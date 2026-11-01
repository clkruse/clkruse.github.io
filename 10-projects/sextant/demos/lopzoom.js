'use strict';
/* §11: a circle of position at two scales. Left: the ring on the globe.
   Right: the chart around the AP, where the nearby ring has a straight
   local tangent perpendicular to the azimuth toward the GP. */

(function demoLopZoom() {
  const d = createDemo('demo-lopzoom', {
    aspect: 1.55,
    maxH: 540,
    draw,
  });
  let splitX = 1e9;
  const g = makeGlobe(d, 137.2, 16.7, p => p.x < splitX);
  const GP = { lat: 38.81, lon: -127.2129 };
  const AP = { lat: -5.7901, lon: -145 };
  let workedSight = SIGHT_STORY.state;
  let workedZn = workedSight.zn;
  const alt = addSlider(d, {
    label: 'corrected altitude Ho', min: 20, max: 70, step: 0.001, value: workedSight.ho,
    fmt: v => v.toFixed(1) + '°',
  });
  const note = addStat(d, 'worked local geometry', true);
  const applyWorked = (state = workedSight) => {
    workedSight = state;
    GP.lat = state.gp.lat;
    GP.lon = state.gp.lon;
    AP.lat = state.assumed.lat;
    AP.lon = state.assumed.lon;
    workedZn = state.zn;
    alt.set(state.ho, { emit: false });
  };
  d.addPreset('worked', () => applyWorked());
  SIGHT_STORY.subscribe(applyWorked);

  function initialAzimuth(lat1, lon1, lat2, lon2) {
    const p1 = lat1 * D2R, p2 = lat2 * D2R, dL = (lon2 - lon1) * D2R;
    const y = Math.sin(dL) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dL);
    return (Math.atan2(y, x) * R2D + 360) % 360;
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    splitX = w * 0.52;
    const { zr, ringPoint, zn, rho, azFromGp, offsetNm } = localGeometry();
    const globeCompact = splitX < 190;
    const compactPlate = w < 500 || h < 320;
    const directText = (text, x, y, opts = {}) =>
      plateText(ctx, text, x, y, {
        size: opts.size || (compactPlate ? 8 : 9),
        weight: opts.weight,
        align: opts.align,
      });
    const dataText = (text, x, y, opts = {}) =>
      plateDataText(ctx, text, x, y, {
        size: opts.size || (compactPlate ? 8 : 9),
        weight: opts.weight,
        align: opts.align,
      });

    /* ----- left: the globe ----- */

    const cx = splitX * 0.5, cy = h * 0.52;
    const R = Math.min(h * 0.40, splitX * 0.40);
    const saved = {
      paperDeep: P.paperDeep,
      globeGrat: P.globeGrat,
      globeCoast: P.globeCoast,
      globeLimb: P.globeLimb,
    };
    try {
      P.paperDeep = PLATE.paper;
      P.globeGrat = PLATE.ink;
      P.globeCoast = PLATE.ink;
      P.globeLimb = PLATE.ink;
      g.base(ctx, cx, cy, R, {
        longitudeStep: 45,
        // The separately weighted equator completes the -45/0/45 set.
        latitudes: [-45, 45],
        graticuleWeight: 0.3,
        equatorWeight: 0.4,
        showCenter: false,
      });
    } finally {
      Object.assign(P, saved);
    }
    const ring = [];
    for (let angle = 0; angle <= 360; angle += 2) {
      const point = destPoint(GP.lat, GP.lon, zr, angle);
      ring.push(g.proj(point.lat, point.lon, R, cx, cy));
    }
    for (const front of [false, true]) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = front ? 1.8 : 0.65;
      ctx.setLineDash(front ? [] : plateDash('long'));
      ctx.beginPath();
      let penDown = false;
      for (const point of ring) {
        if (point.front === front) {
          if (penDown) ctx.lineTo(point.x, point.y);
          else {
            ctx.moveTo(point.x, point.y);
            penDown = true;
          }
        } else {
          penDown = false;
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    directText('VEGA POSITION CIRCLE · GLOBAL SCALE', splitX * 0.5, 18, {
      size: compactPlate ? 8 : 10,
      weight: 600,
      align: 'center',
    });

    // Radius from the GP to the worked ring, on the great circle through AP.
    const N = 20;
    const ray = [];
    let rayOk = true;
    for (let i = 0; i <= N; i++) {
      const p = destPoint(GP.lat, GP.lon, (zr * i) / N, azFromGp);
      const q = g.proj(p.lat, p.lon, R, cx, cy);
      if (!q.front) { rayOk = false; break; }
      ray.push(q);
    }
    if (rayOk && ray.length > 1) {
      ctx.strokeStyle = PLATE.ink;
      ctx.fillStyle = PLATE.ink;
      ctx.lineWidth = 0.9;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(ray[0].x, ray[0].y);
      for (let i = 1; i < ray.length; i++) ctx.lineTo(ray[i].x, ray[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      const end = ray[ray.length - 1], prev = ray[ray.length - 2];
      dimHead(ctx, end.x, end.y, Math.atan2(end.y - prev.y, end.x - prev.x), 7, 2.3);
    }

    const gp = g.proj(GP.lat, GP.lon, R, cx, cy);
    if (gp.front) {
      starGlyph(ctx, gp.x, gp.y, 7, PLATE.ink);
      directText('Vega GP', gp.x, gp.y - 16, {
        size: compactPlate ? 8 : 9,
        align: 'center',
      });
    }
    const ap = g.proj(AP.lat, AP.lon, R, cx, cy);
    if (ap.front) {
      pointMark(ctx, ap.x, ap.y, PLATE.ink);
      // The 3 nm AP-to-ring gap is sub-pixel here; the local pane resolves it.
      const box = 16;
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(ap.x - box, ap.y - box, box * 2, box * 2);
      const labelRight = ap.x < splitX * 0.52;
      const labelPoint = {
        x: ap.x + (labelRight ? 24 : -24),
        y: ap.y - 20,
      };
      plateLeader(ctx, { x: ap.x, y: ap.y }, labelPoint, { head: 2.8 });
      directText(globeCompact ? 'AP' : 'ASSUMED POSITION', labelPoint.x,
        labelPoint.y - 5, {
          size: compactPlate ? 8 : 9,
          align: labelRight ? 'left' : 'right',
        });
    }
    const rp = g.proj(ringPoint.lat, ringPoint.lon, R, cx, cy);
    if (rp.front) pointMark(ctx, rp.x, rp.y, PLATE.ink, 2.2);

    /* ----- divider ----- */

    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 12);
    ctx.lineTo(splitX, h - 12);
    ctx.stroke();

    /* ----- right: the local chart ----- */

    const chx = splitX + (w - splitX) * 0.5;
    const chy = h * 0.52;
    const scale = Math.min(w - splitX, h) / 78; // px per nm
    const compactLocal = w - splitX < 230;
    const toPx = (e, n) => ({ x: chx + e * scale, y: chy - n * scale });

    directText('VEGA LOP · LOCAL TANGENT', splitX + (w - splitX) * 0.5, 18, {
      size: compactPlate ? 8 : 10,
      weight: 600,
      align: 'center',
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX + 8, 28, w - splitX - 16, h - 40);
    ctx.clip();

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.3;
    const gridStepNm = 20;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(chx + i * gridStepNm * scale, 0);
      ctx.lineTo(chx + i * gridStepNm * scale, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(splitX, chy + i * gridStepNm * scale);
      ctx.lineTo(w, chy + i * gridStepNm * scale);
      ctx.stroke();
    }
    ctx.restore();

    const znR = zn * D2R;
    const u = { x: Math.sin(znR), y: Math.cos(znR) }; // east, north toward GP
    const perp = { x: -u.y, y: u.x };
    const localPoint = (s, n) =>
      toPx(perp.x * s + u.x * n, perp.y * s + u.y * n);

    // The observed circle lies offset from the AP by Ho − Hc. It bends toward
    // its GP; the straight plotting line touches it at the ring point.
    const arcSpan = compactLocal ? 32 : 40;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.65;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let s = -arcSpan; s <= arcSpan; s += 1) {
      const sag = rho - Math.sqrt(Math.max(0, rho * rho - s * s));
      const p = localPoint(s, offsetNm + sag);
      if (s === -arcSpan) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();

    // Zn runs from the AP through the tangent point toward Vega's GP.
    ctx.strokeStyle = PLATE.ink;
    ctx.fillStyle = PLATE.ink;
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 4]);
    const farNm = compactLocal ? 25 : 36;
    const far = localPoint(0, farNm);
    ctx.beginPath();
    ctx.moveTo(chx, chy);
    ctx.lineTo(far.x, far.y);
    ctx.stroke();
    ctx.setLineDash([]);
    dimHead(ctx, far.x, far.y, Math.atan2(far.y - chy, far.x - chx), 7, 2.3);
    starGlyph(ctx, far.x + u.x * 8, far.y - u.y * 8, 5.5, PLATE.ink);
    dataText(compactLocal
      ? `Zn ${String(Math.round(zn)).padStart(3, '0')}° · TO GP`
      : `Zn ${zn.toFixed(1)}° · TOWARD VEGA GP`,
    far.x + (u.x >= 0 ? -8 : 8), far.y - (compactLocal ? 14 : 15), {
      size: compactPlate ? 8 : 9,
      align: u.x >= 0 ? 'right' : 'left',
    });

    // LOP: the perpendicular tangent at the observed Vega ring.
    const L1 = localPoint(40, offsetNm);
    const L2 = localPoint(-40, offsetNm);
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L1.x, L1.y);
    ctx.lineTo(L2.x, L2.y);
    ctx.stroke();
    const tangentTag = localPoint(compactLocal ? 15 : 27, offsetNm);
    directText(compactLocal ? 'VEGA LOP' : 'VEGA LOP · CIRCLE TANGENT',
      tangentTag.x, tangentTag.y - 11, {
        size: compactPlate ? 8 : 9,
        align: tangentTag.x < chx ? 'left' : 'right',
      });

    const aAz = Math.atan2(-u.y, u.x); // canvas angle of azimuth (y down)
    const aPerp = Math.atan2(-perp.y, perp.x);
    const tangentPoint = localPoint(0, offsetNm);
    rightAngleMark(ctx, tangentPoint.x, tangentPoint.y,
      aAz, aPerp, compactLocal ? 10 : 12, PLATE.ink);
    pointMark(ctx, tangentPoint.x, tangentPoint.y, PLATE.ink, 2.5);

    ctx.restore();

    // The AP is the sight-reduction origin, not quite on the observed ring.
    pointMark(ctx, chx, chy, PLATE.ink);
    directText(compactLocal ? 'AP' : 'AP · ASSUMED POSITION', chx, chy + 18, {
      size: compactPlate ? 8 : 9,
      align: 'center',
    });

    // north arrow
    ctx.strokeStyle = PLATE.ink;
    ctx.fillStyle = PLATE.ink;
    ctx.lineWidth = 0.9;
    const nx = splitX + 28, ny = 58;
    ctx.beginPath();
    ctx.moveTo(nx, ny + 22); ctx.lineTo(nx, ny);
    ctx.stroke();
    dimHead(ctx, nx, ny, -Math.PI / 2);
    directText('N', nx, ny - 12, {
      size: compactPlate ? 8 : 9,
      align: 'center',
    });

    // scale bar
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 1;
    const sbX2 = w - 22, sbX1 = sbX2 - 10 * scale, sbY = h - 24;
    ctx.beginPath();
    ctx.moveTo(sbX1, sbY); ctx.lineTo(sbX2, sbY);
    ctx.moveTo(sbX1, sbY - 5); ctx.lineTo(sbX1, sbY);
    ctx.moveTo(sbX2, sbY - 5); ctx.lineTo(sbX2, sbY);
    ctx.stroke();
    dataText('10 nm', (sbX1 + sbX2) / 2, h - 36, {
      size: compactPlate ? 7.5 : 8,
      align: 'center',
    });

    const signedOffset = `${Math.abs(offsetNm).toFixed(1)} nm ${offsetNm >= 0 ? 'toward GP' : 'away from GP'}`;
    note.set(compactLocal
      ? `Vega LOP ${signedOffset} · crosses Zn at 90°`
      : `Vega LOP is ${Math.abs(offsetNm).toFixed(1)} nm from AP ${offsetNm >= 0 ? 'toward' : 'away from'} Vega’s GP and crosses Zn at 90°`);
  }

  function localGeometry() {
    const zr = 90 - alt.v;
    const azFromGp = initialAzimuth(GP.lat, GP.lon, AP.lat, AP.lon);
    const ringPoint = destPoint(GP.lat, GP.lon, zr, azFromGp);
    const apRadiusNm = globeAngularDistance(AP, GP) * 60;
    const offsetNm = apRadiusNm - zr * 60;
    const zn = workedZn;
    // A small circle at angular radius z has geodesic curvature cot(z)/R,
    // hence local osculating radius R tan(z). R is Earth radius in nautical miles.
    const rho = 3437.75 * Math.tan(zr * D2R);
    return { zr, ringPoint, zn, rho, azFromGp, offsetNm, apRadiusNm };
  }
})();
