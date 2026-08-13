'use strict';
/* §05: the view through the telescope. */

(function demoScope() {
  const d = createDemo('demo-scope', { aspect: 1.55, maxH: 520, draw });
  const FOV = 5; // degrees across the view
  let hTrue = 40 + Math.random() * 0.9 - 0.45 + 21.6 / 60; // hidden true altitude of sun center
  let rocking = false, rockT = 0;
  const coarse = addSlider(d, {
    label: 'index arm (°)', min: 35, max: 45, step: 1, value: 40,
    fmt: v => v + '°',
  });
  const drum = addSlider(d, {
    label: 'micrometer drum (′)', min: 0, max: 60, step: 0.2, value: 30,
    fmt: v => v.toFixed(1) + '′',
  });
  addCheck(d, 'rock the sextant', v => { rocking = v; });
  const readStat = addStat(d, 'sextant reads');
  const status = addStat(d, ' ', true);
  addButton(d, 'new sun', () => {
    hTrue = 37 + Math.random() * 6;
  }, 'subtle');

  function draw(ctx, w, h, t) {
    // the drawing sheet: paper everywhere, so the figure follows the theme
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.5, Rv = Math.min(w, h) * 0.44;
    const ppd = (2 * Rv) / FOV; // pixels per degree

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Rv, 0, TAU);
    ctx.clip();

    // ––– left half: the real world through clear glass –––
    // sky is bare paper; the sea is a flat deep-paper band with sparse
    // horizontal hatching (drafting-water convention)
    ctx.fillStyle = P.paper;
    ctx.fillRect(cx - Rv, cy - Rv, 2 * Rv, Rv);
    ctx.fillStyle = P.paperDeep;
    ctx.fillRect(cx - Rv, cy, 2 * Rv, Rv);
    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const yy = cy + Rv * (0.18 + i * 0.15);
      const xx = cx - Rv + Rv * (0.16 + ((i * 0.47) % 1.1));
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx + 24 - i * 3, yy);
    }
    ctx.stroke();

    // ––– right half: the mirrored sky, behind shades –––
    // paper ground under a flat neutral ink wash: darkened glass in grayscale
    const reading = coarse.v + drum.v / 60;
    ctx.fillStyle = P.paper;
    ctx.fillRect(cx, cy - Rv, Rv, 2 * Rv);
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = P.ink;
    ctx.fillRect(cx, cy - Rv, Rv, 2 * Rv);
    ctx.restore();

    // sun disc in the mirrored half: flat disc, thin darker ring
    const sunR = (32 / 60 / 2) * ppd; // 16′ radius
    const beta = rocking ? 4 * D2R * Math.sin(t * 1.6) : 0;
    const K = hTrue * ppd; // pendulum arm length in view scale
    const yAligned = cy + (reading - hTrue) * ppd;
    const sx = cx + Rv * 0.5 + K * Math.sin(beta) * 0.25;
    const sy = yAligned - K * (1 - Math.cos(beta));
    if (sy > cy - Rv - sunR * 3 && sy < cy + Rv + sunR * 3) {
      ctx.fillStyle = P.s3;
      ctx.beginPath(); ctx.arc(sx, sy, sunR, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(122,82,26,0.85)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // out-of-view hint: slim dimension-style pointer, ink family
      const up = sy <= cy - Rv;
      const ax = cx + Rv * 0.5, ay = up ? cy - Rv * 0.7 : cy + Rv * 0.7;
      const tipY = ay + (up ? -22 : 22);
      ctx.strokeStyle = P.ink;
      ctx.fillStyle = P.ink;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax, tipY);
      ctx.stroke();
      dimHead(ctx, ax, tipY, up ? -Math.PI / 2 : Math.PI / 2);
      label(ctx, up ? 'sun is higher' : 'sun is lower', ax - 9, (ay + tipY) / 2,
        { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'right' });
    }

    // horizon continues across the mirrored half (seen through the clear edge)
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - Rv, cy);
    ctx.lineTo(cx + Rv, cy);
    ctx.stroke();

    // split line
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - Rv);
    ctx.lineTo(cx, cy + Rv);
    ctx.stroke();

    // fixed reticle tick at the center of the horizon line
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx, cy + 5);
    ctx.stroke();

    if (Rv > 130) {
      label(ctx, 'clear glass', cx - Rv * 0.4, cy - Rv * 0.5,
        { color: P.inkSoft, size: 10.5, halo: P.paper });
      label(ctx, 'mirror + shades', cx + Rv * 0.4, cy - Rv * 0.5,
        { color: P.inkSoft, size: 10.5, halo: P.paper });
    }

    ctx.restore();

    // eyepiece: crisp 1px rings on the sheet
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, Rv + 0.5, 0, TAU); ctx.stroke();
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, Rv + 5, 0, TAU); ctx.stroke();

    // status
    const lowerLimb = reading; // reading when lower limb touches: hTrue - 16'
    const target = hTrue - 16 / 60;
    const err = (lowerLimb - target) * 60; // arcmin
    readStat.set(fmtDM(reading, 1));
    if (Math.abs(err) < 0.6 && Math.abs(beta) < 0.01) {
      status.set('✓ lower limb kissing the horizon – note the time!', P.good);
    } else if (Math.abs(err) < 0.6) {
      status.set('aligned – read it at the bottom of the swing', P.brassBright);
    } else if (err > 0) {
      status.set(`sun cuts ${Math.abs(err).toFixed(1)}′ below the horizon – back off the drum`);
    } else {
      status.set(`sun floats ${Math.abs(err).toFixed(1)}′ above the horizon – bring it down`);
    }
  }
})();
