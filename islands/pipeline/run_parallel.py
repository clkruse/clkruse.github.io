"""Parallel orchestrator for run.py's process_island.

run.py iterates islands sequentially; one cache miss per island serialises
the whole batch when many coords change. This wrapper calls process_island
from a thread pool so multiple islands extract from GEE in parallel. Each
worker still uses run.py's intra-island 16-way ThreadPoolExecutor for the
per-period GEE requests.

Defaults match run.py exactly. Use --only to restrict, --workers to dial
parallelism (start at 4; bump if GEE keeps up).

Usage:
  python run_parallel.py                          # all islands, 4 workers
  python run_parallel.py --workers 6
  python run_parallel.py --only sand-cay,namyit-island
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract  # noqa: E402
import run as run_mod  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
MANIFEST_PATH = DATA_DIR / "manifest.json"

log = logging.getLogger("island-map.parallel")


def process_one(entry: dict, args: argparse.Namespace) -> tuple[str, dict | None, str | None]:
    try:
        result = run_mod.process_island(
            entry,
            args.start_year,
            args.end_year,
            args.size_m,
            args.size_px,
            args.cadence,
            last_n=args.last_n,
            force_rebuild=args.force_rebuild,
        )
    except Exception as e:
        return entry["slug"], None, f"{type(e).__name__}: {e}"
    return entry["slug"], result, None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, default=DATA_DIR / "islands.geojson")
    p.add_argument("--start-year", type=int, default=run_mod.DEFAULT_START_YEAR)
    p.add_argument("--end-year", type=int, default=run_mod.DEFAULT_END_YEAR)
    p.add_argument("--size-m", type=float, default=run_mod.DEFAULT_SIZE_M)
    p.add_argument("--size-px", type=int, default=run_mod.DEFAULT_SIZE_PX)
    p.add_argument("--cadence", choices=["monthly", "quarterly"],
                   default=run_mod.DEFAULT_CADENCE)
    p.add_argument("--only", default=None,
                   help="Comma-separated slugs to process (filters the geojson).")
    p.add_argument("--last-n", type=int, default=None,
                   help="Process only the last N cadence periods (smoke tests).")
    p.add_argument("--force-rebuild", action="store_true")
    p.add_argument("--workers", type=int, default=4,
                   help="Islands processed in parallel (default 4).")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    features = run_mod.load_features(args.input)
    entries = [run_mod.feature_to_entry(f, i) for i, f in enumerate(features)]
    geojson_order = [e["slug"] for e in entries]

    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        entries = [e for e in entries if e["slug"] in wanted]

    # Warm up Earth Engine in the main thread before workers race for it.
    extract.ensure_initialized()

    print(f"processing {len(entries)} islands with {args.workers} workers")
    started = time.time()
    completed = 0
    results: dict[str, dict] = {}
    fails: list[tuple[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(process_one, e, args): e for e in entries}
        for fut in concurrent.futures.as_completed(futures):
            entry = futures[fut]
            slug, result, err = fut.result()
            completed += 1
            if err:
                fails.append((slug, err))
                print(f"  [{completed}/{len(entries)}] FAIL {slug}  {err}")
            elif result is None:
                fails.append((slug, "no usable frames"))
                print(f"  [{completed}/{len(entries)}] SKIP {slug}  (no frames)")
            else:
                results[slug] = result
                print(f"  [{completed}/{len(entries)}] {slug}")

    # Build the intermediate manifest. If --only was used, merge with the
    # existing one so untouched islands stay represented; otherwise emit only
    # this run's results in the geojson's natural order.
    if args.only and MANIFEST_PATH.exists():
        existing = json.loads(MANIFEST_PATH.read_text()).get("islands", [])
        by_slug = {e["slug"]: e for e in existing}
        for slug, result in results.items():
            by_slug[slug] = result
        # Preserve geojson ordering for slugs we know about; append any leftovers.
        ordered = [by_slug[s] for s in geojson_order if s in by_slug]
        leftovers = [e for e in by_slug.values() if e["slug"] not in set(geojson_order)]
        all_entries = ordered + leftovers
    else:
        all_entries = [results[s] for s in geojson_order if s in results]

    MANIFEST_PATH.write_text(json.dumps({"islands": all_entries}, indent=2))

    elapsed = time.time() - started
    ok = len(results)
    print(f"\nwrote {MANIFEST_PATH}: {len(all_entries)} islands")
    print(f"done: {ok}/{len(entries)} ok, {len(fails)} failed, {elapsed:.0f}s wall-clock")
    if fails:
        print("\nfailures:")
        for slug, err in fails:
            print(f"  {slug}: {err}")


if __name__ == "__main__":
    main()
