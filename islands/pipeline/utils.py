"""Helpers: bbox math, slugs, quarterly date ranges."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class BBox:
    west: float
    south: float
    east: float
    north: float

    def as_list(self) -> list[float]:
        return [self.west, self.south, self.east, self.north]


def bbox_from_point(lat: float, lon: float, size_m: float) -> BBox:
    """Square bbox of side `size_m` meters centered on (lat, lon)."""
    half = size_m / 2.0
    dlat = half / 111_320.0
    dlon = half / (111_320.0 * max(math.cos(math.radians(lat)), 1e-6))
    return BBox(west=lon - dlon, south=lat - dlat, east=lon + dlon, north=lat + dlat)


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "island"


def quarter_ranges(start_year: int, end_year: int) -> list[tuple[str, str, str]]:
    """
    Returns list of (label, start_date, end_date_exclusive) for each quarter
    from start_year Q1 through end_year Q4.
    """
    out: list[tuple[str, str, str]] = []
    for y in range(start_year, end_year + 1):
        for q in range(1, 5):
            start_month = (q - 1) * 3 + 1
            end_month = start_month + 3
            end_y = y + 1 if end_month > 12 else y
            end_m = end_month - 12 if end_month > 12 else end_month
            label = f"{y}-Q{q}"
            start = date(y, start_month, 1).isoformat()
            end = date(end_y, end_m, 1).isoformat()
            out.append((label, start, end))
    return out


def month_ranges(start_year: int, end_year: int) -> list[tuple[str, str, str]]:
    """
    Returns list of (label, start_date, end_date_exclusive) for each calendar
    month from start_year-01 through end_year-12.
    """
    out: list[tuple[str, str, str]] = []
    for y in range(start_year, end_year + 1):
        for m in range(1, 13):
            end_y = y + 1 if m == 12 else y
            end_m = 1 if m == 12 else m + 1
            label = f"{y}-{m:02d}"
            start = date(y, m, 1).isoformat()
            end = date(end_y, end_m, 1).isoformat()
            out.append((label, start, end))
    return out


def cadence_ranges(
    cadence: str,
    start_year: int,
    end_year: int,
    today: date | None = None,
) -> list[tuple[str, str, str]]:
    """
    Build cadence periods and drop any period whose start date hasn't happened
    yet, so the timelapse extends exactly through the most recent complete-or-
    in-progress period but no further.
    """
    if cadence == "monthly":
        raw = month_ranges(start_year, end_year)
    elif cadence == "quarterly":
        raw = quarter_ranges(start_year, end_year)
    else:
        raise ValueError(f"unknown cadence: {cadence}")
    today = today or date.today()
    return [(label, s, e) for (label, s, e) in raw if date.fromisoformat(s) <= today]
