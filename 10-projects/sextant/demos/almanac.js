'use strict';
/* §06: the almanac as a book, not a planet. A page of tables plus the
   same arithmetic unrolled on a strip: one racing number (GHA Aries)
   plus a fixed catalog offset (SHA) is one addition. Declination never
   joins. Hour angles run westward from Greenwich, left → right. */

(function demoAlmanac() {
  const d = createDemo('demo-almanac', { aspect: 1.22, maxH: 560, draw });
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

  const STARS = [
    { name: 'Vega', sha: 80.5, dec: '38° 48′ N', main: true },
    { name: 'Sirius', sha: 258.5, dec: '16° 44′ S' },
    { name: 'Capella', sha: 280.5, dec: '46° 01′ N' },
  ];
  const wrap360 = a => ((a % 360) + 360) % 360;
  const ghaAt = t => wrap360(100 + t * 15.041);
  const hhmm = t => {
    const hh = Math.floor(t) % 24, mm = Math.round((t - Math.floor(t)) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  };

  function barDim(ctx, x1, x2, y, color, text, side) {
    const L = Math.abs(x2 - x1);
    if (L < 10) return;
    const a = x1 < x2 ? 0 : Math.PI;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    if (L >= 16) {
      dimHead(ctx, x1, y, a + Math.PI, 6, 2);
      dimHead(ctx, x2, y, a, 6, 2);
    }
    if (text && L >= 44) {
      label(ctx, text, (x1 + x2) / 2, y + (side < 0 ? -10 : 11),
        { color, size: 10.5, halo: P.paper });
    }
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const ghaAries = ghaAt(gmt);
    const shaV = STARS[0].sha;
    const ghaVega = wrap360(ghaAries + shaV);
    const wrapped = ghaAries + shaV >= 360;

    const hour0 = Math.floor(gmt) % 24;
    const hour1 = (hour0 + 1) % 24;
    const gha0 = ghaAt(hour0);
    const gha1 = ghaAt(hour0 + 1);
    const onHour = (gmt - hour0) * 60 < 0.51;

    /* ————— the sky, unrolled ————— */

    const pad = 16;
    const stripTop = 26;
    const stripH = Math.min(112, h * 0.30);
    const x0 = pad + 8, x1 = w - pad - 8;
    const yStrip = stripTop + 18;
    const yMid = yStrip + stripH * 0.42;
    const xOf = ha => x0 + (wrap360(ha) / 360) * (x1 - x0);

    label(ctx, 'hour angle, westward from Greenwich', pad, 16,
      { color: P.inkFaint, size: 10.5, align: 'left' });

    ctx.fillStyle = P.paperDeep;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x0, yStrip, x1 - x0, stripH * 0.72);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 0.75;
    for (let a = 0; a < 360; a += 30) {
      const x = xOf(a);
      const major = a % 90 === 0;
      ctx.beginPath();
      ctx.moveTo(x, yStrip);
      ctx.lineTo(x, yStrip + (major ? 10 : 5));
      ctx.stroke();
      if (major) {
        label(ctx, a === 0 ? '0°' : a + '°', x, yStrip + 20,
          { color: P.inkFaint, size: 9.5, halo: P.paperDeep,
            align: a === 0 ? 'left' : 'center' });
      }
    }

    // Greenwich: the earth-fixed edge of the page
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x0, yStrip);
    ctx.lineTo(x0, yStrip + stripH * 0.72);
    ctx.stroke();
    label(ctx, 'Greenwich', x0 + 6, yMid + 18,
      { color: P.ink, size: 10.5, halo: P.paperDeep, align: 'left' });

    const xA = xOf(ghaAries);
    const xV = xOf(ghaVega);

    const starXs = STARS.map(st => ({ st, x: xOf(ghaAries + st.sha) }));
    for (const { st, x } of starXs) {
      starGlyph(ctx, x, yMid - 4, st.main ? 7 : 5, st.main ? P.s2 : P.inkSoft);
      const crowded = starXs.some(o => o.st !== st && Math.abs(o.x - x) < 44);
      if (crowded && !st.main) continue;
      const nearR = x > x1 - 46, nearL = x < x0 + 70;
      label(ctx, st.name, x + (nearR ? -10 : nearL ? 12 : 0), yMid - 18,
        {
          color: st.main ? P.s2 : P.inkSoft, size: 10.5, halo: P.paperDeep,
          align: nearR ? 'right' : nearL ? 'left' : 'center',
        });
    }

    ctx.strokeStyle = P.s3;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(xA, yStrip + 4);
    ctx.lineTo(xA, yStrip + stripH * 0.72 - 4);
    ctx.stroke();
    pointMark(ctx, xA, yMid - 4, P.s3, 3);
    const ariesAlign = xA > x1 - 50 ? 'right' : xA < x0 + 50 ? 'left' : 'center';
    label(ctx, 'Aries', xA, yStrip + stripH * 0.72 - 12,
      { color: P.s3, size: 10.5, halo: P.paperDeep, align: ariesAlign });

    // the two addends, drawn as lengths on the strip
    const yBar = yStrip + stripH * 0.72 + 16;
    barDim(ctx, x0, xA, yBar, P.s3, 'GHA Aries', -1);
    if (!wrapped) {
      barDim(ctx, xA, xV, yBar + 18, P.inkSoft, 'SHA – fixed', 1);
      barDim(ctx, x0, xV, yBar + 36, P.s2, 'GHA Vega', 1);
    } else {
      const leftLen = xV - x0, rightLen = x1 - xA;
      barDim(ctx, xA, x1, yBar + 18, P.inkSoft, rightLen >= leftLen ? 'SHA wraps' : '', 1);
      barDim(ctx, x0, xV, yBar + 18, P.inkSoft, leftLen > rightLen ? 'SHA wraps' : '', 1);
      barDim(ctx, x0, xV, yBar + 36, P.s2, 'GHA Vega', 1);
    }

    /* ————— the page ————— */

    const pageY = yBar + 52;
    const pageX = pad;
    const pageW = w - pad * 2;
    const pageH = h - pageY - 8;
    if (pageH < 70) {
      ariesStat.set(fmtDM(ghaAries, 1));
      sumStat.set(wrapped
        ? `${fmtDM(ghaAries, 1)} + 80° 30′ − 360° = ${fmtDM(ghaVega, 1)}`
        : `${fmtDM(ghaAries, 1)} + 80° 30′ = ${fmtDM(ghaVega, 1)}`);
      decStat.set('38° 48′ N');
      return;
    }

    ctx.fillStyle = P.paperDeep;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(pageX, pageY, pageW, pageH);
    ctx.fill();
    ctx.stroke();

    const split = pageW > 420;
    const tight = pageH < 168;
    const colL = pageX + 14;
    const colR = split ? pageX + pageW * 0.50 : colL;
    const row0 = pageY + 16;
    const lh = Math.min(18, Math.max(13, (pageH - 40) / (tight && !split ? 9 : 10)));

    label(ctx, 'THE NAUTICAL ALMANAC', colL, row0,
      { color: P.ink, size: 11, halo: P.paperDeep, align: 'left', weight: 600 });
    if (pageW > 460) {
      label(ctx, 'one racing column, one fixed catalog', pageX + pageW - 14, row0,
        { color: P.inkFaint, size: 10.5, halo: P.paperDeep, align: 'right' });
    }

    // Aries block – the number that moves
    const yA = row0 + lh * 1.55;
    label(ctx, 'ARIES', colL, yA, { color: P.s3, size: 10.5, halo: P.paperDeep, align: 'left' });
    label(ctx, 'GMT', colL, yA + lh, { color: P.inkFaint, size: 10, halo: P.paperDeep, align: 'left' });
    label(ctx, 'GHA', colL + 88, yA + lh, { color: P.inkFaint, size: 10, halo: P.paperDeep, align: 'left' });

    const ariesRows = onHour
      ? [
          { t: String((hour0 + 23) % 24).padStart(2, '0') + 'h',
            v: fmtDM(ghaAt(hour0 - 1), 1), now: false },
          { t: String(hour0).padStart(2, '0') + 'h', v: fmtDM(gha0, 1), now: true },
          { t: String(hour1).padStart(2, '0') + 'h', v: fmtDM(gha1, 1), now: false },
        ]
      : [
          { t: String(hour0).padStart(2, '0') + 'h', v: fmtDM(gha0, 1), now: false },
          { t: 'now  ' + hhmm(gmt), v: fmtDM(ghaAries, 1), now: true },
          { t: String(hour1).padStart(2, '0') + 'h', v: fmtDM(gha1, 1), now: false },
        ];
    const shownAries = tight && !split ? ariesRows.filter(r => r.now) : ariesRows;
    shownAries.forEach((r, i) => {
      const y = yA + lh * (2 + i);
      const c = r.now ? P.s3 : P.ink;
      label(ctx, r.t, colL, y, { color: c, size: 11, halo: P.paperDeep, align: 'left' });
      label(ctx, r.v, colL + 88, y, { color: c, size: 11, halo: P.paperDeep, align: 'left' });
    });

    // Stars block – the lines that do not move
    const yS = split ? yA : yA + lh * (tight ? 3.4 : 5.6);
    const shownStars = tight && !split ? STARS.filter(st => st.main) : STARS;
    label(ctx, 'STARS', colR, yS, { color: P.s2, size: 10.5, halo: P.paperDeep, align: 'left' });
    label(ctx, 'SHA', colR + 78, yS + lh, { color: P.inkFaint, size: 10, halo: P.paperDeep, align: 'left' });
    label(ctx, 'Dec', colR + 168, yS + lh, { color: P.inkFaint, size: 10, halo: P.paperDeep, align: 'left' });
    shownStars.forEach((st, i) => {
      const y = yS + lh * (2 + i);
      const c = st.main ? P.s2 : P.ink;
      label(ctx, st.name, colR, y, { color: c, size: 11, halo: P.paperDeep, align: 'left' });
      label(ctx, fmtDM(st.sha, 1), colR + 78, y, { color: c, size: 11, halo: P.paperDeep, align: 'left' });
      label(ctx, st.dec, colR + 168, y, { color: c, size: 11, halo: P.paperDeep, align: 'left' });
    });

    // the addition, typeset in the same colors as the strip
    const yEq = pageY + pageH - 15;
    const eqClear = yEq > yS + lh * (shownStars.length + 2.2);
    if (eqClear) {
      const parts = wrapped
        ? [['GHA Vega  ', P.s2], ['=  ', P.ink], [fmtDM(ghaAries, 1), P.s3],
           ['  +  ', P.ink], ['80° 30′', P.inkSoft],
           ['  −  360°  =  ', P.ink], [fmtDM(ghaVega, 1), P.s2]]
        : [['GHA Vega  ', P.s2], ['=  ', P.ink], [fmtDM(ghaAries, 1), P.s3],
           ['  +  ', P.ink], ['80° 30′', P.inkSoft],
           ['  =  ', P.ink], [fmtDM(ghaVega, 1), P.s2]];
      let x = colL;
      for (const [t, c] of parts) {
        label(ctx, t, x, yEq, { color: c, size: 11, halo: P.paperDeep, align: 'left' });
        x += textW(ctx, t, 11);
      }
    }

    ariesStat.set(fmtDM(ghaAries, 1));
    sumStat.set(wrapped
      ? `${fmtDM(ghaAries, 1)} + 80° 30′ − 360° = ${fmtDM(ghaVega, 1)}`
      : `${fmtDM(ghaAries, 1)} + 80° 30′ = ${fmtDM(ghaVega, 1)}`);
    decStat.set('38° 48′ N');
  }
})();
