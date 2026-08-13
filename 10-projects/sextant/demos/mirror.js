'use strict';
/* §04a: rotate a mirror, the beam turns twice as fast. */

(function demoMirror() {
  const d = createDemo('demo-mirror', { aspect: 1.7, maxH: 460, draw });
  const M0 = 128; // reference mirror tilt, degrees (canvas angle of mirror line)
  let delta = 10;
  const slider = addSlider(d, {
    label: 'mirror rotation', min: -20, max: 24, step: 0.5, value: delta,
    fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) + '°',
    onchange: v => { delta = v; },
  });
  const beamStat = addStat(d, 'beam swings by');
  d.canvas.classList.add('grab');
  let geo = null;
  addDrag(d.canvas, {
    move(p, dp) {
      if (!geo) return;
      const a1 = Math.atan2(p.y - dp.dy - geo.my, p.x - dp.dx - geo.mx);
      const a2 = Math.atan2(p.y - geo.my, p.x - geo.mx);
      let dd = (a2 - a1) * R2D;
      if (dd > 180) dd -= 360; if (dd < -180) dd += 360;
      delta = clamp(delta + dd, -20, 24);
      slider.set(delta);
    },
  });

  function beamDir(mirrorDeg) {
    const mdir = { x: Math.cos(mirrorDeg * D2R), y: Math.sin(mirrorDeg * D2R) };
    let n = rot(mdir, Math.PI / 2);
    if (n.x > 0) n = { x: -n.x, y: -n.y }; // normal faces the incoming beam (from left)
    return reflect({ x: 1, y: 0 }, n);
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    const mx = w * 0.46, my = h * 0.60;
    geo = { mx, my };
    const m = M0 + delta;
    const mdir = { x: Math.cos(m * D2R), y: Math.sin(m * D2R) };
    const len = h * 0.24;

    // distance from the pivot to the canvas edge (inset) along a ray
    const inset = 14;
    const rayLen = dir => {
      let t = Infinity;
      if (dir.x > 1e-9) t = Math.min(t, (w - inset - mx) / dir.x);
      if (dir.x < -1e-9) t = Math.min(t, (inset - mx) / dir.x);
      if (dir.y > 1e-9) t = Math.min(t, (h - inset - my) / dir.y);
      if (dir.y < -1e-9) t = Math.min(t, (inset - my) / dir.y);
      return t;
    };

    // ––– ghost reference mirror + ghost beam: dashed reference lines –––
    const gdir = { x: Math.cos(M0 * D2R), y: Math.sin(M0 * D2R) };
    const gb = beamDir(M0);
    const rb = beamDir(m);
    const beamLen = Math.min(rayLen(rb), rayLen(gb));
    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(mx - gdir.x * len, my - gdir.y * len);
    ctx.lineTo(mx + gdir.x * len, my + gdir.y * len);
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + gb.x * (beamLen - 16), my + gb.y * (beamLen - 16));
    ctx.stroke();
    ctx.setLineDash([]);
    leaderNote(ctx, 'reference', mx + gdir.x * len * 0.95, my + gdir.y * len * 0.95,
      112 * D2R, 22, P.inkFaint, { size: 10.5 });

    // ––– the normal: dash-dot centerline –––
    let n = rot(mdir, Math.PI / 2);
    if (n.x > 0) n = { x: -n.x, y: -n.y };
    const nAng = Math.atan2(n.y, n.x);
    const NL = h * 0.32;
    centerline(ctx, mx, my, mx + n.x * NL, my + n.y * NL, P.inkFaint);
    label(ctx, 'normal', mx + n.x * (NL + 16), my + n.y * (NL + 16),
      { color: P.inkFaint, size: 10.5, halo: P.paper });

    // ––– equal incidence / reflection angles: matched single-tick arcs –––
    const iAng = Math.PI;                 // incoming ray, reversed
    const rAng = Math.atan2(rb.y, rb.x);
    const rEq = h * 0.14;
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 0.9;
    for (const [from, to] of [[iAng, nAng], [nAng, rAng]]) {
      ctx.beginPath();
      arcBetween(ctx, mx, my, rEq, from, to);
      ctx.stroke();
      let deq = to - from;                // wrap-safe mid angle
      while (deq > Math.PI) deq -= TAU;
      while (deq < -Math.PI) deq += TAU;
      const mid = from + deq / 2;
      ctx.beginPath();
      ctx.moveTo(mx + Math.cos(mid) * (rEq - 4), my + Math.sin(mid) * (rEq - 4));
      ctx.lineTo(mx + Math.cos(mid) * (rEq + 4), my + Math.sin(mid) * (rEq + 4));
      ctx.stroke();
    }

    // ––– incoming beam: 1.6px, slim head, leader note –––
    ctx.strokeStyle = P.brass;
    ctx.fillStyle = P.brass;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(w * 0.04, my);
    ctx.lineTo(mx - 6, my);
    ctx.stroke();
    dimHead(ctx, mx - 6, my, 0, 9, 2.7);
    leaderNote(ctx, 'incoming ray', w * 0.17, my, -75 * D2R, 22, P.brass, { size: 10.5 });

    // ––– reflected beam –––
    ctx.strokeStyle = P.brass;
    ctx.fillStyle = P.brass;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + rb.x * beamLen, my + rb.y * beamLen);
    ctx.stroke();
    dimHead(ctx, mx + rb.x * beamLen, my + rb.y * beamLen, rAng, 9, 2.7);

    // ––– dimension: beam sweep 2Δ, between ghost beam and live beam –––
    // (the beams themselves are the extension lines: they cross the arc)
    const a1 = Math.atan2(gb.y, gb.x), a2 = rAng;
    const rB = h * 0.42;
    angleDim(ctx, mx, my, rB, a1, a2, P.brass);
    // label at mid-span; when the sweep is tiny the beams nearly coincide,
    // so the text steps aside to the far side of the ghost beam
    const sgnB = Math.sign(a2 - a1) || 1;
    const midB = (a1 + a2) / 2 - (Math.abs(delta) < 4 ? sgnB * 0.30 : 0);
    label(ctx, '2Δ = ' + (2 * Math.abs(delta)).toFixed(1) + '°',
      mx + Math.cos(midB) * (rB + 26), my + Math.sin(midB) * (rB + 26),
      { color: P.brass, size: 11.5, halo: P.paper });

    // ––– dimension: mirror rotation Δ, extension ticks + green arc –––
    const ma1 = (M0 - 180) * D2R, ma2 = (m - 180) * D2R;
    const rM = len + 16;
    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 0.9;
    for (const a of [ma1, ma2]) {
      ctx.beginPath();
      ctx.moveTo(mx + Math.cos(a) * (len + 5), my + Math.sin(a) * (len + 5));
      ctx.lineTo(mx + Math.cos(a) * (rM + 10), my + Math.sin(a) * (rM + 10));
      ctx.stroke();
    }
    angleDim(ctx, mx, my, rM, ma1, ma2, P.green);
    const midM = (ma1 + ma2) / 2;
    label(ctx, 'Δ = ' + Math.abs(delta).toFixed(1) + '°',
      mx + Math.cos(midM) * (rM + 32), my + Math.sin(midM) * (rM + 32),
      { color: P.green, size: 11.5, halo: P.paper });

    // ––– the mirror: 2px object line, back-hatched on the dead side –––
    const back = { x: -n.x, y: -n.y };
    const hx = norm({ x: mdir.x + back.x, y: mdir.y + back.y }); // 45° hatch
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let s = -len + 4; s <= len - 2; s += 8) {
      if (Math.abs(s) < 7) continue; // keep the pivot clear
      const px = mx + mdir.x * s, py = my + mdir.y * s;
      ctx.moveTo(px, py);
      ctx.lineTo(px + hx.x * 6, py + hx.y * 6);
    }
    ctx.stroke();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx - mdir.x * len, my - mdir.y * len);
    ctx.lineTo(mx + mdir.x * len, my + mdir.y * len);
    ctx.stroke();
    leaderNote(ctx, 'mirror – drag', mx - mdir.x * len * 0.55, my - mdir.y * len * 0.55,
      28 * D2R, 24, P.inkSoft, { size: 10.5 });

    // ––– pivot last, over the linework –––
    pointMark(ctx, mx, my, P.ink);

    beamStat.set((2 * Math.abs(delta)).toFixed(1) + '° – always double');
  }
})();
