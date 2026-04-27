"""Pull GFW AIS Vessel Presence per-month detections for one island.

Endpoint: POST /v3/4wings/report with format=JSON.
Dataset:  public-global-presence:latest (AIS-broadcasting vessels, monthly).

Output JSON matches the shape `app.js::loadVessels` already expects:
  {
    "slug": ...,
    "source": "GFW AIS Vessel Presence",
    "bbox": { lat, lon, size_m, west, east, south, north },
    "months": [{ "month": "YYYY-MM", "detections": [[lon, lat], ...] }, ...]
  }

Each detection is one vessel-cell-month entry from the API. A vessel that
moves through several 0.01° cells in one month produces multiple glints,
which is the right behaviour for the visualization.

Caveat: AIS misses vessels with their transponder off. The Whitsun-2021
maritime-militia swarm is largely invisible here for that reason. AIS still
captures legitimate fishing + commercial traffic across all 130 islands.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import bbox_from_point  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TOKEN_PATH = ROOT / ".gfw_token"
TOKEN = TOKEN_PATH.read_text().strip()

API = "https://gateway.api.globalfishingwatch.org/v3/4wings/report"
DATASET = "public-global-presence:latest"

BBOX_M = 5000.0
START = (2019, 1)
END = (2026, 4)


def month_iter(start: tuple[int, int], end: tuple[int, int]):
    y, m = start
    ey, em = end
    while (y, m) <= (ey, em):
        yield y, m
        m += 1
        if m == 13:
            m = 1
            y += 1


def yearly_windows(start: tuple[int, int], end: tuple[int, int]):
    """Yield (start_date, end_date) tuples ≤ 366 days each."""
    y, m = start
    ey, em = end
    while y <= ey:
        win_start = f"{y:04d}-{m:02d}-01"
        if y == ey:
            # End-of-month for the last requested month.
            win_end = f"{ey:04d}-{em:02d}-28"  # 28 keeps us safe across all months
        else:
            win_end = f"{y:04d}-12-31"
        yield win_start, win_end
        y += 1
        m = 1


def fetch_window(geojson_polygon: dict, start: str, end: str) -> dict:
    qs = urllib.parse.urlencode([
        ("spatial-resolution", "HIGH"),
        ("temporal-resolution", "MONTHLY"),
        ("datasets[0]", DATASET),
        ("date-range", f"{start},{end}"),
        ("format", "JSON"),
    ])
    url = f"{API}?{qs}"
    body = json.dumps({"geojson": geojson_polygon}).encode()
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        # GFW's gateway sits behind Cloudflare, which 403s the default
        # python-urllib User-Agent (Cloudflare error 1010).
        "User-Agent": "islands-pipeline/0.1",
        "Accept": "application/json",
    }
    last_err = None
    for attempt in range(4):
        if attempt:
            time.sleep(2 ** attempt)  # 2s, 4s, 8s backoff
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            last_err = e
            print(f"    retry {attempt + 1}/4 after {type(e).__name__}: {str(e)[:80]}")
    raise last_err


def extract_for_slug(slug: str, max_workers: int = 4, verbose: bool = True) -> dict:
    """Pull AIS Vessel Presence detections for one island. Returns a dict
    matching the loadVessels schema; doesn't write to disk (caller's job)."""
    import concurrent.futures
    detail = json.loads((ROOT / "series" / f"{slug}.json").read_text())
    lat = detail["lat"]
    lon = detail["lon"]
    bbox = bbox_from_point(lat, lon, BBOX_M)
    poly = {
        "type": "Polygon",
        "coordinates": [[
            [bbox.west, bbox.south],
            [bbox.east, bbox.south],
            [bbox.east, bbox.north],
            [bbox.west, bbox.north],
            [bbox.west, bbox.south],
        ]],
    }

    detections_by_month: dict[str, list] = {}
    windows = list(yearly_windows(START, END))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(fetch_window, poly, ws, we): (ws, we) for ws, we in windows
        }
        for fut in concurrent.futures.as_completed(futures):
            ws, we = futures[fut]
            try:
                data = fut.result()
            except Exception as e:
                if verbose:
                    print(f"  [{slug}] {ws}..{we}: error {type(e).__name__}: {str(e)[:120]}")
                continue
            for entry in data.get("entries", []):
                for _ds_key, vessel_list in entry.items():
                    if not vessel_list:
                        continue
                    for v in vessel_list:
                        month = v.get("date")
                        vlon = v.get("lon")
                        vlat = v.get("lat")
                        if month is None or vlon is None or vlat is None:
                            continue
                        detections_by_month.setdefault(month, []).append([vlon, vlat])

    months = []
    for y, m in month_iter(START, END):
        key = f"{y:04d}-{m:02d}"
        months.append({"month": key, "detections": detections_by_month.get(key, [])})

    return {
        "slug": slug,
        "source": "GFW AIS Vessel Presence",
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
    p.add_argument("--workers", type=int, default=4,
                   help="Parallel windows to fetch (default 4)")
    args = p.parse_args()
    print(f"island: {args.slug}")
    out = extract_for_slug(args.slug, max_workers=args.workers)
    out_path = ROOT / "series" / f"{args.slug}-vessels.json"
    out_path.write_text(json.dumps(out))
    total = sum(len(m["detections"]) for m in out["months"])
    print(f"  wrote {out_path}  ({total} detections, {out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
