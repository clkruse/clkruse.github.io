'use strict';
/* §05: the same sky, two places. Start with the shared Vega sight at the
   assumed position, then move UTC and longitude west together. The shared
   base follows SIGHT_STORY; the local comparison keeps its selected offset. */

(function demoSameSky() {
  const d = createDemo('demo-samesky', {
    aspect: 1.55,
    maxH: 520,
    draw,
  });
  let baseSight = SIGHT_STORY.state;
  let referenceUtc = baseSight.utcHours;
  let referenceLonW = Math.abs(baseSight.assumed.lon);
  let referenceGha = baseSight.gha;
  const STELLAR_RATE = SIGHT_STORY.constants.stellarRate;
  const MATCH_WINDOW_HOURS = 80 / 60;
  let gmt = referenceUtc;
  const gmtSlider = addSlider(d, {
    label: 'if UTC reads',
    min: referenceUtc,
    max: referenceUtc + MATCH_WINDOW_HOURS,
    step: 1 / 3600,
    value: gmt,
    fmt: utcText,
    onchange: v => {
      gmt = v;
      syncSliderFill();
    },
  });
  const lonStat = addStat(d, 'matched position');
  const skyStat = addStat(d, ' ', true);

  function syncSliderFill() {
    const fraction = clamp((gmt - referenceUtc) / MATCH_WINDOW_HOURS, 0, 1);
    gmtSlider.input.style.setProperty('--fill', `${fraction * 100}%`);
  }

  SIGHT_STORY.subscribe(state => {
    const selectedOffset = clamp(gmt - referenceUtc, 0, MATCH_WINDOW_HOURS);
    baseSight = state;
    referenceUtc = state.utcHours;
    referenceLonW = Math.abs(state.assumed.lon);
    referenceGha = state.gha;
    gmt = referenceUtc + selectedOffset;
    gmtSlider.input.min = referenceUtc;
    gmtSlider.input.max = referenceUtc + MATCH_WINDOW_HOURS;
    gmtSlider.set(gmt, { emit: false });
    syncSliderFill();
  });

  function utcText(v) {
    const raw = Math.round(v * 3600);
    const total = ((raw % 86400) + 86400) % 86400;
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  function latitudeText() {
    return `${fmtDM(Math.abs(baseSight.assumed.lat), 1)} ${baseSight.assumed.lat < 0 ? 'S' : 'N'}`;
  }

  function longitudeText(west) {
    return `${fmtDM(Math.abs(west), 1)} W`;
  }

  function positionText(west) {
    return `${latitudeText()}  ${longitudeText(west)}`;
  }

  function state() {
    const rawDGha = (gmt - referenceUtc) * STELLAR_RATE;
    const dGha = Math.abs(rawDGha) < 1e-9 ? 0 : rawDGha;
    const lonW = referenceLonW + dGha;
    const gha = (referenceGha + dGha + 360) % 360;
    return { dGha, lonW, gha, lha: (gha - lonW + 360) % 360 };
  }

  function setReadouts(s) {
    lonStat.set(positionText(s.lonW));
    skyStat.set(`Vega LHA ${fmtDM(s.lha, 1)} in both situations`);
  }

  function draw(ctx, w, h) {
    const s = state();
    drawHourAngleStrips(ctx, w, h, s);
    setReadouts(s);
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

  function drawHourAngleStrips(ctx, w, h, s) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500 || h < 330;
    const bodySize = compact ? 8 : 9.2;
    const dataSize = compact ? 8 : 9;
    // the figure's title is set in its caption, so the field starts at the top
    const fieldTop = compact ? 10 : 16;
    const ruleY = h - (compact ? 38 : 62);
    const frac = clamp((gmt - referenceUtc) / MATCH_WINDOW_HOURS, 0, 1);
    const margin = compact ? 8 : 16;

    const boxTitle = 'WHY THE VIEW REPEATS';
    const boxLines = [
      'GP AND OBSERVER MOVE EQUALLY WEST.',
      'THE LONGITUDE GAP STAYS THE SAME,',
      {
        text: 'SO LHA AND THE LOCAL SKY DO TOO.',
        font: PLATE.dataFont,
        tracking: 0,
      },
    ];
    const boxPadding = compact ? 6 : 7;
    const boxW = Math.min(w - 16,
      boxContentWidth(ctx, boxTitle, boxLines, bodySize) + boxPadding * 2 + 4);
    const boxX = compact ? Math.round((w - boxW) / 2) : 14;
    const boxY = fieldTop + (compact ? 1 : 5);
    const boxH = plateBox(ctx, boxX, boxY, boxW, boxLines, {
      title: boxTitle,
      size: bodySize,
      lineHeight: compact ? 9 : 14,
      padding: boxPadding,
    });

    if (!compact) {
      // the readings sit beside the box, three lines spread over its height
      const infoX = boxX + boxW + 18;
      const infoY = i => boxY + 14 + (boxH - 28) * i / 2;
      plateDataText(ctx, `First  ${utcText(referenceUtc)} UTC · ${longitudeText(referenceLonW)}`,
        infoX, infoY(0), {
          size: dataSize,
        });
      plateDataText(ctx, `Later  ${utcText(gmt)} UTC · ${longitudeText(s.lonW)}`,
        infoX, infoY(1), {
          size: dataSize,
        });
      plateDataText(ctx, `Both at ${latitudeText()} latitude`,
        infoX, infoY(2), {
          size: dataSize,
        });
    }

    // rails: each name sits at the left end of its own rail, so the rails
    // start after the longer name
    const railNames = ['VEGA’S GP', compact ? 'YOU' : 'OBSERVER'];
    const nameW = Math.max(...railNames.map(t => plateTextWidth(ctx, t, { size: bodySize })));
    const x0 = Math.ceil(margin + nameW + (compact ? 8 : 12));
    // each rail's shift reads at the clear end of the rail, past the arrow,
    // so the moving marker never crosses it; reserve its widest value
    const shiftDecimals = compact ? 1 : 3;
    const shiftText = `+${s.dGha.toFixed(shiftDecimals)}° WEST`;
    const shiftGap = compact ? 6 : 8;
    const shiftW = plateTextWidth(ctx,
      `+${(MATCH_WINDOW_HOURS * STELLAR_RATE).toFixed(shiftDecimals)}° WEST`,
      { size: dataSize, tracking: 0, uppercase: false });
    const x1 = Math.floor(w - margin - shiftW - shiftGap);
    const xm = x0 + (x1 - x0) * frac;
    const yGha = boxY + boxH + (compact ? 22 : 30);
    // desktop keeps two definition lines above the rule when there is room
    const definitionY = ruleY - 32;
    let showDefinitions = !compact;
    let yLon = compact
      ? yGha + Math.min(64, ruleY - 18 - yGha)
      : Math.min(definitionY - 20, yGha + 110);
    if (showDefinitions && yLon - yGha < 50) {
      showDefinitions = false;
      yLon = Math.min(ruleY - 22, yGha + 110);
    }

    function shiftRail(y, title) {
      plateText(ctx, title, x0 - (compact ? 8 : 12), y, {
        size: bodySize, align: 'right',
      });
      plateDataText(ctx, shiftText, x1 + shiftGap, y, {
        size: dataSize, align: 'left',
      });
      plateLine(ctx, { x: x0, y }, { x: x1 - (compact ? 4 : 6), y }, {
        weight: compact ? 0.9 : 1.2,
      });
      plateArrowhead(ctx, { x: x1, y }, 0, compact ? 3 : 3.8);
      for (let i = 0; i <= 4; i++) {
        const x = x0 + (x1 - x0) * i / 4;
        plateLine(ctx, { x, y: y - (compact ? 3 : 5) },
          { x, y: y + (compact ? 3 : 5) }, {
            weight: i === 0 ? (compact ? 0.75 : 0.9) : 0.45,
          });
      }
      plateLine(ctx, { x: x0, y }, { x: xm, y }, {
        weight: compact ? 1.4 : 1.8,
      });
      plateLine(ctx, { x: xm, y: y - (compact ? 6 : 8) },
        { x: xm, y: y + (compact ? 6 : 8) }, {
          weight: compact ? 1.4 : 1.8,
        });
    }

    shiftRail(yGha, railNames[0]);
    shiftRail(yLon, railNames[1]);

    plateLine(ctx, { x: xm, y: yGha + (compact ? 7 : 9) },
      { x: xm, y: yLon - (compact ? 7 : 9) }, {
        kind: 'construction', weight: compact ? 0.55 : 0.7,
      });
    // flips to the left of the marker once, where it would pass the arrow
    const sameText = 'SAME DISTANCE WEST';
    const sameW = plateTextWidth(ctx, sameText, { size: bodySize });
    const flip = xm + 7 + sameW > x1 - 4;
    plateText(ctx, sameText, xm + (flip ? -7 : 7), (yGha + yLon) / 2, {
      size: bodySize,
      align: flip ? 'right' : 'left',
    });

    if (showDefinitions) {
      plateDataText(ctx, 'GHA: Vega GP’s angle west from Greenwich',
        w / 2, definitionY, {
          size: bodySize, align: 'center',
        });
      plateDataText(ctx, 'LHA: Vega GP’s angle west from the observer',
        w / 2, definitionY + 16, {
          size: bodySize, align: 'center',
        });
    }

    plateRule(ctx, ruleY, 14, w - 14);
    plateDataText(ctx, 'LHA = GHA − west longitude',
      w / 2, ruleY + (compact ? 11 : 18), {
        size: dataSize, weight: 600, align: 'center',
      });
    const wrapTerm = s.gha < s.lonW ? ' + 360°' : '';
    plateDataText(ctx,
      `${fmtDM(s.gha, 1)} − ${fmtDM(s.lonW, 1)}${wrapTerm} = ${fmtDM(s.lha, 1)}`,
      w / 2, ruleY + (compact ? 26 : 40), {
        size: dataSize, align: 'center',
      });
  }
})();
