'use strict';
/* In the spherical navigation model, one degree of great-circle arc is
   approximately sixty nautical miles. A ruler connects zenith distance,
   arcminutes, and surface distance. */

(function demoArcminute() {
  const d = createDemo('demo-arcminute', {
    aspect: 2.5,
    maxH: 260,
    compactAspect: 1.57,
    compactMaxH: 180,
    draw,
  });

  const FALLBACK_WORKED_Z = 47.4989;
  const angle = addSlider(d, {
    label: 'zenith distance z',
    min: 0,
    max: 60,
    step: 0.001,
    value: FALLBACK_WORKED_Z,
    fmt: v => fmtDM(v, 1),
  });
  const distance = addStat(d, 'surface distance');
  const minutes = addStat(d, 'arcminutes');
  const applyWorked = (state = SIGHT_STORY.state) => {
    angle.set(clamp(state.z, 0, 60), { emit: false });
  };
  d.addPreset('worked', () => applyWorked());
  SIGHT_STORY.subscribe(applyWorked);

  function draw(ctx, w, h) {
    drawRuler(ctx, w, h);
    const mins = angle.v * 60;
    minutes.set(mins.toFixed(1) + '′');
    distance.set('≈ ' + fmtNM(mins));
  }

  function drawRuler(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500 || h < 300;
    const contentH = compact ? Math.min(180, h - 10) : Math.min(420, h - 24);
    const top = (h - contentH) / 2;
    const left = compact ? 18 : Math.max(42, w * 0.08);
    const right = w - left;
    const y = top + contentH * 0.47;
    const shown = 60;
    const xOf = deg => left + (right - left) * deg / shown;
    const current = clamp(angle.v, 0, shown);
    const arcminutes = current * 60;
    const x = xOf(current);

    plateText(ctx, compact
      ? 'ANGLE ACROSS EARTH'
      : 'ZENITH DISTANCE ACROSS EARTH',
    w / 2, top + contentH * 0.065, {
      size: compact ? 8.5 : 10.5,
      weight: 600,
      align: 'center',
    });
    plateDataText(ctx, '1° = 60′ · 1′ ≈ 1 nm',
      w / 2, top + contentH * 0.17, {
        size: compact ? 8 : 10.5,
        align: 'center',
    });

    plateLine(ctx, { x: left, y }, { x: right, y }, {
      weight: compact ? 1.2 : 1.5,
    });
    for (let deg = 0; deg <= shown; deg += 5) {
      const tx = xOf(deg);
      const major = deg % 15 === 0;
      plateLine(ctx,
        { x: tx, y: y - (major ? (compact ? 7 : 10) : (compact ? 4 : 6)) },
        { x: tx, y: y + (major ? (compact ? 7 : 10) : (compact ? 4 : 6)) }, {
        weight: major ? (compact ? 0.85 : 1) : (compact ? 0.5 : 0.6),
      });
      if (major) {
        plateDataText(ctx, `${deg}°`, tx, y + (compact ? 17 : 23), {
          size: compact ? 7.5 : 8.5,
          align: deg === 0 ? 'left' : deg === shown ? 'right' : 'center',
        });
      }
    }

    plateLine(ctx, { x, y: y - (compact ? 20 : 28) },
      { x, y: y + (compact ? 13 : 18) }, {
        weight: compact ? 1.6 : 1.9,
      });
    plateArrowhead(ctx, { x, y: y + (compact ? 13 : 18) }, Math.PI / 2,
      compact ? 3.5 : 4.5);
    const align = current < 8 ? 'left' : current > 52 ? 'right' : 'center';
    const textX = x + (align === 'left' ? 4 : align === 'right' ? -4 : 0);
    plateDataText(ctx, `z = ${fmtDM(current, 1)}`,
      textX, y - (compact ? 29 : 39), {
        size: compact ? 8.5 : 10.5,
        weight: 600,
        align,
      });

    plateText(ctx, 'LIVE CONVERSION',
      w / 2, top + contentH * 0.76, {
        size: compact ? 8.5 : 9.5,
        weight: 600,
        align: 'center',
      });
    plateDataText(ctx,
      `${fmtDM(current, 1)} = ${arcminutes.toFixed(1)}′`,
      w / 2, top + contentH * 0.86, {
        size: compact ? 8.5 : 10.5,
        align: 'center',
      });
    plateDataText(ctx,
      `≈ ${Math.round(arcminutes).toLocaleString('en-US')} nm`,
      w / 2, top + contentH * 0.95, {
        size: compact ? 8.5 : 10.5,
        weight: 600,
        align: 'center',
      });
  }
})();
