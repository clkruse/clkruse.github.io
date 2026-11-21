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

  // GHA runs 0–360° west of Greenwich; as a longitude it is west up to
  // 180° and east beyond
  const lonText = gha => gha <= 180
    ? `${fmtDM(gha, 1)} W`
    : `${fmtDM(360 - gha, 1)} E`;

  // largest nominal size at which a line fits its column, never below the
  // 8-point floor for canvas text (DIAGRAM_STYLE §11)
  function fitSize(ctx, text, width, size, opts = {}) {
    const floor = Math.min(size, 8);
    let fitted = size;
    while (fitted > floor
      && plateTextWidth(ctx, text, { ...opts, size: fitted }) > width) fitted -= 0.25;
    return Math.max(floor, fitted);
  }

  // width a plateBox needs for its title and lines, measured the way
  // plateBox draws them, so the box follows the font instead of a guess
  function boxContentWidth(ctx, title, lines, size) {
    let width = plateTextWidth(ctx, title, { size, weight: 600, tracking: size * 0.09 });
    for (const line of lines) {
      const entry = typeof line === 'string' ? { text: line } : line;
      const font = entry.font || PLATE.font;
      width = Math.max(width, (entry.indent || 0) + plateTextWidth(ctx, entry.text, {
        size: entry.size || size,
        weight: entry.weight || 500,
        tracking: entry.tracking ?? size * 0.055,
        font,
        uppercase: entry.uppercase ?? (font === PLATE.dataFont ? false : undefined),
      }));
    }
    return Math.ceil(width);
  }
  const DATA = { font: PLATE.dataFont, tracking: 0, uppercase: false };

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
  }

  function drawGhaBelt(ctx, w, h, s) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500 || h < 330;
    const bodySize = compact ? 8 : 9.2;
    const dataSize = compact ? 8 : 9;
    const line = size => size * PLATE_TEXT_SCALE * 1.45;
    const ruleY = h - (compact ? 34 : 50);
    const x0 = compact ? 28 : 48;
    const x1 = w - x0;
    const clockRead = gmt + s.errorSeconds / 3600;
    const errorX = seconds => x0
      + (clamp(seconds, -120, 120) + 120) / 240 * (x1 - x0);
    const markerX = errorX(s.errorSeconds);

    // the figure's title is set in its caption, so the band starts at the top
    const titleRule = compact ? 2 : 4;

    // top band: the clock readings beside the why-box (stacked on phones,
    // where the readings already sit in the footer)
    const bandY = titleRule + (compact ? 8 : 12);
    const boxTitle = 'WHY TIME SETS LONGITUDE';
    const boxLines = [
      { text: 'EARTH TURNS 1′ IN ABOUT 4 S.', font: PLATE.dataFont, tracking: 0 },
      'A WRONG TIME PUTS THE GP',
      'AT THE WRONG LONGITUDE.',
    ];
    const boxPadding = compact ? 6 : 8;
    // sized from its text: full width on phones, hugging the right edge
    // on desktop so the readings keep the rest of the band
    const boxW = compact ? w - 28 : Math.min(w * 0.5 - 14,
      boxContentWidth(ctx, boxTitle, boxLines, bodySize) + boxPadding * 2 + 4);
    const boxX = compact ? 14 : w - 14 - boxW;
    const boxH = plateBox(ctx, boxX, bandY, boxW, boxLines, {
      title: boxTitle,
      size: bodySize,
      lineHeight: compact ? 9.5 : 13,
      padding: boxPadding,
    });
    let y = bandY + boxH;
    if (!compact) {
      const readings = [
        `True UTC     ${clockText(gmt)}`,
        `Clock reads  ${clockText(clockRead)}`,
        `Clock − UTC  ${clockErrorText(s.errorSeconds)}`,
      ];
      readings.forEach((text, i) => {
        plateDataText(ctx, text, 16, bandY + 12 + i * line(dataSize) * 1.15, {
          size: fitSize(ctx, text, boxX - 30, dataSize, DATA),
        });
      });
    }

    // the error scale fills the space between the band and the result lines
    const resultSize = compact ? 8 : 10;
    const resultsH = line(resultSize) * 2;
    const scaleTop = y + (compact ? 10 : 18);
    const scaleBottom = ruleY - resultsH - (compact ? 8 : 14);
    const scaleY = (scaleTop + scaleBottom) / 2 + (compact ? 6 : 0);
    // tick labels sit clear of the marker's crossbar (±8 / ±11 px)
    const tickLift = line(dataSize) * (compact ? 1.1 : 1.2);

    // heading above the scale; the two direction notes below it, under
    // the longitude row they explain
    plateText(ctx, 'CLOCK ERROR → LONGITUDE ERROR',
      w / 2, scaleY - tickLift - line(bodySize) * 1.05, {
        size: bodySize, weight: 600, align: 'center',
      });
    if (!compact) {
      const noteY = scaleY + tickLift + line(bodySize) * 1.0;
      plateText(ctx, 'SLOW CLOCK: GP EAST', x0, noteY, {
        size: bodySize, align: 'left',
      });
      plateText(ctx, 'FAST CLOCK: GP WEST', x1, noteY, {
        size: bodySize, align: 'right',
      });
    }
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
      x, scaleY - tickLift, {
        size: dataSize, align,
      });
      plateDataText(ctx, seconds === 0 ? 'true' :
        `${Math.abs(seconds) / 4}′ ${seconds < 0 ? 'E' : 'W'}`,
      x, scaleY + tickLift, {
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
    const resultLine = s.errorSeconds === 0
      ? 'TRUE AND CLOCK-IMPLIED POSITIONS MATCH'
      : `POSITION ERROR IS UP TO ABOUT ${s.arcmin.toFixed(1)} NM`;
    const resultY = ruleY - resultsH - (compact ? 2 : 6) + line(resultSize) * 0.5;
    plateDataText(ctx, mappingLine, w / 2, resultY, {
      size: fitSize(ctx, mappingLine, w - 28, resultSize, DATA), weight: 600, align: 'center',
    });
    plateDataText(ctx, resultLine, w / 2, resultY + line(resultSize), {
      size: fitSize(ctx, resultLine, w - 28, resultSize, DATA), weight: 600, align: 'center',
    });

    plateRule(ctx, ruleY, 14, w - 14);
    const timeLine = `True UTC ${clockText(gmt)} · clock ${clockText(clockRead)}`;
    const lonLine = `Sample GP longitude ${lonText(s.gha)} → ${lonText(s.falseGha)}`;
    plateDataText(ctx, timeLine, w / 2, ruleY + (compact ? 11 : 16), {
      size: fitSize(ctx, timeLine, w - 28, dataSize, DATA), align: 'center',
    });
    plateDataText(ctx, lonLine, w / 2, ruleY + (compact ? 25 : 35), {
      size: fitSize(ctx, lonLine, w - 28, dataSize, DATA), align: 'center',
    });
  }
})();
