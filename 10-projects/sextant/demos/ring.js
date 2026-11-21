'use strict';
/* Rings of position (§3). The reader's view of a star beside a globe with
   its ground position and ring, set like Figures 2-1 and 2-2. Drag the star
   in your view and the ring grows or shrinks; drag yourself around the ring
   and the star holds its altitude while the direction you look at it
   changes. Uses the plate globe helpers in demos/globes.js. */

(function demoRing() {
  const d = createDemo('demo-circle', {
    aspect: 1.75,
    maxH: 400,
    compactAspect: 0.68,
    compactMaxH: 540,
    draw,
  });

  const alt = addSlider(d, {
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
  let geo = null;
  let dragView = false;

  const fmtDeg = v => `${v.toFixed(0)}°`;
  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  // the compass direction from a to b along the great circle
  const bearing = (a, b) => {
    const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lon - a.lon) * D2R;
    const t = Math.atan2(Math.sin(dl) * Math.cos(p2),
      Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
    return ((t * R2D) % 360 + 360) % 360;
  };

  d.canvas.classList.add('grab');
  const inView = p => geo && geo.view && p.x >= geo.view.x && p.x <= geo.view.x + geo.view.w
    && p.y >= geo.view.y && p.y <= geo.view.y + geo.view.h;
  addDrag(d.canvas, {
    start(p) {
      dragView = inView(p);
      this.move(p);
    },
    move(p) {
      if (!geo) return;
      if (dragView) {
        const v = geo.view;
        const a = 90 * (v.horizonY - p.y) / (v.horizonY - v.topY);
        alt.set(clamp(Math.round(a), 5, 85), { emit: false });
        return;
      }
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

    // two panes, your view first and the globe beside it (below it on
    // phones), split by a hairline, each with its own heading
    const pad = compact ? 10 : 16;
    const fieldTop = pad;
    const fieldBottom = h - pad;
    const headSize = compact ? 8 : 9;
    const headLine = plateSize(headSize) * 1.3;
    const viewHead = 'YOUR VIEW OF THE STAR';
    const globeHead = 'YOUR RING OF POSITION';
    const headW = t => plateTextWidth(ctx, t, { size: headSize, weight: 600 });
    const heading = (lines, x, y) => lines.forEach((t, i) =>
      plateText(ctx, t, x, y + i * headLine, { size: headSize, weight: 600, align: 'center' }));
    let globeBox, viewBox;
    if (compact) {
      const headH = headLine + 8;
      const viewH = Math.min(150, (fieldBottom - fieldTop) * 0.36);
      viewBox = { x: pad, y: fieldTop + headH, w: w - pad * 2, h: viewH };
      const splitY = viewBox.y + viewH + 12;
      plateLine(ctx, { x: pad, y: splitY }, { x: w - pad, y: splitY }, { weight: 0.55 });
      heading([viewHead], w / 2, fieldTop + headLine / 2);
      heading([globeHead], w / 2, splitY + 12 + headLine / 2);
      const gy = splitY + 12 + headH;
      globeBox = { x: pad, y: gy, w: w - pad * 2, h: fieldBottom - gy };
    } else {
      const viewW = Math.min(260, w * 0.34);
      const wrap = headW(viewHead) > viewW - 8;
      const viewLines = wrap ? ['YOUR VIEW', 'OF THE STAR'] : [viewHead];
      const headH = headLine * viewLines.length + 10;
      const splitX = pad + viewW + pad;
      viewBox = { x: pad, y: fieldTop + headH, w: viewW, h: fieldBottom - fieldTop - headH };
      globeBox = { x: splitX + pad, y: fieldTop + headH, w: w - splitX - pad * 2, h: fieldBottom - fieldTop - headH };
      plateLine(ctx, { x: splitX, y: fieldTop }, { x: splitX, y: fieldBottom }, { weight: 0.55 });
      heading(viewLines, viewBox.x + viewW / 2, fieldTop + headLine / 2);
      heading([globeHead], globeBox.x + globeBox.w / 2, fieldTop + headLine / 2);
    }

    const youGeo = destPoint(GP.lat, GP.lon, z, az);
    const look = COMPASS[Math.round(bearing(youGeo, GP) / 45) % 8];
    geo = {};
    drawGlobe(ctx, globeBox, z, youGeo, compact);
    drawView(ctx, viewBox, alt.v, look, compact);
  }

  function drawGlobe(ctx, box, z, youGeo, compact) {
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
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
        const a = Math.atan2(t.y, t.x) + turn;
        const ex = Math.cos(a), ey = Math.sin(a);
        const reach = (compact ? 9 : 11) + Math.abs(ex) * bhw + Math.abs(ey) * bhh;
        seats.push({ x: you.x + ex * reach, y: you.y + ey * reach });
      }
      const rectAt = c => ({ x: c.x - bhw - 2, y: c.y - bhh - 2, w: bhw * 2 + 4, h: bhh * 2 + 4 });
      const at = seats.find(c => clear(rectAt(c)));
      if (at) {
        plateDataText(ctx, text, at.x, at.y - bhh + numH / 2, { size: nSize, align: 'center' });
        plateText(ctx, word, at.x, at.y + bhh - wordH / 2, { size: wSize, align: 'center' });
        labels.reserve({ x: at.x - bhw, y: at.y - bhh, w: bhw * 2, h: bhh * 2 });
        rects.push(rectAt(at));
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
    const side = you.x >= gp.x ? -1 : 1;
    const gpLabel = labels.place(small ? 'GP' : 'STAR’S GP', gp, [
      { x: gp.x + side * 9, y: gp.y - 9, align: side < 0 ? 'right' : 'left' },
      { x: gp.x + side * 9, y: gp.y + 10, align: side < 0 ? 'right' : 'left' },
      { x: gp.x - side * 9, y: gp.y - 9, align: side < 0 ? 'left' : 'right' },
    ], { size, leader: false, backed: false });
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
      for (const da of [180, 150, 210, 120, 240, 90, 270, 60, 300]) {
        const q = near(az + da);
        if (!q || !q.front) continue;
        const r = { x: q.x - rw / 2, y: q.y - rh / 2, w: rw, h: rh };
        if (r.x < box.x || r.x + r.w > box.x + box.w || r.y < box.y || r.y + r.h > box.y + box.h) continue;
        if (rects.some(o => hit(r, o))) continue;
        // keep clear of the starlight, which crosses the ring's top
        if (r.x < gp.x + 4 && r.x + r.w > gp.x - 4 && r.y + r.h < gp.y) continue;
        if (arc.some(p => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h)) continue;
        ctx.save();
        ctx.fillStyle = PLATE.paper;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.restore();
        plateText(ctx, ringText, q.x, q.y, { size: ringSize, weight: 600, align: 'center' });
        labels.reserve(r);
        break;
      }
    }
  }

  function drawView(ctx, box, alt, look, compact) {
    const size = compact ? 7.5 : 8.5;
    const ruleY = box.y;

    // sky above a sea horizon; altitude runs linearly up the frame
    const seaH = Math.max(compact ? 14 : 22, box.h * 0.13);
    const horizonY = box.y + box.h - seaH;
    const topY = ruleY + (compact ? 12 : 16);
    const yOf = deg => horizonY - (horizonY - topY) * deg / 90;
    geo.view = { ...box, horizonY, topY };
    const scaleX = box.x + (compact ? 34 : 42);
    const right = box.x + box.w - 8;

    // sea: short broken strokes thinning toward the eye
    for (let y = horizonY + 5, i = 0; y < box.y + box.h - 3; y += compact ? 5 : 6, i++) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = 0.45;
      ctx.setLineDash([6 + i * 3, 5 + i * 2]);
      ctx.lineDashOffset = i * 7;
      ctx.beginPath();
      ctx.moveTo(box.x + 4, y);
      ctx.lineTo(box.x + box.w - 4, y);
      ctx.stroke();
      ctx.restore();
    }
    plateLine(ctx, { x: box.x + 1, y: horizonY }, { x: box.x + box.w - 1, y: horizonY }, {
      weight: compact ? 1.2 : 1.5,
    });

    // altitude scale
    plateLine(ctx, { x: scaleX, y: horizonY }, { x: scaleX, y: topY }, { weight: 0.8 });
    for (let deg = 0; deg <= 90; deg += 15) {
      const y = yOf(deg);
      const major = deg % 30 === 0;
      plateLine(ctx, { x: scaleX - (major ? 5 : 3), y }, { x: scaleX, y }, { weight: 0.7 });
      if (major) {
        plateDataText(ctx, `${deg}°`, scaleX - 8, deg === 0 ? y - 6 : y, { size, align: 'right' });
        if (deg > 0) {
          plateLine(ctx, { x: scaleX + 3, y }, { x: right, y }, { kind: 'short', weight: 0.3 });
        }
      }
    }
    plateText(ctx, 'HORIZON', right, horizonY - (compact ? 7 : 9), {
      size: compact ? 7 : 7.5, align: 'right',
    });
    plateText(ctx, 'OVERHEAD', right, topY - (compact ? 7 : 9), {
      size: compact ? 7 : 7.5, align: 'right',
    });

    const readoutW = plateTextWidth(ctx, 'ALTITUDE', { size: compact ? 7 : 7.5 }) + (compact ? 10 : 13) + 6;
    const starX = Math.max(scaleX + 14, Math.min((scaleX + right) / 2 + (compact ? 0 : 6), box.x + box.w - readoutW));
    const sy = yOf(alt);
    plateLine(ctx, { x: starX, y: horizonY }, { x: starX, y: sy + 9 }, { kind: 'long', weight: 0.7 });
    starGlyph(ctx, starX, sy, compact ? 5.5 : 7, PLATE.ink);
    const ay = clamp(sy, topY + 4, horizonY - (compact ? 18 : 24));
    const wSize = compact ? 7 : 7.5, nSize = compact ? 8.5 : 10;
    const wordW = plateTextWidth(ctx, 'ALTITUDE', { size: wSize });
    const numW = plateTextWidth(ctx, '90°', { size: nSize, weight: 700, font: PLATE.dataFont, uppercase: false, tracking: 0 });
    const gapX = compact ? 10 : 13;
    const room = box.x + box.w - 6 - (starX + gapX);
    const ax = starX + gapX;
    if (wordW + 5 + numW <= room) {
      plateText(ctx, 'ALTITUDE', ax, ay, { size: wSize });
      plateDataText(ctx, fmtDeg(alt), ax + wordW + 5, ay, { size: nSize, weight: 700 });
    } else {
      const lh = plateSize(wSize) * 0.75;
      const sy2 = Math.min(ay, horizonY - (compact ? 26 : 34));
      plateText(ctx, 'ALTITUDE', ax, sy2 - lh, { size: wSize });
      plateDataText(ctx, fmtDeg(alt), ax, sy2 + lh + 1, { size: nSize, weight: 700 });
    }

    // the direction you face to see it, set on the sea below the star: it
    // turns as you walk the ring while the altitude holds
    const lookText = `LOOKING ${look}`;
    const lookSize = compact ? 7 : 7.5;
    const lw = plateTextWidth(ctx, 'LOOKING NW', { size: lookSize, weight: 600 });
    const ly = horizonY + seaH / 2 + 1;
    const lx = clamp(starX, box.x + lw / 2 + 6, box.x + box.w - lw / 2 - 6);
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(lx - lw / 2 - 4, ly - plateSize(lookSize) * 0.8, lw + 8, plateSize(lookSize) * 1.6);
    ctx.restore();
    plateText(ctx, lookText, lx, ly, { size: lookSize, weight: 600, align: 'center' });
  }
})();
