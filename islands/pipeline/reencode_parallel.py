"""Parallel re-encode of all videos from cached `.npy` frames.

Bypasses run.py / extract.py so there's no GEE traffic — only local ffmpeg
work. Use this whenever you change build_timelapse.py and want every island
re-rendered (e.g. you removed the burned-in date label).

Each island's encoding runs in its own process so all CPU cores are busy.
ffmpeg's libx264 still uses default threads inside each process; the OS
scheduler time-slices when there's overcommit. With 4 workers on an M-series
machine this finishes ~4x faster than serial.

Usage:
  python reencode_parallel.py                    # all islands, 4 workers
  python reencode_parallel.py --workers 6        # more aggressive
  python reencode_parallel.py --only sand-cay,namyit-island
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_timelapse  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRAMES_DIR = DATA_DIR / "frames_raw"
SITE_DIR = ROOT
VIDEO_DIR = SITE_DIR / "assets" / "videos"
VIDEO_THUMB_DIR = SITE_DIR / "assets" / "videos-thumb"
POSTER_DIR = SITE_DIR / "assets" / "posters"


def encode_one(slug: str) -> tuple[str, float, str | None]:
    """Encode video + thumb + poster for one island. Worker entry point."""
    frames_dir = FRAMES_DIR / slug / "monthly"
    paths = sorted(frames_dir.glob("*.npy"))
    if not paths:
        return slug, 0.0, "no frames cached"
    frames = [(p.stem, np.load(p)) for p in paths]
    video_out = VIDEO_DIR / f"{slug}.mp4"
    thumb_out = VIDEO_THUMB_DIR / f"{slug}.mp4"
    poster_out = POSTER_DIR / f"{slug}.webp"
    t0 = time.time()
    try:
        build_timelapse.build(frames, video_out, thumb_out, poster_out)
    except Exception as e:
        return slug, time.time() - t0, f"{type(e).__name__}: {e}"
    return slug, time.time() - t0, None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--workers", type=int, default=4,
                   help="Parallel encoder processes (default 4)")
    p.add_argument("--only", default=None,
                   help="Comma-separated slugs to process")
    args = p.parse_args()

    manifest = json.loads((ROOT / "manifest.json").read_text())
    slugs = [e["slug"] for e in manifest["islands"]]
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        slugs = [s for s in slugs if s in wanted]

    print(f"re-encoding {len(slugs)} islands with {args.workers} workers")
    started = time.time()
    completed = 0
    fails: list[tuple[str, str]] = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(encode_one, s): s for s in slugs}
        for fut in concurrent.futures.as_completed(futures):
            slug, elapsed, err = fut.result()
            completed += 1
            if err:
                fails.append((slug, err))
                print(f"  [{completed}/{len(slugs)}] FAIL {slug}  ({elapsed:.1f}s)  {err}")
            else:
                print(f"  [{completed}/{len(slugs)}] {slug}  ({elapsed:.1f}s)")

    total = time.time() - started
    ok = len(slugs) - len(fails)
    print(f"\ndone: {ok}/{len(slugs)} ok, {len(fails)} failed, {total:.0f}s wall-clock")
    if fails:
        print("\nfailures:")
        for s, e in fails:
            print(f"  {s}: {e}")


if __name__ == "__main__":
    main()
