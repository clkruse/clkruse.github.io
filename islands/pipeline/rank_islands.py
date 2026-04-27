"""
Rank islands by detected reclamation. Uses pixel-level persistent water→land
flips between a window of early frames and a window of late frames, cleaned
with a morphological opening, scored by the area of the largest connected
component.

Per-frame scene-level water fraction is still computed (only as the
`land_series` time series the lightbox plots) but no longer drives ranking.
The slope/R² approach the previous version used conflated three unrelated
things — real reclamation, monotone seasonal/atmospheric drift, and small
absolute changes inside a 25 km² scene — and produced the false positives
(noisy shallow reefs) and false negatives (small but real builds) that
prompted this rewrite.

Water detection: Normalized Blue-Red Difference Index on raw reflectance,
NBRDI = (B - R) / (B + R). To be replaced with NDWI/NIR-based detection
once extract.py fetches B8.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRAMES_DIR = DATA_DIR / "frames_raw"
GEOJSON_PATH = DATA_DIR / "islands.geojson"
MANIFEST_PATH = DATA_DIR / "manifest.json"
OCCUPIERS_PATH = DATA_DIR / "occupiers.json"
FULL_ARCHIVE_PATH = DATA_DIR / "manifest.full.json"
SITE_MANIFEST = ROOT / "manifest.json"
SERIES_DIR = ROOT / "series"

SLIM_FIELDS = ("slug", "name", "video_thumb", "video", "poster")
DETAIL_FIELDS = (
    "slug", "lat", "lon", "date_range", "frame_count",
    "land_series", "occupier", "claimants",
)

# Group-level claimants. Paracels and Spratlys are each claimed wholesale by
# the PRC, ROC (Taiwan), and Vietnam under the nine-dash / U-shaped line and
# Vietnamese pre-1975 administration; the Philippines' Kalayaan claim covers
# most Spratly features; Malaysia's claim covers the southern Spratlys.
GROUP_CLAIMANTS = {
    "Paracel Islands": ["China", "Taiwan", "Vietnam"],
    "Scarborough Shoal": ["China", "Taiwan", "Philippines"],
    "Spratly Islands": ["China", "Taiwan", "Vietnam", "Philippines", "Malaysia"],
}
DEFAULT_CLAIMANTS = ["China", "Taiwan", "Vietnam"]
# Per-slug additions. Brunei's claim covers a small area in the southern
# Spratlys; Louisa Reef is the canonical example.
EXTRA_CLAIMANTS = {
    "louisa-reef": ["Brunei"],
}

NBRDI_THRESHOLD = 0.05  # pixels with (B-R)/(B+R) above this count as water

# Persistent-change scoring.
# Window of frames at each end. 12 monthly frames smooths over a full annual
# cycle (tides, sun angle, monsoon) so seasonal noise can't sneak through.
WINDOW_MONTHS = 12
# Per-pixel majority vote needs at least this fraction of valid frames within
# the window or the pixel is excluded from the change mask.
MIN_VALID_FRACTION = 0.4
# Morphological opening iterations. 1 drops single scattered noise pixels but
# preserves any structure ≥ 2 px wide (~20 m at 10 m/px source).
OPENING_ITERATIONS = 1


def _water_and_valid(arr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(water, valid) HxW boolean masks for a single raw-reflectance frame."""
    valid = ~np.isnan(arr).any(axis=-1) & (np.nansum(arr, axis=-1) > 0)
    r = arr[..., 0]
    b = arr[..., 2]
    with np.errstate(invalid="ignore", divide="ignore"):
        nbrdi = (b - r) / (b + r + 1e-6)
    water = (nbrdi > NBRDI_THRESHOLD) & valid
    return water, valid


def water_fraction(arr: np.ndarray) -> float:
    water, valid = _water_and_valid(arr)
    denom = int(valid.sum())
    return float(water.sum()) / denom if denom > 0 else 0.0


def _aggregate_window(window_paths: list[Path]) -> tuple[np.ndarray, np.ndarray]:
    """Per-pixel (water_count, valid_count) across the window's frames."""
    water_count = None
    valid_count = None
    for p in window_paths:
        w, v = _water_and_valid(np.load(p))
        if water_count is None:
            water_count = np.zeros(w.shape, dtype=np.int16)
            valid_count = np.zeros(v.shape, dtype=np.int16)
        water_count += w.astype(np.int16)
        valid_count += v.astype(np.int16)
    return water_count, valid_count


def development_score(
    slug: str, cadence: str = "monthly"
) -> dict | None:
    """Persistent water→land area, normalized by valid scene coverage.

    Returns dict with `score`, `area_px`, `compactness`, or None if the cache
    has too few frames to fill both windows.
    """
    frames_dir = FRAMES_DIR / slug / cadence
    paths = sorted(frames_dir.glob("*.npy"))
    if len(paths) < 2 * WINDOW_MONTHS:
        return None

    early = _aggregate_window(paths[:WINDOW_MONTHS])
    late = _aggregate_window(paths[-WINDOW_MONTHS:])
    early_water, early_valid = early
    late_water, late_valid = late
    late_land = late_valid - late_water

    min_valid = WINDOW_MONTHS * MIN_VALID_FRACTION
    early_ok = early_valid >= min_valid
    late_ok = late_valid >= min_valid

    # Strict-majority (>50% of valid frames) so a tied pixel doesn't flip.
    early_is_water = (early_water * 2 > early_valid) & early_ok
    late_is_land = (late_land * 2 > late_valid) & late_ok

    flipped = early_is_water & late_is_land
    cleaned = ndimage.binary_opening(flipped, iterations=OPENING_ITERATIONS)

    # 8-connectivity: corners-touching pixels join the same component.
    labeled, num = ndimage.label(cleaned, structure=np.ones((3, 3), dtype=int))
    coverage = int((early_ok & late_ok).sum())
    if num == 0 or coverage == 0:
        return {"score": 0.0, "area_px": 0, "compactness": 0.0}

    sizes = np.bincount(labeled.ravel())
    sizes[0] = 0  # background label
    largest_label = int(np.argmax(sizes))
    largest_size = int(sizes[largest_label])
    score = largest_size / coverage

    largest_mask = labeled == largest_label
    boundary = largest_mask & ~ndimage.binary_erosion(largest_mask)
    perimeter = int(boundary.sum())
    # 4πA/P²: 1.0 = perfect circle (most-compact possible blob), down toward
    # 0 for jagged/elongated shapes. Reclamation is geometric (runways,
    # polygonal pads) so its compactness lands well above noise blobs that
    # squeak past the opening filter.
    compactness = (4 * np.pi * largest_size / (perimeter ** 2)) if perimeter > 0 else 0.0
    compactness = min(compactness, 1.0)

    return {
        "score": float(score),
        "area_px": int(largest_size),
        "compactness": float(compactness),
    }


def water_series(slug: str, cadence: str = "monthly") -> list[float] | None:
    frames_dir = FRAMES_DIR / slug / cadence
    paths = sorted(frames_dir.glob("*.npy"))
    if len(paths) < 2:
        return None
    return [water_fraction(np.load(p)) for p in paths]


def reject_outliers(
    series: list[float], window: int = 7, threshold: float = 3.0
) -> list[float]:
    """
    Rolling-median baseline + global MAD on residuals.

    Why not purely local MAD: consecutive bad frames (e.g. a 3-month stretch
    of cloud-contaminated extractions) inflate the local MAD enough that the
    outliers hide each other. Computing residuals from a rolling-median
    baseline and then taking a GLOBAL MAD on those residuals gives each
    outlier a stable yardstick — they can't collude to raise the threshold.

    Replaces flagged points with the rolling-median baseline value.
    """
    arr = np.array(series, dtype=np.float64)
    n = len(arr)
    half = window // 2

    baseline = np.empty(n)
    for i in range(n):
        lo = max(0, i - half)
        hi = min(n, i + half + 1)
        baseline[i] = np.median(arr[lo:hi])

    residuals = arr - baseline
    mad = np.median(np.abs(residuals - np.median(residuals)))
    if mad <= 0:
        return arr.tolist()

    z = np.abs(residuals) / (mad * 1.4826)
    cleaned = np.where(z > threshold, baseline, arr)
    return cleaned.tolist()


def _slugify(s: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", s.strip().lower()).strip("-")


def load_groups() -> dict[str, str]:
    gj = json.loads(GEOJSON_PATH.read_text())
    out: dict[str, str] = {}
    for f in gj["features"]:
        p = f.get("properties") or {}
        name = p.get("name") or ""
        if not name:
            continue
        slug = _slugify(p.get("slug") or name)
        group = p.get("group")
        if group:
            out[slug] = group
    return out


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    occupiers = json.loads(OCCUPIERS_PATH.read_text())
    groups = load_groups()
    for entry in manifest["islands"]:
        slug = entry["slug"]
        entry["occupier"] = occupiers.get(slug, "Disputed")
        claimants = list(GROUP_CLAIMANTS.get(groups.get(slug, ""), DEFAULT_CLAIMANTS))
        for extra in EXTRA_CLAIMANTS.get(slug, []):
            if extra not in claimants:
                claimants.append(extra)
        # Defensive: if an island is occupied by a nation not yet in the
        # claimants list (data inconsistency), include it so the lightbox
        # never shows "Occupied by X · Also claimed by [list without X]".
        if entry["occupier"] != "Disputed" and entry["occupier"] not in claimants:
            claimants.append(entry["occupier"])
        entry["claimants"] = claimants
        ws = water_series(slug)
        if ws is None or len(ws) < 2:
            entry["land_series"] = []
            entry["land_first"] = 0.0
            entry["land_last"] = 0.0
            entry["growth"] = 0.0
        else:
            cleaned = reject_outliers([1.0 - w for w in ws])
            entry["land_series"] = [round(v, 4) for v in cleaned]
            entry["land_first"] = round(cleaned[0], 4)
            entry["land_last"] = round(cleaned[-1], 4)
            entry["growth"] = round(cleaned[-1] - cleaned[0], 4)

        dev = development_score(entry["slug"])
        if dev is None:
            entry["development_score"] = 0.0
            entry["dev_area_px"] = 0
            entry["dev_compactness"] = 0.0
        else:
            entry["development_score"] = round(dev["score"], 5)
            entry["dev_area_px"] = dev["area_px"]
            entry["dev_compactness"] = round(dev["compactness"], 4)

    manifest["islands"].sort(key=lambda x: -x.get("development_score", 0.0))

    FULL_ARCHIVE_PATH.write_text(json.dumps(manifest, indent=2))

    SERIES_DIR.mkdir(parents=True, exist_ok=True)
    slim = {"islands": [{k: e[k] for k in SLIM_FIELDS} for e in manifest["islands"]]}
    SITE_MANIFEST.write_text(json.dumps(slim, separators=(",", ":")))
    for e in manifest["islands"]:
        detail = {k: e[k] for k in DETAIL_FIELDS}
        (SERIES_DIR / f"{e['slug']}.json").write_text(
            json.dumps(detail, separators=(",", ":"))
        )

    print(f"{'slug':<25} {'score':>8} {'area_px':>8} {'compact':>8} {'growth':>8}")
    for e in manifest["islands"]:
        print(
            f"{e['slug']:<25} "
            f"{e['development_score']:>8.4f} "
            f"{e['dev_area_px']:>8} "
            f"{e['dev_compactness']:>8.3f} "
            f"{e['growth']:>+8.3f}"
        )


if __name__ == "__main__":
    main()
