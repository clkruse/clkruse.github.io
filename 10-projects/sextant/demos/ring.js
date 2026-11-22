'use strict';
/* Rings of position (§3). A globe with a star's ground position and ring,
   and "Your view" called out from where you stand, set like Figures 2-1 and
   2-2. Swing the line of sight in the detail and the ring grows or shrinks; drag
   yourself around the ring and the star holds its altitude while the
   direction you look at it changes. Uses the plate globe helpers in
   demos/globes.js. */

(function demoRing() {
  const d = createDemo('demo-circle', {
    aspect: 1.75,
    maxH: 400,
    compactAspect: 0.85,
    compactMaxH: 680,
    draw,
  });

  const alt = addValue(d, {
    label: 'measured altitude',
    min: 5,
    max: 85,
    step: 1,
    value: 60,
    fmt: v => v.toFixed(0) + '°',
  });
  d.addPreset('sixty', () => alt.set(60, { emit: false }));
  d.addPreset('high-altitude', () => alt.set(75, { emit: false }));
  d.addPreset('low-altitude', () => alt.set(15, { emit: false }));

  // a generic star whose GP sits high on the near side of a north-up globe,
  // so its starlight runs straight up the page as in Figure 2-2
  const GP = { lat: 50, lon: 0 };
  const GLOBE = { spin: 0, tilt: 10 };
  // your bearing from the GP, in degrees clockwise from north
  let az = 135;
  // which side of the GP its name sits on, away from you
  let gpSide = -1;
  let geo = null;

  const fmtDeg = v => `${v.toFixed(0)}°`;

  d.canvas.classList.add('grab');
  // dragging in the caption's detail sets the altitude; dragging the globe
  // walks you around the ring
  onDetailDrag(d, a => alt.set(clamp(Math.round(a), 5, 85), { emit: false }));
  addDrag(d.canvas, {
    // a finger takes the ring itself
    hit: p => nearGrab(p, geo && geo.ring && geo.ring.filter(q => q.front), 24),
    start(p) { this.move(p); },
    move(p) {
      if (!geo) return;
      // walk to the point on the ring nearest the pointer, favouring the
      // near side of the globe
      if (!geo.ring) return;
      let best = null, bestD = Infinity;
      for (const q of geo.ring) {
        const dd = Math.hypot(q.x - p.x, q.y - p.y) + (q.front ? 0 : 40);
        if (dd < bestD) { bestD = dd; best = q; }
      }
      if (best) az = best.az;
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const z = 90 - alt.v;

    // the globe, with "Your view" in the caption
    const layout = plateDetailLayout(w, h, compact, ctx);
    const { detail, field } = layout;
    const headH = plateDetailHeading(ctx, layout, 'YOUR RING OF POSITION');
    const globeBox = { x: field.x, y: field.y + headH, w: field.w, h: field.h - headH };

    const youGeo = destPoint(GP.lat, GP.lon, z, az);
    geo = { detail };
    drawGlobe(ctx, globeBox, z, youGeo, compact, detail);
    plateAltitudeInstrument(detail, {
      sights: [{ alt: alt.v, block: plateFigureBlock(ctx, `h = ${fmtDeg(alt.v)}`, compact) }],
    });
  }

  function drawGlobe(ctx, box, z, youGeo, compact, detail) {
    const size = compact ? 8 : 9;
    const starR = compact ? 7.5 : 9;
    const starY = box.y + starR + (compact ? 12 : 16);
    const rayTop = starY + starR + 6;
    const bottomPad = compact ? 22 : 28;
    const cx = box.x + box.w * 0.5;
    const R = Math.min(box.w * (compact ? 0.42 : 0.4),
      (box.y + box.h - bottomPad - rayTop - (compact ? 16 : 22)) / 2);
    const cy = box.y + box.h - bottomPad - R;

    const scene = drawPlateGlobeFrame(ctx, GLOBE, cx, cy, R, compact, {
      showCenter: false,
      gridLatitudes: compact ? [0, 45] : [0, 30, 60],
      gridLongitudeStep: compact ? 90 : 45,
      gridHiddenWeight: compact ? 0.22 : 0.26,
      gridVisibleWeight: compact ? 0.3 : 0.36,
      // lighter than the ring, as in Figure 3-2
      outlineWeight: compact ? 0.8 : 1,
    });
    const gp = scene.project(GP.lat, GP.lon);
    const you = scene.project(youGeo.lat, youGeo.lon);

    // the ring: every place z from the GP, solid on the near side
    const ring = [];
    for (let a = 0; a <= 360; a += 2) {
      const q = destPoint(GP.lat, GP.lon, z, a);
      ring.push({ ...scene.project(q.lat, q.lon), az: a % 360 });
    }
    strokePlateHemisphere(ctx, ring, false, { kind: 'long', weight: compact ? 0.52 : 0.65 });
    strokePlateHemisphere(ctx, ring, true, { kind: 'solid', weight: compact ? 1.55 : 2 });
    geo.ring = ring;

    // your distance from the GP, along the ground: the ring's radius
    const arc = [];
    const steps = Math.max(8, Math.ceil(z / 3));
    for (let i = 0; i <= steps; i++) {
      const q = destPoint(GP.lat, GP.lon, z * i / steps, az);
      arc.push(scene.project(q.lat, q.lon));
    }
    strokePlateHemisphere(ctx, arc, false, { kind: 'short', weight: 0.6 });
    strokePlateHemisphere(ctx, arc, true, { kind: 'construction', weight: compact ? 0.75 : 0.9 });

    // starlight straight out from the GP to the star, as in Figures 2-1 and 2-2
    const u = norm({ x: gp.x - cx, y: gp.y - cy });
    const len = (gp.y - rayTop) / -u.y;
    const gpRay = { x: gp.x + u.x * len, y: gp.y + u.y * len };
    plateVector(ctx, gp, gpRay, { kind: 'long', weight: compact ? 0.8 : 1, head: compact ? 3.2 : 4 });
    const star = { x: gpRay.x + u.x * ((rayTop - starY) / -u.y), y: starY };
    starGlyph(ctx, star.x, star.y, starR, PLATE.ink);

    // the GP, and you on the ring
    ctx.save();
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(gp.x, gp.y, compact ? 2.6 : 3.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.fillStyle = PLATE.paper;
    ctx.lineWidth = 1.3;
    if (!you.front) ctx.setLineDash(plateDash('short'));
    ctx.beginPath();
    ctx.arc(you.x, you.y, compact ? 4.4 : 5.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (you.front) {
      ctx.save();
      ctx.fillStyle = PLATE.ink;
      ctx.beginPath();
      ctx.arc(you.x, you.y, compact ? 2.2 : 2.7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    const labels = createPlateLabeler(ctx, {
      left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h, gap: compact ? 2 : 3,
    });
    // everything a label must stay off, kept as points so the distance
    // block below can test its own seats against them
    const obstacles = [];
    const mark = (q, r = 2) => {
      obstacles.push({ x: q.x, y: q.y, r });
      labels.reserve({ x: q.x - r, y: q.y - r, w: r * 2, h: r * 2 }, 1);
    };
    const markSegment = (p, q) => {
      const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 6));
      for (let i = 0; i <= n; i++) mark({ x: lerp(p.x, q.x, i / n), y: lerp(p.y, q.y, i / n) });
    };
    // "Your view" is called out from where you stand
    plateDetailMarks(plateDetailCallout(ctx, you, detail, { toward: { x: cx, y: cy }, compact })).forEach(q => mark(q, q.r));
    ring.forEach(q => mark(q));
    arc.forEach(q => mark(q));
    markSegment(gp, gpRay);
    mark(gp, 5);
    mark(you, 7);
    labels.reserve({ x: star.x - starR - 3, y: star.y - starR - 3, w: starR * 2 + 6, h: starR * 2 + 6 });
    for (let t = 0; t < TAU; t += 0.06) mark({ x: cx + Math.cos(t) * R, y: cy + Math.sin(t) * R });
    // a small globe takes the short names
    const small = R < 115;

    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const rects = [];
    const clear = r => {
      if (r.x < box.x || r.y < box.y || r.x + r.w > box.x + box.w || r.y + r.h > box.y + box.h) return false;
      if (rects.some(q => hit(r, q))) return false;
      return !obstacles.some(o => o.x + o.r > r.x && o.x - o.r < r.x + r.w && o.y + o.r > r.y && o.y - o.r < r.y + r.h);
    };

    // "30°" over "FROM THE GP": beside the middle of your distance line when
    // the ring is big enough to hold it, otherwise just past you, carrying
    // the line on
    if (z >= 4) {
      const text = fmtDeg(z);
      const word = 'FROM THE GP';
      const nSize = compact ? 7.5 : 9, wSize = compact ? 6.8 : 7.5;
      const numH = plateSize(nSize) * 1.15, wordH = plateSize(wSize) * 1.15;
      const bhw = Math.max(
        plateTextWidth(ctx, text, { size: nSize, font: PLATE.dataFont, uppercase: false, tracking: 0 }),
        plateTextWidth(ctx, word, { size: wSize })) / 2;
      const bhh = (numH + wordH) / 2;
      const mid = arc[Math.floor(arc.length / 2)];
      const t = norm({ x: arc[arc.length - 1].x - arc[0].x, y: arc[arc.length - 1].y - arc[0].y });
      const nrm = { x: -t.y, y: t.x };
      const off = (compact ? 6 : 8) + Math.abs(nrm.x) * bhw + Math.abs(nrm.y) * bhh;
      const seats = [
        { x: mid.x + nrm.x * off, y: mid.y + nrm.y * off },
        { x: mid.x - nrm.x * off, y: mid.y - nrm.y * off },
      ];
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4]) {
        const a = Math.atan2(t.y, t.x) + turn;
        const ex = Math.cos(a), ey = Math.sin(a);
        const reach = (compact ? 9 : 11) + Math.abs(ex) * bhw + Math.abs(ey) * bhh;
        seats.push({ x: you.x + ex * reach, y: you.y + ey * reach });
      }
      const placed = labels.settle('distance', you, seats, {
        rectAt: c => ({ x: c.x - bhw - 2, y: c.y - bhh - 2, w: bhw * 2 + 4, h: bhh * 2 + 4 }),
        test: r => (clear(r) ? 0 : 1),
        draw(r, alpha) {
          const x = r.x + r.w / 2, y = r.y + r.h / 2;
          ctx.save();
          ctx.globalAlpha *= alpha;
          plateDataText(ctx, text, x, y - bhh + numH / 2, { size: nSize, align: 'center' });
          plateText(ctx, word, x, y + bhh - wordH / 2, { size: wSize, align: 'center' });
          ctx.restore();
        },
      });
      if (placed) {
        labels.reserve({ x: placed.rect.x + 2, y: placed.rect.y + 2, w: placed.rect.w - 4, h: placed.rect.h - 4 });
        rects.push(placed.rect);
      }
    }

    // you, labelled outward from the GP where there is room, otherwise
    // anywhere around you, inside the ring included
    const out = norm({ x: you.x - gp.x, y: you.y - gp.y });
    const youCandidates = [];
    for (const r of [13, 20, 30]) {
      for (const turn of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, Math.PI]) {
        const a = Math.atan2(out.y, out.x) + turn;
        const ex = Math.cos(a), ey = Math.sin(a);
        youCandidates.push({
          x: you.x + ex * r, y: you.y + ey * r,
          align: Math.abs(ex) < 0.35 ? 'center' : ex < 0 ? 'right' : 'left',
        });
      }
    }
    const youLabel = labels.place(small ? 'YOU' : you.front ? 'YOU · DRAG' : 'YOU · FAR SIDE', you, youCandidates,
      { size, weight: 700, backed: false, leader: false, key: 'you' });
    if (youLabel) rects.push(youLabel.rect);

    // the GP is named on the side away from you
    // (with a little play, so walking past the GP's meridian doesn't flip it
    // back and forth)
    if (Math.abs(you.x - gp.x) > 6) gpSide = you.x >= gp.x ? -1 : 1;
    const side = gpSide;
    const gpSeat = (dir, dy, id) => ({
      id, x: gp.x + dir * 9, y: gp.y + dy, align: dir < 0 ? 'right' : 'left',
    });
    const gpLabel = labels.place(small ? 'GP' : 'STAR’S GP', gp, [
      gpSeat(side, -9, side < 0 ? 'left-up' : 'right-up'),
      gpSeat(side, 10, side < 0 ? 'left-down' : 'right-down'),
      gpSeat(-side, -9, side < 0 ? 'right-up' : 'left-up'),
    ], { size, leader: false, backed: false, key: 'gp' });
    if (gpLabel) rects.push(gpLabel.rect);

    // the ring is named on the ring itself, opposite you, breaking the line
    // the way a section drawing labels a curve
    const ringSize = compact ? 7 : 7.5;
    const ringText = 'RING OF POSITION';
    const rw = plateTextWidth(ctx, ringText, { size: ringSize, weight: 600 }) + 8;
    const rh = plateSize(ringSize) * 1.5;
    const ringSpan = Math.max(...ring.map(q => Math.hypot(q.x - gp.x, q.y - gp.y)));
    if (ringSpan > rw * 0.6) {
      const near = a => ring[Math.round((((a % 360) + 360) % 360) / 2)];
      const seats = [180, 150, 210, 120, 240, 90, 270, 60, 300]
        .map(da => ({ id: da, q: near(az + da) }))
        .filter(s => s.q && s.q.front);
      const placed = labels.settle('ring', gp, seats, {
        rectAt: s => ({ x: s.q.x - rw / 2, y: s.q.y - rh / 2, w: rw, h: rh }),
        test(r) {
          if (r.x < box.x || r.x + r.w > box.x + box.w || r.y < box.y || r.y + r.h > box.y + box.h) return 1;
          // a little air from the other labels, so it doesn't read as one
          // stacked with "STAR'S GP"
          if (rects.some(o => hit({ x: r.x - 4, y: r.y - 5, w: r.w + 8, h: r.h + 10 }, o))) return 1;
          // keep clear of the starlight, which crosses the ring's top
          if (r.x < gp.x + 4 && r.x + r.w > gp.x - 4 && r.y + r.h < gp.y) return 1;
          return arc.some(p => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) ? 1 : 0;
        },
        draw(r, alpha) {
          ctx.save();
          ctx.globalAlpha *= alpha;
          ctx.fillStyle = PLATE.paper;
          ctx.fillRect(r.x, r.y, r.w, r.h);
          plateText(ctx, ringText, r.x + r.w / 2, r.y + r.h / 2, { size: ringSize, weight: 600, align: 'center' });
          ctx.restore();
        },
      });
      if (placed) labels.reserve(placed.rect);
    }
  }
})();
