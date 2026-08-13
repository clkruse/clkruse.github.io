'use strict';
/* §08b: the noon sight in cross-section – why the peak altitude is latitude.
   The plane of the drawing is the observer's meridian at local apparent noon:
   the sun, the zenith, and both poles all lie in it, so three angles stack
   at the earth's center: φ = z + δ. */

(function demoNoonGeom() {
  const d = createDemo('demo-noongeom', { aspect: 1.5, maxH: 520, draw });
  let lat = 40;   // observer latitude, °N
  let dec = 15;   // sun declination, ° (+N / −S)
  addSlider(d, {
    label: 'your latitude', min: 26, max: 55, step: 0.5, value: lat,
    fmt: v => v.toFixed(1) + '° N',
    onchange: v => { lat = v; },
  });
  addSlider(d, {
    label: "sun's declination", min: -23.4, max: 23.4, step: 0.1, value: dec,
    fmt: v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '°',
    onchange: v => { dec = v; },
  });
  const hStat = addStat(d, 'noon altitude h');
  const phiStat = addStat(d, 'latitude φ = z + δ', true);

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.42, cy = h * 0.54, R = h * 0.34;
    const aSun = -dec * D2R;   // canvas angle of the sun direction (N up)
    const aObs = -lat * D2R;   // canvas angle of the observer's radial
    const dSun = { x: Math.cos(aSun), y: Math.sin(aSun) };
    const zdeg = lat - dec;    // zenith distance at culmination
    const hdeg = 90 - zdeg;    // noon altitude
    const hC = P.s2, zC = P.s1, dC = P.s3;

    // ––– the earth, its axis, and the equator plane –––
    ctx.fillStyle = P.paperDeep;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    centerMark(ctx, cx, cy, 7, P.inkSoft);

    centerline(ctx, cx, cy - R - 26, cx, cy + R + 16, P.inkFaint);   // polar axis
    label(ctx, 'N', cx, cy - R - 38, { color: P.inkSoft, size: 11 });
    centerline(ctx, cx - R - 14, cy, cx + R + 30, cy, P.inkFaint);   // equator plane
    label(ctx, 'equator', cx - R - 20, cy - 11, { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'right' });

    // centerline from the center toward the sun (off the sheet, like §1's star)
    const sr = Math.min((w - 16 - cx) / dSun.x, R * 2.1);
    centerline(ctx, cx, cy, cx + dSun.x * sr, cy + dSun.y * sr, P.inkFaint);
    label(ctx, 'to the sun – at noon', cx + dSun.x * sr - 74, cy + dSun.y * sr - 12,
      { color: dC, size: 10.5, halo: P.paper });

    // subsolar point: the sun's GP, at latitude δ
    const gp = { x: cx + Math.cos(aSun) * R, y: cy + Math.sin(aSun) * R };
    pointMark(ctx, gp.x, gp.y, dC);
    leaderNote(ctx, 'sun overhead here', gp.x, gp.y, (aSun * R2D + 52) * D2R, 30, P.inkSoft, { size: 10.5 });

    // ––– the observer: zenith, horizon, and the measured altitude –––
    const O = { x: cx + Math.cos(aObs) * R, y: cy + Math.sin(aObs) * R };
    const u = { x: Math.cos(aObs), y: Math.sin(aObs) };
    const tHat = rot(u, Math.PI / 2);
    const tSide = (tHat.x * dSun.x + tHat.y * dSun.y) >= 0 ? tHat : { x: -tHat.x, y: -tHat.y };
    const angT = Math.atan2(tSide.y, tSide.x);

    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(O.x - tSide.x * R * 0.3, O.y - tSide.y * R * 0.3);
    ctx.lineTo(O.x + tSide.x * R * 0.62, O.y + tSide.y * R * 0.62);
    ctx.stroke();
    label(ctx, 'horizon', O.x - tSide.x * R * 0.3 - 6, O.y - tSide.y * R * 0.3 - 10,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'right' });

    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(O.x, O.y);
    ctx.lineTo(O.x + u.x * R * 0.42, O.y + u.y * R * 0.42);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'zenith', O.x + u.x * (R * 0.42 + 20), O.y + u.y * (R * 0.42 + 20),
      { color: P.inkSoft, size: 10.5, halo: P.paper });

    // sight line to the sun, parallel to the centerline
    const sightLen = R * 0.62;
    ctx.strokeStyle = hC;
    ctx.fillStyle = hC;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(O.x, O.y);
    ctx.lineTo(O.x + dSun.x * sightLen, O.y + dSun.y * sightLen);
    ctx.stroke();
    dimHead(ctx, O.x + dSun.x * sightLen, O.y + dSun.y * sightLen, aSun, 9, 2.7);

    // measured altitude h, between horizon and sun
    const rH = R * 0.26;
    angleDim(ctx, O.x, O.y, rH, angT, aSun, hC);
    const mH = (angT + aSun) / 2;
    label(ctx, 'h', O.x + Math.cos(mH) * (rH + 13), O.y + Math.sin(mH) * (rH + 13),
      { color: hC, halo: P.paper, size: 11.5 });

    pointMark(ctx, O.x, O.y, P.ink);
    leaderNote(ctx, 'you, at noon', O.x, O.y,
      (Math.atan2(u.y - tSide.y, u.x - tSide.x)), 30, P.inkSoft, { size: 10.5 });

    // ––– the stack of angles at the center: φ = z + δ –––
    // δ: equator up to the sun direction (skipped when the sun is on the equator)
    if (Math.abs(dec) >= 3) {
      angleDim(ctx, cx, cy, R * 0.3, 0, aSun, dC);
      const mD = aSun / 2;
      label(ctx, 'δ', cx + Math.cos(mD) * (R * 0.3 + 12), cy + Math.sin(mD) * (R * 0.3 + 12),
        { color: dC, halo: P.paperDeep, size: 11.5 });
    }
    // z: sun direction up to the zenith
    if (zdeg >= 3) {
      angleDim(ctx, cx, cy, R * 0.46, aSun, aObs, zC);
      const mZ = (aSun + aObs) / 2;
      label(ctx, 'z', cx + Math.cos(mZ) * (R * 0.46 + 12), cy + Math.sin(mZ) * (R * 0.46 + 12),
        { color: zC, halo: P.paperDeep, size: 11.5 });
    }
    // φ: equator up to the observer – the whole stack
    angleDim(ctx, cx, cy, R * 0.66, 0, aObs, P.ink);
    const mP = aObs / 2;
    label(ctx, 'φ', cx + Math.cos(mP) * (R * 0.66 + 12), cy + Math.sin(mP) * (R * 0.66 + 12),
      { color: P.ink, halo: P.paperDeep, size: 11.5 });

    // the formula, assembled in the quiet lower half of the disc
    const fx = cx - R * 0.22, fy = cy + R * 0.52;
    label(ctx, 'φ = z + δ', fx, fy - 9, { color: P.ink, halo: P.paperDeep, size: 11.5 });
    label(ctx, `${lat.toFixed(1)}° = ${zdeg.toFixed(1)}° ${dec < 0 ? '−' : '+'} ${Math.abs(dec).toFixed(1)}°`,
      fx, fy + 9, { color: P.inkSoft, halo: P.paperDeep, size: 10.5 });

    hStat.set(fmtDM(hdeg, 0));
    phiStat.set(`${zdeg.toFixed(1)}° + ${dec >= 0 ? '' : '(−'}${Math.abs(dec).toFixed(1)}${dec >= 0 ? '°' : '°)'} = ${lat.toFixed(1)}° N`);
  }
})();
