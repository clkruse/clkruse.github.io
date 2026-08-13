'use strict';
/* §07: the clockwork earth. */

(function demoClock() {
  const d = createDemo('demo-clock', { aspect: 1.55, maxH: 520, draw });
  let gmt = 15.2, playing = false;
  const gmtSlider = addSlider(d, {
    label: 'Greenwich time', min: 0, max: 24, step: 1 / 60, value: gmt,
    fmt: v => {
      const hh = Math.floor(v) % 24, mm = Math.round((v - Math.floor(v)) * 60);
      return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    },
    onchange: v => { gmt = v; },
  });
  const playBtn = addButton(d, '▶ spin', () => {
    playing = !playing;
    playBtn.textContent = playing ? '❚❚ pause' : '▶ spin';
  });
  const err = addSlider(d, {
    label: 'clock error', min: -120, max: 120, step: 1, value: 30,
    fmt: v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' s',
  });
  const errStat = addStat(d, 'position error', true);

  // theme-following ink at reduced alpha (meridians, hatching)
  function inkA(a) {
    let c = P.ink.trim().replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function draw(ctx, w, h, t, ) {
    if (playing) {
      gmt = (gmt + 0.02) % 24;
      gmtSlider.set(gmt);
    }
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.42, cy = h * 0.52, R = Math.min(w, h) * 0.36;
    const rayEnd = cx + R + 26;

    // ––– sunlight: parallel rays at dimension weight, slim heads;
    //     the central ray is replaced by the centerline of collinearity –––
    ctx.strokeStyle = P.sun;
    ctx.fillStyle = P.sun;
    ctx.lineWidth = 0.9;
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const yy = cy + i * R * 0.32;
      ctx.beginPath();
      ctx.moveTo(w * 0.98, yy);
      ctx.lineTo(rayEnd, yy);
      ctx.stroke();
      dimHead(ctx, rayEnd, yy, Math.PI);
    }
    // the sun at the edge: flat disc, thin ring, no glow
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(w * 0.985, cy, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.sun;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(w * 0.985, cy, 16, 0, TAU); ctx.stroke();
    leaderNote(ctx, 'to the sun', rayEnd * 0.42 + w * 0.98 * 0.58, cy - R * 0.64,
      -65 * D2R, 20, P.sun, { size: 10.5, halo: P.paper });

    // ––– Earth disc (from above the North Pole): flat fill, object-line rim –––
    ctx.fillStyle = P.paperDeep;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // night side: diagonal drafting hatch on the half facing away from the sun
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI / 2, 3 * Math.PI / 2);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = inkA(0.16);
    ctx.lineWidth = 0.75;
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    for (let yy = -R * 1.5; yy <= R * 1.5; yy += 7) {
      ctx.moveTo(-R * 1.5, yy);
      ctx.lineTo(R * 1.5, yy);
    }
    ctx.stroke();
    ctx.restore();
    // terminator: the day/night boundary
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    // rim
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    // meridians every 15° (= every hour)
    const thG = -(gmt - 12) * 15 * D2R; // canvas angle of the Greenwich meridian
    for (let i = 1; i < 24; i++) {
      const a = thG - i * 15 * D2R; // successive meridians eastward
      ctx.strokeStyle = inkA(0.22);
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    // the Greenwich meridian, on top of the faint set
    ctx.strokeStyle = P.s2;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(thG) * R, cy + Math.sin(thG) * R);
    ctx.stroke();
    // Greenwich label at the end of its line; when the meridian points at
    // the sun the label yields to the GP marks: it becomes a leader note
    // stepped off the ray axis, away from the GP note below
    if (Math.cos(thG) > 0.94) {
      const dir = (Math.sin(thG) >= 0.001 ? 60 : -60) * D2R;
      leaderNote(ctx, 'Greenwich', cx + Math.cos(thG) * R, cy + Math.sin(thG) * R,
        dir, 30, P.s2, { size: 10.5, halo: P.paper });
    } else {
      label(ctx, 'Greenwich',
        cx + Math.cos(thG) * (R + 26), cy + Math.sin(thG) * (R + 26),
        { color: P.s2, size: 10.5, halo: P.paper });
    }

    // pole
    centerMark(ctx, cx, cy, 7, P.inkSoft);
    label(ctx, 'N', cx - 13, cy - 12, { color: P.inkSoft, size: 10.5, halo: P.paperDeep });

    // centerline of collinearity: earth center – sun's GP – sun
    centerline(ctx, cx, cy, w * 0.955, cy, P.inkFaint);

    // ––– sun's GP: the rim point facing the sun –––
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(cx + R, cy, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.sun;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx + R, cy, 8.5, 0, TAU); ctx.stroke();
    leaderNote(ctx, "sun's GP", cx + R + Math.cos(80 * D2R) * 8.5, cy + Math.sin(80 * D2R) * 8.5,
      80 * D2R, 20, P.sun, { size: 10.5, halo: P.paper });

    // ––– an observer riding the planet at 75° W –––
    const thObs = thG + 75 * D2R;
    const ox = cx + Math.cos(thObs) * R, oy = cy + Math.sin(thObs) * R;
    const facing = Math.cos(thObs); // 1 when facing the sun
    pointMark(ctx, ox, oy, P.ink);
    if (facing > 0.997) {
      // local noon: thin highlight ring, note steps above the ray axis
      ctx.strokeStyle = P.s2;
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(ox, oy, 9, 0, TAU); ctx.stroke();
      leaderNote(ctx, 'you (75° W) – local noon!',
        ox + Math.cos(-55 * D2R) * 9, oy + Math.sin(-55 * D2R) * 9,
        -55 * D2R, 25, P.s2, { size: 10.5, halo: P.paper });
    } else {
      leaderNote(ctx, 'you (75° W)', ox, oy, thObs, 22, P.inkSoft,
        { size: 10.5, halo: P.paper });
    }

    // ––– the GP a wrong clock implies: crimson, exaggerated ×100 –––
    // a fast clock reads a later GMT, so the navigator computes the GP
    // farther west; west = increasing canvas angle from the true GP at 0.
    // true shift = err × 15″ of longitude; drawn ×100 → err / 2.4 degrees.
    const esV = err.v;
    if (esV !== 0) {
      const am = Math.abs(esV) / 4; // honest arcminutes (= nm)
      const aF = (esV / 2.4) * D2R; // exaggerated ×100 for the drawing
      const fx = cx + Math.cos(aF) * R, fy = cy + Math.sin(aF) * R;
      // extension ticks from the rim inward, dimension arc between them
      ctx.strokeStyle = P.inkFaint;
      ctx.lineWidth = 0.9;
      for (const a of [0, aF]) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
        ctx.lineTo(cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30));
        ctx.stroke();
      }
      angleDim(ctx, cx, cy, R - 18, 0, aF, P.s1);
      // hollow ring: plotted, not real – contrast with the flat true GP
      ctx.strokeStyle = P.s1;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(fx, fy, 4.5, 0, TAU); ctx.stroke();
      // note block inside the disc, led off the ring away from the dimension
      const dir = aF + Math.PI - Math.sign(esV) * 35 * D2R;
      const nx = fx + Math.cos(dir) * 4.5, ny = fy + Math.sin(dir) * 4.5;
      const ex = nx + Math.cos(dir) * 30, ey = ny + Math.sin(dir) * 30;
      ctx.strokeStyle = P.s1;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex - 10, ey);
      ctx.stroke();
      ctx.fillStyle = P.s1;
      ctx.beginPath(); ctx.arc(nx, ny, 1.7, 0, TAU); ctx.fill();
      label(ctx, 'GP your clock implies', ex - 15, ey,
        { color: P.s1, size: 10.5, halo: P.paperDeep, align: 'right' });
      label(ctx, am.toFixed(1) + '′ = ' + am.toFixed(1) + ' nm', ex - 15, ey + 13,
        { color: P.s1, size: 10.5, halo: P.paperDeep, align: 'right' });
      label(ctx, '(shown ×100)', ex - 15, ey + 26,
        { color: P.s1, size: 9.5, halo: P.paperDeep, align: 'right' });
    }

    // sun GP longitude: data block, top-left corner
    let lonSun = (12 - gmt) * 15;
    while (lonSun > 180) lonSun -= 360;
    while (lonSun < -180) lonSun += 360;
    const ew = lonSun >= 0 ? 'E' : 'W';
    label(ctx, 'GP longitude: ' + fmtDM(Math.abs(lonSun)).replace('′', '′ ') + ew,
      14, 16, { color: P.inkSoft, size: 11, halo: P.paper, align: 'left' });

    // error meter
    const es = err.v;
    const arcmin = Math.abs(es) / 4;
    errStat.set(
      es === 0 ? 'a perfect clock – no error' :
        `GPs shift ${arcmin.toFixed(1)}′ ${es > 0 ? 'west' : 'east'} → fix lands ~${arcmin.toFixed(1)} nm off`,
      Math.abs(es) > 60 ? P.red : '');
  }
})();
