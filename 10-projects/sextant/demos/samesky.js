'use strict';
/* §05: the same sky, two places. One Earth-under-sky configuration can be
   read as 40°N 40°W at 12:00 GMT or as 40°N 60°W at 13:20 – they are the
   same orientation of the planet. The deck view never changes; only the
   Greenwich meridian (and so the implied longitude) does. */

(function demoSameSky() {
  const d = createDemo('demo-samesky', { aspect: 1.55, maxH: 520, draw });
  let gmt = 12;
  addSlider(d, {
    label: 'if Greenwich reads', min: 12, max: 12 + 80 / 60, step: 1 / 60, value: gmt,
    fmt: v => {
      const hh = Math.floor(v) % 24, mm = Math.round((v - Math.floor(v)) * 60);
      return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    },
    onchange: v => { gmt = v; },
  });
  const lonStat = addStat(d, 'then you are at');
  const skyStat = addStat(d, ' ', true);

  function inkA(a) {
    let c = P.ink.trim().replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const lonW = 40 + (gmt - 12) * 15; // implied west longitude
    const hSun = 50;                   // deck altitude, fixed (z = 40°)
    const hC = P.s2;

    /* ————— left pane: from the deck, unchanging ————— */

    const splitX = w * 0.36;
    const ax = 58;
    const y0 = h - 58, y90 = 40;
    const yOf = deg => y0 - (y0 - y90) * deg / 90;

    label(ctx, 'from the deck', splitX * 0.5, 18, { color: P.inkSoft, size: 10.5 });

    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - 12, y0);
    ctx.lineTo(splitX - 20, y0);
    ctx.stroke();
    label(ctx, 'horizon', splitX - 20, y0 + 12,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'right' });

    // sea hatch under the horizon
    ctx.save();
    ctx.beginPath();
    ctx.rect(12, y0, splitX - 36, h - y0 - 12);
    ctx.clip();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 0.75;
    ctx.translate(splitX * 0.4, y0 + 20);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    for (let yy = -80; yy <= 80; yy += 7) {
      ctx.moveTo(-80, yy); ctx.lineTo(80, yy);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = P.inkSoft;
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
        label(ctx, a + '°', ax - 12, yOf(a), { color: P.inkFaint, size: 9.5, align: 'right' });
      }
    }

    const sx = ax + 48, sy = yOf(hSun);
    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(ax + 4, sy);
    ctx.lineTo(sx - 12, sy);
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
    label(ctx, 'h', sx + 12, (y0 + sy) / 2, { color: hC, size: 11.5, halo: P.paper, align: 'left' });

    // the sun: flat disc, thin ring – matches the polar pane
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.sun;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, sy, 11, 0, TAU); ctx.stroke();
    label(ctx, 'the sun', sx + 16, sy - 14,
      { color: P.sun, size: 10.5, halo: P.paper, align: 'left' });

    /* ————— divider ————— */

    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 12);
    ctx.lineTo(splitX, h - 12);
    ctx.stroke();

    /* ————— right pane: Earth from above the pole ————— */

    const cx = splitX + (w - splitX) * 0.48, cy = h * 0.54;
    const R = Math.min(h * 0.34, (w - splitX) * 0.32);

    label(ctx, 'from above the pole – the same moment',
      splitX + (w - splitX) * 0.5, 18, { color: P.inkSoft, size: 10.5 });

    const obsA = 40 * D2R;                 // 40° west of the sun, so h = 50°
    const thG = obsA - lonW * D2R;         // Greenwich: west of it is +canvas

    // sunlight from the right
    ctx.strokeStyle = P.sun;
    ctx.fillStyle = P.sun;
    ctx.lineWidth = 0.9;
    const rayEnd = cx + R + 22;
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const yy = cy + i * R * 0.34;
      ctx.beginPath();
      ctx.moveTo(w - 8, yy);
      ctx.lineTo(rayEnd, yy);
      ctx.stroke();
      dimHead(ctx, rayEnd, yy, Math.PI);
    }
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(w - 6, cy, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.sun;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(w - 6, cy, 13.5, 0, TAU); ctx.stroke();

    ctx.fillStyle = P.paperDeep;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
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
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    // faint meridians, then the two endpoint Greenwiches, then the live one
    for (let i = 1; i < 24; i++) {
      const a = thG - i * 15 * D2R;
      ctx.strokeStyle = inkA(0.18);
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }

    const endTh = [
      { a: obsA - 40 * D2R, lab: '12:00', lon: 40 },
      { a: obsA - 60 * D2R, lab: '13:20', lon: 60 },
    ];
    for (const e of endTh) {
      ctx.strokeStyle = P.inkFaint;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(e.a) * R, cy + Math.sin(e.a) * R);
      ctx.stroke();
      ctx.setLineDash([]);
      if (Math.cos(e.a) < 0.85) {
        label(ctx, e.lab,
          cx + Math.cos(e.a) * (R + 16), cy + Math.sin(e.a) * (R + 16),
          { color: P.inkFaint, size: 9.5, halo: P.paper });
      }
    }

    ctx.strokeStyle = hC;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(thG) * R, cy + Math.sin(thG) * R);
    ctx.stroke();
    const gx = cx + Math.cos(thG) * R, gy = cy + Math.sin(thG) * R;
    if (Math.cos(thG) > 0.94) {
      const dir = (Math.sin(thG) >= 0.001 ? 55 : -55) * D2R;
      leaderNote(ctx, 'Greenwich', gx, gy, dir, 28, hC, { size: 10.5, halo: P.paper });
    } else {
      leaderNote(ctx, 'Greenwich', gx, gy, thG, 24, hC, { size: 10.5, halo: P.paper });
    }

    centerline(ctx, cx, cy, Math.min(w - 22, cx + R + 40), cy, P.inkFaint);
    centerMark(ctx, cx, cy, 7, P.inkSoft);
    label(ctx, 'N', cx - 12, cy - 12, { color: P.inkSoft, size: 10.5, halo: P.paperDeep });

    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(cx + R, cy, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.sun;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx + R, cy, 8, 0, TAU); ctx.stroke();
    leaderNote(ctx, "sun's GP", cx + R, cy, 80 * D2R, 18, P.sun, { size: 10.5, halo: P.paper });

    const ox = cx + Math.cos(obsA) * R, oy = cy + Math.sin(obsA) * R;
    pointMark(ctx, ox, oy, P.ink);
    leaderNote(ctx, 'you', ox, oy, obsA, 22, P.inkSoft, { size: 10.5, halo: P.paper });

    lonStat.set('40° N  ' + lonW.toFixed(1) + '° W');
    skyStat.set('the deck view does not change');
  }
})();
