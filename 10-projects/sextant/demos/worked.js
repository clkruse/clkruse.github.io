'use strict';
/* §9 worked example: two sights at 05:16:24 UTC on 19 August 2026, the
   moment Figure 7-1 opens on, built on a globe in five steps: ① the two
   sights, ② Aries's longitude from Greenwich, ③ each star's offset from
   Aries to its ground position, ④ Vega's ring, ⑤ Arcturus's ring and the
   fix. Each step's text (#worked-stages in the page) shows under the
   globe, one step at a time.
   Vega's numbers are the printed 2026 almanac values the sight story uses
   (story.js). Arcturus's offset and latitude are the USNO celestial
   navigation service's for the same moment; its altitude is the one seen
   from the fix, which sits on Vega's ring 3′ from the story's assumed
   position. Uses the plate globe helpers from globes.js. */

(function demoWorked() {
  const M = MOTION;
  const d = createDemo('demo-worked', { aspect: 1.55, maxH: 540, compactAspect: 0.78, compactMaxH: 560, draw });

  const DM = (deg, min) => deg + min / 60;
  const ARIES = DM(46, 40.7);                     // west of Greenwich
  const STARS = [
    { name: 'VEGA', offset: DM(80, 32.1), lat: DM(38, 48.6), alt: DM(42, 30.1), dimLat: -10 },
    { name: 'ARCTURUS', offset: DM(145, 46.8), lat: DM(19, 2.8), alt: DM(37, 5.3), dimLat: -19 },
  ];
  STARS.forEach(s => { s.lon = -(ARIES + s.offset); s.z = 90 - s.alt; });
  const FIX = { lat: -DM(5, 44.6), lon: -DM(144, 59.0) };
  const FAR = { lat: DM(71, 51.7), lon: DM(162, 2.8) };

  const STEPS = [
    { tab: 'SIGHTS', short: 'SIGHTS', view: { lat: 8, lon: -150 },
      lines: ['VEGA · 42° 30.1′', 'ARCTURUS · 37° 05.3′'] },
    { tab: 'ARIES', short: 'ARIES', view: { lat: 16, lon: -24 },
      lines: ['ARIES · 42° 34.0′ W + 4° 06.7′ = 46° 40.7′ W'] },
    { tab: 'THE STARS', short: 'STARS', view: { lat: 18, lon: -118 },
      lines: ['VEGA’S GP · 38° 48.6′ N, 127° 12.8′ W', 'ARCTURUS’S GP · 19° 02.8′ N, 167° 32.5′ E'] },
    { tab: 'VEGA’S RING', short: 'VEGA', view: { lat: 14, lon: -136 },
      lines: ['VEGA’S RING · 90° − 42° 30.1′ = 47° 29.9′'] },
    { tab: 'THE FIX', short: 'FIX', view: { lat: 18, lon: -155 },
      lines: ['ARCTURUS’S RING · 90° − 37° 05.3′ = 52° 54.7′', 'YOU · 5° 44.6′ S, 144° 59.0′ W'] },
  ];

  const LAST = STEPS.length;
  const step = addValue(d, { label: 'step', min: 1, max: LAST, step: 1, value: 1, onchange: () => { view.free = false; } });
  const back = addButton(d, 'Back', () => step.set(step.v - 1, { emit: true }));
  const next = addButton(d, 'Next', () => step.set(step.v + 1, { emit: true }));

  // each step's text, moved in under the globe and its buttons, one shown
  // at a time (without this script they all read in order after the figure)
  const stageBox = document.getElementById('worked-stages');
  const stages = stageBox ? [...stageBox.querySelectorAll('.worked-stage')] : [];
  if (stageBox) d.fig.querySelector('.demo-panel').append(stageBox);
  let shown = 0;
  const showStage = n => {
    if (n === shown) return;
    shown = n;
    stages.forEach(el => { el.hidden = +el.dataset.stage !== n; });
    back.disabled = n <= 1;
    next.disabled = n >= LAST;
  };

  // the view eases to each step's framing; a drag turns it freely until
  // the next step
  const view = { lat: STEPS[0].view.lat, lon: STEPS[0].view.lon, free: false };
  let geo = null;
  d.canvas.classList.add('grab');
  addDrag(d.canvas, {
    touch: 'x',
    start(p) {
      const tab = geo && geo.tabs.find(t => p.x >= t.x0 && p.x <= t.x1 && Math.abs(p.y - t.y) < 14);
      this.tab = tab || null;
      if (tab) step.set(tab.n, { emit: true });
    },
    move(p, dp) {
      if (this.tab || !geo) return;
      view.free = true;
      // the surface follows the pointer: a drag to the right brings the
      // ground to the west into the middle
      view.lon -= dp.dx / geo.R * R2D;
      view.lat = clamp(view.lat + dp.dy / geo.R * R2D, -60, 70);
    },
  });

  // a step number in its circle, then a figure, on a paper ground
  function tag(ctx, n, text, x, y, { size = 9, align = 'center', alpha = 1 } = {}) {
    const r = size * 0.68, gap = 4;
    const tw = plateTextWidth(ctx, text, { size, weight: 700, font: PLATE.dataFont, uppercase: false, tracking: 0 });
    const w = (n ? r * 2 + gap : 0) + tw;
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(left - 3, y - r - 2, w + 6, r * 2 + 4);
    if (n) {
      ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(left + r, y, r, 0, TAU); ctx.stroke();
      plateText(ctx, String(n), left + r, y + 0.5, { size: size - 1.5, weight: 700, align: 'center' });
    }
    plateDataText(ctx, text, left + (n ? r * 2 + gap : 0), y, { size, weight: 700 });
    ctx.restore();
  }

  // ① the sights as you see them: you on the horizon, Vega's line of
  // sight rising to the north-northeast, Arcturus's to the west-northwest,
  // each with its altitude
  function drawSights(ctx, { w, top, bottom, cx, size, compact }) {
    const pad = compact ? 10 : 16;
    const above = compact ? 26 : 34, below = compact ? 24 : 30;
    // as long as the room allows: the lower line reaches across half the
    // width, the higher one up to just under the tabs; then the whole view
    // sits in the middle of the space
    const L = Math.min(w * 0.36, (w / 2 - pad - 12) / Math.cos(STARS[1].alt * D2R),
      (bottom - top - above - below) / Math.sin(STARS[0].alt * D2R));
    const sceneH = above + L * Math.sin(STARS[0].alt * D2R) + below;
    const O = { x: cx, y: (top + bottom) / 2 + sceneH / 2 - below };
    plateLine(ctx, { x: pad, y: O.y }, { x: w - pad, y: O.y }, { weight: compact ? 1.2 : 1.4 });
    // the ground under you, hatched as the plates hatch it
    for (let x = O.x - 26; x <= O.x + 20; x += 6) plateLine(ctx, { x, y: O.y + 1 }, { x: x - 5, y: O.y + 7 }, { weight: 0.6 });
    plateText(ctx, 'HORIZON · WEST-NORTHWEST', pad, O.y + (compact ? 13 : 15), { size: size - 1, weight: 600 });
    plateText(ctx, 'HORIZON · NORTH-NORTHEAST', w - pad, O.y + (compact ? 13 : 15), { size: size - 1, weight: 600, align: 'right' });
    const sights = [
      { st: STARS[0], dir: 1, value: '42° 30.1′' },
      { st: STARS[1], dir: -1, value: '37° 05.3′' },
    ];
    sights.forEach(({ st, dir, value }) => {
      const a = st.alt * D2R;
      const end = { x: O.x + dir * L * Math.cos(a), y: O.y - L * Math.sin(a) };
      const r = compact ? 6 : 7.5;
      plateVector(ctx, O, { x: end.x - dir * Math.cos(a) * (r + 6), y: end.y + Math.sin(a) * (r + 6) },
        { weight: compact ? 1.1 : 1.3, head: compact ? 4.5 : 5.5 });
      starGlyph(ctx, end.x, end.y, r, PLATE.ink);
      plateText(ctx, st.name, end.x, end.y - r - (compact ? 8 : 10), { size, weight: 700, align: 'center' });
      // the altitude, as an arc up from the horizon
      const ra = L * 0.42, pts = [];
      for (let k = 0; k <= 40; k++) {
        const t = a * k / 40;
        pts.push({ x: O.x + dir * ra * Math.cos(t), y: O.y - ra * Math.sin(t) });
      }
      ctx.save(); ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 0.9; ctx.beginPath();
      pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q.x, q.y)); ctx.stroke(); ctx.restore();
      const n = pts.length;
      plateArrowhead(ctx, pts[n - 1], Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x), 4.5);
      plateArrowhead(ctx, pts[0], Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x), 4.5);
      const mid = a / 2, lr = ra + (compact ? 12 : 16);
      const lp = { x: O.x + dir * lr * Math.cos(mid), y: O.y - lr * Math.sin(mid) };
      tag(ctx, 0, value, lp.x, lp.y, { size: compact ? 9 : 11, align: dir > 0 ? 'left' : 'right' });
    });
    M.dot(ctx, O, compact ? 3 : 3.6);
    plateText(ctx, 'YOU', O.x, O.y - (compact ? 12 : 14), { size, weight: 700, align: 'center' });
  }

  // the caption's sketch: both sights, as the sextant read them
  function drawCaption(ctx, s) {
    const detail = plateCaptionDetail(ctx);
    // step 1 draws this view full size, so the caption's copy steps aside
    if (detail) detail.canvas.hidden = s === 1;
    if (detail && s > 1) {
      detail.canvas.classList.remove('grab');
      detail.canvas.style.touchAction = 'auto';
      const block = (name, value) => {
        const nw = plateTextWidth(ctx, name, { size: 7, weight: 600 });
        const vw = plateTextWidth(ctx, value, { size: 8.5, weight: 700, font: PLATE.dataFont, uppercase: false, tracking: 0 });
        return {
          w: nw + 4 + vw, h: plateSize(8.5) * 1.2,
          draw: (x, y, a, c2 = ctx) => {
            plateText(c2, name, x, y, { size: 7, weight: 600 });
            plateDataText(c2, value, x + nw + 4, y, { size: 8.5, weight: 700 });
          },
        };
      };
      plateAltitudeInstrument(detail, {
        title: 'YOUR SIGHTS',
        sights: [
          { alt: STARS[0].alt, block: block('VEGA', '42° 30.1′') },
          { alt: STARS[1].alt, block: block('ARCTURUS', '37° 05.3′') },
        ],
      });
    }
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper; ctx.fillRect(0, 0, w, h);
    const compact = w < 500, size = compact ? 8 : 9, pad = compact ? 10 : 16;
    const s = Math.round(step.v);
    showStage(s);

    // the steps, as tabs along the top
    const tabY = pad + 6, tabs = [];
    const cell = (w - pad * 2) / LAST;
    STEPS.forEach((st, i) => {
      const n = i + 1, cx = pad + cell * (i + 0.5), cur = n === s;
      const label = compact ? st.short : st.tab;
      const r = compact ? 6 : 6.5;
      const tw = plateTextWidth(ctx, label, { size, weight: cur ? 700 : 500 });
      const x0 = cx - (r * 2 + 5 + tw) / 2;
      ctx.save();
      ctx.globalAlpha = n <= s ? 1 : 0.4;
      ctx.strokeStyle = PLATE.ink; ctx.fillStyle = PLATE.paper; ctx.lineWidth = cur ? 1.6 : 0.9;
      ctx.beginPath(); ctx.arc(x0 + r, tabY, r, 0, TAU); ctx.fill(); ctx.stroke();
      plateText(ctx, String(n), x0 + r, tabY + 0.5, { size: size - 1, weight: 700, align: 'center' });
      plateText(ctx, label, x0 + r * 2 + 5, tabY, { size, weight: cur ? 700 : 500 });
      ctx.restore();
      if (cur) plateLine(ctx, { x: x0, y: tabY + 11 }, { x: x0 + r * 2 + 5 + tw, y: tabY + 11 }, { weight: 1.2 });
      tabs.push({ n, x0: pad + cell * i, x1: pad + cell * (i + 1), y: tabY });
    });

    // the step's arithmetic, under the globe
    const lines = STEPS[s - 1].lines;
    const lineH = compact ? 14 : 16;
    const textTop = h - pad - lineH * (lines.length - 1) - 4;
    const top = tabY + (compact ? 22 : 28), bottom = textTop - (compact ? 16 : 20);
    const R = Math.max(60, Math.min((w - pad * 2) / 2 - (compact ? 4 : 40), (bottom - top) / 2));
    const cx = w / 2, cy = (top + bottom) / 2;
    geo = { R, tabs };
    lines.forEach((t, i) => {
      const [head, ...rest] = t.split(' · ');
      const value = rest.join(' · ');
      const y = textTop + i * lineH;
      const hw = plateTextWidth(ctx, head + ' · ', { size, weight: 600 });
      const vw = plateTextWidth(ctx, value, { size: size + 1, weight: 700, font: PLATE.dataFont, uppercase: false, tracking: 0 });
      const x = cx - (hw + vw) / 2;
      plateText(ctx, head + ' · ', x, y, { size, weight: 600 });
      plateDataText(ctx, value, x + hw, y, { size: size + 1, weight: 700 });
    });

    if (s === 1) { drawSights(ctx, { w, top, bottom, cx, size, compact }); drawCaption(ctx, s); return; }

    // ease the view toward this step's framing
    if (!view.free) {
      const target = STEPS[s - 1].view;
      let dl = target.lon - view.lon;
      dl = ((dl + 540) % 360) - 180;
      view.lon += dl * 0.14;
      view.lat += (target.lat - view.lat) * 0.14;
    }
    const scene = drawPlateGlobeFrame(ctx, { spin: -view.lon, tilt: view.lat }, cx, cy, R, compact, {
      showCenter: false,
      gridLatitudes: [-60, -30, 0, 30, 60],
      gridLongitudeStep: 30,
      gridHiddenWeight: 0.01,
      gridVisibleWeight: compact ? 0.28 : 0.32,
      outlineWeight: compact ? 1.4 : 1.7,
    });
    const pr = (lat, lon) => scene.project(lat, lon);
    ctx.save(); ctx.globalAlpha = 0.55;
    M.strokeLand(ctx, (lat, lon) => { const q = pr(lat, lon); return q.front ? q : null; }, compact ? 0.5 : 0.6);
    ctx.restore();

    const along = (lat, lon0, lon1, n = 48) => Array.from({ length: n + 1 }, (_, i) => pr(lat, lon0 + (lon1 - lon0) * i / n));
    const meridian = (lon, lat0, lat1, n = 24) => Array.from({ length: n + 1 }, (_, i) => pr(lat0 + (lat1 - lat0) * i / n, lon));
    const front = (pts, opts) => strokePlateHemisphere(ctx, pts, true, opts);
    const ringPts = (c, z) => Array.from({ length: 181 }, (_, i) => { const q = destPoint(c.lat, c.lon, z, i * 2); return pr(q.lat, q.lon); });
    // a dimension along a parallel, arrowheads at the ends that face us
    const dim = (pts, weight) => {
      front(pts, { weight });
      const n = pts.length;
      const head = (a, b) => { if (a.front && b.front) plateArrowhead(ctx, a, Math.atan2(a.y - b.y, a.x - b.x), compact ? 4 : 4.5); };
      head(pts[n - 1], pts[n - 2]); head(pts[0], pts[1]);
    };
    const faded = alpha => fn => { ctx.save(); ctx.globalAlpha *= alpha; fn(); ctx.restore(); };
    // earlier steps fade once a later one is shown; the fix hides the offsets
    const past = n => faded(n === s ? 1 : s === LAST ? 0 : 0.35);
    // a label beside a mark, on the side away from the globe's middle unless
    // that side would run off the canvas
    const side = (text, q, opts) => {
      const tw = plateTextWidth(ctx, text, opts);
      let right = q.x >= cx;
      if (right && q.x + 7 + tw > w - 4) right = false;
      if (!right && q.x - 7 - tw < 4) right = true;
      M.backedText(ctx, text, right ? q.x + 7 : q.x - 7, q.y - 9, { ...opts, align: right ? 'left' : 'right' });
    };

    // Greenwich, the zero the almanac counts from
    if (s >= 2) {
      front(meridian(0, -70, 75), { weight: 0.8 });
      const gLab = pr(52, 0);
      if (gLab.front) M.backedText(ctx, 'GREENWICH', gLab.x + 5, gLab.y, { size: size - 1, weight: 600 });
      // ② Aries, west of Greenwich along the equator
      past(2)(() => {
        dim(along(-2, 0, -ARIES), compact ? 0.9 : 1.1);
        const m = pr(-2, -ARIES / 2);
        if (m.front) tag(ctx, 2, '46° 40.7′', m.x, m.y + (compact ? 11 : 13), { size: compact ? 8.5 : 9.5 });
      });
    }
    const aq = pr(0, -ARIES);
    if (s >= 2 && aq.front) {
      M.ring(ctx, aq, compact ? 3.6 : 4.4, { weight: 1.3 });
      M.dot(ctx, aq, 1.3);
      side('ARIES', aq, { size: size - 0.5, weight: 700 });
    }

    // ③ each star's offset west of Aries, then up its meridian to its GP
    if (s >= 3) {
      past(3)(() => {
        front(meridian(-ARIES, 0, STARS[1].dimLat - 2), { kind: 'construction', weight: 0.6 });
        STARS.forEach(st => {
          front(meridian(st.lon, st.lat, st.dimLat - 2), { kind: 'construction', weight: 0.6 });
          const pts = along(st.dimLat, -ARIES, st.lon);
          dim(pts, compact ? 0.8 : 0.95);
          const m = pts[Math.round(pts.length / 2)];
          if (m.front) tag(ctx, 3, `${Math.floor(st.offset)}° ${((st.offset % 1) * 60).toFixed(1).padStart(4, '0')}′`, m.x, m.y,
            { size: compact ? 8 : 9 });
        });
      });
      STARS.forEach(st => {
        const q = pr(st.lat, st.lon);
        if (!q.front) return;
        M.dot(ctx, q, compact ? 2.8 : 3.4);
        side(`${st.name}’S GP`, q, { size: size - 0.5, weight: 700 });
      });
    }

    // ④ and ⑤ each ring, its radius drawn toward the fix
    STARS.forEach((st, i) => {
      const n = i + 4;
      if (s < n) return;
      const pts = ringPts(st, st.z);
      strokePlateHemisphere(ctx, pts, false, { kind: 'long', weight: compact ? 0.5 : 0.6 });
      front(pts, { weight: compact ? 1.6 : 2 });
      const az = (() => {
        const a = st.lat * D2R, b = FIX.lat * D2R, dl = (FIX.lon - st.lon) * D2R;
        return Math.atan2(Math.sin(dl) * Math.cos(b), Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(dl)) * R2D;
      })();
      const radius = Array.from({ length: 31 }, (_, k) => { const q = destPoint(st.lat, st.lon, st.z * k / 30, az); return pr(q.lat, q.lon); });
      front(radius, { kind: 'construction', weight: 0.8 });
      const mq = destPoint(st.lat, st.lon, st.z * 0.55, az), m = pr(mq.lat, mq.lon);
      if (m.front) tag(ctx, n, st.z === STARS[0].z ? '47° 29.9′' : '52° 54.7′', m.x + 6, m.y, { size: compact ? 8.5 : 9.5, align: 'left' });
    });

    // the two crossings: you, and one far off to rule out
    if (s >= LAST) {
      const y = pr(FIX.lat, FIX.lon);
      if (y.front) {
        ctx.save(); ctx.fillStyle = PLATE.paper; ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(y.x, y.y, compact ? 5.5 : 6.5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
        M.dot(ctx, y, compact ? 2.2 : 2.6);
        M.backedText(ctx, 'YOU', y.x - 11, y.y + 1, { size, weight: 700, align: 'right' });
      }
      const f = pr(FAR.lat, FAR.lon);
      if (f.front) {
        M.ring(ctx, f, compact ? 3.5 : 4, { weight: 1 });
        M.backedText(ctx, 'RULED OUT', f.x + 8, f.y - 8, { size: size - 1, weight: 600 });
      }
    }

    drawCaption(ctx, s);
  }
})();
