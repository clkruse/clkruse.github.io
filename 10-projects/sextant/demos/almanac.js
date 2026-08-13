'use strict';
/* §05b: how the almanac stores the sky – seen from above the pole, the stars
   turn as one rigid wheel. One fast number (the GHA of Aries) sets the wheel;
   each star rides at a fixed catalogued offset (its SHA); declination is the
   catalog constant that never joins the arithmetic.
   Hour angles are measured WESTWARD from Greenwich, drawn clockwise. */

(function demoAlmanac() {
  const d = createDemo('demo-almanac', { aspect: 1.5, maxH: 520, draw });
  let gmt = 4.6;
  addSlider(d, {
    label: 'Greenwich time', min: 0, max: 24, step: 1 / 60, value: gmt,
    fmt: v => {
      const hh = Math.floor(v) % 24, mm = Math.round((v - Math.floor(v)) * 60);
      return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    },
    onchange: v => { gmt = v; },
  });
  const ariesStat = addStat(d, 'GHA Aries');
  const sumStat = addStat(d, 'GHA Vega = Aries + SHA', true);
  const decStat = addStat(d, 'dec Vega – catalog constant');

  // navigational catalog values, rounded
  const STARS = [
    { name: 'Vega', sha: 80.5, dec: '38° 48′ N', main: true },
    { name: 'Sirius', sha: 258.5, dec: '16° 44′ S' },
    { name: 'Capella', sha: 280.5, dec: '46° 01′ N' },
  ];

  const wrap360 = a => ((a % 360) + 360) % 360;
  // westward hour angle HA → canvas angle (Greenwich fixed at the top, west = clockwise)
  const toCanvas = ha => (-90 + ha) * D2R;

  // an arc that sweeps the ACTUAL westward direction (can exceed 180°),
  // with a single slim head at its far end
  function sweepDim(ctx, cx, cy, r, haFrom, haTo, color, lw = 1.1) {
    const a1 = toCanvas(haFrom), a2 = toCanvas(haFrom + wrap360(haTo - haFrom));
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a1, a2, false);
    ctx.stroke();
    dimHead(ctx, cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, a2 + Math.PI / 2);
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    label(ctx, 'seen from above the pole', 14, 18, { color: P.inkFaint, size: 10.5, align: 'left' });

    const cx = w * 0.42, cy = h * 0.52, R = Math.min(h * 0.37, w * 0.27);
    const ghaAries = wrap360(100 + gmt * 15.041);   // illustrative epoch
    const ghaVega = wrap360(ghaAries + STARS[0].sha);

    // ––– the dial: the equatorial plane from above the pole –––
    ctx.fillStyle = P.paperDeep;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    centerMark(ctx, cx, cy, 7, P.inkSoft);

    // rim ticks every 15° of hour angle
    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 0.75;
    for (let a = 0; a < 360; a += 15) {
      const ar = toCanvas(a);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ar) * (R - 5), cy + Math.sin(ar) * (R - 5));
      ctx.lineTo(cx + Math.cos(ar) * R, cy + Math.sin(ar) * R);
      ctx.stroke();
    }

    // ––– the earth-fixed reference: Greenwich, straight up –––
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - R);
    ctx.stroke();
    label(ctx, 'Greenwich meridian', cx, cy - R - 14, { color: P.ink, size: 10.5, halo: P.paper });

    // ––– the star wheel: Aries + stars, rigid, turning with the clock –––
    const aAries = toCanvas(ghaAries);
    ctx.strokeStyle = P.s3;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(aAries) * R, cy + Math.sin(aAries) * R);
    ctx.stroke();
    label(ctx, 'Aries', cx + Math.cos(aAries) * (R + 18), cy + Math.sin(aAries) * (R + 18),
      { color: P.s3, size: 10.5, halo: P.paper });

    for (const st of STARS) {
      const a = toCanvas(wrap360(ghaAries + st.sha));
      ctx.strokeStyle = st.main ? P.s2 : P.inkFaint;
      ctx.lineWidth = st.main ? 1.6 : 0.9;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
      starGlyph(ctx, cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10), st.main ? 7 : 5,
        st.main ? P.s2 : P.inkSoft);
      label(ctx, st.name, cx + Math.cos(a) * (R + 30), cy + Math.sin(a) * (R + 30),
        { color: st.main ? P.s2 : P.inkSoft, size: 10.5, halo: P.paper });
      if (!st.main) {
        label(ctx, 'dec ' + st.dec, cx + Math.cos(a) * (R + 30), cy + Math.sin(a) * (R + 30) + 13,
          { color: P.inkFaint, size: 9.5, halo: P.paper });
      }
    }

    // ––– the bookkeeping: two sweeps that add –––
    // GHA Aries: the one fast number, Greenwich → Aries
    sweepDim(ctx, cx, cy, R * 0.5, 0, ghaAries, P.s3);
    const mA = toCanvas(ghaAries * 0.5);
    label(ctx, 'GHA Aries', cx + Math.cos(mA) * (R * 0.5 - 22), cy + Math.sin(mA) * (R * 0.5 - 22),
      { color: P.s3, halo: P.paperDeep, size: 10.5 });
    // SHA Vega: the fixed catalog offset, Aries → Vega
    sweepDim(ctx, cx, cy, R * 0.72, ghaAries, ghaAries + STARS[0].sha, P.inkSoft, 0.9);
    const mS = toCanvas(ghaAries + STARS[0].sha * 0.5);
    label(ctx, 'SHA – fixed', cx + Math.cos(mS) * (R * 0.72 + 16), cy + Math.sin(mS) * (R * 0.72 + 16),
      { color: P.inkSoft, halo: P.paper, size: 10 });
    // the sum: Greenwich → Vega
    sweepDim(ctx, cx, cy, R * 0.3, 0, ghaVega, P.s2);
    const mV = toCanvas(ghaVega * 0.5);
    label(ctx, 'GHA Vega', cx + Math.cos(mV) * (R * 0.3 + 17), cy + Math.sin(mV) * (R * 0.3 + 17),
      { color: P.s2, halo: P.paperDeep, size: 10.5 });

    ariesStat.set(fmtDM(ghaAries, 1));
    sumStat.set(`${fmtDM(ghaAries, 1)} + 80° 30′ = ${fmtDM(ghaVega, 1)}`);
    decStat.set('38° 48′ N');
  }
})();
