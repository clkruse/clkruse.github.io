#!/usr/bin/env python3
"""Build the per-year arrays embedded in index.html from Garmin/Strava GPX files.

Method (matches the original data): each run's cumulative haversine distance is
stretched linearly so its total equals the shared grid length (the 2023 track,
660 points at 0.04 mi); elapsed time, heart rate and cadence are linearly
interpolated at each grid point.

usage: build_data.py <gpx dir> [year ...]   -> prints JSON {year: {t, finish, hr, cad}}
"""
import sys, os, re, json, math, glob, xml.etree.ElementTree as ET
from datetime import datetime
GRID_TOTAL_MI = 26.375   # haversine length of the 2023 track, the shared grid
NS = {'g': 'http://www.topografix.com/GPX/1/1', 'x': 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1'}

def parse(f):
    pts = []
    for p in ET.parse(f).getroot().iter('{%s}trkpt' % NS['g']):
        e, tm, hr, cad = p.find('g:ele', NS), p.find('g:time', NS), p.find('.//x:hr', NS), p.find('.//x:cad', NS)
        pts.append(dict(lat=float(p.get('lat')), lon=float(p.get('lon')), ele=float(e.text) if e is not None else None,
                        t=datetime.fromisoformat(tm.text.replace('Z', '+00:00')).timestamp(),
                        hr=int(hr.text) if hr is not None else None, cad=int(cad.text) if cad is not None else None))
    t0 = pts[0]['t']
    for p in pts: p['t'] -= t0
    return pts

def hav(a, b):
    R = 3958.7613
    la1, lo1, la2, lo2 = map(math.radians, (a['lat'], a['lon'], b['lat'], b['lon']))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

def cumdist(pts, three_d=False):
    c = [0.0]
    for i in range(1, len(pts)):
        d = hav(pts[i - 1], pts[i])
        if three_d and pts[i]['ele'] is not None and pts[i - 1]['ele'] is not None:
            d = math.hypot(d, (pts[i]['ele'] - pts[i - 1]['ele']) / 1609.344)
        c.append(c[-1] + d)
    return c

def sample(pts, m, grid, key):
    out, k = [], 0
    for d in grid:
        while k < len(pts) and m[k] < d: k += 1
        if k >= len(pts): out.append(pts[-1][key]); continue
        if k == 0: out.append(pts[0][key]); continue
        a, b = pts[k - 1][key], pts[k][key]
        if a is None or b is None: out.append(a if a is not None else b); continue
        f = (d - m[k - 1]) / ((m[k] - m[k - 1]) or 1)
        out.append(a + (b - a) * f)
    return out

def build(gpx_path, grid, three_d=False):
    pts = parse(gpx_path)
    cum = cumdist(pts, three_d)
    m = [x * grid[-1] / cum[-1] for x in cum]   # stretch this run onto the grid length
    has_hr = any(p['hr'] for p in pts); has_cad = any(p['cad'] for p in pts)
    return dict(t=[int(round(v)) for v in sample(pts, m, grid, 't')],
                finish=int(round(pts[-1]['t'])),
                hr=[int(round(v)) for v in sample(pts, m, grid, 'hr')] if has_hr else None,
                cad=[int(round(v)) for v in sample(pts, m, grid, 'cad')] if has_cad else None)

def load_grid(html='index.html'):
    s = open(html).read()
    return json.loads(re.search(r'const DATA = (\{.*?\});\n', s, re.S).group(1))

if __name__ == '__main__':
    gdir = sys.argv[1]; years = sys.argv[2:]
    data = load_grid(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html'))
    # grid: 0.04 mi steps, then a final point at the 2023 track's true length (the embedded dist array rounds it)
    grid = [i * 0.04 for i in range(len(data['dist']) - 1)] + [GRID_TOTAL_MI]
    out = {}
    for f in sorted(glob.glob(os.path.join(gdir, 'Pikes_Peak_Marathon_*.gpx'))):
        y = re.search(r'_(20\d\d)', os.path.basename(f)).group(1)
        if years and y not in years: continue
        out[y] = build(f, grid)
    json.dump(out, sys.stdout, separators=(',', ':'))
