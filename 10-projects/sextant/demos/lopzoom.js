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

  // Reserve a drawn line in a labeler as a chain of thin boxes, so labels
  // avoid the line itself rather than only its end points.
  function reserveLine(labels, a, b, pad = 1) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(length / 6));
    for (let i = 0; i < steps; i++) {
      const p = { x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps };
      const q = { x: a.x + (b.x - a.x) * (i + 1) / steps, y: a.y + (b.y - a.y) * (i + 1) / steps };
      labels.reserve({
        x: Math.min(p.x, q.x),
        y: Math.min(p.y, q.y),
        w: Math.abs(q.x - p.x),
        h: Math.abs(q.y - p.y),
      }, pad);
    }
  }

  // Pane titles use the longest wording that fits the pane.
  function fittedTitle(ctx, options, width, size) {
    return options.find(text =>
      plateTextWidth(ctx, text, { size, weight: 600 }) <= width) || options[options.length - 1];
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

    const titleSize = compactPlate ? 8 : 10;
    directText(fittedTitle(ctx, [
      'VEGA POSITION CIRCLE · GLOBAL SCALE',
      'VEGA CIRCLE · GLOBE',
      'GLOBE',
    ], splitX - 16, titleSize), splitX * 0.5, 18, {
      size: titleSize,
      weight: 600,
      align: 'center',
    });

    // Globe labels avoid the ring, the radius, the limb and the AP box;
    // their paper knockout only ever covers coastline and graticule.
    const globeLabels = createPlateLabeler(ctx, {
      left: 6,
      top: 30,
      right: splitX - 6,
      bottom: h - 6,
      gap: 2,
    });
    for (let i = 1; i < ring.length; i++) {
      if (ring[i].front && ring[i - 1].front) reserveLine(globeLabels, ring[i - 1], ring[i]);
    }
    for (let i = 0; i < 72; i++) {
      const a0 = (i / 72) * TAU, a1 = ((i + 1) / 72) * TAU;
      reserveLine(globeLabels,
        { x: cx + Math.cos(a0) * R, y: cy + Math.sin(a0) * R },
        { x: cx + Math.cos(a1) * R, y: cy + Math.sin(a1) * R });
    }

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
      for (let i = 1; i < ray.length; i++) reserveLine(globeLabels, ray[i - 1], ray[i]);
    }

    const gp = g.proj(GP.lat, GP.lon, R, cx, cy);
    const ap = g.proj(AP.lat, AP.lon, R, cx, cy);
    const apBox = 16;
    if (gp.front) {
      starGlyph(ctx, gp.x, gp.y, 7, PLATE.ink);
      globeLabels.reserve({ x: gp.x - 7, y: gp.y - 7, w: 14, h: 14 }, 1);
    }
    if (ap.front) {
      pointMark(ctx, ap.x, ap.y, PLATE.ink);
      // The 3 nm AP-to-ring gap is sub-pixel here; the local pane resolves it.
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(ap.x - apBox, ap.y - apBox, apBox * 2, apBox * 2);
      globeLabels.reserve({ x: ap.x - apBox, y: ap.y - apBox, w: apBox * 2, h: apBox * 2 }, 1);
    }
    const globeLabelSize = compactPlate ? 8 : 9;
    if (gp.front) {
      // Beside the star when there is room; when a small ring hugs the GP,
      // the label stands outside it on a leader.
      const around = off => [
        { x: gp.x, y: gp.y - off - 2, align: 'center' },
        { x: gp.x + off, y: gp.y - off + 2, align: 'left' },
        { x: gp.x - off, y: gp.y - off + 2, align: 'right' },
        { x: gp.x + off, y: gp.y + off - 2, align: 'left' },
        { x: gp.x - off, y: gp.y + off - 2, align: 'right' },
        { x: gp.x, y: gp.y + off + 2, align: 'center' },
        { x: gp.x + off + 2, y: gp.y, align: 'left' },
        { x: gp.x - off - 2, y: gp.y, align: 'right' },
      ];
      const near = globeLabels.place('Vega GP', null, around(13), {
        key: 'globe-gp-near',
        size: globeLabelSize,
        leader: false,
        fallback: 'hide',
      });
      if (!near) {
        globeLabels.place('Vega GP', gp, [...around(30), ...around(46)], {
          key: 'globe-gp-far',
          size: globeLabelSize,
          head: 2.8,
        });
      }
    }
    if (ap.front) {
      // The label stands off the AP box on a leader, on whichever side the
      // ring and limb leave open.
      const apCandidates = [];
      for (const d of [apBox + 10, apBox + 26, apBox + 44]) {
        apCandidates.push(
          { x: ap.x + d, y: ap.y + d, align: 'left' },
          { x: ap.x, y: ap.y + d + 4, align: 'center' },
          { x: ap.x - d, y: ap.y + d, align: 'right' },
          { x: ap.x + d, y: ap.y - d, align: 'left' },
          { x: ap.x - d, y: ap.y - d, align: 'right' },
          { x: ap.x, y: ap.y - d - 4, align: 'center' },
          { x: ap.x + d + 6, y: ap.y, align: 'left' },
          { x: ap.x - d - 6, y: ap.y, align: 'right' },
        );
      }
      globeLabels.place(globeCompact ? 'AP' : 'ASSUMED POSITION', ap, apCandidates, {
        key: 'globe-ap',
        size: globeLabelSize,
        head: 2.8,
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

    directText(fittedTitle(ctx, [
      'VEGA LOP · LOCAL TANGENT',
      'LOCAL TANGENT',
      'LOCAL',
    ], w - splitX - 16, titleSize), splitX + (w - splitX) * 0.5, 18, {
      size: titleSize,
      weight: 600,
      align: 'center',
    });
    const pane = { left: splitX + 8, top: 28, right: w - 8, bottom: h - 12 };
    const inPane = p => p.x > pane.left && p.x < pane.right && p.y > pane.top && p.y < pane.bottom;
    const chartLabels = createPlateLabeler(ctx, {
      left: pane.left,
      top: pane.top,
      right: pane.right,
      bottom: pane.bottom,
      gap: 2,
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
    const arcPoints = [];
    for (let s = -arcSpan; s <= arcSpan; s += 1) {
      const sag = rho - Math.sqrt(Math.max(0, rho * rho - s * s));
      arcPoints.push(localPoint(s, offsetNm + sag));
    }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.65;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    arcPoints.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
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
    const gpStar = { x: far.x + u.x * 8, y: far.y - u.y * 8 };
    starGlyph(ctx, gpStar.x, gpStar.y, 5.5, PLATE.ink);

    // LOP: the perpendicular tangent at the observed Vega ring.
    const L1 = localPoint(40, offsetNm);
    const L2 = localPoint(-40, offsetNm);
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L1.x, L1.y);
    ctx.lineTo(L2.x, L2.y);
    ctx.stroke();

    const aAz = Math.atan2(-u.y, u.x); // canvas angle of azimuth (y down)
    const aPerp = Math.atan2(-perp.y, perp.x);
    const tangentPoint = localPoint(0, offsetNm);
    rightAngleMark(ctx, tangentPoint.x, tangentPoint.y,
      aAz, aPerp, compactLocal ? 10 : 12, PLATE.ink);
    pointMark(ctx, tangentPoint.x, tangentPoint.y, PLATE.ink, 2.5);

    ctx.restore();

    // The AP is the sight-reduction origin, not quite on the observed ring.
    pointMark(ctx, chx, chy, PLATE.ink);

    // north arrow and scale bar share the bottom edge, out of the way of
    // the azimuth line and its label.
    ctx.strokeStyle = PLATE.ink;
    ctx.fillStyle = PLATE.ink;
    ctx.lineWidth = 0.9;
    const nx = splitX + (compactLocal ? 20 : 26), ny = h - (compactLocal ? 44 : 52);
    ctx.beginPath();
    ctx.moveTo(nx, ny + 22); ctx.lineTo(nx, ny);
    ctx.stroke();
    dimHead(ctx, nx, ny, -Math.PI / 2);
    plateText(ctx, 'N', nx + 6, ny + 4, {
      size: compactPlate ? 8 : 9,
    });

    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 1;
    const sbX2 = w - 22, sbX1 = sbX2 - 10 * scale, sbY = h - 24;
    ctx.beginPath();
    ctx.moveTo(sbX1, sbY); ctx.lineTo(sbX2, sbY);
    ctx.moveTo(sbX1, sbY - 5); ctx.lineTo(sbX1, sbY);
    ctx.moveTo(sbX2, sbY - 5); ctx.lineTo(sbX2, sbY);
    ctx.stroke();

    // Chart labels: every mark is reserved first, then labels take the
    // first clear seat. Their paper knockout only covers grid lines.
    const chartSize = compactPlate ? 8 : 9;
    const dataOpts = { size: chartSize, font: PLATE.dataFont, tracking: 0, uppercase: false };
    const visibleSegments = (points) => {
      for (let i = 1; i < points.length; i++) {
        if (inPane(points[i - 1]) || inPane(points[i])) reserveLine(chartLabels, points[i - 1], points[i]);
      }
    };
    visibleSegments(arcPoints);
    visibleSegments([L2, ...Array.from({ length: 19 }, (_, i) => localPoint(-40 + (i + 1) * 4, offsetNm)), L1]);
    reserveLine(chartLabels, { x: chx, y: chy }, far);
    chartLabels.reserve({ x: gpStar.x - 6, y: gpStar.y - 6, w: 12, h: 12 }, 1);
    if (inPane(tangentPoint)) {
      const m = compactLocal ? 10 : 12;
      chartLabels.reserve({ x: tangentPoint.x - m, y: tangentPoint.y - m, w: m * 2, h: m * 2 }, 1);
    }
    chartLabels.reserve({ x: chx - 4, y: chy - 4, w: 8, h: 8 }, 1);
    chartLabels.reserve({ x: nx - 4, y: ny - 2, w: 20, h: 26 }, 1);
    chartLabels.reserve({ x: sbX1, y: sbY - 6, w: sbX2 - sbX1, h: 7 }, 1);

    chartLabels.place('10 nm', null, [
      { x: (sbX1 + sbX2) / 2, y: sbY - 12, align: 'center' },
    ], {
      ...dataOpts,
      size: compactPlate ? 7.5 : 8,
      leader: false,
    });

    const apText = compactLocal ? 'AP' : 'AP · ASSUMED POSITION';
    chartLabels.place(apText, null, [
      { x: chx, y: chy + 16, align: 'center' },
      { x: chx - 8, y: chy + 14, align: 'right' },
      { x: chx + 8, y: chy + 14, align: 'left' },
      { x: chx - 10, y: chy, align: 'right' },
      { x: chx + 10, y: chy, align: 'left' },
      { x: chx, y: chy + 30, align: 'center' },
    ], {
      key: 'chart-ap',
      size: chartSize,
      leader: false,
    });

    const znText = compactLocal
      ? `Zn ${String(Math.round(zn)).padStart(3, '0')}° · TO GP`
      : `Zn ${zn.toFixed(1)}° · TOWARD VEGA GP`;
    const side = u.x >= 0 ? 1 : -1;
    const midZn = localPoint(0, farNm * 0.62);
    chartLabels.place(znText, null, [
      { x: far.x - side * 10, y: far.y - 12, align: side > 0 ? 'right' : 'left' },
      { x: far.x - side * 10, y: far.y + 4, align: side > 0 ? 'right' : 'left' },
      { x: midZn.x - side * 10, y: midZn.y, align: side > 0 ? 'right' : 'left' },
      { x: far.x + side * 12, y: far.y + 12, align: side > 0 ? 'left' : 'right' },
      { x: midZn.x + side * 10, y: midZn.y, align: side > 0 ? 'left' : 'right' },
    ], {
      ...dataOpts,
      leader: false,
    });

    if (inPane(tangentPoint)) {
      // A horizontal label clears a sloping line only on the side the line
      // falls away from: above and toward its low end, or below and toward
      // its high end.
      const step = localPoint(1, offsetNm);
      const fallsRight = (step.y - tangentPoint.y) * (step.x - tangentPoint.x) >= 0;
      const lopCandidates = [];
      for (const along of [-30, 30, -22, 22, -14, 14, -36, 36]) {
        const tag = localPoint(along, offsetNm);
        lopCandidates.push(
          { x: tag.x + (fallsRight ? 4 : -4), y: tag.y - 15, align: fallsRight ? 'left' : 'right' },
          { x: tag.x + (fallsRight ? -4 : 4), y: tag.y + 15, align: fallsRight ? 'right' : 'left' }
        );
      }
      chartLabels.place('VEGA LOP', null, lopCandidates, {
        size: chartSize,
        leader: false,
      });
    }

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
