'use strict';
/* §03: North Star height = latitude, two coupled views (owner's sketch).
   Left: a vertical height gauge – the star's altitude above the horizon read
   like a thermometer, draggable. Right: the globe with a vertical polar axis;
   the observer's sight line to the North Star runs parallel to the axis and
   never moves – the horizon tangent tilts under it. One shared latitude. */

(function demoPolaris() {
  const d = createDemo('demo-polaris', { aspect: 1.5, maxH: 520, draw });
  let lat = 45;
  const latSlider = addSlider(d, {
    label: 'your latitude', min: 5, max: 80, step: 0.5, value: lat,
    fmt: v => v.toFixed(1) + '° N',
    onchange: v => { lat = v; },
  });
  const hStat = addStat(d, 'altitude of Polaris');
  const note = addStat(d, ' ', true);

  d.canvas.classList.add('grab');
  let geo = null, pane = null;
  addDrag(d.canvas, {
    start(p) {
      pane = geo && p.x < geo.splitX ? 'left' : 'right';
    },
    move(p) {
      if (!geo) return;
      if (pane === 'left') {
        lat = clamp((geo.y0 - p.y) / (geo.y0 - geo.y90) * 90, 5, 80);
      } else {
        lat = clamp(-Math.atan2(p.y - geo.cy, p.x - geo.cx) * R2D, 5, 80);
      }
      latSlider.set(lat);
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    const hC = P.s2;

    /* ————— left pane: the height gauge ————— */

    const splitX = w * 0.36;
    const ax = 66;                 // the scale line
    const y0 = h - 64, y90 = 44;   // 0° at the horizon, 90° at the zenith
    const yOf = deg => y0 - (y0 - y90) * deg / 90;
    geo = geo || {};
    geo.splitX = splitX;
    geo.y0 = y0;
    geo.y90 = y90;

    label(ctx, 'from the deck', splitX * 0.5, 18, { color: P.inkSoft, size: 10.5 });

    // the horizon, with a hint of sea
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - 14, y0);
    ctx.lineTo(splitX - 24, y0);
    ctx.stroke();
    label(ctx, 'horizon', splitX - 24, y0 + 12, { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'right' });

    // the graduated scale, 0–90°
    ctx.strokeStyle = P.inkSoft;
    ctx.fillStyle = P.inkSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, y0);
    ctx.lineTo(ax, y90);
    ctx.stroke();
    for (let a = 10; a <= 90; a += 10) {
      const major = a % 30 === 0;
      ctx.lineWidth = major ? 1 : 0.75;
      ctx.beginPath();
      ctx.moveTo(ax, yOf(a));
      ctx.lineTo(ax - (major ? 7 : 4), yOf(a));
      ctx.stroke();
      if (major) {
        label(ctx, a + '°', ax - 14, yOf(a), { color: P.inkFaint, size: 9.5, align: 'right' });
      }
    }

    // the star's height, as a linear dimension off the scale
    const sx = ax + 52;
    const sy = yOf(lat);
    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(ax + 4, sy);
    ctx.lineTo(sx - 14, sy);
    ctx.stroke();
    ctx.strokeStyle = hC;
    ctx.fillStyle = hC;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(sx, y0 - 3);
    ctx.lineTo(sx, sy + 14);
    ctx.stroke();
    dimHead(ctx, sx, sy + 14, -Math.PI / 2, 7, 2.3);
    dimHead(ctx, sx, y0 - 3, Math.PI / 2, 7, 2.3);
    const hTxt = 'h = ' + fmtDM(lat, 0);
    label(ctx, hTxt, Math.min(sx + 12, splitX - 12 - textW(ctx, hTxt, 11)), (y0 + sy) / 2,
      { color: hC, size: 11, halo: P.paper, align: 'left' });

    starGlyph(ctx, sx, sy, 8, P.ink);
    const dragTxt = 'North Star – drag';
    const dragX = Math.min(sx + 16, splitX - 12 - textW(ctx, dragTxt, 10.5));
    label(ctx, dragTxt, dragX, dragX < sx + 16 ? sy - 18 : sy - 12,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'left' });

    /* ————— divider ————— */

    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 12);
    ctx.lineTo(splitX, h - 12);
    ctx.stroke();

    /* ————— right pane: the same moment, from outside ————— */

    const cx = splitX + (w - splitX) * 0.44, cy = h * 0.60;
    const R = Math.min(h * 0.295, (w - splitX) * 0.28);
    geo.cx = cx; geo.cy = cy;

    label(ctx, 'from outside – the same moment', splitX + (w - splitX) * 0.5, 18, { color: P.inkSoft, size: 10.5 });

    const starY = 52;
    const aObs = -lat * D2R;
    const O = { x: cx + Math.cos(aObs) * R, y: cy + Math.sin(aObs) * R };
    const u = { x: Math.cos(aObs), y: Math.sin(aObs) };

    // the earth and its axis, N up
    ctx.fillStyle = P.paperDeep;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    centerMark(ctx, cx, cy, 7, P.inkSoft);
    centerline(ctx, cx, cy + R + 16, cx, starY + 10, P.inkFaint);
    label(ctx, 'N', cx - 12, cy - R - 14, { color: P.inkSoft, size: 11, halo: P.paper });
    label(ctx, 'to the North Star, too', cx - 8, starY, { color: P.inkFaint, size: 9.5, halo: P.paper, align: 'right' });
    label(ctx, 'S', cx - 12, cy + R + 12, { color: P.inkSoft, size: 11, halo: P.paper });

    // the horizon: a long tangent through you – the part that tilts
    const tHat = rot(u, Math.PI / 2);
    const tUp = tHat.y < 0 ? tHat : { x: -tHat.x, y: -tHat.y };   // toward the star side
    const angT = Math.atan2(tUp.y, tUp.x);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(O.x + tUp.x * R * 0.55, O.y + tUp.y * R * 0.55);
    ctx.lineTo(O.x - tUp.x * R * 1.05, O.y - tUp.y * R * 1.05);
    ctx.stroke();
    const hx = O.x - tUp.x * R * 1.05 + 4;
    label(ctx, 'horizon – it tilts', Math.min(hx, w - 10), O.y - tUp.y * R * 1.05 + 13,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: hx > w - 130 ? 'right' : 'left' });

    // the sight line: straight up, parallel to the axis, never moves –
    // with the North Star riding at its top, far beyond the globe
    ctx.strokeStyle = hC;
    ctx.fillStyle = hC;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(O.x, O.y);
    ctx.lineTo(O.x, starY + 22);
    ctx.stroke();
    dimHead(ctx, O.x, starY + 22, -Math.PI / 2, 9, 2.7);
    starGlyph(ctx, O.x, starY, 9, P.ink);
    label(ctx, 'North Star', O.x + 16, starY, { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'left' });

    // the measured angle, horizon up to the star
    const rH = R * 0.34;
    angleDim(ctx, O.x, O.y, rH, angT, -Math.PI / 2, hC);
    const mH = (angT - Math.PI / 2) / 2;
    label(ctx, 'h', O.x + Math.cos(mH) * (rH + 13), O.y + Math.sin(mH) * (rH + 13),
      { color: hC, halo: P.paper, size: 11.5 });

    pointMark(ctx, O.x, O.y, P.ink);
    leaderNote(ctx, 'you – drag', O.x, O.y, (Math.atan2(u.y - tUp.y, u.x - tUp.x)), 28, P.inkSoft, { size: 10.5 });

    hStat.set(fmtDM(lat, 0));
    note.set(lat < 12 ? 'near the equator the North Star skims the horizon' :
      lat > 70 ? 'in the far north it hangs high overhead' :
        'the sight line never moves; your horizon does');
  }
})();
