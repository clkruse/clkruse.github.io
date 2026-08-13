'use strict';
/* Globe figures: circle of position (§02) and crossing circles (§03).
   The globe base (ocean, graticule, real coastlines, limb) is the shared
   globeView/drawGlobeBase from app.js, data from demos/world.js. */

function makeGlobe(d, spin0, tilt0) {
  const g = { spin: spin0, tilt: tilt0 };
  g.view = globeView(g.spin, g.tilt);
  addDrag(d.canvas, {
    move(p, dp) {
      g.spin += dp.dx * 0.35;
      g.tilt = clamp(g.tilt + dp.dy * 0.35, -72, 72);
    },
  });
  g.proj = (latDeg, lonDeg, R, cx, cy) => {
    const v = g.view(lonDeg, latDeg);
    return { x: cx + R * v.X, y: cy - R * v.Y, front: v.Z > 0 };
  };
  g.base = (ctx, cx, cy, R) => {
    g.view = globeView(g.spin, g.tilt);
    drawGlobeBase(ctx, g.view, cx, cy, R);
  };
  // circle of equal altitude around (lat,lon) with angular radius zr (deg):
  // flat 2.2px object line on the front hemisphere, dashed hidden line behind
  g.posCircle = (ctx, lat, lon, zr, R, cx, cy, color) => {
    const pts = [];
    for (let a = 0; a <= 360; a += 2) {
      const p = destPoint(lat, lon, zr, a);
      pts.push(g.proj(p.lat, p.lon, R, cx, cy));
    }
    for (const pass of [0, 1]) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = pass ? 1 : 0.35;
      ctx.lineWidth = pass ? 2.2 : 1;
      if (!pass) ctx.setLineDash([4, 4]);
      ctx.beginPath();
      let pen = false;
      for (const p of pts) {
        const ok = pass ? p.front : !p.front;
        if (ok) {
          if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; }
        } else pen = false;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    return pts;
  };
  return g;
}

function destPoint(lat, lon, dist, az) {
  const la = lat * D2R, dr = dist * D2R, azr = az * D2R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(dr) + Math.cos(la) * Math.sin(dr) * Math.cos(azr));
  const lo2 = lon * D2R + Math.atan2(
    Math.sin(azr) * Math.sin(dr) * Math.cos(la),
    Math.cos(dr) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 * R2D, lon: lo2 * R2D };
}

function latLonToVec(lat, lon) {
  const la = lat * D2R, lo = lon * D2R;
  return { x: Math.cos(la) * Math.cos(lo), y: Math.cos(la) * Math.sin(lo), z: Math.sin(la) };
}

(function demoCircle() {
  const d = createDemo('demo-circle', { aspect: 1.45, maxH: 540, draw });
  const g = makeGlobe(d, -35, 22);
  const GP = { lat: 39, lon: -30 };
  const alt = addSlider(d, {
    label: 'measured altitude', min: 5, max: 85, step: 0.5, value: 52,
    fmt: v => v.toFixed(1) + '°',
  });
  const radStat = addStat(d, 'circle radius');

  // radius as a dimension: 0.9px great-circle line from the GP out to the
  // circle, slim arrowhead at the circle end, letter label alongside.
  // Picks the first candidate azimuth whose whole path faces front; degrades
  // by dropping the label, then the whole dim, as the circle shrinks on screen.
  function radiusDim(ctx, zr, R, cx, cy) {
    const dimC = P.inkSoft;
    for (const az of [150, 205, 105, 250, 60, 305]) {
      const pts = [];
      let ok = true;
      const N = 24;
      for (let i = 0; i <= N; i++) {
        const p = destPoint(GP.lat, GP.lon, (zr * i) / N, az);
        const q = g.proj(p.lat, p.lon, R, cx, cy);
        if (!q.front) { ok = false; break; }
        pts.push(q);
      }
      if (!ok) continue;
      let len = 0;
      for (let i = 1; i <= N; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (len < 30) return; // too cramped for a dimension – readout carries the value
      ctx.strokeStyle = dimC;
      ctx.fillStyle = dimC;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= N; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      const end = pts[N], prev = pts[N - 1];
      dimHead(ctx, end.x, end.y, Math.atan2(end.y - prev.y, end.x - prev.x));
      if (len >= 74) {
        const m = pts[N >> 1], m2 = pts[(N >> 1) + 1];
        let px = -(m2.y - m.y), py = m2.x - m.x;
        const pl = Math.hypot(px, py) || 1;
        if (py > 0) { px = -px; py = -py; } // prefer the upper side
        label(ctx, 'z × 60 nm', m.x + (px / pl) * 13, m.y + (py / pl) * 13,
          { color: dimC, size: 10.5, halo: P.paper });
      }
      return;
    }
  }

  function draw(ctx, w, h, t) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.42;
    g.base(ctx, cx, cy, R);
    const zr = 90 - alt.v;
    g.posCircle(ctx, GP.lat, GP.lon, zr, R, cx, cy, P.s2);
    radiusDim(ctx, zr, R, cx, cy);
    // GP marker
    const gp = g.proj(GP.lat, GP.lon, R, cx, cy);
    if (gp.front) {
      starGlyph(ctx, gp.x, gp.y, 8, P.s2);
      // small circles: step the label outside the circle's track so the
      // wandering point never overprints it
      const rpx = R * Math.sin(zr * D2R);
      const ly = gp.y - (rpx < 34 ? rpx + 16 : 18);
      label(ctx, "star's GP", gp.x, ly, { color: P.s2, size: 11.5, halo: P.paper });
    }
    // a wandering "could-be-you" point traveling the circle: crisp dot, thin ring
    const az = (t * 9) % 360;
    const bp = destPoint(GP.lat, GP.lon, zr, az);
    const b = g.proj(bp.lat, bp.lon, R, cx, cy);
    if (b.front) {
      pointMark(ctx, b.x, b.y, P.ink, 2.6);
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, 6.5, 0, TAU); ctx.stroke();
      // tiny circles put the point on top of the GP label – drop the text, keep the mark
      if (!gp.front || Math.hypot(b.x - gp.x, b.y - gp.y) > 36)
        label(ctx, 'you?', b.x, b.y - 15, { color: P.inkSoft, size: 11, halo: P.paper });
    }
    radStat.set(fmtNM(zr * 60));
  }
})();

(function demoTwoStar() {
  const d = createDemo('demo-twostar', { aspect: 1.45, maxH: 540, draw });
  const g = makeGlobe(d, -12, 20);
  const A = { lat: 39, lon: -30, name: 'star A' };
  const B = { lat: 5, lon: 35, name: 'star B' };
  const altA = addSlider(d, {
    label: 'altitude of star A', min: 20, max: 80, step: 0.5, value: 50,
    fmt: v => v.toFixed(1) + '°',
  });
  const altB = addSlider(d, {
    label: 'altitude of star B', min: 20, max: 80, step: 0.5, value: 55,
    fmt: v => v.toFixed(1) + '°',
  });
  const sepStat = addStat(d, 'candidates apart', true);

  function intersections(zA, zB) {
    const n1 = latLonToVec(A.lat, A.lon), n2 = latLonToVec(B.lat, B.lon);
    const c1 = Math.cos(zA * D2R), c2 = Math.cos(zB * D2R);
    const dd = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
    const den = 1 - dd * dd;
    if (den < 1e-9) return null;
    const a = (c1 - c2 * dd) / den, b = (c2 - c1 * dd) / den;
    const x0 = { x: a * n1.x + b * n2.x, y: a * n1.y + b * n2.y, z: a * n1.z + b * n2.z };
    const m2 = x0.x * x0.x + x0.y * x0.y + x0.z * x0.z;
    const h2 = 1 - m2;
    if (h2 < 0) return null;
    const cr = {
      x: n1.y * n2.z - n1.z * n2.y,
      y: n1.z * n2.x - n1.x * n2.z,
      z: n1.x * n2.y - n1.y * n2.x,
    };
    const tt = Math.sqrt(h2 / den);
    const mk = s => {
      const v = { x: x0.x + s * tt * cr.x, y: x0.y + s * tt * cr.y, z: x0.z + s * tt * cr.z };
      return { lat: Math.asin(clamp(v.z, -1, 1)) * R2D, lon: Math.atan2(v.y, v.x) * R2D, v };
    };
    return [mk(1), mk(-1)];
  }

  function draw(ctx, w, h, t) {
    const cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.42;
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    g.base(ctx, cx, cy, R);
    g.posCircle(ctx, A.lat, A.lon, 90 - altA.v, R, cx, cy, P.s2);
    g.posCircle(ctx, B.lat, B.lon, 90 - altB.v, R, cx, cy, P.s1);
    for (const [gp, col] of [[A, P.s2], [B, P.s1]]) {
      const p = g.proj(gp.lat, gp.lon, R, cx, cy);
      if (p.front) {
        starGlyph(ctx, p.x, p.y, 7, col);
        label(ctx, gp.name + ' GP', p.x, p.y - 16, { color: col, size: 11, halo: P.paper });
      }
    }
    const ints = intersections(90 - altA.v, 90 - altB.v);
    if (!ints) {
      sepStat.set('circles don’t touch – measurements can’t both be right', P.red);
      return;
    }
    // candidate fixes: static double-ring marks, ink with paper ring
    for (const it of ints) {
      const p = g.proj(it.lat, it.lon, R, cx, cy);
      if (!p.front) continue;
      pointMark(ctx, p.x, p.y, P.ink, 2.6);
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, TAU); ctx.stroke();
    }
    const dot = ints[0].v.x * ints[1].v.x + ints[0].v.y * ints[1].v.y + ints[0].v.z * ints[1].v.z;
    const sep = Math.acos(clamp(dot, -1, 1)) * R2D * 60;
    sepStat.set(fmtNM(sep) + ' – dead reckoning picks the right one');
  }
})();
