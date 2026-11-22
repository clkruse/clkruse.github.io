'use strict';
/* Two rings identify a location (§3.1). Set like Figure 3-1: the globe
   with two rings of position, and a detail with your two sights on the
   altitude schematic. The four steps in the text are numbered on the
   drawing: ① and ③ are the two measured altitudes, ② and ④ the two rings'
   radii. Swing either line of sight in the detail to change its altitude, drag the
   globe to turn it, and reveal a third star to see which of the two
   crossings it keeps. Uses the plate globe helpers in demos/globes.js. */

(function demoFix() {
  const d = createDemo('demo-twostar', {
    aspect: 1.6,
    maxH: 460,
    compactAspect: 0.8,
    compactMaxH: 720,
    draw,
  });

  const MIN_ALT = 15, MAX_ALT = 75;
  const vega = addValue(d, {
    label: 'Vega altitude', min: MIN_ALT, max: MAX_ALT, step: 1, value: 60,
  });
  const sirius = {
    v: 40,
    set(x) { this.v = clamp(x, MIN_ALT, MAX_ALT); },
  };
  // the two sights from the text, each with the step numbers that measure
  // its altitude and draw its ring
  const STARS = [
    { name: 'VEGA', gp: { lat: 38.81, lon: -127.21 }, alt: vega, steps: [1, 2] },
    { name: 'SIRIUS', gp: { lat: -16.7, lon: -100 }, alt: sirius, steps: [3, 4] },
  ];
  // the third star's GP; its ring runs through the crossing nearest where
  // you expected to be, as a real third sight would
  const THIRD_GP = { lat: -24, lon: -158 };
  const EXPECTED = { lat: -5.79, lon: -145 };
  const GLOBE0 = { spin: 115, tilt: 18 };
  const globe = { ...GLOBE0 };
  let third = false;

  const thirdButton = addButton(d, 'reveal third star', () => setThird(!third));
  thirdButton.setAttribute('aria-pressed', 'false');
  function setThird(on) {
    third = Boolean(on);
    thirdButton.textContent = third ? 'hide third star' : 'reveal third star';
    thirdButton.setAttribute('aria-pressed', String(third));
  }
  d.addPreset('sixty-forty', () => {
    vega.set(60);
    sirius.set(40);
    Object.assign(globe, GLOBE0);
    setThird(false);
  });

  let geo = null;
  let drag = null;
  // which line of sight in the detail is drawn heaviest: the one last dragged
  let aim = 0;
  d.canvas.classList.add('grab');
  const inBox = (p, b) => b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  // a drag in the caption's detail takes the sight whose angle is nearest
  // the pointer's and swings it; dragging the globe turns it
  let detailStar = null;
  onDetailDrag(d, (a, first) => {
    if (first || !detailStar) {
      detailStar = STARS.reduce((x, y) => (Math.abs(y.alt.v - a) < Math.abs(x.alt.v - a) ? y : x));
      aim = STARS.indexOf(detailStar);
    }
    detailStar.alt.set(Math.round(clamp(a, 0, 90)));
  });
  addDrag(d.canvas, {
    touch: 'x',
    start(p) {
      drag = null;
      if (!geo) return;
      if (inBox(p, geo.globe)) {
        drag = { globe: true };
      }
    },
    move(p, dp) {
      if (!drag || !geo) return;
      if (drag.globe && dp) {
        globe.spin += dp.dx * 0.35;
        globe.tilt = clamp(globe.tilt + dp.dy * 0.35, -60, 60);
      }
    },
    end() { drag = null; },
  });

  const fmtDeg = v => `${Math.round(v)}°`;
  // the compass bearing from a to b along the great circle
  const bearing = (a, b) => {
    const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lon - a.lon) * D2R;
    const t = Math.atan2(Math.sin(dl) * Math.cos(p2),
      Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
    return ((t * R2D) % 360 + 360) % 360;
  };

  // where two rings of position cross: the points zA from A and zB from B
  function crossings(A, B, zA, zB) {
    const n1 = latLonToVec(A.lat, A.lon), n2 = latLonToVec(B.lat, B.lon);
    const c1 = Math.cos(zA * D2R), c2 = Math.cos(zB * D2R);
    const dd = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
    const den = 1 - dd * dd;
    if (den < 1e-9) return null;
    const a = (c1 - c2 * dd) / den, b = (c2 - c1 * dd) / den;
    const x0 = { x: a * n1.x + b * n2.x, y: a * n1.y + b * n2.y, z: a * n1.z + b * n2.z };
    const h2 = 1 - (x0.x * x0.x + x0.y * x0.y + x0.z * x0.z);
    if (h2 < 0) return null;
    const cr = {
      x: n1.y * n2.z - n1.z * n2.y,
      y: n1.z * n2.x - n1.x * n2.z,
      z: n1.x * n2.y - n1.y * n2.x,
    };
    const t = Math.sqrt(h2 / den);
    return [1, -1].map(s => {
      const v = { x: x0.x + s * t * cr.x, y: x0.y + s * t * cr.y, z: x0.z + s * t * cr.z };
      return { lat: Math.asin(clamp(v.z, -1, 1)) * R2D, lon: Math.atan2(v.y, v.x) * R2D };
    });
  }

  /* A step number in a small circle, as an Apollo procedure keys its steps
     to the drawing, followed by text and an optional bold figure. Returns
     its size and a painter for its left-middle point. */
  function tagged(ctx, step, word, figure, compact) {
    const r = compact ? 5.6 : 6.4;
    const wSize = compact ? 7.5 : 8.5, nSize = compact ? 8.5 : 10;
    const gap = compact ? 4 : 5;
    const ww = word ? plateTextWidth(ctx, word, { size: wSize, weight: 600 }) : 0;
    const nw = figure ? plateTextWidth(ctx, figure, {
      size: nSize, weight: 700, font: PLATE.dataFont, uppercase: false, tracking: 0,
    }) : 0;
    const w = (step ? r * 2 + gap : 0) + ww + (word && figure ? 4 : 0) + nw;
    const h = Math.max(r * 2, plateSize(nSize) * 1.25);
    const base = ctx;
    return {
      w, h,
      draw(x, y, alpha = 1, target = null) {
        const ctx = target || base;
        ctx.save();
        ctx.globalAlpha *= alpha;
        let cx = x;
        if (step) {
          ctx.fillStyle = PLATE.paper;
          ctx.strokeStyle = PLATE.ink;
          ctx.lineWidth = compact ? 0.8 : 0.9;
          ctx.beginPath();
          ctx.arc(cx + r, y, r, 0, TAU);
          ctx.fill();
          ctx.stroke();
          plateDataText(ctx, String(step), cx + r, y + 0.5, {
            size: compact ? 7 : 7.8, weight: 700, align: 'center',
          });
          cx += r * 2 + gap;
        }
        if (word) {
          plateText(ctx, word, cx, y, { size: wSize, weight: 600 });
          cx += ww + (figure ? 4 : 0);
        }
        if (figure) plateDataText(ctx, figure, cx, y, { size: nSize, weight: 700 });
        ctx.restore();
      },
    };
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;

    // the globe, with your sights in the caption's detail
    const layout = plateDetailLayout(w, h, compact, ctx);
    const { detail, field } = layout;
    const headH = plateDetailHeading(ctx, layout, 'TWO RINGS OF POSITION');
    const globeBox = { x: field.x, y: field.y + headH, w: field.w, h: field.h - headH };

    // the two crossings, which of them you expected to be near, and the
    // third star's distance from that one
    const zs = STARS.map(s => 90 - s.alt.v);
    const ints = crossings(STARS[0].gp, STARS[1].gp, zs[0], zs[1]);
    let kept = null, z3 = null;
    if (ints) {
      kept = globeAngularDistance(ints[0], EXPECTED) <= globeAngularDistance(ints[1], EXPECTED) ? 0 : 1;
      z3 = globeAngularDistance(ints[kept], THIRD_GP);
    }
    const showThird = third && ints && z3 < 90 - 5;

    syncText(zs);
    geo = { globe: globeBox, detail };
    drawGlobe(ctx, globeBox, zs, ints, kept, showThird ? z3 : null, compact);
    // ① and ③ are the two measurements; a revealed third star joins them
    const sight = (step, altV) => ({ alt: altV, block: tagged(ctx, step, '', fmtDeg(altV), compact) });
    const sights = STARS.map(s => sight(s.steps[0], s.alt.v));
    if (showThird) sights.push(sight(null, 90 - z3));
    plateAltitudeInstrument(detail, {
      title: 'YOUR SIGHTS', sights, aim,
    });
    thirdButton.hidden = !ints;
  }

  // the steps above the figure quote its numbers; keep them in step
  const liveText = document.querySelectorAll('[data-fix]');
  let lastText = '';
  function syncText(zs) {
    const values = {
      'vega-alt': vega.v, 'vega-z': zs[0], 'sirius-alt': sirius.v, 'sirius-z': zs[1],
    };
    const key = Object.values(values).join();
    if (key === lastText) return;
    lastText = key;
    liveText.forEach(el => {
      const v = values[el.dataset.fix];
      if (v != null) el.textContent = fmtDeg(v);
    });
  }

  function drawGlobe(ctx, box, zs, ints, kept, z3, phone) {
    const statusH = phone ? 18 : 22;
    const cx = box.x + box.w / 2;
    const R = Math.min(box.w * 0.46, (box.h - statusH - 10) / 2);
    // a small globe takes compact type and short names
    const compact = phone || R < 150;
    const size = compact ? 7.5 : 8.5;
    const cy = box.y + (box.h - statusH) / 2;

    const scene = drawPlateGlobeFrame(ctx, globe, cx, cy, R, compact, {
      showCenter: false,
      gridLatitudes: compact ? [0] : [-30, 0, 30],
      gridLongitudeStep: compact ? 90 : 45,
      gridHiddenWeight: compact ? 0.22 : 0.26,
      gridVisibleWeight: compact ? 0.3 : 0.36,
      // lighter than the rings, so the rings read as the subject
      outlineWeight: compact ? 0.8 : 1,
    });

    const labels = createPlateLabeler(ctx, {
      left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h - statusH, gap: compact ? 2 : 3,
    });
    // everything a label must stay off, as points
    const obstacles = [];
    const mark = (q, r = 2) => {
      obstacles.push({ x: q.x, y: q.y, r });
      labels.reserve({ x: q.x - r, y: q.y - r, w: r * 2, h: r * 2 }, 1);
    };
    const clearOf = r => !obstacles.some(o => o.x + o.r > r.x && o.x - o.r < r.x + r.w
      && o.y + o.r > r.y && o.y - o.r < r.y + r.h);
    for (let t = 0; t < TAU; t += 0.05) mark({ x: cx + Math.cos(t) * R, y: cy + Math.sin(t) * R });

    // ring of position: every place z from the GP, solid on the near side
    const ringOf = (gp, z) => {
      const pts = [];
      for (let a = 0; a <= 360; a += 2) {
        const q = destPoint(gp.lat, gp.lon, z, a);
        pts.push(scene.project(q.lat, q.lon));
      }
      return pts;
    };
    const strokeRing = (pts, weight) => {
      strokePlateHemisphere(ctx, pts, false, { kind: 'long', weight: compact ? 0.5 : 0.6 });
      strokePlateHemisphere(ctx, pts, true, { kind: 'solid', weight });
      pts.forEach(q => { if (q.front) mark(q); });
    };
    const dot = (q, r) => {
      ctx.save();
      ctx.fillStyle = PLATE.ink;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    };

    const rings = STARS.map((s, i) => ringOf(s.gp, zs[i]));
    rings.forEach(pts => strokeRing(pts, compact ? 1.5 : 1.9));

    // each ring's radius, measured out from its GP away from the other star
    const radii = STARS.map((s, i) => {
      const other = STARS[1 - i].gp;
      const az = (bearing(s.gp, other) + 180) % 360;
      const arc = [];
      const steps = Math.max(12, Math.ceil(zs[i] / 1.5));
      for (let k = 0; k <= steps; k++) {
        const q = destPoint(s.gp.lat, s.gp.lon, zs[i] * k / steps, az);
        arc.push(scene.project(q.lat, q.lon));
      }
      strokePlateHemisphere(ctx, arc, false, { kind: 'short', weight: 0.6 });
      strokePlateHemisphere(ctx, arc, true, { kind: 'construction', weight: compact ? 0.8 : 0.95 });
      arc.forEach(q => { if (q.front) mark(q, 2.5); });
      return arc;
    });

    // the third star's ring, through the crossing you expected
    let thirdRing = null;
    if (z3 != null) {
      thirdRing = ringOf(THIRD_GP, z3);
      strokePlateHemisphere(ctx, thirdRing, false, { kind: 'long', weight: compact ? 0.5 : 0.6 });
      strokePlateHemisphere(ctx, thirdRing, true, { kind: 'long', weight: compact ? 1.2 : 1.45 });
      thirdRing.forEach(q => { if (q.front) mark(q); });
    }

    // GPs
    const gps = STARS.map(s => scene.project(s.gp.lat, s.gp.lon));
    gps.forEach(q => { if (q.front) { dot(q, compact ? 2.6 : 3.2); mark(q, 5); } });
    const thirdGp = z3 != null ? scene.project(THIRD_GP.lat, THIRD_GP.lon) : null;
    if (thirdGp && thirdGp.front) { dot(thirdGp, compact ? 2.2 : 2.7); mark(thirdGp, 4); }

    // the crossings: two possible positions until a third ring picks one
    const marks = ints ? ints.map(c => scene.project(c.lat, c.lon)) : [];
    marks.forEach((q, i) => {
      const ruledOut = z3 != null && i !== kept;
      const r = compact ? 5 : 6.5;
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.fillStyle = PLATE.paper;
      ctx.lineWidth = 1.2;
      if (!q.front) ctx.setLineDash(plateDash('short'));
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (ruledOut) {
        const c = r * 0.7;
        ctx.beginPath();
        ctx.moveTo(q.x - c, q.y - c); ctx.lineTo(q.x + c, q.y + c);
        ctx.moveTo(q.x + c, q.y - c); ctx.lineTo(q.x - c, q.y + c);
        ctx.stroke();
      } else {
        ctx.fillStyle = PLATE.ink;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * 0.42, 0, TAU);
        ctx.fill();
        if (z3 != null) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, r + (compact ? 3 : 3.5), 0, TAU);
          ctx.stroke();
        }
      }
      ctx.restore();
      mark(q, r + 3);
    });

    // labels: every one is a block placed clear of the drawing and of the
    // others, on a paper knockout so the graticule doesn't run through it
    const taken = [];
    const hit = (r, q) => q.x < r.x + r.w && q.x + q.w > r.x && q.y < r.y + r.h && q.y + q.h > r.y;
    const free = r => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w
      && r.y + r.h <= box.y + box.h - statusH && clearOf(r) && !taken.some(q => hit(r, q));
    const TURNS = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4, Math.PI];
    // seats all round a point, nearest the given direction first, each far
    // enough out that the block clears a mark of radius `clear`
    // farther seats come after the near ones, and get a leader back
    const FAR = [0, compact ? 16 : 22, compact ? 30 : 40, compact ? 46 : 60];
    const around = (q, dir, clear, block, extras = FAR) => extras.flatMap(extra =>
      TURNS.map(turn => {
        const a = Math.atan2(dir.y, dir.x) + turn;
        const ex = Math.cos(a), ey = Math.sin(a);
        const dist = clear + (compact ? 4 : 5) + extra + Math.abs(ex) * block.w / 2 + Math.abs(ey) * block.h / 2;
        return { x: q.x + ex * dist, y: q.y + ey * dist };
      }));
    const leader = (q, clear, r, alpha) => {
      const nx = clamp(q.x, r.x, r.x + r.w), ny = clamp(q.y, r.y, r.y + r.h);
      const len = Math.hypot(nx - q.x, ny - q.y);
      if (len < clear + 9) return;
      const u = { x: (nx - q.x) / len, y: (ny - q.y) / len };
      ctx.save();
      ctx.globalAlpha *= alpha;
      plateLine(ctx, { x: q.x + u.x * (clear + 1.5), y: q.y + u.y * (clear + 1.5) }, { x: nx - u.x * 2, y: ny - u.y * 2 },
        { weight: 0.6 });
      ctx.restore();
    };
    const put = (key, target, block, seats, clear = null) => {
      const got = labels.settle(key, target, seats, {
        rectAt: c => ({ x: c.x - block.w / 2 - 2, y: c.y - block.h / 2 - 2, w: block.w + 4, h: block.h + 4 }),
        test: r => (free(r) ? 0 : 1),
        draw(r, alpha) {
          if (clear != null) leader(target, clear, r, alpha);
          ctx.save();
          ctx.globalAlpha *= alpha;
          ctx.fillStyle = PLATE.paper;
          ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
          ctx.restore();
          block.draw(r.x + 2, r.y + r.h / 2, alpha);
        },
      });
      if (got) taken.push(got.rect);
      return got;
    };
    const lineBlock = (lines, weight = 600) => {
      const lh = plateSize(size) * 1.2;
      const w = Math.max(...lines.map(t => plateTextWidth(ctx, t, { size, weight })));
      return {
        w, h: lh * lines.length,
        draw(x, y, alpha = 1) {
          ctx.save();
          ctx.globalAlpha *= alpha;
          lines.forEach((t, i) => plateText(ctx, t, x + w / 2, y + (i - (lines.length - 1) / 2) * lh,
            { size, weight, align: 'center' }));
          ctx.restore();
        },
      };
    };

    // ② and ④ on the radii, beside the middle of each line
    STARS.forEach((s, i) => {
      const arc = radii[i].filter(q => q.front);
      if (arc.length < 2) return;
      const block = tagged(ctx, s.steps[1], '', fmtDeg(zs[i]), compact);
      const t = norm({ x: arc[arc.length - 1].x - arc[0].x, y: arc[arc.length - 1].y - arc[0].y });
      const n = { x: -t.y, y: t.x };
      const off = (compact ? 6 : 8) + Math.abs(n.x) * block.w / 2 + Math.abs(n.y) * block.h / 2;
      const seats = [];
      for (const f of [0.5, 0.38, 0.62, 0.28]) {
        const m = arc[Math.round((arc.length - 1) * f)];
        seats.push({ x: m.x + n.x * off, y: m.y + n.y * off }, { x: m.x - n.x * off, y: m.y - n.y * off });
      }
      // failing that, farther out with a leader: these are steps in the
      // text, so they should always show
      const mid = arc[Math.floor(arc.length / 2)];
      put(`radius${i}`, mid, block, [...seats, ...around(mid, n, 3, block)], 3);
    });

    // the crossings: two possible positions, until the third ring picks one
    if (marks.length === 2) {
      const midX = (marks[0].x + marks[1].x) / 2, midY = (marks[0].y + marks[1].y) / 2;
      marks.forEach((q, i) => {
        if (!q.front) return;
        let out = norm({ x: q.x - midX, y: q.y - midY });
        if (!Number.isFinite(out.x)) out = { x: 1, y: 0 };
        const clear = compact ? 6 : 8;
        const near = FAR.slice(0, 2);
        const lines = z3 == null ? ['POSSIBLE', 'POSITION']
          : i === kept ? (compact ? ['YOU'] : ['YOUR', 'POSITION']) : ['RULED', 'OUT'];
        const weight = z3 != null && i === kept ? 700 : 600;
        const block = lineBlock(lines, weight);
        // close by in full, else close by in short, else farther out
        const brief = lines.length > 1 && z3 != null && i === kept ? lineBlock(['YOU'], weight) : null;
        put(`cross${i}`, q, block, around(q, out, clear, block, near), clear)
          || (brief && put(`cross${i}-brief`, q, brief, around(q, out, clear, brief, near), clear))
          || put(`cross${i}-far`, q, block, around(q, out, clear, block), clear);
      });
    }

    // GP names, on the side away from their radius
    STARS.forEach((s, i) => {
      const q = gps[i];
      if (!q.front) return;
      const end = radii[i][radii[i].length - 1];
      const block = lineBlock([compact ? `${s.name} GP` : `${s.name}’S GP`], 500);
      put(`gp${i}`, q, block, around(q, norm({ x: q.x - end.x, y: q.y - end.y }), 4, block), 4);
    });
    if (thirdGp && thirdGp.front) {
      const dir = norm({ x: cx - thirdGp.x, y: cy - thirdGp.y });
      const short = lineBlock(['THIRD GP'], 500);
      if (compact) put('gp3', thirdGp, short, around(thirdGp, dir, 4, short), 4);
      else {
        const block = lineBlock(['THIRD STAR’S GP'], 500);
        put('gp3', thirdGp, block, around(thirdGp, dir, 4, block), 4)
          || put('gp3-short', thirdGp, short, around(thirdGp, dir, 4, short), 4);
      }
    }

    // what the drawing shows, under the globe
    const sy = box.y + box.h - statusH / 2;
    const sSize = compact ? 7.5 : 8.5;
    if (!ints) {
      plateText(ctx, 'THE RINGS DON’T CROSS · CHANGE AN ALTITUDE', cx, sy, { size: sSize, align: 'center' });
    } else if (z3 != null) {
      plateText(ctx, 'ONE PLACE FITS ALL THREE STARS', cx, sy, { size: sSize, align: 'center' });
    } else {
      const nm = Math.round(globeAngularDistance(ints[0], ints[1]) * 60).toLocaleString('en-US');
      const words = 'TWO POSSIBLE POSITIONS · ';
      const fig = `${nm} nm apart`;
      const ww = plateTextWidth(ctx, words, { size: sSize });
      const fw = plateTextWidth(ctx, fig, { size: sSize, font: PLATE.dataFont, uppercase: false, tracking: 0 });
      plateText(ctx, words, cx - (ww + fw) / 2, sy, { size: sSize });
      plateDataText(ctx, fig, cx - (ww + fw) / 2 + ww, sy, { size: sSize });
    }
  }
})();
