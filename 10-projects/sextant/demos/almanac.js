'use strict';
/* §7: why the almanac stays small, as a slide rule. The sky's scale holds
   still on top, Aries at its right and each star a fixed offset (SHA) to
   the west; the ground map slides east under it as the Earth turns. The
   one number the book tracks is where Aries's line meets the ground.
   Hour angles run westward from Greenwich. */

(function demoAlmanac() {
  const M = MOTION;
  const d = createDemo('demo-almanac', { aspect: 1.7, maxH: 460, compactAspect: 1.33, compactMaxH: 440, draw });
  const STORY_SOURCE = 'demo-almanac';
  const WORKED = SIGHT_STORY.state;
  const RATE = SIGHT_STORY.constants.stellarRate;
  const STARS = [
    { name: 'Vega', sha: WORKED.sha, dec: WORKED.dec },
    { name: 'Arcturus', sha: 145 + 46.8 / 60, dec: 19 + 2.8 / 60 },
    { name: 'Capella', sha: 280 + 30 / 60, dec: 46.02 },
  ];
  const wrap360 = a => ((a % 360) + 360) % 360;
  const gha = t => wrap360(WORKED.ghaAries + (t - WORKED.utcHours) * RATE);
  const dm = v => {
    let deg = Math.floor(v), m = Math.round((v - deg) * 60);
    if (m === 60) { deg += 1; m = 0; }
    return `${deg}° ${String(m).padStart(2, '0')}′`;
  };
  const utc = t => {
    const s = Math.round(t * 3600), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} UTC`;
  };

  // time, by dragging the map or the arrow keys, shared with the sight story.
  // The clock wraps through midnight, so the map pans without end. The figure
  // shows no date, so crossing midnight steps Aries back the ~1° a day gains.
  const wrap24 = h => ((h % 24) + 24) % 24;
  // time only runs forward, as the Earth only turns east: the keys that would
  // step it back are swallowed before addValue sees them
  d.canvas.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); e.stopImmediatePropagation(); }
  });
  const t = addValue(d, {
    label: 'time', min: -Infinity, max: Infinity, step: 1 / 12, value: WORKED.utcHours,
    onchange: v => {
      const u = wrap24(v);
      if (u !== v) t.set(u);
      if (Math.abs(SIGHT_STORY.state.utcHours - u) > 1e-10) SIGHT_STORY.set({ utcHours: u }, { source: STORY_SOURCE });
    },
  });
  SIGHT_STORY.subscribe((state, source) => {
    if (source !== STORY_SOURCE) t.set(state.utcHours);
  });
  d.addPreset('worked', () => t.set(WORKED.utcHours, { emit: true }));
  const stat = {
    time: addStat(d, 'Time'),
    aries: addStat(d, 'Aries longitude'),
    vega: addStat(d, 'Vega longitude', true),
  };

  let k = 2;
  d.canvas.classList.add('grab');
  addDrag(d.canvas, { touch: 'x', move(p, dp) { if (dp.dx > 0) t.set(t.v + dp.dx / k / RATE, { emit: true }); } });

  // the caption's minimap: the same moment on a globe that holds still
  // against the sky, faced midway between Aries and Vega, so the land turns
  // east under them while Vega's offset holds as an arc on the equator
  let globeR = 60;
  function drawGlobe(lonAries) {
    const detail = plateCaptionDetail(d.ctx);
    if (!detail) return;
    const c = detail.ctx, { w, h } = detail;
    plateText(c, 'ON THE GLOBE', w / 2, 9, { size: 7, weight: 700, align: 'center' });
    const R = Math.min(w / 2 - 8, (h - 26) / 2);
    globeR = R;
    // dragging the globe turns it, east only, as the map does: a sideways
    // drag of one radius turns it one radian
    if (!detail.canvas._almanacDrag) {
      detail.canvas._almanacDrag = true;
      addDrag(detail.canvas, { touch: 'x', move(p, dp) { if (dp.dx > 0) t.set(t.v + dp.dx / globeR * R2D / RATE, { emit: true }); } });
    }
    const cx = w / 2, cy = 18 + R + (h - 22 - R * 2) / 2;
    const lonVega = lonAries - STARS[0].sha, facing = lonAries - STARS[0].sha / 2;
    const scene = drawPlateGlobeFrame(c, { spin: -facing, tilt: 22 }, cx, cy, R, true, {
      showCenter: false,
      gridLatitudes: [-30, 0, 30, 60],
      gridLongitudeStep: 30,
      gridHiddenWeight: 0.01,
      gridVisibleWeight: 0.3,
      outlineWeight: 1.2,
    });
    const pr = scene.project;
    MOTION.strokeLand(c, (lat, lon) => { const q = pr(lat, lon); return q.front ? q : null; }, 0.45);
    // Vega's offset west of Aries, along the equator, and Vega's meridian
    // down to it
    const eq = Array.from({ length: 41 }, (_, i) => pr(0, lonAries - STARS[0].sha * i / 40));
    strokePlateHemisphere(c, eq, true, { kind: 'solid', weight: 1.8 });
    strokePlateHemisphere(c, Array.from({ length: 11 }, (_, i) => pr(STARS[0].dec * i / 10, lonVega)), true, { kind: 'construction', weight: 0.7 });
    const mid = pr(0, lonAries - STARS[0].sha / 2);
    MOTION.backedText(c, dm(STARS[0].sha), mid.x, mid.y + 9, { size: 6.5, weight: 700, align: 'center' });
    // labels first, then the marks over them, so no label hides a mark;
    // Aries is named toward the middle, the stars to their east
    const marks = [
      ...STARS.map(s => ({ name: s.name.toUpperCase(), q: pr(s.dec, lonAries - s.sha), dx: 4 })),
      { name: 'ARIES', q: pr(0, lonAries), dx: -4, aries: true },
    ].filter(m => m.q.front);
    marks.forEach(m => MOTION.backedText(c, m.name, m.q.x + m.dx, m.q.y - 7,
      { size: 6.5, weight: 700, align: m.dx < 0 ? 'right' : 'left' }));
    marks.forEach(m => m.aries ? MOTION.ring(c, m.q, 2.8, { weight: 1.1 }) : starGlyph(c, m.q.x, m.q.y, 4.5, PLATE.ink));
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper; ctx.fillRect(0, 0, w, h);
    const compact = w < 500, size = compact ? 8 : 9, pad = compact ? 10 : 16;
    const x0 = pad, W = w - pad * 2;
    k = W / 360;
    const xA = x0 + W * 0.88;
    const g = gha(t.v), lonAries = -g;

    // the sky: a fixed scale, with each star's offset west of Aries drawn
    // as an arrow from Aries, stacked longest on top
    const rowStep = compact ? 15 : 16, row0 = pad + (compact ? 28 : 30);
    const rowY = i => row0 + (STARS.length - 1 - i) * rowStep;
    const skyY = rowY(0) + (compact ? 13 : 14);
    plateText(ctx, 'THE SKY · EACH STAR’S FIXED OFFSET FROM ARIES', x0, pad + 6, { size: size - 0.5, weight: 700 });
    plateLine(ctx, { x: x0, y: skyY }, { x: x0 + W, y: skyY }, { weight: 1.2 });
    for (let o = -40; o <= 320; o += 10) {
      const x = xA - o * k;
      if (x < x0 - 0.5 || x > x0 + W + 0.5) continue;
      plateLine(ctx, { x, y: skyY }, { x, y: skyY + (o % 30 === 0 ? 6 : 3) }, { weight: 0.6 });
    }
    plateLine(ctx, { x: xA, y: skyY }, { x: xA, y: rowY(STARS.length - 1) - 4 }, { weight: 0.6 });
    plateText(ctx, 'ARIES', xA, rowY(STARS.length - 1) - 12, { size, weight: 700, align: 'center' });
    STARS.forEach((s, i) => {
      const x = xA - s.sha * k, y = rowY(i);
      plateLine(ctx, { x, y: skyY }, { x, y: y - 4 }, { weight: 0.6 });
      plateLine(ctx, { x: xA, y }, { x: x + 1, y }, { weight: compact ? 0.8 : 0.9 });
      plateArrowhead(ctx, { x, y }, Math.PI, compact ? 4.5 : 5);
      M.backedText(ctx, dm(s.sha), (xA + x) / 2, y, { size: size - 1, weight: i === 0 ? 700 : 500, align: 'center' });
    });

    // the ground: a map band that slides east, tiled so it wraps
    // the map keeps the world's proportions: 135° of latitude to the 360°
    // of longitude across, at the same scale both ways
    const mapTop = skyY + (compact ? 20 : 24);
    const mapBot = Math.min(h - pad - (compact ? 34 : 40), mapTop + 135 * k);
    const latY = lat => mapTop + (75 - lat) / 135 * (mapBot - mapTop);
    const xOf = L => xA + (L - lonAries) * k;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, mapTop, W, mapBot - mapTop); ctx.clip();
    // coastlines a step back from the ink, the grid further still; the
    // equator and Greenwich stay full as the references
    ctx.globalAlpha = 0.6;
    for (const sh of [-720, -360, 0, 360]) {
      M.strokeLand(ctx, (lat, L) => lat >= -60 && lat <= 75 ? { x: xOf(L + sh), y: latY(lat) } : null, compact ? 0.5 : 0.6,
        (a, b) => Math.abs(a - b) > 180);
    }
    ctx.globalAlpha = 0.35;
    for (const lat of [-30, 30, 60]) plateLine(ctx, { x: x0, y: latY(lat) }, { x: x0 + W, y: latY(lat) }, { kind: 'short', weight: 0.3 });
    // the meridians, turning with the ground
    for (let L = -720; L <= 360; L += 30) {
      const x = xOf(L);
      if (L % 360 !== 0 && x >= x0 && x <= x0 + W) plateLine(ctx, { x, y: mapTop }, { x, y: mapBot }, { kind: 'short', weight: 0.3 });
    }
    ctx.globalAlpha = 1;
    plateLine(ctx, { x: x0, y: latY(0) }, { x: x0 + W, y: latY(0) }, { kind: 'short', weight: 0.5 });
    for (let L = -720; L <= 360; L += 360) {
      const x = xOf(L);
      if (x >= x0 && x <= x0 + W) plateLine(ctx, { x, y: mapTop }, { x, y: mapBot }, { weight: 0.6 });
    }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 1.2;
    ctx.strokeRect(x0, mapTop, W, mapBot - mapTop); ctx.restore();
    plateText(ctx, 'THE GROUND · SLIDES EAST', x0, mapBot + (compact ? 12 : 14), { size: size - 0.5, weight: 700 });
    // the ground's longitude scale under the map
    for (let L = -720; L <= 360; L += 30) {
      const x = xOf(L);
      if (x < x0 + 14 || x > x0 + W - 14) continue;
      const ll = (((L + 540) % 360) + 360) % 360 - 180;
      if (!compact || ll % 60 === 0) {
        plateText(ctx, ll === 0 ? 'GREENWICH' : `${Math.abs(ll)}° ${ll < 0 ? 'W' : 'E'}`, x, mapBot + (compact ? 24 : 28),
          { size: size - 1.5, align: 'center', weight: ll === 0 ? 700 : 500 });
      }
    }

    // each star dropped from the sky's scale to its ground position
    STARS.forEach(s => {
      const x = xA - s.sha * k, gp = { x, y: latY(s.dec) };
      plateLine(ctx, { x, y: skyY }, gp, { kind: 'long', weight: 0.7 });
      starGlyph(ctx, x, skyY, compact ? 5 : 6, PLATE.ink);
      M.backedText(ctx, s.name, x + 9, gp.y - 10, { size, weight: 600 });
      starGlyph(ctx, gp.x, gp.y, compact ? 5 : 6, PLATE.ink);
    });

    // Aries: its drop line meets the ground at its longitude
    plateLine(ctx, { x: xA, y: skyY }, { x: xA, y: mapBot }, { kind: 'construction', weight: 1 });
    M.ring(ctx, { x: xA, y: skyY }, compact ? 4 : 5, { weight: 1.4 });
    M.ring(ctx, { x: xA, y: latY(0) }, compact ? 3 : 3.6, { weight: 1.2 });
    M.backedText(ctx, `ARIES ${M.lonText(lonAries)}`, xA - 6, mapBot - 10, { size, weight: 700, align: 'right' });
    plateText(ctx, 'DRAG THE MAP EAST', x0 + W, mapBot + (compact ? 12 : 14), { size: size - 1, weight: 600, align: 'right' });

    drawGlobe(lonAries);
    stat.time.set(utc(t.v));
    stat.aries.set(M.lonText(lonAries));
    stat.vega.set(`${M.lonText(lonAries)} + ${dm(STARS[0].sha)} = ${M.lonText(lonAries - STARS[0].sha)}`);
  }
})();
