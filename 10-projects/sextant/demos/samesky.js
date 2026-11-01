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

  function drawHourAngleStrips(ctx, w, h, s) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500 || h < 330;
    const titleSize = compact ? 8.5 : 11;
    const bodySize = compact ? 8 : 9.2;
    const dataSize = compact ? 8 : 9;
    const fieldTop = compact ? 29 : 44;
    const ruleY = h - (compact ? 36 : 62);
    const frac = clamp((gmt - referenceUtc) / MATCH_WINDOW_HOURS, 0, 1);
    const x0 = compact ? 45 : 80;
    const x1 = w - (compact ? 12 : 35);
    const xm = x0 + (x1 - x0) * frac;
    const railTop = compact ? 104 : 190;
    const railGap = compact ? 23 : 86;
    const yGha = railTop;
    const yLon = railTop + railGap;

    plateText(ctx, 'Same distance west, same local sky', w / 2,
      compact ? 11 : 15, {
        size: titleSize, weight: 600, tracking: titleSize * 0.12, align: 'center',
      });
    plateRule(ctx, compact ? 25 : 32, 14, w - 14);

    const boxX = compact ? 8 : 14;
    const boxY = fieldTop + (compact ? 1 : 5);
    const boxW = compact ? w - 16 : w * 0.47;
    const boxH = compact ? 54 : 80;
    plateBox(ctx, boxX, boxY, boxW, [
      'GP AND OBSERVER MOVE EQUALLY WEST.',
      'THEIR LONGITUDE DIFFERENCE IS UNCHANGED.',
      {
        text: 'SO LHA – AND THE LOCAL SKY – STAYS UNCHANGED.',
        font: PLATE.dataFont,
        tracking: 0,
      },
    ], {
      title: 'WHY THE VIEW REPEATS',
      size: bodySize,
      lineHeight: compact ? 9 : 14,
      padding: compact ? 6 : 7,
      height: boxH,
    });

    if (!compact) {
      const infoX = w * 0.52;
      plateDataText(ctx, `First  ${utcText(referenceUtc)} UTC · ${longitudeText(referenceLonW)}`,
        infoX, boxY + 14, {
          size: dataSize,
        });
      plateDataText(ctx, `Later  ${utcText(gmt)} UTC · ${longitudeText(s.lonW)}`,
        infoX, boxY + 39, {
          size: dataSize,
        });
      plateDataText(ctx, `Both at ${latitudeText()} latitude`,
        infoX, boxY + 64, {
          size: dataSize,
        });
    }

    function shiftRail(y, title) {
      plateText(ctx, title, compact ? 8 : 16, y - (compact ? 10 : 16), {
        size: bodySize,
      });
      plateDataText(ctx, shiftText, x1, y - (compact ? 10 : 16), {
        size: dataSize, align: 'right',
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

    const shiftText = `+${s.dGha.toFixed(compact ? 1 : 3)}° WEST`;
    shiftRail(yGha, 'VEGA’S GP');
    shiftRail(yLon, compact ? 'YOU' : 'OBSERVER');

    plateLine(ctx, { x: xm, y: yGha + (compact ? 7 : 9) },
      { x: xm, y: yLon - (compact ? 7 : 9) }, {
        kind: 'construction', weight: compact ? 0.55 : 0.7,
      });
    if (!compact) {
      plateText(ctx, 'SAME DISTANCE WEST',
        clamp(xm + (frac > 0.77 ? -7 : 7), x0 + 8, x1 - 8),
        (yGha + yLon) / 2, {
          size: bodySize,
          align: frac > 0.77 ? 'right' : 'left',
        });
    }

    if (!compact) {
      const definitionY = ruleY - 34;
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
      w / 2, ruleY + (compact ? 27 : 40), {
        size: dataSize, align: 'center',
      });
  }
})();
