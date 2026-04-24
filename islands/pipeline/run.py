"""Orchestrator: islands.geojson -> per-island MP4 + manifest.json."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import logging
from datetime import date, timedelta
from pathlib import Path

import geopandas as gpd
import numpy as np
from tqdm import tqdm

import build_timelapse
import extract
from utils import BBox, bbox_from_point, cadence_ranges, slugify

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRAMES_DIR = DATA_DIR / "frames_raw"
# The published site lives at ROOT directly (there is no `docs/` subdir).
SITE_DIR = ROOT
VIDEO_DIR = SITE_DIR / "assets" / "videos"
VIDEO_THUMB_DIR = SITE_DIR / "assets" / "videos-thumb"
POSTER_DIR = SITE_DIR / "assets" / "posters"

DEFAULT_START_YEAR = 2019
DEFAULT_END_YEAR = date.today().year
DEFAULT_CADENCE = "monthly"
DEFAULT_SIZE_M = 5000.0
DEFAULT_SIZE_PX = 500
# Rolling composite window: each frame's GEE query pulls observations from
# ±WINDOW_DAYS/2 around the month's center, giving the p25 reducer more
# candidates to pick clean pixels from. Keeps the monthly cadence but
# roughly doubles the per-frame observation count.
COMPOSITE_WINDOW_DAYS = 60
MAX_PARALLEL_QUARTERS = 16
SKIP_IF_MASKED_ABOVE = 0.8

log = logging.getLogger("island-map")


def feature_to_entry(feature: dict, idx: int) -> dict:
    props = feature.get("properties") or {}
    name = props.get("name") or props.get("Name") or f"Island {idx + 1}"
    slug = slugify(props.get("slug") or name)
    geom = feature["geometry"]
    if geom["type"] == "Point":
        lon, lat = geom["coordinates"][:2]
    else:
        shp = gpd.GeoDataFrame.from_features([feature]).geometry.iloc[0]
        c = shp.centroid
        lon, lat = float(c.x), float(c.y)
    return {"name": name, "slug": slug, "lat": float(lat), "lon": float(lon)}


def _widen(start: str, end: str, window_days: int) -> tuple[str, str]:
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    center = s + (e - s) / 2
    half = window_days // 2
    return (
        (center - timedelta(days=half)).isoformat(),
        (center + timedelta(days=half)).isoformat(),
    )


def _extract_period(
    bbox: BBox,
    label: str,
    start: str,
    end: str,
    size_px: int,
    out_path: Path,
) -> tuple[str, Path | None]:
    if out_path.exists():
        return label, out_path
    try:
        pixels, masked = extract.extract_raw(bbox, start, end, size_px)
    except Exception as e:
        log.warning("  %s: extract failed (%s)", label, e)
        return label, None
    if masked > SKIP_IF_MASKED_ABOVE:
        log.info("  %s: skipped (%.0f%% masked)", label, masked * 100)
        return label, None
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_name(out_path.stem + ".tmp.npy")
    np.save(tmp.with_suffix(""), pixels)
    tmp.replace(out_path)
    return label, out_path


def process_island(
    entry: dict,
    start_year: int,
    end_year: int,
    size_m: float,
    size_px: int,
    cadence: str,
) -> dict | None:
    bbox = bbox_from_point(entry["lat"], entry["lon"], size_m)
    periods = cadence_ranges(cadence, start_year, end_year)
    if COMPOSITE_WINDOW_DAYS > 0:
        periods = [
            (label, *_widen(s, e, COMPOSITE_WINDOW_DAYS))
            for (label, s, e) in periods
        ]
    island_frames_dir = FRAMES_DIR / entry["slug"] / cadence
    island_frames_dir.mkdir(parents=True, exist_ok=True)

    # Coord-tracking: if the cache was built with a different coord, wipe
    # it so the new coord's frames replace the stale ones. Otherwise moving
    # a point in the geojson silently reuses data from the old location.
    meta_path = FRAMES_DIR / entry["slug"] / "meta.json"
    coord_key = {
        "lat": round(entry["lat"], 6),
        "lon": round(entry["lon"], 6),
        "size_m": size_m,
    }
    if meta_path.exists():
        prior = json.loads(meta_path.read_text())
        if prior != coord_key:
            log.info("%s: coord changed, invalidating cache", entry["name"])
            for f in island_frames_dir.glob("*.npy"):
                f.unlink()
    meta_path.write_text(json.dumps(coord_key, indent=2))

    log.info("Extracting %s (%d %s periods)", entry["name"], len(periods), cadence)
    extract.ensure_initialized()

    collected: dict[str, Path] = {}
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=MAX_PARALLEL_QUARTERS
    ) as ex:
        futures = {
            ex.submit(
                _extract_period,
                bbox,
                label,
                start,
                end,
                size_px,
                island_frames_dir / f"{label}.npy",
            ): label
            for label, start, end in periods
        }
        for fut in tqdm(
            concurrent.futures.as_completed(futures),
            total=len(futures),
            desc=entry["slug"],
        ):
            label, path = fut.result()
            if path is not None:
                collected[label] = path

    ordered_paths = [
        (label, collected[label]) for label, _, _ in periods if label in collected
    ]
    if not ordered_paths:
        log.warning("%s: no usable frames, skipping", entry["name"])
        return None

    frames = [(label, np.load(path)) for label, path in ordered_paths]
    slug = entry["slug"]
    video_out = VIDEO_DIR / f"{slug}.mp4"
    video_thumb_out = VIDEO_THUMB_DIR / f"{slug}.mp4"
    poster_out = POSTER_DIR / f"{slug}.webp"
    build_timelapse.build(frames, video_out, video_thumb_out, poster_out)
    log.info("%s: wrote %d frames -> %s", entry["name"], len(frames), video_out.name)

    return {
        "slug": slug,
        "name": entry["name"],
        "lat": entry["lat"],
        "lon": entry["lon"],
        "video": f"assets/videos/{slug}.mp4",
        "video_thumb": f"assets/videos-thumb/{slug}.mp4",
        "poster": f"assets/posters/{slug}.webp",
        "date_range": [frames[0][0], frames[-1][0]],
        "frame_count": len(frames),
    }


def load_features(path: Path) -> list[dict]:
    with path.open() as f:
        gj = json.load(f)
    if gj.get("type") == "FeatureCollection":
        return gj["features"]
    if gj.get("type") == "Feature":
        return [gj]
    raise ValueError(f"unsupported geojson: {gj.get('type')}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, default=DATA_DIR / "islands.geojson")
    p.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR)
    p.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)
    p.add_argument("--size-m", type=float, default=DEFAULT_SIZE_M)
    p.add_argument("--size-px", type=int, default=DEFAULT_SIZE_PX)
    p.add_argument(
        "--cadence", choices=["monthly", "quarterly"], default=DEFAULT_CADENCE
    )
    p.add_argument("--test", action="store_true",
                   help="Process only the first feature in the geojson.")
    p.add_argument("--limit", type=int, default=None,
                   help="Process only the first N features in the geojson.")
    p.add_argument("--only", default=None,
                   help="Comma-separated slugs to process (filters the geojson).")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    features = load_features(args.input)
    entries = [feature_to_entry(f, i) for i, f in enumerate(features)]
    if args.test:
        entries = entries[:1]
    if args.limit is not None:
        entries = entries[: args.limit]
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        entries = [e for e in entries if e["slug"] in wanted]

    # Intermediate, pre-ranking archive. The site-facing slim manifest +
    # series/*.json files are written by rank_islands.py after this finishes.
    manifest_path = DATA_DIR / "manifest.json"

    def write_manifest(entries: list[dict]) -> None:
        manifest_path.write_text(json.dumps({"islands": entries}, indent=2))

    manifest_entries: list[dict] = []
    for i, entry in enumerate(entries, 1):
        log.info("[%d/%d] %s", i, len(entries), entry["name"])
        result = process_island(
            entry,
            args.start_year,
            args.end_year,
            args.size_m,
            args.size_px,
            args.cadence,
        )
        if result is not None:
            manifest_entries.append(result)
            write_manifest(manifest_entries)

    write_manifest(manifest_entries)
    log.info("manifest: %d islands", len(manifest_entries))


if __name__ == "__main__":
    main()
