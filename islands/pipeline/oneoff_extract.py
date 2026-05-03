"""One-off timelapse for an arbitrary lat/lon.

Doesn't touch the site's manifest, series, assets, or frames_raw cache —
all outputs land under /tmp/oneoff/<slug>/. Mirrors run.py's defaults for
the bbox, monthly cadence, ±60-day composite window, and the SKIP_IF_MASKED
floor so the imagery quality matches what the site produces.

Usage:
  python oneoff_extract.py --lat -2.1645 --lon -68.6755 --slug amazon-test
"""

from __future__ import annotations

import argparse
import concurrent.futures
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_timelapse  # noqa: E402
import extract  # noqa: E402
from utils import bbox_from_point, cadence_ranges  # noqa: E402

OUT_ROOT = Path("/tmp/oneoff")

# Match run.py's defaults so the output is comparable to site videos.
DEFAULT_START_YEAR = 2019
DEFAULT_END_YEAR = date.today().year
DEFAULT_SIZE_M = 5000.0
DEFAULT_SIZE_PX = 500
COMPOSITE_WINDOW_DAYS = 60
MAX_PARALLEL = 16
SKIP_IF_MASKED_ABOVE = 0.8


def widen(start: str, end: str, window_days: int) -> tuple[str, str]:
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    center = s + (e - s) / 2
    half = window_days // 2
    return (
        (center - timedelta(days=half)).isoformat(),
        (center + timedelta(days=half)).isoformat(),
    )


def extract_period(bbox, label, start, end, size_px):
    try:
        pixels, masked = extract.extract_raw(bbox, start, end, size_px)
    except Exception as e:
        return label, None, f"error {type(e).__name__}: {str(e)[:120]}"
    if masked > SKIP_IF_MASKED_ABOVE:
        return label, None, f"masked {masked:.0%}"
    return label, pixels, None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--slug", default="oneoff")
    p.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR)
    p.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)
    p.add_argument("--size-m", type=float, default=DEFAULT_SIZE_M)
    p.add_argument("--size-px", type=int, default=DEFAULT_SIZE_PX)
    p.add_argument("--cadence", choices=["monthly", "quarterly"], default="monthly")
    args = p.parse_args()

    out_dir = OUT_ROOT / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)

    extract.ensure_initialized()
    bbox = bbox_from_point(args.lat, args.lon, args.size_m)
    print(f"slug:    {args.slug}")
    print(f"center:  ({args.lat:.4f}, {args.lon:.4f})")
    print(f"bbox:    {bbox.as_list()}")

    periods = cadence_ranges(args.cadence, args.start_year, args.end_year)
    if COMPOSITE_WINDOW_DAYS > 0:
        periods = [(label, *widen(s, e, COMPOSITE_WINDOW_DAYS)) for (label, s, e) in periods]
    print(f"periods: {len(periods)} ({args.cadence}, {args.start_year}–{args.end_year})")
    print()

    started = time.time()
    raw_results: dict[str, np.ndarray] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_PARALLEL) as ex:
        futures = {
            ex.submit(extract_period, bbox, label, s, e, args.size_px): label
            for (label, s, e) in periods
        }
        completed = 0
        for fut in concurrent.futures.as_completed(futures):
            label, pixels, err = fut.result()
            completed += 1
            if pixels is None:
                print(f"  [{completed}/{len(periods)}] {label}  skipped ({err})")
            else:
                raw_results[label] = pixels
                print(f"  [{completed}/{len(periods)}] {label}  ok")

    # Sort by chronological label so the timelapse plays in order.
    ordered = [(label, raw_results[label]) for label, _, _ in periods if label in raw_results]
    print(f"\nextracted {len(ordered)} usable frames in {time.time() - started:.0f}s")
    if not ordered:
        print("no usable frames; aborting")
        return

    video_out = out_dir / f"{args.slug}.mp4"
    thumb_out = out_dir / f"{args.slug}-thumb.mp4"
    poster_out = out_dir / f"{args.slug}.webp"
    t0 = time.time()
    build_timelapse.build(ordered, video_out, thumb_out, poster_out)
    print(f"encoded in {time.time() - t0:.0f}s")
    print()
    for p in (video_out, thumb_out, poster_out):
        if p.exists():
            print(f"  {p}  ({p.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
