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
    { tab: 'SIGHTS', short: 'SIGHTS', view: { lat: 8, lon: -150 }, lines: [] },
    { tab: 'ARIES', short: 'ARIES', view: { lat: 16, lon: -24 },
      lines: ['ARIES · 42° 34.0′ W + 4° 06.7′ = 46° 40.7′ W'] },
    { tab: 'THE STARS', short: 'STARS', view: { lat: 18, lon: -118 },
      lines: ['VEGA’S GP · 38° 48.6′ N, 127° 12.8′ W', 'ARCTURUS’S GP · 19° 02.8′ N, 167° 32.5′ E'] },
    { tab: 'VEGA’S RING', short: 'VEGA', view: { lat: 14, lon: -136 },
      lines: () => [`VEGA’S RING · 90° − ${fmtT(altT(0))} = ${fmtT(54000 - altT(0))}`] },
    { tab: 'THE FIX', short: 'FIX', view: { lat: 18, lon: -155 },
      lines: () => [`ARCTURUS’S RING · 90° − ${fmtT(altT(1))} = ${fmtT(54000 - altT(1))}`, `YOU · ${latLon(you)}`] },
  ];

  const LAST = STEPS.length;
  // in step 1, up and down turn the arm by a minute (ten with shift), ahead
  // of the step control's own arrow keys
  d.canvas.addEventListener('keydown', e => {
    if (shown !== 1 || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    setArm(sight.hs[sight.cur] + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1) / 60, { stepped: true });
  });
  const step = addValue(d, { label: 'step', min: 1, max: LAST, step: 1, value: 1, onchange: () => { view.free = false; } });

  // ① the reader takes both sights with the sextant from Figure 4-2: Vega,
  // then Arcturus. Take sight records whatever the arm reads, right or
  // wrong, and the rest of the example works from it: the rings, the fix,
  // and the sheets under the figure. Within 6′ of the star the arm settles
  // on the almanac's exact figure (a real sextant's micrometer drum does
  // that last bit). Until a sight is taken, the later steps use the true
  // altitudes.
  const sight = { cur: 0, hs: [15, 15], taken: [null, null] };
  const SNAP = 0.1;
  // angles in tenths of an arcminute, so the sheets' sums come out exact
  const T = v => Math.round(v * 600);
  const fmtT = t => {
    const deg = Math.floor(t / 600);
    return `${deg}° ${((t - deg * 600) / 10).toFixed(1).padStart(4, '0')}′`;
  };
  const fmtDM = v => fmtT(T(v));
  const altT = i => T(sight.taken[i] ?? STARS[i].alt);
  const zOf = i => (54000 - altT(i)) / 600;
  const latLon = p => `${fmtDM(Math.abs(p.lat))} ${p.lat < 0 ? 'S' : 'N'}, ${fmtDM(Math.abs(p.lon))} ${p.lon < 0 ? 'W' : 'E'}`;

  // where the two rings cross: the one near the true fix is you, the other
  // is far off in the Arctic
  const vec = (lat, lon) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crossings = () => {
    const g1 = vec(STARS[0].lat, STARS[0].lon), g2 = vec(STARS[1].lat, STARS[1].lon);
    const c1 = Math.cos(zOf(0) * D2R), c2 = Math.cos(zOf(1) * D2R), dd = dot3(g1, g2);
    const a = (c1 - dd * c2) / (1 - dd * dd), b = (c2 - dd * c1) / (1 - dd * dd);
    const n = [g1[1] * g2[2] - g1[2] * g2[1], g1[2] * g2[0] - g1[0] * g2[2], g1[0] * g2[1] - g1[1] * g2[0]];
    const c = Math.sqrt(Math.max(0, (1 - a * a - b * b - 2 * a * b * dd) / dot3(n, n)));
    const pts = [1, -1].map(sg => {
      const x = [0, 1, 2].map(i => a * g1[i] + b * g2[i] + sg * c * n[i]);
      return { lat: Math.asin(clamp(x[2], -1, 1)) * R2D, lon: Math.atan2(x[1], x[0]) * R2D };
    });
    const off = p => globeAngularDistance(p, FIX);
    return off(pts[0]) <= off(pts[1]) ? pts : [pts[1], pts[0]];
  };
  let you = { ...FIX }, far = { ...FAR }, missNM = 0;

  // the sheets under the figure follow the sights
  const angHTML = (t, hem = '') => {
    const deg = Math.floor(t / 600);
    return `<span class="deg">${deg}°</span><span class="min">${((t - deg * 600) / 10).toFixed(1).padStart(4, '0')}′</span>${hem === null ? '' : `<span class="hem">${hem}</span>`}`;
  };
  const cells = name => [...document.querySelectorAll(`#worked-stages [data-w="${name}"]`)];
  // (a blank N/S/E/W slot stays, so the column keeps lining up)
  const setAng = (name, t, hem) => cells(name).forEach(el => {
    const slot = el.querySelector('.hem');
    el.innerHTML = angHTML(t, hem !== undefined ? hem : slot ? slot.textContent : null);
  });
  const update = () => {
    [you, far] = crossings();
    missNM = globeAngularDistance(you, FIX) * 60;
    document.querySelectorAll('#worked-stages [data-sight]').forEach(td => {
      const i = +td.dataset.sight;
      td.classList.toggle('pending', sight.taken[i] === null);
      td.querySelector('.ang').innerHTML = angHTML(altT(i), null);
    });
    [0, 1].forEach(i => {
      setAng(`alt${i}`, altT(i));
      setAng(`rad${i}`, 54000 - altT(i));
    });
    setAng('lat', T(Math.abs(you.lat)), you.lat < 0 ? 'S' : 'N');
    setAng('lon', T(Math.abs(you.lon)), you.lon < 0 ? 'W' : 'E');
    cells('fix').forEach(el => { el.textContent = latLon(you); });
    cells('miss').forEach(el => {
      el.hidden = missNM < 0.5;
      const n = el.querySelector('[data-w="miss-nm"]');
      if (n) n.textContent = missNM < 1.5 ? 'about a nautical mile' : `about ${Math.round(missNM)} nautical miles`;
    });
  };
  update();
  const setArm = (a, { stepped = false } = {}) => {
    const st = STARS[sight.cur], was = sight.hs[sight.cur];
    a = clamp(a, 0, 120);
    // a drag settles on the star near it; a key press stops on it in passing
    const onStar = stepped ? (was < st.alt) !== (a < st.alt) || a === st.alt : Math.abs(a - st.alt) < SNAP;
    if (onStar) a = st.alt;
    else a = Math.round(a * 60) / 60;
    sight.hs[sight.cur] = a;
    buttons();
  };
  // in step 1, Next takes the sight in view, then moves to the next star;
  // Back returns to Vega to take it again
  const back = addButton(d, 'Back', () => {
    if (step.v === 1 && sight.cur === 1) { sight.cur = 0; buttons(); return; }
    step.set(step.v - 1, { emit: true });
  });
  const taking = () => shown === 1 && sight.taken[sight.cur] !== sight.hs[sight.cur];
  const next = addButton(d, 'Next', () => {
    if (taking()) {
      if (!sx || !sx.starSeen) return;
      sight.taken[sight.cur] = sight.hs[sight.cur];
      update();
      if (sight.cur === 0) sight.cur = 1;
      buttons();
      return;
    }
    if (step.v === 1 && sight.cur === 0) { sight.cur = 1; buttons(); return; }
    step.set(step.v + 1, { emit: true });
  });
  const buttons = () => {
    back.disabled = shown <= 1 && sight.cur === 0;
    const label = taking() ? 'Take sight' : 'Next';
    if (next.textContent !== label) next.textContent = label;
    // a sight needs its star in the eyepiece
    next.disabled = shown >= LAST || (taking() && !(sx && sx.starSeen));
  };

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
    // a finger on the sextant's arm drags it; on the globe, a sideways
    // swipe turns it and an up-and-down one scrolls the page
    d.canvas.style.touchAction = n === 1 ? 'manipulation' : 'pan-y';
    buttons();
  };

  // the view eases to each step's framing; a drag turns it freely until
  // the next step
  const view = { lat: STEPS[0].view.lat, lon: STEPS[0].view.lon, free: false };
  let geo = null;
  // the sextant's geometry, in its own frame under the tabs (sx.top down)
  let sx = null;
  const local = p => ({ x: p.x, y: p.y - sx.top });
  const angleAt = p => {
    let a = Math.atan2(p.y - sx.Pv.y, p.x - sx.Pv.x) - sx.phi0;
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a / sx.rate;
  };
  const sightAt = p => Math.atan2(sx.Pv.y - p.y, p.x - sx.Pv.x) * R2D;
  const onTab = p => geo && geo.tabs.find(t => p.x >= t.x0 && p.x <= t.x1 && Math.abs(p.y - t.y) < 14);
  const onEye = p => sx && sx.eye && Math.hypot(p.x - sx.eye.x, p.y - sx.eye.y) < sx.eye.r + 12;
  const onSextant = p => sx && (onEye(p) || nearGrab(local(p), [...sx.grab, ...(sx.sight || []), ...(sx.label || [])]));
  d.canvas.classList.add('grab');
  addDrag(d.canvas, {
    touch: () => (shown === 1 ? 'hit' : 'x'),
    hit: p => Boolean(onTab(p) || onSextant(p)),
    start(p) {
      const tab = onTab(p);
      this.tab = tab || null;
      this.arm = null;
      if (tab) { step.set(tab.n, { emit: true }); return; }
      if (shown === 1 && sx && onEye(p)) {
        // on a phone the eyepiece is in the figure: drag the star down in it
        this.arm = { eye: { y: p.y, v: sight.hs[sight.cur] } };
        return;
      }
      if (shown === 1 && sx) {
        // as in Figure 4-2: the arm follows the pointer; the line of sight
        // or the reading under the scale turn it by as much as it moves
        const q = local(p);
        const onArm = nearGrab(q, sx.grab);
        const bySight = !onArm && sx.sight && nearGrab(q, sx.sight, 24);
        const byLabel = !onArm && !bySight && sx.label && nearGrab(q, sx.label, 24);
        const at = bySight ? sightAt : angleAt;
        this.arm = { at, off: bySight || byLabel ? sight.hs[sight.cur] - at(q) : 0 };
        this.move(p);
      }
    },
    move(p, dp) {
      if (this.tab || !geo) return;
      if (this.arm && this.arm.eye) { if (sx.k) setArm(this.arm.eye.v + (p.y - this.arm.eye.y) / sx.k); return; }
      if (this.arm) { setArm(this.arm.at(local(p)) + this.arm.off); return; }
      if (shown === 1 || !dp) return;
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

  // in step 1's eyepiece, drag the star down onto the horizon
  let viewGrab = null;
  onDetailDrag(d, (y, first) => {
    if (shown !== 1 || !sx || !sx.k) return;
    if (first) viewGrab = { y, v: sight.hs[sight.cur] };
    if (viewGrab) setArm(viewGrab.v + (y - viewGrab.y) / sx.k);
  });

  // the caption: the eyepiece while the sights are taken, then a sketch of
  // both sights as the sextant read them
  function drawCaption(ctx, s) {
    const detail = plateCaptionDetail(ctx);
    if (detail) {
      detail.canvas.classList.toggle('grab', s === 1);
      detail.canvas.style.touchAction = s === 1 ? 'none' : 'auto';
    }
    // (on a phone, step 1 draws its eyepiece in the figure instead)
    if (detail) detail.canvas.hidden = s === 1 && Boolean(sx && sx.eye);
    if (detail && s === 1 && sx && !sx.eye) {
      drawSextantEyepiece(ctx, sx, { hs: sight.hs[sight.cur], starAlt: STARS[sight.cur].alt });
    }
    if (detail && s > 1) {
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
          { alt: altT(0) / 600, block: block('VEGA', fmtT(altT(0))) },
          { alt: altT(1) / 600, block: block('ARCTURUS', fmtT(altT(1))) },
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
    const lines = typeof STEPS[s - 1].lines === 'function' ? STEPS[s - 1].lines() : STEPS[s - 1].lines;
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

    // ① the sextant, in its own frame under the tabs
    if (s === 1) {
      const st = STARS[sight.cur], hs = sight.hs[sight.cur];
      const fTop = tabY + (compact ? 14 : 20);
      const state = sight.taken[sight.cur] === hs ? 'SIGHT TAKEN' : hs === st.alt ? 'ON THE HORIZON' : 'DRAG THE ARM';
      // on a phone the caption sits far below, so the eyepiece goes in the
      // room under the sextant
      const eyeH = compact ? 138 : 0;
      ctx.save();
      ctx.translate(0, fTop);
      sx = drawSextantPlate(ctx, w, h - fTop - (compact ? 4 : 8) - eyeH, {
        hs, starAlt: st.alt, starName: st.name, fmt: fmtDM, k: sx && sx.k,
        title: `SIGHT ${sight.cur + 1} OF 2 · ${st.name} · ${state}`,
      });
      ctx.restore();
      sx.top = fTop;
      sx.eye = compact
        ? drawSextantEyepiece(ctx, sx, { hs, starAlt: st.alt, into: { x: w / 2 - 66, y: h - 4 - eyeH, w: 132, h: eyeH } })
        : null;
      buttons();
      drawCaption(ctx, s);
      return;
    }

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
      const z = zOf(i), pts = ringPts(st, z);
      strokePlateHemisphere(ctx, pts, false, { kind: 'long', weight: compact ? 0.5 : 0.6 });
      front(pts, { weight: compact ? 1.6 : 2 });
      const az = (() => {
        const a = st.lat * D2R, b = you.lat * D2R, dl = (you.lon - st.lon) * D2R;
        return Math.atan2(Math.sin(dl) * Math.cos(b), Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(dl)) * R2D;
      })();
      const radius = Array.from({ length: 31 }, (_, k) => { const q = destPoint(st.lat, st.lon, z * k / 30, az); return pr(q.lat, q.lon); });
      front(radius, { kind: 'construction', weight: 0.8 });
      const mq = destPoint(st.lat, st.lon, z * 0.55, az), m = pr(mq.lat, mq.lon);
      if (m.front) tag(ctx, n, fmtT(54000 - altT(i)), m.x + 6, m.y, { size: compact ? 8.5 : 9.5, align: 'left' });
    });

    // the two crossings: you, and one far off to rule out
    if (s >= LAST) {
      const y = pr(you.lat, you.lon);
      if (y.front) {
        ctx.save(); ctx.fillStyle = PLATE.paper; ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(y.x, y.y, compact ? 5.5 : 6.5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
        M.dot(ctx, y, compact ? 2.2 : 2.6);
        M.backedText(ctx, 'YOU', y.x - 11, y.y + 1, { size, weight: 700, align: 'right' });
      }
      const f = pr(far.lat, far.lon);
      if (f.front) {
        M.ring(ctx, f, compact ? 3.5 : 4, { weight: 1 });
        M.backedText(ctx, 'RULED OUT', f.x + 8, f.y - 8, { size: size - 1, weight: 600 });
      }
    }

    drawCaption(ctx, s);
  }
})();
