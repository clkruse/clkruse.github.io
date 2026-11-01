'use strict';
/* §08: the noon sight. */

(function demoNoon() {
  // noon-geometry.js fills this shared object in place. Keeping the placeholder
  // makes this demo safe whether that deferred script runs before or after us.
  const geometry = window.SextantNoonGeometry || (window.SextantNoonGeometry = {});
  const T0 = 6, T1 = 22;
  let revealStage = 0; // 0 hunt the peak, 2 decode the sight
  // The decoded sight is a wide, short plate; the hunt keeps the taller frame.
  const d = createDemo('demo-noon', {
    aspect: { valueOf: () => (revealStage === 2 ? 1.82 : 1.3) },
    maxH: { valueOf: () => (revealStage === 2 ? 360 : 560) },
    compactAspect: { valueOf: () => (revealStage === 2 ? 1.35 : 1.3) },
    compactMaxH: { valueOf: () => (revealStage === 2 ? 210 : 560) },
    draw,
  });
  const TRUTHS = [
    { lat: 32, lon: -24 },
    { lat: -18, lon: 38 },
    { lat: 47, lon: 12 },
  ];
  let truthIndex = 0;
  let truth = { ...TRUTHS[truthIndex] };
  let cursorT = 11.0;
  let best = null; // {t, h}
  const dec = addSlider(d, {
    label: "sun's declination", min: -23.4, max: 23.4, step: 0.1, value: 15,
    fmt: v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '°',
    onchange: () => { resetReveal(); },
  });
  const timeSlider = addSlider(d, {
    label: 'sample UTC', min: T0, max: T1, step: 1 / 60, value: cursorT,
    fmt: v => clock(v),
    onchange: v => { setCursorTime(v); },
  });
  const sample = addStat(d, 'current sample');
  const solved = addStat(d, ' ', true);
  const revealButton = addButton(d, 'reveal noon position', advanceReveal);
  revealButton.type = 'button';
  let revealButtonLabel = '';
  const newButton = addButton(d, 'new position', () => {
    truthIndex = (truthIndex + 1) % TRUTHS.length;
    truth = { ...TRUTHS[truthIndex] };
    resetReveal();
  }, 'subtle');
  newButton.type = 'button';
  newButton.setAttribute('aria-label', 'Generate a new hidden position');

  function monochromeNoonStyle() {
    return {
      paper: PLATE.paper,
      paperDeep: PLATE.paper,
      ink: PLATE.ink,
      soft: PLATE.ink,
      faint: PLATE.ink,
      line: PLATE.ink,
      guide: PLATE.ink,
      result: PLATE.ink,
      sun: PLATE.ink,
      tint: PLATE.ink,
      gridAlpha: 1,
      tintAlpha: 0,
      cardLineAlpha: 1,
      controlSuccess: 'var(--s7)',
    };
  }

  // Illustrative equation of time, E = apparent solar time − mean solar time.
  // E = +6 min puts Greenwich apparent noon at 11:54 UTC. In practice the
  // navigator uses the almanac GHA at the recorded UTC, not a fixed correction.
  const EQUATION_OF_TIME_MIN = 6;
  const sunGhaSigned = t => (t - 12) * 15 + EQUATION_OF_TIME_MIN * 0.25;
  const normalize360 = degrees => ((degrees % 360) + 360) % 360;
  const normalize180 = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
  const sunGha = t => normalize360(sunGhaSigned(t));
  const longitudeFromGha = gha => normalize180(-gha);
  const transitTime = () => 12 - (truth.lon + EQUATION_OF_TIME_MIN * 0.25) / 15;
  const altAt = t => {
    const lha = (sunGhaSigned(t) + truth.lon) * D2R;
    const la = truth.lat * D2R, de = dec.v * D2R;
    return Math.asin(Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(lha)) * R2D;
  };

  let geo = null;
  addDrag(d.canvas, {
    start(p) { moveCursor(p); },
    move(p) { moveCursor(p); },
  });
  d.canvas.classList.add('grab');
  function moveCursor(p) {
    if (!geo) return;
    setCursorTime(T0 + (p.x - geo.x0) / geo.sx, true);
  }

  function setCursorTime(value, syncSlider = false) {
    cursorT = clamp(value, T0, T1);
    if (syncSlider) timeSlider.set(cursorT);
    const hh = altAt(cursorT);
    if (hh > 0 && (!best || hh > best.h)) best = { t: cursorT, h: hh };
  }

  function setRevealStage(stage) {
    revealStage = clamp(Math.round(stage), 0, 2);
    d.refit?.();
  }

  function resetReveal() {
    best = null;
    setRevealStage(0);
  }

  function advanceReveal() {
    if (revealStage >= 2) resetReveal();
    else setRevealStage(2);
  }

  function syncRevealButton() {
    const text = revealStage > 0 ? 'start over' : 'reveal noon position';
    if (revealButtonLabel !== text) {
      revealButtonLabel = text;
      revealButton.textContent = text;
      revealButton.setAttribute('aria-label', text);
    }
  }

  function draw(ctx, w, h) {
    syncRevealButton();
    const style = monochromeNoonStyle();
    if (revealStage === 2) return drawPlateDecodedSolution(ctx, w, h, style);
    drawPlatePeakCurve(ctx, w, h, style);
  }

  function drawPlatePeakCurve(ctx, w, h, style) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 560 || h < 340;
    const left = compact ? 38 : 52;
    const right = w - (compact ? 10 : 16);
    const top = compact ? 27 : 34;
    const bottom = h - (compact ? 31 : 42);
    const sx = (right - left) / (T1 - T0);
    const xOf = time => left + (time - T0) * sx;
    const yOf = altitude => bottom
      - (bottom - top) * clamp(altitude, 0, 90) / 90;
    const tTr = transitTime();
    const hMax = altAt(tTr);
    const ch = altAt(cursorT);
    const currentX = xOf(cursorT);
    const currentY = yOf(ch);
    const currentAtPeak = Math.abs(cursorT - tTr) < 1 / 120;
    const peakFound = best && Math.abs(hMax - best.h) < 0.05;
    geo = { sx, x0: left };

    plateText(ctx, 'CORRECTED ALTITUDE Ho · HUNT THE MERIDIAN PEAK',
      left, compact ? 10 : 15, {
        size: compact ? 8 : 10,
        weight: 600,
        uppercase: false,
      });

    for (let altitude = 15; altitude <= 90; altitude += 15) {
      const y = yOf(altitude);
      plateLine(ctx, { x: left, y }, { x: right, y }, {
        kind: 'short',
        weight: compact ? 0.35 : 0.45,
      });
    }
    for (let time = T0 + 2; time < T1; time += 2) {
      const x = xOf(time);
      plateLine(ctx, { x, y: top }, { x, y: bottom }, {
        kind: 'short',
        weight: compact ? 0.3 : 0.4,
      });
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.5 : 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    for (let time = T0; time <= T1; time += 0.04) {
      const point = { x: xOf(time), y: yOf(altAt(time)) };
      if (!started) {
        ctx.moveTo(point.x, point.y);
        started = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
    ctx.restore();

    plateLine(ctx, { x: left, y: top }, { x: left, y: bottom }, {
      weight: 0.8,
    });
    plateLine(ctx, { x: left, y: bottom }, { x: right, y: bottom }, {
      weight: 0.9,
    });
    for (let altitude = 0; altitude <= 90; altitude += 15) {
      const y = yOf(altitude);
      plateLine(ctx, { x: left - 3, y }, { x: left, y }, {
        weight: 0.55,
      });
      plateDataText(ctx, `${altitude}°`, left - 6, y, {
        size: compact ? 7.5 : 8,
        align: 'right',
      });
    }
    const tickStep = compact ? 4 : 2;
    for (let time = T0; time <= T1; time += tickStep) {
      const x = xOf(time);
      plateLine(ctx, { x, y: bottom }, { x, y: bottom + 3 }, {
        weight: 0.55,
      });
      plateDataText(ctx, `${String(time).padStart(2, '0')}:00`, x,
        bottom + (compact ? 10 : 12), {
          size: compact ? 7.5 : 8,
          align: 'center',
        });
    }
    plateText(ctx, 'UTC', right, bottom + (compact ? 23 : 28), {
      size: compact ? 8 : 9,
      align: 'right',
    });

    if (best) {
      const bestY = yOf(best.h);
      plateLine(ctx, { x: left, y: bestY }, { x: xOf(best.t), y: bestY }, {
        kind: 'short',
        weight: compact ? 0.55 : 0.7,
      });
      plateDataText(ctx, `BEST SAMPLE · ${clock(best.t)} · Ho ${best.h.toFixed(1)}°`,
        left + 5, Math.max(top + 8, bestY - (compact ? 7 : 9)), {
          size: compact ? 8 : 9,
        });
    }

    plateLine(ctx, { x: currentX, y: top }, { x: currentX, y: bottom }, {
      kind: 'construction',
      weight: compact ? 0.55 : 0.7,
    });
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.9 : 1.1;
    ctx.beginPath();
    ctx.arc(currentX, currentY, compact ? 3 : 4, 0, TAU);
    ctx.fill();
    ctx.stroke();

    const currentAlign = currentX < w * 0.68 ? 'left' : 'right';
    plateDataText(ctx, `CURRENT SAMPLE · ${clock(cursorT)} · Ho ${ch.toFixed(1)}°`,
      currentX + (currentAlign === 'left' ? 7 : -7),
      clamp(currentY + (currentY < top + 22 ? 10 : -9), top + 7, bottom - 7), {
        size: compact ? 8 : 9,
        align: currentAlign,
      });

    sample.set(`${clock(cursorT)} – ${ch < 0 ? 'below horizon' : `Ho ${fmtDM(ch, 1)}`}`);
    if (peakFound && currentAtPeak) {
      solved.set('✓ this sample is the peak – reveal noon position to save it',
        style.controlSuccess);
    } else if (peakFound) {
      solved.set('peak found and saved – reveal noon position to lock the record',
        style.controlSuccess);
    } else {
      solved.set('drag the curve or use the sample UTC control to hunt for the highest Ho');
    }
  }

  function drawPlateDecodedSolution(ctx, w, h, style) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 560 || h < 340;
    const targetH = compact ? 210 : 360;
    const contentH = Math.min(targetH, h - 2);
    const ratio = contentH / targetH;
    const top = (h - contentH) / 2;
    const margin = compact ? 7 : 14;
    const traceH = Math.round((compact ? 52 : 88) * ratio);
    const firstCardH = Math.round((compact ? 50 : 220) * ratio);
    const secondCardH = Math.round((compact ? 78 : 220) * ratio);
    const conclusionH = compact
      ? contentH - traceH - firstCardH - secondCardH
      : Math.round(36 * ratio);
    const cardGap = compact ? 0 : Math.round(8 * ratio);
    const cardsTop = top + traceH + cardGap;
    const conclusionTop = compact
      ? cardsTop + firstCardH + secondCardH
      : cardsTop + firstCardH + cardGap;
    const tTr = transitTime();
    const hMax = altAt(tTr);
    const ch = altAt(cursorT);
    const currentAtPeak = Math.abs(cursorT - tTr) < 1 / 120;
    const helperReady = typeof geometry.bearingFromLatitudes === 'function'
      && typeof geometry.calculateNoonLatitude === 'function'
      && typeof geometry.formatLatitude === 'function'
      && typeof geometry.formatSignedDegrees === 'function';
    const bearing = helperReady
      ? geometry.bearingFromLatitudes(truth.lat, dec.v)
      : null;
    const latitudeSolution = helperReady
      ? geometry.calculateNoonLatitude(hMax, dec.v, bearing)
      : null;
    const gha = sunGha(tTr);
    const longitude = longitudeFromGha(gha);
    const latitudeEquation = helperReady
      ? latitudeSolution.bearing === 'overhead'
        ? 'φ = δ'
        : `φ = δ ${latitudeSolution.operator} z`
      : '';

    const traceTop = top + (compact ? 18 : 23);
    const traceBottom = top + traceH - (compact ? 5 : 8);
    const x0 = margin + (compact ? 2 : 8);
    const x1 = w - margin - (compact ? 2 : 8);
    const sx = (x1 - x0) / (T1 - T0);
    const xOf = time => x0 + (time - T0) * sx;
    const plotMax = Math.max(30, hMax * 1.08);
    const yOf = altitude => traceBottom
      - (traceBottom - traceTop) * clamp(altitude, 0, plotMax) / plotMax;
    const currentX = xOf(cursorT);
    const currentY = yOf(ch);
    const peakX = xOf(tTr);
    const peakY = yOf(hMax);
    geo = { sx, x0 };

    plateText(ctx, 'DECODE THE SAVED PEAK', margin, top + (compact ? 8 : 11), {
      size: compact ? 8 : 10,
      weight: 600,
    });
    if (currentAtPeak) {
      plateDataText(ctx, `CURRENT = SAVED · ${clock(tTr)} UTC`,
        w - margin, top + (compact ? 8 : 11), {
          size: compact ? 8 : 9,
          align: 'right',
        });
    } else {
      plateDataText(ctx, `CURRENT ${clock(cursorT)} · SAVED ${clock(tTr)}`,
        w - margin, top + (compact ? 8 : 11), {
          size: compact ? 8 : 9,
          align: 'right',
        });
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, traceTop, x1 - x0, Math.max(1, traceBottom - traceTop));
    ctx.clip();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.15 : 1.5;
    ctx.beginPath();
    let traceStarted = false;
    for (let time = T0; time <= T1; time += 0.04) {
      const x = xOf(time);
      const y = yOf(altAt(time));
      if (!traceStarted) {
        ctx.moveTo(x, y);
        traceStarted = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
    plateLine(ctx, { x: x0, y: traceBottom }, { x: x1, y: traceBottom }, {
      weight: compact ? 0.6 : 0.8,
    });
    plateLine(ctx, { x: currentX, y: traceTop },
      { x: currentX, y: traceBottom }, {
        kind: 'construction',
        weight: compact ? 0.45 : 0.6,
      });
    plateLine(ctx, { x: peakX, y: traceTop }, { x: peakX, y: traceBottom }, {
      kind: 'long',
      weight: compact ? 0.7 : 0.9,
    });
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.8 : 1;
    ctx.beginPath();
    ctx.arc(currentX, currentY, compact ? 2.4 : 3.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(peakX, peakY, compact ? 2.7 : 3.6, 0, TAU);
    ctx.fill();

    const titleH = compact ? 18 : 28;
    const dataSize = compact ? 8 : 9;
    const drawCard = (box, title, lines) => {
      ctx.fillStyle = PLATE.paper;
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.75 : 0.9;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
      plateText(ctx, title, box.x + (compact ? 6 : 9),
        box.y + titleH * 0.48, {
          size: compact ? 8 : 9,
          weight: 600,
        });
      plateLine(ctx, { x: box.x + (compact ? 5 : 8), y: box.y + titleH },
        { x: box.x + box.w - (compact ? 5 : 8), y: box.y + titleH }, {
          weight: compact ? 0.5 : 0.6,
        });
      const bodyTop = box.y + titleH;
      const bodyH = Math.max(1, box.h - titleH);
      lines.forEach((line, index) => {
        plateDataText(ctx, line, box.x + (compact ? 6 : 10),
          bodyTop + bodyH * (index + 1) / (lines.length + 1), {
            size: dataSize,
            weight: index === lines.length - 1 ? 600 : 500,
          });
      });
    };

    if (compact) {
      const longitudeBox = {
        x: margin,
        y: cardsTop,
        w: w - margin * 2,
        h: firstCardH,
      };
      const latitudeBox = {
        x: margin,
        y: cardsTop + firstCardH,
        w: w - margin * 2,
        h: secondCardH,
      };
      drawCard(longitudeBox, 'TIME + ALMANAC → LONGITUDE', [
        `${clock(tTr)} UTC · GHA Sun ${gha.toFixed(1)}°`,
        `λ = −GHA Sun → ${formatLongitude(longitude)}`,
      ]);
      drawCard(latitudeBox, 'HEIGHT + BEARING → LATITUDE', helperReady
        ? [
          `Ho ${hMax.toFixed(1)}° · z = 90° − Ho = ${latitudeSolution.z.toFixed(1)}°`,
          `δ ${geometry.formatSignedDegrees(dec.v)} · ${latitudeSolution.bearingLabel.toUpperCase()}`,
          `${latitudeEquation} = ${geometry.formatLatitude(latitudeSolution.latitude)}`,
        ]
        : ['MERIDIAN DECODER LOADING']);
    } else {
      const gap = 12;
      const cardW = (w - margin * 2 - gap) / 2;
      const longitudeBox = {
        x: margin,
        y: cardsTop,
        w: cardW,
        h: firstCardH,
      };
      const latitudeBox = {
        x: margin + cardW + gap,
        y: cardsTop,
        w: cardW,
        h: secondCardH,
      };
      drawCard(longitudeBox, 'TIME + ALMANAC → LONGITUDE', [
        `SAVED PEAK UTC = ${clock(tTr)}`,
        `ALMANAC GHA Sun = ${gha.toFixed(1)}°`,
        'λ = −GHA Sun',
        `λ = ${formatLongitude(longitude)}`,
        `LONGITUDE = ${formatLongitude(longitude)}`,
      ]);
      drawCard(latitudeBox, 'HEIGHT + BEARING → LATITUDE', helperReady
        ? [
          `SAVED PEAK Ho = ${hMax.toFixed(1)}°`,
          `z = 90° − Ho = ${latitudeSolution.z.toFixed(1)}°`,
          `δ = ${geometry.formatSignedDegrees(dec.v)}`,
          `${latitudeSolution.bearingLabel.toUpperCase()} → ${latitudeEquation}`,
          `φ = ${geometry.formatLatitude(latitudeSolution.latitude)}`,
          `LATITUDE = ${geometry.formatLatitude(latitudeSolution.latitude)}`,
        ]
        : ['MERIDIAN DECODER LOADING']);
    }

    plateRule(ctx, conclusionTop, margin, w - margin);
    const conclusion = helperReady
      ? `SAVED PEAK → ${geometry.formatLatitude(latitudeSolution.latitude)} · ${formatLongitude(longitude)}`
      : 'SAVED PEAK HELD · WAITING FOR MERIDIAN GEOMETRY';
    plateDataText(ctx, conclusion, w / 2,
      conclusionTop + conclusionH * 0.54, {
        size: compact ? 8 : 9,
        weight: 600,
        align: 'center',
      });

    sample.set(`${clock(cursorT)} – ${ch < 0 ? 'below horizon' : `Ho ${fmtDM(ch, 1)}`}`);
    if (helperReady) {
      solved.set(
        `saved peak decoded – ${latitudeSolution.bearingLabel}: `
        + `${geometry.formatLatitude(latitudeSolution.latitude)}, `
        + `${formatLongitude(longitude)} from Sun GHA`,
        style.controlSuccess,
      );
    } else {
      solved.set('meridian passage saved – the latitude decoder is still loading');
    }
  }

  function formatLongitude(value, digits = 1) {
    const longitude = Number(value);
    if (Math.abs(longitude) < 0.05) return `${(0).toFixed(digits)}°`;
    return `${Math.abs(longitude).toFixed(digits)}° ${longitude > 0 ? 'E' : 'W'}`;
  }

  function clock(t) {
    let hour = Math.floor(t);
    let minute = Math.round((t - hour) * 60);
    if (minute === 60) { hour += 1; minute = 0; }
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
})();
