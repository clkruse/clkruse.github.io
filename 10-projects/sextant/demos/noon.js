'use strict';
/* §08: the noon sight. */

(function demoNoon() {
  const d = createDemo('demo-noon', { aspect: 1.55, maxH: 520, draw });
  let truth = newTruth();
  let cursorT = 11.0;
  let best = null; // {t, h}
  let revealed = false;
  const dec = addSlider(d, {
    label: "sun's declination", min: -23.4, max: 23.4, step: 0.1, value: 15,
    fmt: v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '°',
    onchange: () => { best = null; revealed = false; },
  });
  const sample = addStat(d, 'your sample');
  const solved = addStat(d, ' ', true);
  addButton(d, 'reveal solution', () => { revealed = true; });
  addButton(d, 'new position', () => {
    truth = newTruth();
    best = null;
    revealed = false;
  }, 'subtle');

  function newTruth() {
    return { lat: 26 + Math.random() * 26, lon: -(15 + Math.random() * 60) };
  }
  const altAt = t => {
    const lha = ((t - 12) * 15 + truth.lon) * D2R;
    const la = truth.lat * D2R, de = dec.v * D2R;
    return Math.asin(Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(lha)) * R2D;
  };

  const X0 = 58, XR = 16, Y0 = 26, YB = 46;
  const T0 = 6, T1 = 22;
  let geo = null;
  addDrag(d.canvas, {
    start(p) { moveCursor(p); },
    move(p) { moveCursor(p); },
  });
  d.canvas.classList.add('grab');
  function moveCursor(p) {
    if (!geo) return;
    cursorT = clamp(T0 + (p.x - X0) / geo.sx, T0, T1);
    const hh = altAt(cursorT);
    if (hh > 0 && (!best || hh > best.h)) best = { t: cursorT, h: hh };
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    const pw = w - X0 - XR, ph = h - Y0 - YB;
    const sx = pw / (T1 - T0);
    geo = { sx };
    const yOf = alt => Y0 + ph * (1 - alt / 90);
    const xOf = t => X0 + (t - T0) * sx;
    const yAxis = h - YB; // 0° horizon coincides with the x-axis baseline

    // hairline grid inside the plot box (axis positions excluded)
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    for (let a = 15; a <= 90; a += 15) {
      ctx.beginPath();
      ctx.moveTo(X0, yOf(a));
      ctx.lineTo(w - XR, yOf(a));
      ctx.stroke();
    }
    for (let t = T0 + 2; t <= T1; t += 2) {
      ctx.beginPath();
      ctx.moveTo(xOf(t), Y0);
      ctx.lineTo(xOf(t), yAxis);
      ctx.stroke();
    }

    // flat sun tint under the curve (above the horizon only)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xOf(T0), yOf(0));
    for (let t = T0; t <= T1; t += 0.05) ctx.lineTo(xOf(t), yOf(Math.max(altAt(t), 0)));
    ctx.lineTo(xOf(T1), yOf(0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(238,114,3,0.08)';
    ctx.fill();
    ctx.restore();

    // the day's arc: 2px object line, clipped to the plot box
    ctx.save();
    ctx.beginPath();
    ctx.rect(X0, Y0, pw, ph);
    ctx.clip();
    ctx.beginPath();
    let started = false;
    for (let t = T0; t <= T1; t += 0.05) {
      const yy = yOf(altAt(t));
      if (!started) { ctx.moveTo(xOf(t), yy); started = true; }
      else ctx.lineTo(xOf(t), yy);
    }
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // axes: 1px ink lines left + bottom, 3px tick marks outside, labels beyond
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X0, Y0);
    ctx.lineTo(X0, yAxis);
    ctx.lineTo(w - XR, yAxis);
    ctx.stroke();
    for (let a = 0; a <= 90; a += 15) {
      ctx.beginPath();
      ctx.moveTo(X0 - 3, yOf(a));
      ctx.lineTo(X0, yOf(a));
      ctx.stroke();
      label(ctx, a + '°', X0 - 8, yOf(a), { size: 10.5, color: P.inkSoft, align: 'right' });
    }
    for (let t = T0; t <= T1; t += 2) {
      ctx.beginPath();
      ctx.moveTo(xOf(t), yAxis);
      ctx.lineTo(xOf(t), yAxis + 3);
      ctx.stroke();
      label(ctx, String(t).padStart(2, '0') + ':00', xOf(t), yAxis + 16, { size: 10.5, color: P.inkSoft });
    }
    label(ctx, 'GMT →', w - XR - 26, yAxis + 34, { size: 11, color: P.inkSoft });
    label(ctx, "sun's altitude", X0 + 52, Y0 - 12, { size: 11, color: P.inkSoft });

    // reveal geometry (computed early so labels can dodge each other)
    const tTr = 12 - truth.lon / 15;
    const hMax = altAt(tTr);
    const atPeak = best && Math.abs(hMax - best.h) < 0.05;
    // formula block sits in the top corner with the most room beside the peak
    const fLeft = (xOf(tTr) - X0) >= ((w - XR) - xOf(tTr));

    // best-so-far reference: thin dashed line + small label
    if (best) {
      const by = yOf(best.h);
      ctx.strokeStyle = P.brass;
      ctx.lineWidth = 0.9;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(X0, by);
      ctx.lineTo(xOf(best.t), by);
      ctx.stroke();
      ctx.setLineDash([]);
      // once revealed at the peak, the formula carries the value – drop the label
      if (!(revealed && atPeak)) {
        const ly = Math.max(by - 9, Y0 + 8);
        if (revealed && fLeft && by < Y0 + 86) {
          // formula block occupies the top-left: anchor the label at the marker instead
          label(ctx, 'highest so far ' + fmtDM(best.h, 1), xOf(best.t) - 12, ly,
            { size: 10.5, color: P.brass, halo: P.paper, align: 'right' });
        } else {
          label(ctx, 'highest so far ' + fmtDM(best.h, 1), X0 + 8, ly,
            { size: 10.5, color: P.brass, halo: P.paper, align: 'left' });
        }
      }
    }

    // cursor guide: 0.9px dashed reference line
    const ch = altAt(cursorT);
    const cxp = xOf(cursorT), cyp = yOf(Math.max(ch, -3));
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cxp, Y0);
    ctx.lineTo(cxp, yAxis);
    ctx.stroke();
    ctx.setLineDash([]);

    // reveal
    if (revealed) {
      ctx.strokeStyle = P.good;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(xOf(tTr), Y0);
      ctx.lineTo(xOf(tTr), yAxis);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, 'local noon', xOf(tTr), yAxis - 10, { size: 10.5, color: P.good, halo: P.paper });
      const latC = 90 - hMax + dec.v;
      const lonC = -(tTr - 12) * 15;
      const fx = fLeft ? X0 + 10 : w - XR - 8;
      const ind = fLeft ? 30 : 0; // continuation indent (left-anchored block only)
      const align = fLeft ? 'left' : 'right';
      const rows = [
        [`lat = 90° − ${hMax.toFixed(1)}° + ${dec.v.toFixed(1)}°`, 0, Y0 + 14],
        [`= ${latC.toFixed(1)}° N   (true ${truth.lat.toFixed(1)}° N)`, ind, Y0 + 30],
        [`lon = (noon − 12:00) × 15°/h`, 0, Y0 + 52],
        [`= ${Math.abs(lonC).toFixed(1)}° W   (true ${Math.abs(truth.lon).toFixed(1)}° W)`, ind, Y0 + 68],
      ];
      for (const [txt, dx, yy] of rows) {
        label(ctx, txt, fx + dx, yy, { size: 11.5, color: P.ink, halo: P.paper, align });
      }
    }

    // sample marker: flat signal-orange dot with a paper ring, over everything
    ctx.strokeStyle = P.paper;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cxp, cyp, 5, 0, TAU); ctx.stroke();
    ctx.fillStyle = P.s3;
    ctx.beginPath(); ctx.arc(cxp, cyp, 4, 0, TAU); ctx.fill();

    const mm = Math.round((cursorT - Math.floor(cursorT)) * 60);
    sample.set(`${String(Math.floor(cursorT)).padStart(2, '0')}:${String(mm).padStart(2, '0')} – ` +
      (ch < 0 ? 'below horizon' : fmtDM(ch, 1)));
    if (revealed) solved.set('the peak gives latitude; its Greenwich time gives longitude', P.good);
    else if (best && Math.abs(altAt(12 - truth.lon / 15) - best.h) < 0.05) {
      solved.set('✓ that’s the peak – now reveal the solution', P.good);
    } else {
      solved.set('drag across the day and hunt for the highest point');
    }
  }
})();
