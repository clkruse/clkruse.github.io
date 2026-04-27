"""Parallel orchestrator: pull AIS + VIIRS detections for every island and
write the merged `series/<slug>-vessels.json` files the lightbox loads.

Parallelism layout:
  - Top-level: N island workers (ThreadPool). Each worker fully processes one
    island (AIS + VIIRS + merge).
  - Inside each worker: AIS pulls 8 yearly windows in parallel; VIIRS pulls
    88 monthly GEE calls in parallel.

Both APIs (GFW Cloudflare-fronted gateway and Earth Engine) tolerate this
concurrency level in practice. Tweak --island-workers if you trip 429/5xx.

Skips islands that already have a `<slug>-vessels.json` unless --force.

Usage:
  python extract_vessels_all.py                # all pending
  python extract_vessels_all.py --only sand-cay,namyit-island
  python extract_vessels_all.py --force        # redo everything
  python extract_vessels_all.py --island-workers 6
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_vessels_ais as ais_mod
import extract_vessels_viirs as viirs_mod

ROOT = Path(__file__).resolve().parent.parent
SERIES_DIR = ROOT / "series"


def merge(ais: dict, viirs: dict) -> dict:
    """Merge VIIRS detection coordinates into AIS month buckets in place."""
    by_month = {m["month"]: m["detections"] for m in viirs["months"]}
    for m in ais["months"]:
        for det in by_month.get(m["month"], []):
            m["detections"].append(det)
    ais["source"] = "GFW AIS Vessel Presence + NOAA VIIRS DNB monthly radiance"
    return ais


def process_one(slug: str, ais_workers: int, viirs_workers: int) -> tuple[str, int, float, str | None]:
    """Run AIS + VIIRS for one slug, write merged file. Returns
    (slug, total_detections, elapsed_seconds, error_or_None)."""
    t0 = time.time()
    try:
        ais = ais_mod.extract_for_slug(slug, max_workers=ais_workers, verbose=False)
        viirs = viirs_mod.extract_for_slug(slug, max_workers=viirs_workers, verbose=False)
        merged = merge(ais, viirs)
        out_path = SERIES_DIR / f"{slug}-vessels.json"
        out_path.write_text(json.dumps(merged))
        # The standalone -viirs.json is no longer needed once merged.
        viirs_only = SERIES_DIR / f"{slug}-vessels-viirs.json"
        if viirs_only.exists():
            viirs_only.unlink()
        total = sum(len(m["detections"]) for m in merged["months"])
        return slug, total, time.time() - t0, None
    except Exception as e:
        return slug, 0, time.time() - t0, f"{type(e).__name__}: {e}"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--island-workers", type=int, default=4,
                   help="Islands processed in parallel (default 4)")
    p.add_argument("--ais-workers", type=int, default=4,
                   help="Per-island AIS yearly-window concurrency (default 4)")
    p.add_argument("--viirs-workers", type=int, default=8,
                   help="Per-island VIIRS monthly-call concurrency (default 8)")
    p.add_argument("--force", action="store_true",
                   help="Re-extract even if vessels.json already exists")
    p.add_argument("--only", default=None,
                   help="Comma-separated slugs to process (filters the list)")
    args = p.parse_args()

    manifest = json.loads((ROOT / "manifest.json").read_text())
    all_slugs = [e["slug"] for e in manifest["islands"]]

    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        all_slugs = [s for s in all_slugs if s in wanted]

    if args.force:
        pending = all_slugs
    else:
        pending = [s for s in all_slugs if not (SERIES_DIR / f"{s}-vessels.json").exists()]

    skipped = len(all_slugs) - len(pending)
    print(f"processing {len(pending)} islands ({skipped} already have vessels data)")
    print(f"workers: {args.island_workers} islands × ({args.ais_workers} AIS + {args.viirs_workers} VIIRS)")
    if not pending:
        return

    # Warm up GEE auth in the main thread before workers race for it.
    viirs_mod.ensure_ee_initialized()

    started = time.time()
    completed = 0
    fails: list[tuple[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.island_workers) as ex:
        futures = {
            ex.submit(process_one, s, args.ais_workers, args.viirs_workers): s
            for s in pending
        }
        for fut in concurrent.futures.as_completed(futures):
            slug, total, elapsed, err = fut.result()
            completed += 1
            if err:
                fails.append((slug, err))
                print(f"  [{completed}/{len(pending)}] FAIL {slug}  ({elapsed:.1f}s)  {err}")
            else:
                print(f"  [{completed}/{len(pending)}] {slug}  total={total:<5} ({elapsed:.1f}s)")

    total_elapsed = time.time() - started
    ok = len(pending) - len(fails)
    print(f"\ndone: {ok}/{len(pending)} ok, {len(fails)} failed, {total_elapsed:.0f}s wall-clock")
    if fails:
        print("\nfailures:")
        for slug, err in fails:
            print(f"  {slug}: {err}")


if __name__ == "__main__":
    main()
