"""GEE extraction: Sentinel-2 composites as raw reflectance arrays."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import ee
import numpy as np
from google.api_core import retry

from utils import BBox, bbox_from_point

EE_PROJECT_DEFAULT = os.environ.get("EE_PROJECT", "earth-engine-ck")
RGB_BANDS = ["B4", "B3", "B2"]
RESOLUTION_M = 10
DEFAULT_CLEAR_THRESHOLD = 0.65
SR_AVAILABLE_FROM = "2019-01-01"
# p25 over the clear-masked collection picks the darkest-quartile observation
# per pixel — i.e. the cleanest, least-hazy sample of water/reef/sand.
COMPOSITE_PERCENTILE = 25
L1C_THRESHOLD = 0.4  # pre-2019 fallback: sparser data, looser mask

_initialized = False


def ensure_initialized(project: str = EE_PROJECT_DEFAULT) -> None:
    global _initialized
    if _initialized:
        return
    ee.Initialize(
        opt_url="https://earthengine-highvolume.googleapis.com",
        project=project,
    )
    _initialized = True


def build_s2_composite(
    bbox: BBox,
    start_date: str,
    end_date: str,
    clear_threshold: float = DEFAULT_CLEAR_THRESHOLD,
) -> ee.Image:
    geom = ee.Geometry.Rectangle(bbox.as_list())
    is_sr = end_date > SR_AVAILABLE_FROM
    collection_id = (
        "COPERNICUS/S2_SR_HARMONIZED" if is_sr else "COPERNICUS/S2_HARMONIZED"
    )
    cs = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")
    qa = "cs_cdf"
    clear = clear_threshold if is_sr else L1C_THRESHOLD
    bands = RGB_BANDS if is_sr else [*RGB_BANDS, qa]
    coll = (
        ee.ImageCollection(collection_id)
        .filterBounds(geom)
        .filterDate(start_date, end_date)
        .linkCollection(cs, [qa])
        .map(lambda img: img.updateMask(img.select(qa).gte(clear)))
        .select(bands)
    )
    if is_sr:
        return coll.reduce(
            ee.Reducer.percentile([COMPOSITE_PERCENTILE])
        ).rename(RGB_BANDS)
    # Pre-2019: qualityMosaic picks the single best observation per pixel.
    return coll.qualityMosaic(qa).select(RGB_BANDS)


@retry.Retry(timeout=240)
def fetch_pixels(composite: ee.Image, bbox: BBox, size_px: int) -> np.ndarray:
    """Return HxWx3 float32 array of raw reflectance (NaN where masked)."""
    geom = ee.Geometry.Rectangle(bbox.as_list())
    clipped = composite.clipToBoundsAndScale(
        geometry=geom, width=size_px, height=size_px
    )
    raw = ee.data.computePixels(
        {
            "bandIds": RGB_BANDS,
            "expression": clipped,
            "fileFormat": "NUMPY_NDARRAY",
        }
    )
    return np.stack([raw[b] for b in RGB_BANDS], axis=-1).astype(np.float32)


def extract_raw(
    bbox: BBox,
    start_date: str,
    end_date: str,
    size_px: int,
    clear_threshold: float = DEFAULT_CLEAR_THRESHOLD,
) -> tuple[np.ndarray, float]:
    """Raw reflectance + masked fraction. Callers apply stretch/display."""
    ensure_initialized()
    composite = build_s2_composite(bbox, start_date, end_date, clear_threshold)
    pixels = fetch_pixels(composite, bbox, size_px)
    nan_mask = np.isnan(pixels).any(axis=-1) | (np.nansum(pixels, axis=-1) == 0)
    return pixels, float(nan_mask.mean())


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--start", required=True, help="YYYY-MM-DD")
    p.add_argument("--end", required=True, help="YYYY-MM-DD exclusive")
    p.add_argument("--size-m", type=float, default=5000.0)
    p.add_argument("--size-px", type=int, default=500)
    p.add_argument("--clear-threshold", type=float, default=DEFAULT_CLEAR_THRESHOLD)
    p.add_argument("--out", type=Path, required=True, help="raw .npy output")
    args = p.parse_args()

    bbox = bbox_from_point(args.lat, args.lon, args.size_m)
    pixels, masked = extract_raw(
        bbox, args.start, args.end, args.size_px, args.clear_threshold
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    np.save(args.out, pixels)
    print(f"wrote {args.out} shape={pixels.shape} masked={masked:.2%}")


if __name__ == "__main__":
    main()
