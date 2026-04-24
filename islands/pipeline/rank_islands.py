"""
Compute water fraction per frame (how much of the 5 km scene is open water),
rank islands by how developed they are now (lowest water fraction = most
land), and attach the water-fraction time series to each manifest entry so
the site can plot change over time.

Water detection: Normalized Blue-Red Difference Index on raw reflectance,
NBRDI = (B - R) / (B + R). Water absorbs red and reflects blue, so NBRDI > 0
for water, ~0 for neutral bright surfaces (sand, concrete), and negative
for vegetation. Thresholded to a binary mask and meaned over valid pixels.

Runs on the raw-reflectance .npy cache — NOT on the processed video frames —
so the numbers are atmosphere-corrected and independent of the display
stretch.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRAMES_DIR = DATA_DIR / "frames_raw"
# Input: full archive written by run.py (every island field, no land_series).
MANIFEST_PATH = DATA_DIR / "manifest.json"
# Output: full archive with land_series attached, kept for debugging + re-runs.
FULL_ARCHIVE_PATH = DATA_DIR / "manifest.full.json"
# Site output: slim grid index + one detail JSON per island, loaded lazily by
# the lightbox. Keeping the per-island series out of the grid manifest drops
# initial JSON parse from ~224 KB to ~24 KB.
SITE_MANIFEST = ROOT / "manifest.json"
SERIES_DIR = ROOT / "series"

SLIM_FIELDS = ("slug", "name", "video_thumb", "video", "poster")
DETAIL_FIELDS = ("slug", "lat", "lon", "date_range", "frame_count", "land_series")

NBRDI_THRESHOLD = 0.05  # pixels with (B-R)/(B+R) above this count as water


def water_fraction(arr: np.ndarray) -> float:
    valid = ~np.isnan(arr).any(axis=-1)
    denom = int(valid.sum())
    if denom == 0:
        return 0.0
    r = arr[..., 0]
    b = arr[..., 2]
    with np.errstate(invalid="ignore", divide="ignore"):
        nbrdi = (b - r) / (b + r + 1e-6)
    water = (nbrdi > NBRDI_THRESHOLD) & valid
    return float(water.sum()) / float(denom)


def score_island(
    slug: str, cadence: str = "monthly"
) -> tuple[float, float, list[float]] | None:
    frames_dir = FRAMES_DIR / slug / cadence
    paths = sorted(frames_dir.glob("*.npy"))
    if len(paths) < 2:
        return None
    series = [water_fraction(np.load(p)) for p in paths]
    return (series[0], series[-1], series)


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


def linear_trend(series: list[float]) -> tuple[float, float]:
    """OLS slope×duration and R² of linear fit."""
    if len(series) < 3:
        return 0.0, 0.0
    x = np.arange(len(series), dtype=np.float64)
    y = np.array(series, dtype=np.float64)
    slope, intercept = np.polyfit(x, y, 1)
    pred = slope * x + intercept
    ss_res = float(((y - pred) ** 2).sum())
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = max(1.0 - ss_res / ss_tot, 0.0) if ss_tot > 0 else 0.0
    return float(slope * (len(series) - 1)), r2


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    for entry in manifest["islands"]:
        res = score_island(entry["slug"])
        if res is None:
            entry["land_series"] = []
            entry["land_first"] = 0.0
            entry["land_last"] = 0.0
            entry["growth"] = 0.0
            entry["trend_r2"] = 0.0
            entry["trend_score"] = 0.0
        else:
            first_w, last_w, water_series = res
            raw_land = [1.0 - w for w in water_series]
            cleaned = reject_outliers(raw_land)
            fit_delta, r2 = linear_trend(cleaned)
            entry["land_series"] = [round(v, 4) for v in cleaned]
            entry["land_first"] = round(cleaned[0], 4)
            entry["land_last"] = round(cleaned[-1], 4)
            entry["growth"] = round(cleaned[-1] - cleaned[0], 4)
            entry["trend_r2"] = round(r2, 4)
            entry["trend_score"] = round(fit_delta * r2, 4)

    # Sort by trend score — combines magnitude (fit delta) and smoothness
    # (R²) so noisy growth doesn't beat clean gradual growth.
    manifest["islands"].sort(key=lambda x: -x.get("trend_score", 0.0))

    FULL_ARCHIVE_PATH.write_text(json.dumps(manifest, indent=2))

    SERIES_DIR.mkdir(parents=True, exist_ok=True)
    slim = {"islands": [{k: e[k] for k in SLIM_FIELDS} for e in manifest["islands"]]}
    SITE_MANIFEST.write_text(json.dumps(slim, separators=(",", ":")))
    for e in manifest["islands"]:
        detail = {k: e[k] for k in DETAIL_FIELDS}
        (SERIES_DIR / f"{e['slug']}.json").write_text(
            json.dumps(detail, separators=(",", ":"))
        )

    print(f"{'slug':<25} {'first':>7} {'last':>7} {'growth':>8} {'R²':>6} {'score':>8}")
    for e in manifest["islands"]:
        print(
            f"{e['slug']:<25} {e['land_first']:>7.3f} {e['land_last']:>7.3f} "
            f"{e['growth']:>+8.3f} {e['trend_r2']:>6.2f} {e['trend_score']:>+8.3f}"
        )


if __name__ == "__main__":
    main()
