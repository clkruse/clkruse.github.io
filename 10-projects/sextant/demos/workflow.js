'use strict';
/* The operational chain: record Hs and UTC, correct to Ho, locate the GP,
   compute Hc and Zn from an assumed position, plot Ho − Hc, then repeat
   sights before advancing and combining several LOPs at one common time. */

(function demoWorkflow() {
  const d = createDemo('demo-workflow', {
    aspect: 2.04,
    maxH: 320,
    compactAspect: 1.29,
    compactMaxH: 220,
    draw,
  });

  const step = addSlider(d, {
    label: 'reveal the sight',
    min: 1,
    max: 6,
    step: 1,
    value: 3,
    fmt: v => ['record', 'correct Ho', 'locate GP', 'predict Hc and Zn', 'plot LOP', 'repeat'][v - 1],
  });
  const result = addStat(d, 'result', true);
  const stepControl = step.input.parentElement;
  const stepValue = stepControl.querySelector('.ctl-value');
  stepControl.style.minWidth = '0';
  stepControl.style.maxWidth = '100%';
  stepControl.style.flex = '1 1 100%';
  stepControl.style.flexWrap = 'wrap';
  stepControl.style.rowGap = '0.2rem';
  step.input.style.order = '3';
  step.input.style.flex = '1 1 100%';
  step.input.style.width = '100%';
  step.input.style.minWidth = '0';
  stepValue.style.minWidth = '0';
  stepValue.style.maxWidth = '100%';
  stepValue.style.whiteSpace = 'normal';
  const resultControl = d.controls.lastElementChild;
  resultControl.style.minWidth = '0';
  resultControl.style.maxWidth = '100%';
  resultControl.style.flex = '1 1 100%';
  d.addPreset('worked', () => step.set(3, { emit: false }));

  const stageColor = i => [
    P.measured,
    P.corrected,
    P.ephemeris,
    P.predicted,
    P.constraint,
    P.fix,
  ][i];

  function worked() {
    const s = SIGHT_STORY.state;
    return {
      s,
      utc: `${storyClock(s.utcHours, true)} UTC`,
      gpLat: storySignedPosition(s.gp.lat, true),
      gpLon: storySignedPosition(s.gp.lon, false),
      ap: `${storySignedPosition(s.assumed.lat, true)} · ${storySignedPosition(s.assumed.lon, false)}`,
      zn: `${s.zn.toFixed(1)}°`,
      intercept: `${s.interceptMin >= 0 ? '+' : '−'}${Math.abs(s.interceptMin).toFixed(1)}′`,
    };
  }

  function draw(ctx, w, h) {
    drawWholeSight(ctx, w, h);
    const { s } = worked();
    result.set(step.v < 5
      ? `Vega sight · ${step.v}/6`
      : step.v < 6
        ? `${Math.abs(s.interceptMin).toFixed(1)} nm ${s.direction} · one LOP plotted`
        : 'one LOP complete · repeat',
    stageColor(step.v - 1));
  }

  function drawWholeSight(ctx, w, h) {
    const { s, utc, gpLat, gpLon, ap, zn, intercept } = worked();
    const compact = w < 500 || h < 300;
    const targetHeight = compact ? 220 : 320;
    const contentH = Math.min(targetHeight, h - 2);
    const top = (h - contentH) / 2;
    const headingH = compact ? 18 : 26;
    const conclusionH = compact ? 40 : 42;
    const rowH = (contentH - headingH - conclusionH) / 6;
    const rowsTop = top + headingH;
    const conclusionTop = rowsTop + rowH * 6;
    const left = compact ? 8 : 14;
    const right = w - left;
    const markerX = left + (compact ? 4 : 5);
    const textX = markerX + (compact ? 10 : 14);
    const titleSize = compact ? 8 : 9;
    const dataSize = compact ? 8 : 9;
    const titles = [
      '1 · RECORD OBSERVATION',
      '2 · CORRECT ALTITUDE',
      '3 · LOCATE VEGA GP',
      '4 · PREDICT FROM AP',
      '5 · PLOT THE LOP',
      '6 · REPEAT AND COMBINE',
    ];
    const detailRows = compact
      ? [
        [`Hs ${fmtDM(s.hs, 1)} · ${utc}`],
        [`IC +${s.indexCorrectionMin.toFixed(1)}′ · DIP −${s.dipMin.toFixed(1)}′ · R −${s.refractionMin.toFixed(1)}′ · Ho ${fmtDM(s.ho, 1)}`],
        [`GP ${gpLat} · ${gpLon}`],
        [`Hc ${fmtDM(s.hc, 1)} · Zn ${zn}`],
        [`Ho − Hc ${intercept} · ${Math.abs(s.interceptMin).toFixed(1)} nm ${s.direction.toUpperCase()}`],
        ['MORE LOPs · COMMON UTC · COMBINE'],
      ]
      : [
        [`Vega · Hs ${fmtDM(s.hs, 1)}`, utc],
        [`IC +${s.indexCorrectionMin.toFixed(1)}′ · DIP −${s.dipMin.toFixed(1)}′ · R −${s.refractionMin.toFixed(1)}′`,
          `Ho ${fmtDM(s.ho, 1)}`],
        [`VEGA GP · ${gpLat}`, gpLon],
        [`AP ${ap}`, `Hc ${fmtDM(s.hc, 1)} · Zn ${zn}`],
        [`Ho − Hc ${intercept}`,
          `${Math.abs(s.interceptMin).toFixed(1)} nm ${s.direction.toUpperCase()} · LOP ⟂ Zn`],
        ['MORE LOPs', 'COMMON UTC · COMBINE'],
      ];

    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    plateText(ctx, 'THE WHOLE SIGHT', w / 2, top + headingH * 0.47, {
      size: compact ? 8 : 10,
      weight: 600,
      align: 'center',
    });
    plateRule(ctx, rowsTop, left, right);

    for (let index = 0; index < 6; index++) {
      const reached = index + 1 <= step.v;
      const current = index + 1 === step.v;
      const rowTop = rowsTop + index * rowH;
      const rowBottom = rowTop + rowH;
      const titleY = rowTop + (compact ? rowH * 0.29 : 13);
      const valueY = rowTop + (compact ? rowH * 0.74 : 31);

      if (index) {
        plateLine(ctx, { x: textX, y: rowTop }, { x: right, y: rowTop }, {
          kind: 'short',
          weight: compact ? 0.4 : 0.5,
        });
      }

      ctx.save();
      ctx.fillStyle = current ? PLATE.ink : PLATE.paper;
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = current ? 1.2 : 0.75;
      const markerR = compact ? 2.6 : 3.3;
      ctx.fillRect(markerX - markerR, titleY - markerR,
        markerR * 2, markerR * 2);
      ctx.strokeRect(markerX - markerR, titleY - markerR,
        markerR * 2, markerR * 2);
      if (reached && !current) {
        ctx.fillStyle = PLATE.ink;
        ctx.fillRect(markerX - markerR + 1.2, titleY - markerR + 1.2,
          markerR * 2 - 2.4, markerR * 2 - 2.4);
      }
      ctx.restore();

      if (current) {
        plateLine(ctx, { x: left, y: rowTop + 3 },
          { x: left, y: rowBottom - 3 }, {
            weight: compact ? 1.4 : 1.8,
          });
      }

      plateText(ctx, titles[index], textX, titleY, {
        size: titleSize,
        weight: current ? 600 : 500,
      });

      if (reached) {
        plateDataText(ctx, detailRows[index][0], textX, valueY, {
          size: dataSize,
          weight: index === 4 ? 600 : 500,
        });
        if (!compact && detailRows[index][1]) {
          plateDataText(ctx, detailRows[index][1], right, valueY, {
            size: dataSize,
            weight: index === 4 ? 600 : 500,
            align: 'right',
          });
        }
      } else {
        const pendingText = 'PENDING';
        const pendingWidth = plateTextWidth(ctx, pendingText, {
          size: dataSize,
          font: PLATE.dataFont,
          tracking: 0,
          uppercase: false,
        });
        const pendingX = right - pendingWidth;
        plateLine(ctx, { x: textX, y: valueY }, {
          x: Math.max(textX, pendingX - 7),
          y: valueY,
        }, {
          kind: 'short',
          weight: compact ? 0.5 : 0.6,
        });
        plateDataText(ctx, pendingText, right, valueY, {
          size: dataSize,
          align: 'right',
        });
      }
    }

    plateRule(ctx, conclusionTop, left, right);
    const conclusionTitle = compact
      ? `CURRENT · ${step.v}/6`
      : `CURRENT STAGE · ${step.v}/6 · ${titles[step.v - 1].replace(/^\d+\s*·\s*/, '')}`;
    plateText(ctx, conclusionTitle, w / 2,
      conclusionTop + (compact ? 10 : 12), {
        size: compact ? 8 : 9,
        weight: 600,
        align: 'center',
      });
    const conclusion = step.v < 5
      ? 'Hs ≠ Ho ≠ Hc · KEEP MEASUREMENT AND PREDICTION SEPARATE'
      : step.v === 5
        ? `Ho − Hc ${intercept} · ${Math.abs(s.interceptMin).toFixed(1)} nm ${s.direction.toUpperCase()} · ONE LOP`
        : 'ONE LOP COMPLETE · REPEAT · COMMON UTC · COMBINE';
    plateDataText(ctx, conclusion, w / 2,
      conclusionTop + (compact ? 28 : 31), {
        size: compact ? 8 : 9,
        weight: 600,
        align: 'center',
      });
  }
})();
