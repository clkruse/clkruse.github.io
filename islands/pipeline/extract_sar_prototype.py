"""Prototype Sentinel-1 ship detection for one island.

Approach (CFAR-ish, GEE-server-side):
  1. Pull S1 GRD VV passes for the month (5–6 passes typical, IW mode).
  2. Background = monthly median (stable returns: sea floor, shoreline).
  3. Per-pass excess = pass − background, in dB. Ships punch through the
     background by 8–15 dB; persistent reef returns are at most a few dB.
  4. Threshold the excess, take connected components 4–200 pixels (rejects
     single-pixel speckle and large continuous bright structures).
  5. Reduce to centroid points; ship = (lon, lat).

Returns a small JSON: month → vessel point list. Bandwidth is tiny because
the heavy raster work runs in GEE; we only download centroids.

Run: python extract_sar_prototype.py
Output: ../series/whitsun-reef-vessels.json
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import ee

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import bbox_from_point  # noqa: E402

EE_PROJECT = os.environ.get("EE_PROJECT", "earth-engine-ck")

# Whitsun Reef. Picked because of the well-documented March 2021 maritime-
# militia swarm — a known event we can use to validate detection.
SLUG = "whitsun-reef"
LAT = 9.991
LON = 114.649
BBOX_SIZE_M = 5000.0

# CFAR threshold — pass dB above the monthly median (in linear-space ratio
# converted from dB). 8 dB = ~6.3× brighter than background, comfortably above
# sea clutter; calm sea + a 50 m hull returns 12-20 dB.
THRESHOLD_DB = 8.0

# Connected-component size filter, in 10 m pixels. Small ships (~20 m) span
# 4-9 pixels; large reef-rim runs would span hundreds.
MIN_PIXELS = 4
MAX_PIXELS = 200

START = (2020, 4)
END = (2022, 4)

OUT_PATH = Path(__file__).resolve().parent.parent / "series" / f"{SLUG}-vessels.json"


def month_range(y: int, m: int) -> tuple[str, str]:
    start = f"{y:04d}-{m:02d}-01"
    if m == 12:
        end = f"{y + 1:04d}-01-01"
    else:
        end = f"{y:04d}-{m + 1:02d}-01"
    return start, end


def detect_month(geom: ee.Geometry, year: int, month: int) -> dict:
    start, end = month_range(year, month)
    coll = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(geom)
        .filterDate(start, end)
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .select("VV")
    )
    n_passes = int(coll.size().getInfo())
    if n_passes == 0:
        return {"month": f"{year}-{month:02d}", "passes": 0, "detections": []}

    # Convert dB → natural for math, take median as stable background.
    nat = coll.map(lambda img: ee.Image(10.0).pow(img.divide(10.0)))
    bg = nat.median()
    # Threshold: excess > 10^(THRESHOLD_DB/10) × bg, equivalently log diff > THRESHOLD_DB.
    threshold_ratio = 10.0 ** (THRESHOLD_DB / 10.0)

    def detect_pass(img):
        ratio = img.divide(bg)
        return ratio.gt(threshold_ratio)

    # Union of detections across all passes in the month.
    bright = nat.map(detect_pass).sum().gt(0)

    # Filter components by size.
    masked = bright.selfMask()
    sizes = masked.connectedPixelCount(maxSize=MAX_PIXELS + 1, eightConnected=True)
    valid = sizes.gte(MIN_PIXELS).And(sizes.lte(MAX_PIXELS))
    detections = masked.updateMask(valid)

    vectors = detections.reduceToVectors(
        geometry=geom,
        scale=10,
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
        "passes": n_passes,
        "detections": coords,
    }


def main() -> None:
    ee.Initialize(
        opt_url="https://earthengine-highvolume.googleapis.com",
        project=EE_PROJECT,
    )
    bbox = bbox_from_point(LAT, LON, BBOX_SIZE_M)
    geom = ee.Geometry.Rectangle(bbox.as_list())

    out: list[dict] = []
    y, m = START
    end_y, end_m = END
    while (y, m) <= (end_y, end_m):
        t0 = time.time()
        result = detect_month(geom, y, m)
        elapsed = time.time() - t0
        print(
            f"  {result['month']}: passes={result['passes']:>2}  "
            f"detections={len(result['detections']):>3}  ({elapsed:.1f}s)"
        )
        out.append(result)
        m += 1
        if m == 13:
            m = 1
            y += 1

    bbox_record = {
        "lat": LAT,
        "lon": LON,
        "size_m": BBOX_SIZE_M,
        "west": bbox.west,
        "east": bbox.east,
        "south": bbox.south,
        "north": bbox.north,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps({"slug": SLUG, "bbox": bbox_record, "months": out}, indent=2)
    )
    print(f"\nwrote {OUT_PATH} ({len(out)} months)")


if __name__ == "__main__":
    main()
