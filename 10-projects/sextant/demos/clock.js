'use strict';
/* §07: the clockwork earth. */

(function demoClock() {
  const d = createDemo('demo-clock', {
    aspect: 1.55,
    maxH: 520,
    draw,
  });
  const STORY_SOURCE = 'demo-clock';
  const WORKED = SIGHT_STORY.state;
  const WORKED_UTC = WORKED.utcHours;
  const SPIN_HOURS_PER_SECOND = 1.2;
  let gmt = SIGHT_STORY.state.utcHours, playing = false, clockError = 30;
  let lastSpinTime = null;
  const gmtSlider = addSlider(d, {
    label: 'UTC', min: 0, max: 24 - 1 / 3600, step: 1 / 3600, value: gmt,
    fmt: clockText,
    onchange: v => {
      gmt = v;
      if (Math.abs(SIGHT_STORY.state.utcHours - v) > 1e-10) {
        SIGHT_STORY.set({ utcHours: v }, { source: STORY_SOURCE });
      }
    },
  });
  const playBtn = addButton(d, '▶ spin', () => {
    playing = !playing;
    lastSpinTime = playing ? d.t : null;
    playBtn.textContent = playing ? '❚❚ pause' : '▶ spin';
  });
  addSlider(d, {
    label: 'CLOCK − UTC', min: -120, max: 120, step: 1, value: clockError,
    fmt: clockErrorText,
    onchange: v => { clockError = v; },
  });
  const errStat = addStat(d, 'position error', true);

  d.addPreset('worked', () => {
    playing = false;
    lastSpinTime = null;
    playBtn.textContent = '▶ spin';
    gmtSlider.set(WORKED_UTC, { emit: true });
  });

  SIGHT_STORY.subscribe((state, source) => {
    if (source === STORY_SOURCE) return;
    gmt = state.utcHours;
    gmtSlider.set(gmt, { emit: false });
  });

  const wrap360 = a => ((a % 360) + 360) % 360;

  function clockText(v) {
    const raw = Math.round(v * 3600);
    const total = ((raw % 86400) + 86400) % 86400;
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  function clockErrorText(value) {
    const seconds = Math.round(value);
    if (seconds === 0) return '0 s EXACT';
    return `${Math.abs(seconds)} s ${seconds > 0 ? 'FAST' : 'SLOW'}`;
  }

  function clockState() {
    const errorSeconds = clockError;
    // Deliberately conceptual: this is the uniform mean-Sun clock dial, not
    // Vega's dated GHA from the adjacent almanac figure.
    const gha = wrap360((gmt - 12) * 15);
    const shiftDeg = errorSeconds / 240;
    const falseGha = wrap360(gha + shiftDeg);
    return {
      errorSeconds,
      gha,
      falseGha,
      shiftDeg,
      arcmin: Math.abs(errorSeconds) / 4,
    };
  }

  function updateErrorStat(s) {
    errStat.set(
      s.errorSeconds === 0
        ? 'a perfect clock: true and computed GPs coincide'
        : `${clockErrorText(s.errorSeconds)}: GHA shifts ${s.arcmin.toFixed(1)}′ ${s.errorSeconds > 0 ? 'west' : 'east'}; position error is up to about ${s.arcmin.toFixed(1)} nm`);
  }

  function draw(ctx, w, h, elapsedTime = d.t) {
    if (playing) {
      if (lastSpinTime === null) lastSpinTime = elapsedTime;
      const elapsed = Math.max(0, elapsedTime - lastSpinTime);
      lastSpinTime = elapsedTime;
      if (elapsed > 0) {
        const nextUtc = (gmt + elapsed * SPIN_HOURS_PER_SECOND) % 24;
        gmtSlider.set(nextUtc, { emit: true });
        gmt = gmtSlider.v;
      }
    } else {
      lastSpinTime = elapsedTime;
    }
    const s = clockState();
    drawGhaBelt(ctx, w, h, s);
    updateErrorStat(s);
  }

  function drawGhaBelt(ctx, w, h, s) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500 || h < 330;
    const titleSize = compact ? 8.5 : 11;
    const bodySize = compact ? 8 : 9.2;
    const dataSize = compact ? 8 : 9;
    const fieldTop = compact ? 29 : 44;
    const ruleY = h - (compact ? 28 : 55);
    const x0 = compact ? 28 : 48;
    const x1 = w - x0;
    const clockRead = gmt + s.errorSeconds / 3600;
    const errorX = seconds => x0
      + (clamp(seconds, -120, 120) + 120) / 240 * (x1 - x0);
    const markerX = errorX(s.errorSeconds);

    plateText(ctx, 'Earth turns about 1′ in four seconds', w / 2,
      compact ? 11 : 15, {
        size: titleSize, weight: 600, tracking: titleSize * 0.12, align: 'center',
      });
    plateRule(ctx, compact ? 25 : 32, 14, w - 14);

    const boxX = compact ? 8 : w * 0.50;
    const boxY = fieldTop + (compact ? 1 : 5);
    const boxW = compact ? w - 16 : w - boxX - 14;
    const boxH = compact ? 53 : 88;
    plateBox(ctx, boxX, boxY, boxW, [
      {
        text: 'EARTH TURNS 1′ IN ABOUT 4 S.',
        font: PLATE.dataFont,
        tracking: 0,
      },
      'WRONG TIME ASSIGNS THE GP',
      'TO THE WRONG LONGITUDE.',
    ], {
      title: 'WHY TIME SETS LONGITUDE',
      size: bodySize,
      lineHeight: compact ? 8.8 : 14,
      padding: compact ? 6 : 7,
      height: boxH,
    });

    if (!compact) {
      plateDataText(ctx, `True UTC  ${clockText(gmt)}`, 16, fieldTop + 16, {
        size: dataSize,
      });
      plateDataText(ctx, `Clock reads  ${clockText(clockRead)}`, 16, fieldTop + 38, {
        size: dataSize,
      });
      plateDataText(ctx,
        `Clock − UTC  ${clockErrorText(s.errorSeconds)}`,
        16, fieldTop + 60, {
          size: dataSize,
        });
    }

    if (!compact) {
      plateText(ctx, 'SLOW CLOCK: GP EAST', x0, 171, {
        size: bodySize, align: 'left',
      });
      plateText(ctx, 'FAST CLOCK: GP WEST', x1, 171, {
        size: bodySize, align: 'right',
      });
    }

    const scaleY = compact ? 111 : 218;
    plateText(ctx, 'CLOCK ERROR → LONGITUDE ERROR',
      w / 2, scaleY - (compact ? 18 : 31), {
        size: bodySize, weight: 600, align: 'center',
      });
    plateLine(ctx, { x: x0, y: scaleY }, { x: x1, y: scaleY }, {
      weight: compact ? 1.05 : 1.35,
    });
    const tickSeconds = compact ? [-120, 0, 120] : [-120, -60, 0, 60, 120];
    for (const seconds of tickSeconds) {
      const x = errorX(seconds);
      plateLine(ctx, { x, y: scaleY - (seconds === 0 ? 7 : 5) },
        { x, y: scaleY + (seconds === 0 ? 7 : 5) }, {
          weight: seconds === 0 ? (compact ? 1.2 : 1.5) : 0.55,
        });
      const align = seconds < 0 ? 'left' : seconds > 0 ? 'right' : 'center';
      plateDataText(ctx, seconds === 0 ? '0 s' :
        `${Math.abs(seconds)} s ${seconds < 0 ? 'slow' : 'fast'}`,
      x, scaleY - (compact ? 10 : 14), {
        size: dataSize, align,
      });
      plateDataText(ctx, seconds === 0 ? 'true' :
        `${Math.abs(seconds) / 4}′ ${seconds < 0 ? 'E' : 'W'}`,
      x, scaleY + (compact ? 12 : 16), {
        size: dataSize, align,
      });
    }

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.3 : 1.6;
    ctx.beginPath();
    ctx.arc(markerX, scaleY, compact ? 3.2 : 4.5, 0, TAU);
    ctx.stroke();
    ctx.restore();
    plateLine(ctx, { x: markerX, y: scaleY - (compact ? 8 : 11) },
      { x: markerX, y: scaleY + (compact ? 8 : 11) }, {
        weight: compact ? 1.25 : 1.55,
      });

    const direction = s.errorSeconds > 0 ? 'WEST' : s.errorSeconds < 0 ? 'EAST' : '';
    const mappingLine = s.errorSeconds === 0
      ? '0 S CLOCK ERROR = 0′ LONGITUDE ERROR'
      : `${Math.abs(s.errorSeconds)} S ${s.errorSeconds > 0 ? 'FAST' : 'SLOW'} ÷ 4 = ${s.arcmin.toFixed(1)}′ ${direction} LONGITUDE`;
    const mappingY = compact ? 136 : 278;
    plateDataText(ctx, mappingLine, w / 2, mappingY, {
      size: compact ? 8 : 10, weight: 600, align: 'center',
    });
    plateDataText(ctx, s.errorSeconds === 0
      ? 'TRUE AND CLOCK-IMPLIED POSITIONS MATCH'
      : `POSITION ERROR IS UP TO ABOUT ${s.arcmin.toFixed(1)} NM`,
    w / 2, mappingY + (compact ? 11 : 29), {
      size: compact ? 8 : 10, weight: 600, align: 'center',
    });

    plateRule(ctx, ruleY, 14, w - 14);
    plateDataText(ctx, `True UTC ${clockText(gmt)} · clock ${clockText(clockRead)}`,
      w / 2, ruleY + (compact ? 11 : 18), {
        size: dataSize, align: 'center',
      });
    plateDataText(ctx, compact
      ? `Mean-Sun GHA: ${fmtDM(s.gha, 1)} → ${fmtDM(s.falseGha, 1)}`
      : `Mean-Sun GHA (angle west from Greenwich): ${fmtDM(s.gha, 1)} → ${fmtDM(s.falseGha, 1)}`,
    w / 2, ruleY + (compact ? 23 : 40), {
      size: dataSize, align: 'center',
    });
  }
})();
