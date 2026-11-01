'use strict';
/* §05: the view through the telescope. */

(function demoScope() {
  const d = createDemo('demo-scope', {
    aspect: 1.55,
    maxH: 520,
    compactAspect: 1.1,
    draw,
  });
  const FOV = 5; // degrees across the view
  function rockingLiftMinutes(altitudeDegrees, rollRadians) {
    const h = clamp(altitudeDegrees, 0, 90) * D2R;
    const v = clamp(rollRadians, -Math.PI / 2, Math.PI / 2);
    // Exact spherical relation: H − atan(tan(H) cos(V)). The atan2 form
    // stays well behaved at 0° and 90°; ±V have the same lift magnitude.
    const rolledAltitude = Math.atan2(
      Math.sin(h) * Math.cos(v),
      Math.cos(h)
    );
    return Math.max(0, (h - rolledAltitude) * R2D * 60);
  }
  const SUN_ALTITUDES = [40 + 21.6 / 60, 38 + 47.2 / 60, 42 + 8.4 / 60];
  let sunPracticeIndex = 0;
  let hTrue = SUN_ALTITUDES[sunPracticeIndex]; // simulated Sun-center altitude
  let vegaAltitude = SIGHT_STORY.state.hs;
  let scopeMode = 'vega';
  const savedReading = {
    vega: 42 + 32 / 60,
    sun: hTrue - 18 / 60,
  };
  let rocking = false;
  let recordedMessage = '';
  let recordedUntil = -1;
  const coarse = addSlider(d, {
    label: 'index arm (°)', min: 35, max: 45, step: 1, value: 42,
    fmt: v => v + '°',
  });
  const drum = addSlider(d, {
    label: 'micrometer drum (′)', min: 0, max: 60, step: 0.2, value: 32,
    fmt: v => v.toFixed(1) + '′',
  });
  addCheck(d, 'rock the sextant', v => { rocking = v; });
  const readStat = addStat(d, 'sextant reads');
  const status = addStat(d, 'sight status', true);
  addButton(d, 'record Hs', recordHs);
  const modeButton = addButton(d, 'practice Sun lower limb', () => {
    savedReading[scopeMode] = currentReading();
    scopeMode = scopeMode === 'vega' ? 'sun' : 'vega';
    setReading(savedReading[scopeMode]);
    syncScopeControls();
  }, 'subtle');
  const newSunButton = addButton(d, 'next practice Sun', () => {
    sunPracticeIndex = (sunPracticeIndex + 1) % SUN_ALTITUDES.length;
    hTrue = SUN_ALTITUDES[sunPracticeIndex];
    savedReading.sun = hTrue - 18 / 60;
    setReading(savedReading.sun);
  }, 'subtle');

  function currentReading() {
    return coarse.v + drum.v / 60;
  }

  function setReading(value) {
    let degrees = Math.floor(value);
    let minutes = (value - degrees) * 60;
    if (minutes >= 59.95) {
      degrees += 1;
      minutes = 0;
    }
    coarse.set(degrees, { emit: false });
    drum.set(+minutes.toFixed(1), { emit: false });
  }

  function syncScopeControls() {
    modeButton.textContent = scopeMode === 'vega'
      ? 'practice Sun lower limb'
      : 'return to worked Vega';
    modeButton.setAttribute('aria-pressed', scopeMode === 'sun' ? 'true' : 'false');
    newSunButton.hidden = scopeMode !== 'sun';
  }

  function recordHs() {
    if (scopeMode !== 'vega') {
      recordedMessage = 'Sun practice is not the worked Vega record';
      recordedUntil = d.t + 4;
      storyLive('Sun lower-limb practice is not recorded in the worked Vega sight.');
      return;
    }
    const hs = currentReading();
    savedReading.vega = hs;
    SIGHT_STORY.set({ hs }, { source: 'demo-scope-record' });
    recordedMessage = `Recorded Vega Hs ${fmtDM(hs, 1)} · ${storyClock(SIGHT_STORY.state.utcHours, true)} UTC`;
    recordedUntil = d.t + 4;
    storyLive(recordedMessage);
  }

  d.addPreset('worked', () => {
    const hs = SIGHT_STORY.defaults.hs;
    scopeMode = 'vega';
    vegaAltitude = hs;
    savedReading.vega = hs;
    setReading(hs);
    syncScopeControls();
    SIGHT_STORY.set({ hs }, { source: 'demo-scope-worked' });
  });
  SIGHT_STORY.subscribe((s, source) => {
    if (source === 'demo-scope-record') return;
    vegaAltitude = s.hs;
    savedReading.vega = s.hs;
    if (scopeMode === 'vega') setReading(s.hs);
  });
  syncScopeControls();

  function draw(ctx, w, h, t) {
    syncScopeControls();
    drawRockingCurve(ctx, w, h, t);
  }

  function sightState(t, mode = scopeMode) {
    const reading = currentReading();
    const bodyAltitude = mode === 'sun' ? hTrue : vegaAltitude;
    const target = mode === 'sun' ? hTrue - 16 / 60 : vegaAltitude;
    const settingError = (reading - target) * 60;
    const beta = rocking ? 4 * D2R * Math.sin(t * 1.6) : 0;
    const rockLift = rockingLiftMinutes(bodyAltitude, beta);
    return {
      mode,
      bodyAltitude,
      reading,
      target,
      settingError,
      beta,
      rockLift,
      contactError: settingError - rockLift,
    };
  }

  function updateScopeStatus(s) {
    readStat.set(fmtDM(s.reading, 1));
    if (d.t < recordedUntil) {
      if (s.mode === 'sun' && recordedMessage.startsWith('Recorded Vega')) {
        status.set('Sun practice – set the lower limb at the 0° rocking minimum',
          P.corrected);
        return;
      }
      status.set(recordedMessage, recordedMessage.startsWith('Recorded') ? P.good : P.corrected);
      return;
    }
    const body = s.mode === 'sun' ? 'Sun’s lower limb' : 'Vega';
    if (Math.abs(s.beta) >= 0.01) {
      const rollDegrees = s.beta * R2D;
      const rollText = `${rollDegrees < 0 ? '−' : '+'}${Math.abs(rollDegrees).toFixed(1)}°`;
      status.set(`${rollText} roll raises ${body} ${s.rockLift.toFixed(1)}′ – use the 0° minimum`,
        P.measured);
      return;
    }
    if (Math.abs(s.settingError) < 0.6 && Math.abs(s.beta) < 0.01) {
      status.set(`✓ ${body} on the horizon – ${s.mode === 'vega' ? 'record Hs' : 'read at the minimum'}`, P.good);
    } else if (Math.abs(s.settingError) < 0.6) {
      status.set('setting is right – keep the bottom of the swing', P.measured);
    } else if (s.settingError > 0) {
      status.set(`${body} is ${Math.abs(s.settingError).toFixed(1)}′ below the horizon – back off the drum`);
    } else {
      status.set(`${body} is ${Math.abs(s.settingError).toFixed(1)}′ above the horizon – bring it down`);
    }
  }

  function drawRockingCurve(ctx, w, h, t) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const s = sightState(t);
    const compact = w < 500;
    const betaMax = 4;
    const liveBeta = clamp(s.beta * R2D, -betaMax, betaMax);
    const edgeLift = rockingLiftMinutes(s.bodyAltitude, betaMax * D2R);
    const titleBottom = compact ? 28 : 32;
    const fieldTop = titleBottom + (compact ? 3 : 8);
    const ruleY = compact ? h - 10 : h - 14;

    plateText(ctx, 'Rock for the lowest contact',
      w / 2, titleBottom / 2, {
        size: compact ? 9.5 : 11,
        weight: 600,
        tracking: compact ? 1.15 : 1.45,
        align: 'center',
      });
    plateRule(ctx, titleBottom, 14, w - 14);

    const field = {
      x: w * (compact ? 0.25 : 0.27),
      y: fieldTop + (ruleY - fieldTop) * 0.50,
    };
    const fieldR = Math.min(
      (ruleY - fieldTop) * (compact ? 0.40 : 0.39),
      w * (compact ? 0.18 : 0.17)
    );
    const horizonY = field.y + fieldR * 0.22;
    const ppam = fieldR * 0.34 / Math.max(edgeLift, 6.5);
    const xOf = beta => field.x + fieldR * 0.58 * beta / betaMax;
    const contactYOf = beta => horizonY + s.settingError * ppam
      - rockingLiftMinutes(s.bodyAltitude, beta * D2R) * ppam;
    const livePoint = { x: xOf(liveBeta), y: contactYOf(liveBeta) };
    const minimumPoint = { x: xOf(0), y: contactYOf(0) };
    const sunR = fieldR * (16 / 60) / (FOV / 2);

    // The circular field and its direct horizon remain recognizable at the
    // compact width. Vertical displacement is explicitly magnified so the
    // few arcminutes of roll lift can be judged on the plate.
    ctx.save();
    ctx.beginPath();
    ctx.arc(field.x, field.y, fieldR, 0, TAU);
    ctx.clip();
    plateLine(ctx, {
      x: field.x - fieldR,
      y: horizonY,
    }, {
      x: field.x + fieldR,
      y: horizonY,
    }, {
      weight: compact ? 1.05 : 1.35,
    });
    plateLine(ctx, {
      x: field.x,
      y: field.y - fieldR,
    }, {
      x: field.x,
      y: field.y + fieldR,
    }, {
      kind: 'construction',
      weight: compact ? 0.5 : 0.65,
    });

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.65 : 0.85;
    ctx.setLineDash(plateDash('long'));
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const beta = -betaMax + 2 * betaMax * i / 64;
      const x = xOf(beta);
      const y = contactYOf(beta);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    const bodyFits = (point, radius = 0) =>
      Math.hypot(point.x - field.x, point.y - field.y) + radius < fieldR - 2;
    const drawPlateBody = (point, isLive, dashed = false) => {
      if (scopeMode === 'sun') {
        const centerY = point.y - sunR;
        const center = { x: point.x, y: centerY };
        if (!bodyFits(center, sunR)) return false;
        ctx.save();
        ctx.fillStyle = PLATE.paper;
        ctx.strokeStyle = PLATE.ink;
        ctx.lineWidth = isLive ? (compact ? 1.2 : 1.55) : (compact ? 0.55 : 0.7);
        if (dashed) ctx.setLineDash(plateDash('long'));
        ctx.beginPath();
        ctx.arc(center.x, center.y, sunR, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (isLive) {
          ctx.fillStyle = PLATE.ink;
          ctx.beginPath();
          ctx.arc(point.x, point.y, compact ? 1.5 : 2, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        return true;
      }
      if (!bodyFits(point, compact ? 4 : 6)) return false;
      const r = compact ? 4.3 : 6;
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = isLive ? (compact ? 1.05 : 1.35) : (compact ? 0.5 : 0.65);
      if (dashed) ctx.setLineDash(plateDash('long'));
      ctx.beginPath();
      ctx.moveTo(point.x - r, point.y);
      ctx.lineTo(point.x + r, point.y);
      ctx.moveTo(point.x, point.y - r);
      ctx.lineTo(point.x, point.y + r);
      ctx.moveTo(point.x - r * 0.55, point.y - r * 0.55);
      ctx.lineTo(point.x + r * 0.55, point.y + r * 0.55);
      ctx.moveTo(point.x + r * 0.55, point.y - r * 0.55);
      ctx.lineTo(point.x - r * 0.55, point.y + r * 0.55);
      ctx.stroke();
      if (isLive) {
        ctx.fillStyle = PLATE.ink;
        ctx.beginPath();
        ctx.arc(point.x, point.y, compact ? 1.45 : 1.9, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      return true;
    };

    if (rocking && Math.abs(liveBeta) > 0.08) {
      drawPlateBody(minimumPoint, false, true);
    }
    const liveVisible = drawPlateBody(livePoint, true);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.35 : 1.75;
    ctx.beginPath();
    ctx.arc(field.x, field.y, fieldR, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = compact ? 0.5 : 0.7;
    ctx.beginPath();
    ctx.arc(field.x, field.y, fieldR + (compact ? 3 : 5), 0, TAU);
    ctx.stroke();
    ctx.restore();

    if (!liveVisible) {
      const above = livePoint.y < field.y;
      const marker = {
        x: clamp(livePoint.x, field.x - fieldR * 0.55, field.x + fieldR * 0.55),
        y: field.y + (above ? -1 : 1) * fieldR * 0.76,
      };
      plateArrowhead(ctx, marker, above ? -Math.PI / 2 : Math.PI / 2,
        compact ? 3.2 : 4);
      plateText(ctx,
        `${scopeMode === 'sun' ? 'Sun' : 'Vega'} is ${above ? 'above' : 'below'} this view`,
        field.x, field.y + (above ? -0.48 : 0.56) * fieldR, {
          size: compact ? 8 : 9,
          align: 'center',
        });
    }

    plateText(ctx, compact ? 'Through the telescope' : 'Through the telescope while rocking',
      field.x, field.y - fieldR - (compact ? 8 : 11), {
        size: compact ? 8 : 9,
        align: 'center',
      });
    plateText(ctx, 'direct horizon', field.x - fieldR + (compact ? 3 : 5),
      horizonY + (compact ? 7 : 10), {
        size: compact ? 7.5 : 8,
        align: 'left',
      });
    plateDataText(ctx, compact
      ? `Exact ±4° lift ${edgeLift.toFixed(1)}′`
      : `Exact ±4° lift: image ${edgeLift.toFixed(1)}′ higher`,
      field.x, field.y + fieldR + (compact ? 8 : 12), {
        size: compact ? 8 : 9,
        align: 'center',
      });

    // The end view connects the side-to-side rock with the image motion.
    const roll = {
      x: w * (compact ? 0.73 : 0.72),
      y: field.y - (compact ? 1 : 0),
    };
    const rollR = Math.min(
      fieldR * (compact ? 0.70 : 0.72),
      w - roll.x - (compact ? 11 : 20)
    );
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.75 : 0.95;
    ctx.beginPath();
    ctx.arc(roll.x, roll.y, rollR, 0, TAU);
    ctx.stroke();
    ctx.restore();
    plateLine(ctx, {
      x: roll.x,
      y: roll.y - rollR - (compact ? 5 : 8),
    }, {
      x: roll.x,
      y: roll.y + rollR + (compact ? 5 : 8),
    }, {
      kind: 'construction',
      weight: compact ? 0.5 : 0.65,
    });
    const planeA = -Math.PI / 2 + liveBeta * D2R;
    const planeDir = { x: Math.cos(planeA), y: Math.sin(planeA) };
    plateLine(ctx, {
      x: roll.x - planeDir.x * rollR * 0.84,
      y: roll.y - planeDir.y * rollR * 0.84,
    }, {
      x: roll.x + planeDir.x * rollR * 0.84,
      y: roll.y + planeDir.y * rollR * 0.84,
    }, {
      weight: compact ? 1.35 : 1.8,
    });
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.8 : 1;
    ctx.beginPath();
    ctx.arc(roll.x, roll.y, compact ? 5 : 7, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(roll.x, roll.y, compact ? 1.4 : 1.9, 0, TAU);
    ctx.fillStyle = PLATE.ink;
    ctx.fill();
    ctx.restore();

    if (Math.abs(liveBeta) > 0.05) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.55 : 0.7;
      ctx.beginPath();
      arcBetween(ctx, roll.x, roll.y, rollR * 0.54, -Math.PI / 2, planeA);
      ctx.stroke();
      ctx.restore();
    }
    plateText(ctx, 'End view: roll', roll.x,
      roll.y - rollR - (compact ? 8 : 11), {
        size: compact ? 8 : 9,
        align: 'center',
      });
    plateDataText(ctx, `roll ${liveBeta >= 0 ? '+' : '−'}${Math.abs(liveBeta).toFixed(1)}°`,
      roll.x + (compact ? 8 : 12), roll.y - rollR * 0.46, {
        size: compact ? 8 : 9,
        align: 'left',
      });

    const methodY = roll.y + rollR + (compact ? 9 : 14);
    const boxW = compact ? Math.min(128, w * 0.45) : Math.min(220, w * 0.34);
    const boxX = compact
      ? clamp(roll.x - boxW / 2, w * 0.52, w - boxW - 8)
      : clamp(roll.x - boxW / 2, w * 0.53, w - boxW - 14);
    const boxY = methodY - 3;
    const boxH = Math.min(compact ? 62 : 78,
      Math.max(compact ? 58 : 72, ruleY - boxY - 5));
    const boxSize = compact ? 8 : 9;
    const boxLine = compact ? 11 : 14;
    const boxPad = compact ? 5 : 8;
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.8;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.restore();
    plateText(ctx, 'Why the minimum', boxX + boxPad,
      boxY + boxPad + boxSize * 0.45, {
        size: boxSize,
        weight: 600,
        tracking: boxSize * 0.09,
      });
    plateLine(ctx, {
      x: boxX + boxPad,
      y: boxY + boxPad + boxLine,
    }, {
      x: boxX + boxW - boxPad,
      y: boxY + boxPad + boxLine,
    }, { weight: 0.55 });
    const boxBodyY = boxY + boxPad + boxLine + (compact ? 9 : 11);
    plateText(ctx, compact ? 'Tilt only lifts the image' : 'Tilt can only lift the image',
      boxX + boxPad, boxBodyY, {
        size: boxSize,
      });
    plateText(ctx, compact ? 'Lowest contact is vertical' : 'The lowest contact is vertical',
      boxX + boxPad, boxBodyY + boxLine, {
        size: boxSize,
      });
    const recordY = boxBodyY + boxLine * 2;
    plateText(ctx, 'Record', boxX + boxPad, recordY, { size: boxSize });
    const recordWidth = plateTextWidth(ctx, 'Record', { size: boxSize });
    plateDataText(ctx, 'Hs', boxX + boxPad + recordWidth + boxSize * 0.55,
      recordY, { size: boxSize });
    const hsWidth = plateTextWidth(ctx, 'Hs', {
      size: boxSize,
      font: PLATE.dataFont,
      tracking: 0,
      uppercase: false,
    });
    plateText(ctx, 'there',
      boxX + boxPad + recordWidth + hsWidth + boxSize * 1.1,
      recordY, { size: boxSize });

    const labels = createPlateLabeler(ctx, {
      left: 7,
      top: fieldTop,
      right: w - 7,
      bottom: ruleY - 5,
      gap: compact ? 2 : 3,
    });
    labels.reserve({ x: boxX, y: boxY, w: boxW, h: boxH }, compact ? 2 : 3);
    if (bodyFits(minimumPoint, scopeMode === 'sun' ? sunR : 5)) {
      labels.place(compact
        ? (scopeMode === 'sun' ? 'LOWEST CONTACT' : 'VEGA MINIMUM')
        : (scopeMode === 'sun' ? 'LOWEST LOWER-LIMB CONTACT' : 'VEGA’S LOWEST POINT'),
        minimumPoint, [
          {
            x: minimumPoint.x + (compact ? 8 : 12),
            y: minimumPoint.y + (compact ? 9 : 13),
            align: 'left',
          },
          {
            x: minimumPoint.x - (compact ? 8 : 12),
            y: minimumPoint.y + (compact ? 9 : 13),
            align: 'right',
          },
        ], {
          size: compact ? 8 : 9,
          head: compact ? 2.5 : 3,
          fallback: 'hide',
        });
    }
    if (rocking && liveVisible && Math.abs(liveBeta) > 0.2) {
      labels.place('IMAGE WHILE ROLLED', livePoint, [
        {
          x: livePoint.x + (liveBeta < 0 ? -8 : 8),
          y: livePoint.y - (compact ? 8 : 11),
          align: liveBeta < 0 ? 'right' : 'left',
        },
      ], {
        size: compact ? 7.5 : 8,
        head: compact ? 2.5 : 3,
        fallback: 'hide',
      });
    }

    updateScopeStatus(s);
  }
})();
