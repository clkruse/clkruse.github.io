'use strict';
/* §06: dip of the horizon and atmospheric refraction. */

(function demoDip() {
  const d = createDemo('demo-dip', { aspect: 1.7, maxH: 460, draw });
  const eye = addSlider(d, {
    label: 'height of eye', min: 1, max: 50, step: 0.5, value: 3,
    fmt: v => v.toFixed(1) + ' m',
  });
  const dipStat = addStat(d, 'dip correction');
  const horStat = addStat(d, 'horizon distance');
  const where = addStat(d, 'you are on', true);

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    const hm = eye.v;
    // exaggerated geometry
    const S = { x: w * 0.24, y: h * 0.64 };
    const Rpx = h * 1.55;
    const C = { x: S.x, y: S.y + Rpx };
    const eyePx = 26 + (h * 0.30) * Math.sqrt(hm / 50);
    const Eye = { x: S.x, y: S.y - eyePx };

    // sea: flat fill, 2px object line for the surface
    ctx.fillStyle = P.sea;
    ctx.beginPath();
    ctx.arc(C.x, C.y, Rpx, -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7);
    ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(C.x, C.y, Rpx, -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7);
    ctx.stroke();

    // true horizontal: dashed reference line from the eye
    const HL = w * 0.66;
    ctx.strokeStyle = P.inkSoft;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Eye.x, Eye.y);
    ctx.lineTo(Eye.x + HL, Eye.y);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'true horizontal', Eye.x + HL, Eye.y - 11,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'right' });

    // line of sight: tangent to the sea surface = visible horizon
    const d0 = Math.hypot(Eye.x - C.x, Eye.y - C.y);
    const dip = Math.acos(clamp(Rpx / d0, 0, 1));
    const Ldist = Math.sqrt(d0 * d0 - Rpx * Rpx);
    // direction from eye toward tangent point (right side): rotate "down-to-center" by (90°-dip)
    const toC = norm({ x: C.x - Eye.x, y: C.y - Eye.y });
    const tanDir = rot(toC, -(Math.PI / 2 - dip));
    const T = { x: Eye.x + tanDir.x * Ldist, y: Eye.y + tanDir.y * Ldist };
    const tangA = Math.atan2(tanDir.y, tanDir.x);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Eye.x, Eye.y);
    ctx.lineTo(T.x + tanDir.x * 30, T.y + tanDir.y * 30);
    ctx.stroke();

    // the dip angle, dimensioned between the horizontal and the sight line
    const rDip = HL * 0.42;
    angleDim(ctx, Eye.x, Eye.y, rDip, 0, tangA, P.s1);
    label(ctx, 'dip', Eye.x + Math.cos(tangA / 2) * (rDip + 16),
      Eye.y + Math.sin(tangA / 2) * (rDip + 16),
      { color: P.s1, size: 11.5, halo: P.paper, align: 'left' });

    // deck and mast: plain linework
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(S.x - 14, S.y);
    ctx.lineTo(S.x + 14, S.y);
    ctx.moveTo(S.x, S.y);
    ctx.lineTo(Eye.x, Eye.y);
    ctx.stroke();

    // height of eye: extension ticks + vertical dimension line
    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(S.x - 18, S.y); ctx.lineTo(S.x - 38, S.y);
    ctx.moveTo(S.x - 6, Eye.y); ctx.lineTo(S.x - 38, Eye.y);
    ctx.stroke();
    const dx = S.x - 31;
    ctx.strokeStyle = P.inkSoft;
    ctx.fillStyle = P.inkSoft;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(dx, Eye.y); ctx.lineTo(dx, S.y);
    ctx.stroke();
    dimHead(ctx, dx, Eye.y, -Math.PI / 2);
    dimHead(ctx, dx, S.y, Math.PI / 2);
    label(ctx, 'height of eye', dx - 13, (S.y + Eye.y) / 2,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'right' });

    // points last, over the linework
    pointMark(ctx, T.x, T.y, P.ink);
    leaderNote(ctx, 'visible horizon', T.x, T.y, -1.15, 30, P.inkSoft, { size: 10.5 });
    pointMark(ctx, Eye.x, Eye.y, P.ink);
    leaderNote(ctx, 'eye', Eye.x, Eye.y, -2.4, 26, P.inkSoft, { size: 10.5 });

    // true numbers
    const dipTrue = 1.76 * Math.sqrt(hm);
    const distTrue = 2.08 * Math.sqrt(hm);
    dipStat.set('−' + dipTrue.toFixed(1) + '′');
    horStat.set(distTrue.toFixed(1) + ' nm');
    where.set(hm < 2.5 ? 'a dinghy – nearly at the waterline' :
      hm < 8 ? 'a sailboat deck' :
        hm < 22 ? "a ship's bridge" : 'the crow’s nest of a tall ship');
  }
})();

(function demoRefraction() {
  const d = createDemo('demo-refraction', { aspect: 1.6, maxH: 500, draw });
  const app = addSlider(d, {
    label: 'apparent altitude', min: 0.5, max: 60, step: 0.5, value: 8,
    fmt: v => v.toFixed(1) + '°',
  });
  const corrStat = addStat(d, 'refraction');
  const note = addStat(d, ' ', true);

  const bennett = ha => 1 / Math.tan((ha + 7.31 / (ha + 4.4)) * D2R); // arcmin

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const O = { x: w * 0.14, y: h * 0.82 };
    // planet surface (gentle arc): flat fill, 2px object line for the limb
    const Rp = h * 3.2;
    const Cp = { x: O.x, y: O.y + Rp };
    ctx.fillStyle = P.paperDeep;
    ctx.beginPath();
    ctx.arc(Cp.x, Cp.y, Rp, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.6);
    ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(Cp.x, Cp.y, Rp, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.6);
    ctx.stroke();
    // atmosphere bands: faint ink construction arcs, denser near the ground
    const bandR = i => Rp + 24 + i * 40;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.globalAlpha = 0.8 - i * 0.14;
      ctx.strokeStyle = P.inkSoft;
      ctx.beginPath();
      ctx.arc(Cp.x, Cp.y, bandR(i), -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.6);
      ctx.stroke();
      ctx.restore();
    }
    const bandY = (i, x) => Cp.y - Math.sqrt(Math.max(0, bandR(i) ** 2 - (x - Cp.x) ** 2));
    const groundY = x => Cp.y - Math.sqrt(Math.max(0, Rp * Rp - (x - Cp.x) ** 2));
    const haloAt = (x, y) => y > groundY(x) ? P.paperDeep : P.paper;
    label(ctx, 'denser air', w * 0.82, bandY(0, w * 0.82) + 4, { color: P.inkSoft, size: 10.5, halo: haloAt(w * 0.82, bandY(0, w * 0.82) + 4) });
    label(ctx, 'thinner air', w * 0.36, bandY(4, w * 0.36) - 14, { color: P.inkFaint, size: 10.5, halo: P.paper });

    const ha = app.v;
    const R = bennett(ha); // arcmin
    const exag = clamp(R * 1.5, 2, 26); // degrees of visual bend
    const haR = ha * D2R, exR = exag * D2R;
    const L = Math.min(Math.min(w, h) * 0.95, (O.y - 50) / Math.max(Math.sin(haR), 0.1));

    // apparent direction: dashed reference line + ghost star
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(O.x, O.y);
    const gx = O.x + Math.cos(haR) * L, gy = O.y - Math.sin(haR) * L;
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.2;
    starGlyphHollow(ctx, gx, gy, 9);
    label(ctx, 'where you see it', gx - 14, gy - 20, { color: P.inkSoft, size: 11, halo: P.paper });

    // actual bent path: angle eases from ha (at eye) down to ha - exag (outside atmosphere),
    // stopping if it would run off the canvas
    ctx.strokeStyle = P.s2;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(O.x, O.y);
    let px = O.x, py = O.y, lastAng = haR;
    const steps = 60;
    for (let i = 1; i <= steps; i++) {
      const s = i / steps;
      const ang = haR - exR * (1 - Math.pow(1 - s, 2.2)); // bends most near the ground
      const nx = px + Math.cos(ang) * (L / steps);
      const ny = py - Math.sin(ang) * (L / steps);
      if (nx > w - 54 || ny < 46 || ny > h - 40) break;
      px = nx; py = ny; lastAng = ang;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    // slim head at the far end, true star just beyond it
    const outA = -lastAng; // canvas angle of travel, away from the eye
    ctx.fillStyle = P.s2;
    dimHead(ctx, px, py, outA);
    const stx = px + Math.cos(outA) * 15, sty = py + Math.sin(outA) * 15;
    starGlyph(ctx, stx, sty, 9, P.s2);
    label(ctx, 'where it really is', stx - 14, sty + 24,
      { color: P.s2, size: 11, halo: haloAt(stx - 14, sty + 24) });

    // R: linear dimension across the gap between the ghost star and the
    // true star – in this drawing that gap IS the refraction correction
    const gap = Math.hypot(stx - gx, sty - gy);
    if (gap > 0.5) {
      const u = { x: (stx - gx) / gap, y: (sty - gy) / gap };
      const ua = Math.atan2(u.y, u.x);
      const span = gap - 24; // room left between the two glyphs
      ctx.strokeStyle = P.s1;
      ctx.fillStyle = P.s1;
      ctx.lineWidth = 0.9;
      if (span >= 2) {
        const e1 = { x: gx + u.x * 12, y: gy + u.y * 12 };
        const e2 = { x: stx - u.x * 12, y: sty - u.y * 12 };
        // short perpendicular extension ticks just outside each star
        for (const e of [e1, e2]) {
          ctx.beginPath();
          ctx.moveTo(e.x - u.y * 4.5, e.y + u.x * 4.5);
          ctx.lineTo(e.x + u.y * 4.5, e.y - u.x * 4.5);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(e1.x, e1.y);
        ctx.lineTo(e2.x, e2.y);
        ctx.stroke();
        if (span >= 14) {
          // heads point outward at the ticks, scaled down when cramped
          const hl = clamp(span * 0.3, 4, 7.5);
          dimHead(ctx, e1.x, e1.y, ua + Math.PI, hl, hl * 0.31);
          dimHead(ctx, e2.x, e2.y, ua, hl, hl * 0.31);
        }
      } else {
        // glyphs nearly touch: bare hairline through the gap
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(stx, sty);
        ctx.stroke();
      }
      const mx = (gx + stx) / 2, my = (gy + sty) / 2;
      if (span >= 14) {
        const rlx = Math.max(gx, stx) + 20;
        label(ctx, 'R (exaggerated)', rlx, my,
          { color: P.s1, size: 10.5, halo: haloAt(rlx, my), align: 'left' });
      } else {
        // cramped: the label takes a leader to the gap, between the star notes
        leaderNote(ctx, 'R (exaggerated)', mx, my, 0, 26, P.s1,
          { size: 10.5, halo: haloAt(mx + 40, my) });
      }
    }

    // observer
    pointMark(ctx, O.x, O.y, P.ink);
    leaderNote(ctx, 'observer', O.x, O.y, 0.85, 26, P.inkSoft,
      { size: 10.5, halo: P.paperDeep });

    corrStat.set('−' + R.toFixed(1) + '′');
    note.set(ha <= 3 ? 'grazing the horizon, light crosses ~300 miles of thick air' :
      ha >= 45 ? 'nearly overhead – the bending almost vanishes' :
        'true altitude = apparent − R');
  }

  function starGlyphHollow(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 === 0 ? r : r * 0.36;
      const a = (i / 8) * TAU - Math.PI / 2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](rr * Math.cos(a), rr * Math.sin(a));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
})();
