'use strict';
/* Two views at once (§4.0). A sextant drawn in elevation, as a technical
   side view: the frame and its scale, the index arm pivoting at the top
   with the index mirror on it, the half-silvered horizon mirror and the
   telescope behind it. Two lines of sight leave the eye: straight ahead
   through the horizon mirror's clear half to the horizon, and up off the
   silvered half and the index mirror into the sky, at the scale reading. The eyepiece, split down the middle,
   is drawn in the caption, where its star can be dragged too. Swing the
   arm until the star sits on the horizon beside it, and the scale reads
   the star's altitude. Both views rock together with
   the boat, so its motion drops out. */

(function demoTwoViews() {
  const d = createDemo('demo-twoviews', {
    aspect: 1.55,
    maxH: 470,
    compactAspect: 1.12,
    compactMaxH: 560,
    draw,
  });

  // the star's altitude, and the half-height of the telescope's field
  const STAR = 35;
  const FOV = 4;
  const reading = addValue(d, {
    label: 'scale reading',
    min: 0,
    max: 120,
    step: 0.1,
    value: 15,
    fmt: v => `${v.toFixed(1)}°`,
  });

  const settle = a => {
    a = clamp(a, 0, 120);
    reading.set(Math.round(a * 10) / 10, { emit: false });
  };
  let geo = null;
  let grab = null;
  d.canvas.classList.add('grab');
  // the scale reading the pointer points at, seen from the pivot
  const angleAt = p => {
    let a = Math.atan2(p.y - geo.Pv.y, p.x - geo.Pv.x) - geo.phi0;
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a / geo.rate;
  };
  // the altitude the line of sight takes when it points at the pointer
  const sightAt = p => Math.atan2(geo.Pv.y - p.y, p.x - geo.Pv.x) * R2D;
  addDrag(d.canvas, {
    hit: p => nearGrab(p, geo && [...geo.grab, ...(geo.sight || []), ...(geo.label || [])]),
    start(p) {
      // taken by the reading under the scale, the arm keeps its place and
      // turns by as much as the pointer does; taken by the arm, it follows.
      // Taken by the line of sight out into the sky, the sight swings to
      // follow the pointer about the index mirror, and the arm with it
      if (!geo) return;
      const onArm = nearGrab(p, geo.grab);
      const bySight = !onArm && geo.sight && nearGrab(p, geo.sight, 24);
      const byLabel = !onArm && !bySight && geo.label && nearGrab(p, geo.label, 24);
      const at = bySight ? sightAt : angleAt;
      grab = { at, off: bySight || byLabel ? reading.v - at(p) : 0 };
      this.move(p);
    },
    move(p) {
      if (!geo || !grab) return;
      settle(grab.at(p) + grab.off);
    },
    end() { grab = null; },
  });
  // in the caption's eyepiece, drag the star down onto the horizon
  let viewGrab = null;
  onDetailDrag(d, (y, first) => {
    if (!geo || !geo.k) return;
    if (first) viewGrab = { y, v: reading.v };
    if (viewGrab) settle(viewGrab.v + (y - viewGrab.y) / geo.k);
  });

  const dirOf = deg => ({ x: Math.cos(deg * D2R), y: -Math.sin(deg * D2R) });

  // line weights: outlines, lesser parts, and the thin work of
  // dimensions, leaders and hatching. The instrument itself is drawn in
  // a lighter set, so the lines of sight carry the figure
  const WEIGHTS = { HEAVY: 1.35, MEDIUM: 0.9, THIN: 0.55 };
  const THIN_WEIGHTS = { HEAVY: 0.75, MEDIUM: 0.5, THIN: 0.4 };
  let HEAVY, MEDIUM, THIN;
  const useWeights = set => ({ HEAVY, MEDIUM, THIN } = set);
  useWeights(WEIGHTS);

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const ink = PLATE.ink;
    const pad = compact ? 10 : 16;
    const lsize = compact ? 6.5 : 7;
    const hs = reading.v;
    const onHorizon = Math.abs(hs - STAR) < 0.05;
    const poly = pts => {
      const path = new Path2D();
      pts.forEach((q, i) => path[i ? 'lineTo' : 'moveTo'](q.x, q.y));
      path.closePath();
      return path;
    };
    const outline = (path, weight = HEAVY) => {
      ctx.save();
      ctx.fillStyle = PLATE.paper; ctx.fill(path);
      ctx.strokeStyle = ink; ctx.lineWidth = weight; ctx.setLineDash([]); ctx.stroke(path);
      ctx.restore();
    };

    plateText(ctx, 'A SEXTANT · TWO LINES OF SIGHT', w / 2, pad + 4, { size: compact ? 7.5 : 9, weight: 600, align: 'center' });

    // ——— the instrument's geometry ———
    // the drawing has the canvas to itself: the eyepiece is in the caption
    const Pv = compact ? { x: w * 0.52, y: pad + 92 } : { x: w * 0.45, y: h * 0.3 };
    const R = compact ? Math.min(w * 0.4, (h - Pv.y - 64) / 1.07) : Math.min(h * 0.46, w * 0.3);
    const HM = { x: Pv.x + R * 0.44, y: Pv.y + R * 0.5 };
    // the telescope looks through both halves of the horizon mirror at
    // once: the horizon through the clear lower half, a little below its
    // axis, and the mirrors' view off the silvered upper half, a little above
    const beam = Math.max(3.5, R * 0.042) * 0.5;
    // the mirror path: from the index mirror down to a point on the
    // silvered half, which turns it into the telescope, straight back.
    // (The point and the mirror's tilt depend on each other; a few rounds
    // settle them.)
    let d1, nH, hd, Ts = HM;
    for (let i = 0; i < 4; i++) {
      d1 = norm({ x: Ts.x - Pv.x, y: Ts.y - Pv.y });
      nH = norm({ x: -1 - d1.x, y: -d1.y });
      hd = { x: -nH.y, y: nH.x };
      Ts = { x: HM.x + hd.x * -beam / hd.y, y: HM.y - beam };
    }
    const hmLen = R * 0.24;
    // the index mirror, set for a reading of a, takes light arriving from a
    // above the horizon and sends it down to the horizon mirror: its normal
    // bisects the two. At zero it lies parallel to the horizon mirror, and
    // it turns half as far as the view it turns (hence the doubled scale)
    const n0 = norm({ x: d1.x + 1, y: d1.y });
    const ang0 = Math.atan2(n0.y, n0.x);
    const n1 = norm({ x: d1.x + Math.cos(D2R), y: d1.y - Math.sin(D2R) });
    const rate = Math.sign(Math.atan2(n1.y, n1.x) - ang0) * D2R / 2;
    const nI = a => ({ x: Math.cos(ang0 + rate * a), y: Math.sin(ang0 + rate * a) });
    // the arm turns with the mirror: straight down at mid-scale
    const phiOf = a => Math.PI / 2 + rate * (a - 60);
    const phi0 = phiOf(0);
    const at = (a, r) => ({ x: Pv.x + Math.cos(phiOf(a)) * r, y: Pv.y + Math.sin(phiOf(a)) * r });

    // a finger takes the index arm, anywhere from the mirror to its foot
    geo = { Pv, phi0, rate, k: geo && geo.k, grab: [[at(hs, R * 0.15), at(hs, R * 0.98)]] };

    // ——— the frame ———
    useWeights(THIN_WEIGHTS);
    // the frame spreads wide enough that its legs carry the telescope's
    // ring on one side and the horizon mirror on the other
    const FA0 = -20, FA1 = 140;
    const frame = new Path2D();
    frame.moveTo(Pv.x, Pv.y);
    for (let a = FA0; a <= FA1; a += 2) { const q = at(a, R * 1.07); frame.lineTo(q.x, q.y); }
    frame.closePath();
    outline(frame, HEAVY);
    // the flange's width, and how far in from a leg (in scale degrees) its
    // rim sits at radius r
    const FT = R * 0.065;
    const rimIn = r => Math.asin(FT / r) / Math.abs(rate);
    // a raised rim along the legs, a flange's width in from each, running
    // down to the scale (which frames the bottom on its own), and a round
    // boss at the pivot
    {
      const t = FT, ri = R * 0.97;
      const half = (FA1 - FA0) / 2 * Math.abs(rate);
      const apex = { x: Pv.x + Math.cos(phiOf((FA0 + FA1) / 2)) * t / Math.sin(half), y: Pv.y + Math.sin(phiOf((FA0 + FA1) / 2)) * t / Math.sin(half) };
      const dr = Math.asin(t / ri) / Math.abs(rate);
      const rim = new Path2D();
      const l0 = at(FA0 + dr, ri), l1 = at(FA1 - dr, ri);
      rim.moveTo(l0.x, l0.y); rim.lineTo(apex.x, apex.y); rim.lineTo(l1.x, l1.y);
      ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM; ctx.stroke(rim); ctx.restore();
      // a second, arcing strut between the legs, a flange wide, cast in one
      // with them: paper over the rim where it joins, its two edges drawn
      const r0 = R * 0.67, r1 = r0 + FT;
      const strut = new Path2D();
      const s0 = FA0 + rimIn(r1) - 0.6, s1 = FA1 - rimIn(r1) + 0.6;
      for (let i = 0; i <= 48; i++) { const q = at(s0 + (s1 - s0) * i / 48, r1); strut[i ? 'lineTo' : 'moveTo'](q.x, q.y); }
      const u0 = FA0 + rimIn(r0) - 0.6, u1 = FA1 - rimIn(r0) + 0.6;
      for (let i = 48; i >= 0; i--) { const q = at(u0 + (u1 - u0) * i / 48, r0); strut.lineTo(q.x, q.y); }
      strut.closePath();
      ctx.save(); ctx.fillStyle = PLATE.paper; ctx.fill(strut); ctx.restore();
      ctx.save();
      ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM;
      for (const r of [r0, r1]) {
        const a0 = FA0 + rimIn(r), a1 = FA1 - rimIn(r);
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) { const q = at(a0 + (a1 - a0) * i / 48, r); ctx[i ? 'lineTo' : 'moveTo'](q.x, q.y); }
        ctx.stroke();
      }
      ctx.restore();
      // and a rib down the middle, from the pivot's boss to the strut,
      // bisecting the triangle the legs and the strut make
      {
        const bd = { x: Math.cos(phiOf((FA0 + FA1) / 2)), y: Math.sin(phiOf((FA0 + FA1) / 2)) };
        const bn = { x: -bd.y, y: bd.x };
        const o = FT / 2;
        const pt = (along, side) => ({ x: Pv.x + bd.x * along + bn.x * side, y: Pv.y + bd.y * along + bn.y * side });
        const end = Math.sqrt(r0 * r0 - o * o);
        ctx.save(); ctx.fillStyle = PLATE.paper; ctx.fill(poly([pt(R * 0.05, -o), pt(end + 1.2, -o), pt(end + 1.2, o), pt(R * 0.05, o)])); ctx.restore();
        plateLine(ctx, pt(R * 0.05, -o), pt(end, -o), { weight: MEDIUM });
        plateLine(ctx, pt(R * 0.05, o), pt(end, o), { weight: MEDIUM });
      }
      ctx.save();
      ctx.fillStyle = PLATE.paper; ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM;
      ctx.beginPath(); ctx.arc(Pv.x, Pv.y, R * 0.1, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // the limb, graduated double: a 60° arc reads 0° to 120°
    ctx.save();
    ctx.strokeStyle = ink; ctx.lineWidth = THIN;
    ctx.beginPath();
    // (only between the legs' rims, so the legs run on into the scale)
    {
      const a0 = FA0 + rimIn(R * 0.97), a1 = FA1 - rimIn(R * 0.97);
      for (let i = 0; i <= 70; i++) { const q = at(a0 + (a1 - a0) * i / 70, R * 0.97); ctx[i ? 'lineTo' : 'moveTo'](q.x, q.y); }
    }
    ctx.stroke();
    for (let a = 0; a <= 120; a += 2) {
      const len = a % 10 === 0 ? R * 0.1 : a % 5 === 0 ? R * 0.065 : R * 0.04;
      const q0 = at(a, R * 1.07 - len), q1 = at(a, R * 1.07);
      ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
    }
    ctx.restore();
    // the figures, outside the limb where the arm never reaches
    for (let a = 0; a <= 120; a += compact ? 30 : 20) {
      const q = at(a, R * 1.07 + (compact ? 9 : 11));
      plateDataText(ctx, `${a}`, q.x, q.y, { size: compact ? 6.5 : 7, align: 'center' });
    }

    // ——— the index arm, on the frame's face, under the telescope and the light ———
    const ad = { x: Math.cos(phiOf(hs)), y: Math.sin(phiOf(hs)) };
    const an = { x: -ad.y, y: ad.x };
    const aw = Math.max(3, R * 0.028);
    // the arm ends in a foot curved to the arc, riding just inside the limb
    // so the graduations stay open; a fine index line runs from it across them
    const fIn = R * 0.904, fOut = R * 0.955;
    {
      const dA = aw * 2.6 / fOut / Math.abs(rate);
      const foot = new Path2D();
      for (let i = 0; i <= 24; i++) { const q = at(hs - dA + 2 * dA * i / 24, fOut); foot[i ? 'lineTo' : 'moveTo'](q.x, q.y); }
      for (let i = 24; i >= 0; i--) { const q = at(hs - dA + 2 * dA * i / 24, fIn); foot.lineTo(q.x, q.y); }
      foot.closePath();
      outline(foot, HEAVY);
    }
    // the shaft, one piece with the foot: paper laid a little into the foot
    // to clear the seam, and only its sides and pivot end drawn
    {
      const pt = (along, side) => ({ x: Pv.x + ad.x * along + an.x * side, y: Pv.y + ad.y * along + an.y * side });
      const into = fIn + (fOut - fIn) * 0.3, meet = Math.sqrt(fIn * fIn - aw * aw);
      ctx.save(); ctx.fillStyle = PLATE.paper;
      ctx.fill(poly([pt(0, aw), pt(into, aw), pt(into, -aw), pt(0, -aw)]));
      ctx.strokeStyle = ink; ctx.lineWidth = HEAVY; ctx.lineJoin = 'miter';
      const sides = [pt(meet, aw), pt(0, aw), pt(0, -aw), pt(meet, -aw)];
      ctx.beginPath(); sides.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q.x, q.y)); ctx.stroke();
      ctx.restore();
    }
    // the index: a small pointer on the foot's edge and a firm line across
    // the graduations, heavier than any tick so it reads at a glance
    {
      const tip = at(hs, fOut), base = at(hs, fOut - aw * 1.05), pw = aw * 0.55;
      ctx.save(); ctx.fillStyle = ink;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(base.x + an.x * pw, base.y + an.y * pw); ctx.lineTo(base.x - an.x * pw, base.y - an.y * pw);
      ctx.closePath(); ctx.fill(); ctx.restore();
      plateLine(ctx, tip, at(hs, R * 1.075), { weight: WEIGHTS.MEDIUM * 1.2 });
    }

    // ——— the telescope, clamped to the frame's near leg and looking at the
    // horizon mirror, its eyepiece hanging out past the frame ———
    const tr = Math.max(3.5, R * 0.042);
    const legDir = { x: Math.cos(phiOf(FA0)), y: Math.sin(phiOf(FA0)) };
    const legX = Pv.x + legDir.x * (HM.y - Pv.y) / legDir.y;
    const obj = HM.x - R * 0.3, back = legX - R * 0.24;
    const tube = (x0, x1, r, weight = HEAVY) => outline(poly([
      { x: x0, y: HM.y - r }, { x: x1, y: HM.y - r }, { x: x1, y: HM.y + r }, { x: x0, y: HM.y + r },
    ]), weight);
    tube(back + R * 0.1, obj - R * 0.07, tr);
    tube(obj - R * 0.07, obj, tr * 1.22);
    tube(back + R * 0.04, back + R * 0.1, tr * 0.78, MEDIUM);
    tube(back, back + R * 0.04, tr * 0.55, MEDIUM);
    // its mounting ring, where the tube crosses the leg
    tube(legX - R * 0.035, legX + R * 0.035, tr * 1.35, MEDIUM);
    const eye = { x: back, y: HM.y };

    useWeights(WEIGHTS);

    // ——— the lines of sight ———
    // traced outward from the eye, as in 4-1: one straight ahead, one turned
    // up by the mirrors. (Light runs the same paths the other way.) The
    // turned one is drawn heavier, since it is the one that finds the star
    // a line of sight: a line with its arrow at the middle, running a → b
    const ray = (a, b, weight, color = ink) => {
      ctx.save();
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = weight; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (Math.hypot(b.x - a.x, b.y - a.y) > 24) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x), s = weight > 1 ? 6 : 4.5;
        const m = { x: (a.x + b.x) / 2 + Math.cos(ang) * s / 2, y: (a.y + b.y) / 2 + Math.sin(ang) * s / 2 };
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - Math.cos(ang - 0.38) * s, m.y - Math.sin(ang - 0.38) * s);
        ctx.lineTo(m.x - Math.cos(ang + 0.38) * s, m.y - Math.sin(ang + 0.38) * s);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    };
    const sightW = compact ? 1.4 : 1.7;
    // how far from the pivot a direction runs before leaving the drawing
    const edgeLen = d => Math.min(
      d.x > 1e-6 ? (w - pad - Pv.x) / d.x : d.x < -1e-6 ? (pad - Pv.x) / d.x : Infinity,
      d.y < -1e-6 ? (Pv.y - pad - 24) / -d.y : Infinity);
    // straight ahead: through the clear half, out to the horizon
    const hy = HM.y + beam;
    const Tc = { x: HM.x + hd.x * beam / hd.y, y: hy };
    // the sea at the horizon, drawn as in the eyepiece: level lines drawing
    // together toward a heavy horizon line
    const seaW = compact ? 44 : 70, sx1 = w - pad, sx0 = sx1 - seaW;
    ctx.save();
    ctx.strokeStyle = ink; ctx.lineWidth = THIN;
    for (let i = 0, gap = 2.6, y = hy + gap; i < 4; i++, gap *= 1.45, y += gap) {
      ctx.beginPath(); ctx.moveTo(sx0, y); ctx.lineTo(sx1, y); ctx.stroke();
    }
    ctx.restore();
    plateLine(ctx, { x: sx0, y: hy }, { x: sx1, y: hy }, { weight: HEAVY });
    ray({ x: eye.x, y: hy }, Tc, MEDIUM);
    ray(Tc, { x: sx0 - 4, y: hy }, MEDIUM);
    // the star, fixed in the sky
    const sd = dirOf(STAR);
    const sReach = Math.min((w - pad - 14 - Pv.x) / sd.x, (Pv.y - pad - (compact ? 40 : 48)) / -sd.y);  // its label held under the title
    const star = { x: Pv.x + sd.x * sReach, y: Pv.y + sd.y * sReach };
    const starR = compact ? 6.5 : 8;
    // turned: up the telescope, off the silvered half, off the index mirror,
    // and out into the sky at the scale reading above the horizon; set on
    // the star, it ends there
    const od = dirOf(hs);
    const outLen = onHorizon ? sReach - starR - 4 : edgeLen(od);
    const outEnd = { x: Pv.x + od.x * outLen, y: Pv.y + od.y * outLen };
    // the field the telescope takes in about it: the star shows in the
    // eyepiece once it falls between these
    for (const sg of [-1, 1]) {
      const fd = dirOf(hs + sg * FOV), fl = Math.min(edgeLen(fd), outLen) * 0.9;
      const f0 = R * 0.16;
      plateLine(ctx, { x: Pv.x + fd.x * f0, y: Pv.y + fd.y * f0 }, { x: Pv.x + fd.x * fl, y: Pv.y + fd.y * fl }, { kind: 'short', weight: THIN });
    }
    ray({ x: eye.x, y: Ts.y }, Ts, sightW);
    ray(Ts, Pv, sightW);
    ray(Pv, outEnd, sightW);
    // a finger can also take the line of sight, clear of the arm at the pivot
    geo.sight = [[{ x: Pv.x + od.x * R * 0.3, y: Pv.y + od.y * R * 0.3 }, outEnd]];
    const starSeen = Math.abs(STAR - hs) < FOV * 0.95;
    starGlyph(ctx, star.x, star.y, starR, ink);
    // the angle it is turned through, from the horizontal at the index mirror
    {
      const Rd = R * (compact ? 0.5 : 0.44);
      const rp = (a, r) => ({ x: Pv.x + Math.cos(a * D2R) * r, y: Pv.y - Math.sin(a * D2R) * r });
      plateLine(ctx, { x: Pv.x + R * 0.14, y: Pv.y }, rp(0, Rd + 12), { kind: 'construction', weight: THIN });
      if (hs > 1.5) {
        ctx.save();
        ctx.strokeStyle = ink; ctx.lineWidth = THIN;
        ctx.beginPath();
        for (let a = 0; a <= hs; a += 0.5) { const q = rp(a, Rd); ctx[a ? 'lineTo' : 'moveTo'](q.x, q.y); }
        const qe = rp(hs, Rd); ctx.lineTo(qe.x, qe.y);
        ctx.stroke();
        ctx.restore();
        const tan = a => Math.atan2(-Math.cos(a * D2R), -Math.sin(a * D2R));
        plateArrowhead(ctx, rp(hs, Rd), tan(hs), 4);
        plateArrowhead(ctx, rp(0, Rd), tan(0) + Math.PI, 4);
      }
      const text = `${hs.toFixed(1)}°`;
      const ds = compact ? 8 : 9.5;
      const tw = plateTextWidth(ctx, text, { size: ds, weight: 700, font: PLATE.dataFont, uppercase: false, tracking: 0 });
      // in a break in the arc where the angle is wide, beyond it where narrow
      const q = hs > 16 ? rp(hs / 2, Rd) : rp(hs + 10, Rd + 4);
      ctx.save();
      ctx.fillStyle = PLATE.paper;
      ctx.fillRect(q.x - tw / 2 - 3, q.y - ds * 0.65, tw + 6, ds * 1.3);
      ctx.restore();
      plateDataText(ctx, text, q.x, q.y, { size: ds, weight: 700, align: 'center' });
    }


    // ——— the mirrors ———
    useWeights(THIN_WEIGHTS);
    // a mirror on a backing plate: silvered face toward n, hatched back;
    // half: only one half silvered, the other plain glass
    const mirror = (c, n, len, half = false) => {
      const sdir = { x: -n.y, y: n.x };
      const th = Math.max(3, R * 0.035);
      const a = { x: c.x - sdir.x * len / 2, y: c.y - sdir.y * len / 2 };
      const b = { x: c.x + sdir.x * len / 2, y: c.y + sdir.y * len / 2 };
      const plate = (p0, p1) => poly([p0, p1, { x: p1.x - n.x * th, y: p1.y - n.y * th }, { x: p0.x - n.x * th, y: p0.y - n.y * th }]);
      const s0 = half ? c : a;
      const silver = plate(s0, b);
      ctx.save(); ctx.fillStyle = PLATE.paper; ctx.fill(silver); ctx.restore();
      plateHatch(ctx, silver, {
        x: Math.min(s0.x, b.x) - th - 4, y: Math.min(s0.y, b.y) - th - 4,
        w: Math.abs(b.x - s0.x) + th * 2 + 8, h: Math.abs(b.y - s0.y) + th * 2 + 8,
      }, { spacing: 2.4, weight: 0.5 });
      ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM; ctx.stroke(silver); ctx.restore();
      plateLine(ctx, s0, b, { weight: HEAVY * 1.35 });
      if (half) outline(plate(a, c), THIN);
      return { a, b };
    };
    const im = mirror(Pv, nI(hs), R * 0.26);
    const hm = mirror(HM, nH, hmLen, true);
    // the pivot, with its center mark
    ctx.save();
    ctx.fillStyle = PLATE.paper; ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM;
    ctx.beginPath(); ctx.arc(Pv.x, Pv.y, compact ? 3 : 3.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = THIN;
    ctx.beginPath();
    ctx.moveTo(Pv.x - 7, Pv.y); ctx.lineTo(Pv.x + 7, Pv.y);
    ctx.moveTo(Pv.x, Pv.y - 7); ctx.lineTo(Pv.x, Pv.y + 7);
    ctx.stroke();
    ctx.restore();

    useWeights(WEIGHTS);

    // ——— names, on leaders ———
    // a label set on a paper knockout, so a stray ray never runs through it
    const label = (text, x, y, opts) => {
      const tw = plateTextWidth(ctx, text, opts);
      const x0 = opts.align === 'right' ? x - tw : opts.align === 'center' ? x - tw / 2 : x;
      ctx.save(); ctx.fillStyle = PLATE.paper; ctx.fillRect(x0 - 3, y - opts.size * 0.75, tw + 6, opts.size * 1.5); ctx.restore();
      plateText(ctx, text, x, y, opts);
    };
    const leader = (target, lx, ly, text, align = 'left', weight = 500) => {
      plateLeader(ctx, target, { x: lx + (align === 'left' ? -4 : 4), y: ly }, { head: 3.2 });
      label(text, lx, ly, { size: lsize, weight, align });
    };
    plateText(ctx, 'STAR', star.x, star.y - starR - 8, { size: lsize + 0.5, weight: 600, align: 'center' });
    const imTop = im.a.y < im.b.y ? im.a : im.b;
    leader(imTop, Pv.x - R * (compact ? 0.3 : 0.36), Pv.y - R * 0.3, 'INDEX MIRROR', 'right');
    const hmTop = hm.a.y < hm.b.y ? hm.a : hm.b;
    if (compact) leader(hmTop, w - pad - plateTextWidth(ctx, 'HORIZON MIRROR', { size: lsize }), HM.y - R * 0.36, 'HORIZON MIRROR', 'left');
    else leader(hmTop, HM.x + R * 0.26, HM.y - R * 0.36, 'HORIZON MIRROR · HALF SILVERED', 'left');
    leader({ x: back + R * 0.2, y: HM.y - tr }, back - R * 0.06, HM.y - R * 0.2, 'TELESCOPE', 'right');
    // the eye, in profile, at the eyepiece
    {
      const ex = eye.x - 5, er = compact ? 5 : 6.5;
      ctx.save();
      ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM;
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.2, HM.y - er); ctx.lineTo(ex - er * 1.9, HM.y); ctx.lineTo(ex - er * 0.2, HM.y + er);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(ex - er * 1.1, HM.y, er, -0.95, 0.95); ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.ellipse(ex - er * 0.25, HM.y, er * 0.22, er * 0.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
      plateText(ctx, 'EYE', ex - er * 1.9 - 6, HM.y, { size: lsize, align: 'right' });
    }
    label('HORIZON', w - pad, hy - 10, { size: lsize, align: 'right' });
    // the starlight, named along its way in
    // the turned line of sight, named along its way out
    {
      // on the side away from the star, so the two never crowd each other
      const along = R * 0.5 + (outLen - R * 0.5) * 0.45;
      const m = { x: Pv.x + od.x * along, y: Pv.y + od.y * along };
      const nrm = { x: od.y, y: -od.x };
      const above = hs >= STAR;
      const sg = above ? 1 : -1;
      const q = { x: m.x + nrm.x * 10 * sg, y: m.y + nrm.y * 10 * sg };
      // kept inside the drawing's edges
      const lw = plateTextWidth(ctx, 'LINE OF SIGHT', { size: lsize });
      const lx = q.x < m.x ? Math.max(q.x, pad + lw) : Math.min(q.x, w - pad - lw);
      label('LINE OF SIGHT', lx, q.y, { size: lsize, align: (q.x < m.x) ? 'right' : 'left' });
    }
    // under the arm, but held clear of the scale's end figures
    const armLab = at(clamp(hs, 20, 100), R * 1.07 + (compact ? 26 : 38));
    // the reading, set at the index where it is read, the arm's name under it
    {
      const vs = compact ? 10 : 12;
      const vt = `${hs.toFixed(1)}°`;
      ctx.save(); ctx.font = `700 ${plateSize(vs)}px ${PLATE.dataFont}`; const vw = ctx.measureText(vt).width; ctx.restore();
      ctx.save(); ctx.fillStyle = PLATE.paper; ctx.fillRect(armLab.x - vw / 2 - 3, armLab.y - plateSize(vs) * 0.6, vw + 6, plateSize(vs) * 1.2); ctx.restore();
      plateDataText(ctx, vt, armLab.x, armLab.y, { size: vs, weight: 700, align: 'center' });
      label('INDEX ARM · DRAG', armLab.x, armLab.y + (compact ? 14 : 17), { size: lsize, weight: 600, align: 'center' });
      // the reading and its label are a handle too
      const lw = plateTextWidth(ctx, 'INDEX ARM · DRAG', { size: lsize }) / 2;
      const ly = armLab.y + (compact ? 7 : 8);
      geo.label = [[{ x: armLab.x - lw, y: ly }, { x: armLab.x + lw, y: ly }]];
    }

    // ——— the eyepiece, in the caption ———
    const detail = plateCaptionDetail(ctx);
    if (!detail) return;
    const c = detail.ctx;
    const band = 18;
    plateText(c, 'EYEPIECE VIEW', 6, 10, { size: 7.5, weight: 700 });
    const vr = Math.min(detail.w / 2 - 8, (detail.h - band - 18) / 2);
    const vx = detail.w / 2, vy = band + 4 + vr;
    // the telescope's field: a few degrees either way, so the star shows
    // only when its light actually finds the objective
    const k = vr / FOV;
    geo.k = k;
    detail.canvas._altAt = p => p.y;
    // water, as level lines drawing together toward the horizon
    const sea = (x0, x1, top) => {
      c.save();
      c.strokeStyle = ink; c.lineWidth = THIN;
      let gap = 2.2, y = top + gap;
      while (y < vy + vr) {
        c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
        gap *= 1.32; y += gap;
      }
      c.restore();
      plateLine(c, { x: x0, y: top }, { x: x1, y: top }, { weight: HEAVY });
    };
    plateEyepiece(c, vx, vy, vr, () => {
      // left: straight ahead through the clear glass
      sea(vx - vr, vx, vy);
      plateText(c, 'HORIZON', vx - vr * 0.5, vy - 6, { size: 5.5, align: 'center' });
      // right: the sky the mirrors turn down, its own horizon far below
      const mh = vy + hs * k;
      if (mh < vy + vr) sea(vx, vx + vr, mh);
      plateLine(c, { x: vx, y: vy }, { x: vx + vr, y: vy }, { kind: 'short', weight: THIN });
      if (starSeen) starReticle(c, vx + vr * 0.45, vy - (STAR - hs) * k, 6, ink);
      plateLine(c, { x: vx, y: vy - vr }, { x: vx, y: vy + vr }, { weight: MEDIUM });
    });
    // out of the field: an arrow at the rim says which way it lies
    if (!starSeen) {
      const up = hs < STAR;
      plateArrowhead(c, { x: vx + vr * 0.45, y: vy + (up ? -1 : 1) * (vr * 0.78) }, up ? -Math.PI / 2 : Math.PI / 2, 5);
    }
    plateText(c, 'CLEAR', vx - vr * 0.5, vy + vr + 11, { size: 6, align: 'center' });
    plateText(c, 'MIRROR', vx + vr * 0.5, vy + vr + 11, { size: 6, align: 'center' });
  }
})();
