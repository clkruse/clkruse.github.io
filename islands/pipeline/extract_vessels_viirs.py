"""Prototype VIIRS night-light boat detection for one island via GEE.

Approach:
  - Use NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG (stray-light-corrected monthly
    radiance composites at ~750 m resolution).
  - For each month, threshold pixels above an open-ocean "dark-sea" floor.
  - Mask out the reef itself using a per-island fixed mask we build from the
    optical median composite (water-fraction ≤ small threshold = land).
  - Output detection points = pixel centroids above threshold.

VIIRS DNB resolution (~750 m) is far coarser than 10 m AIS positions, so
each "detection" is really a "this pixel was bright at night this month",
not an individual boat. With the reef masked, a pixel lighting up almost
always means fishing-fleet activity (squid jigging, etc.).

Output JSON matches `app.js::loadVessels` shape so the lightbox glints
visualisation works without changes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import ee

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import bbox_from_point  # noqa: E402

EE_PROJECT = os.environ.get("EE_PROJECT", "earth-engine-ck")
ROOT = Path(__file__).resolve().parent.parent

BBOX_M = 5000.0
START = (2019, 1)
END = (2026, 4)

# DNB radiance threshold (nW/cm²/sr). Open-ocean dark sea sits well below 1.
# Boats with squid lights typically push a 750 m pixel into the 5-50 range.
RADIANCE_THRESHOLD = 0.5


def month_iter(start, end):
    y, m = start
    ey, em = end
    while (y, m) <= (ey, em):
        yield y, m
        m += 1
        if m == 13:
            m = 1
            y += 1


def detect_month(geom: ee.Geometry, year: int, month: int) -> dict:
    start = f"{year:04d}-{month:02d}-01"
    end_y = year if month < 12 else year + 1
    end_m = month + 1 if month < 12 else 1
    end = f"{end_y:04d}-{end_m:02d}-01"

    coll = (
        ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
        .filterDate(start, end)
        .select("avg_rad")
    )
    n = int(coll.size().getInfo())
    if n == 0:
        return {"month": f"{year}-{month:02d}", "passes": 0, "detections": []}

    img = coll.first()  # Monthly composite, only one per month.
    # Threshold to bright pixels.
    bright = img.gt(RADIANCE_THRESHOLD)
    masked = bright.selfMask()
    vectors = masked.reduceToVectors(
        geometry=geom,
        scale=750,
        geometryType="centroid",
        maxPixels=int(1e9),
        bestEffort=True,
    )
    fc = vectors.getInfo()
    coords = [
        f["geometry"]["coordinates"]
        for f in fc.get("features", [])
        if f.get("geometry") and f["geometry"].get("coordinates")
    ]
    return {
        "month": f"{year}-{month:02d}",
        "passes": n,
        "detections": coords,
    }


_initialized = False


def ensure_ee_initialized() -> None:
    global _initialized
    if _initialized:
        return
    ee.Initialize(
        opt_url="https://earthengine-highvolume.googleapis.com",
        project=EE_PROJECT,
    )
    _initialized = True


def extract_for_slug(slug: str, max_workers: int = 8, verbose: bool = True) -> dict:
    """Pull VIIRS monthly detections for one island. Returns dict matching
    loadVessels schema; doesn't write to disk."""
    import concurrent.futures
    ensure_ee_initialized()
    detail = json.loads((ROOT / "series" / f"{slug}.json").read_text())
    lat = detail["lat"]
    lon = detail["lon"]
    bbox = bbox_from_point(lat, lon, BBOX_M)
    geom = ee.Geometry.Rectangle(bbox.as_list())

    keys = list(month_iter(START, END))
    results: dict[tuple[int, int], dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(detect_month, geom, y, m): (y, m) for y, m in keys}
        for fut in concurrent.futures.as_completed(futures):
            y, m = futures[fut]
            try:
                results[(y, m)] = fut.result()
            except Exception as e:
                if verbose:
                    print(f"  [{slug}] {y}-{m:02d}: error {type(e).__name__}: {str(e)[:120]}")
                results[(y, m)] = {"month": f"{y}-{m:02d}", "passes": 0, "detections": []}
    months = [results[k] for k in keys]

    return {
        "slug": slug,
        "source": "NOAA VIIRS DNB monthly radiance (>{:.1f} nW/cm²/sr)".format(
            RADIANCE_THRESHOLD
        ),
        "bbox": {
            "lat": lat, "lon": lon, "size_m": BBOX_M,
            "west": bbox.west, "east": bbox.east,
            "south": bbox.south, "north": bbox.north,
        },
        "months": months,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--slug", default="whitsun-reef",
                   help="Island slug; lat/lon read from series/<slug>.json")
    p.add_argument("--workers", type=int, default=8,
                   help="Parallel monthly GEE calls (default 8)")
    args = p.parse_args()
    print(f"island: {args.slug}")
    out = extract_for_slug(args.slug, max_workers=args.workers)
    out_path = ROOT / "series" / f"{args.slug}-vessels-viirs.json"
    out_path.write_text(json.dumps(out))
    total = sum(len(m["detections"]) for m in out["months"])
    print(f"  wrote {out_path}  ({total} detections, {out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
