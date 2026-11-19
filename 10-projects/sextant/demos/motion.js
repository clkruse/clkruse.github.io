'use strict';
/* The inconvenient fact, anchored to the worked Vega sight: Earth turns
   under the nearly rigid star field, carrying Vega's GP west at the shared
   sidereal rate while its declination stays effectively fixed. */

(function demoMotion() {
  const d = createDemo('demo-motion', {
    aspect: 1.5,
    maxH: 510,
    draw,
  });

  let sight = SIGHT_STORY.state;
  const STELLAR_RATE = SIGHT_STORY.constants.stellarRate;
  const MAX_HOURS = 8;
  const hours = addSlider(d, {
    label: 'hours after the sight',
    min: 0,
    max: MAX_HOURS,
    step: 1 / 60,
    value: 0,
    fmt: v => {
      const hh = Math.floor(v);
      const mm = Math.round((v - hh) * 60);
      return `${hh}h ${String(mm).padStart(2, '0')}m`;
    },
  });

  SIGHT_STORY.subscribe(state => { sight = state; });

  function draw(ctx, w, h) {
    drawSiderealRatePlate(ctx, w, h);
  }

  // GHA runs 0–360° west of Greenwich; as a longitude it is west up to
  // 180° and east beyond
  const lonText = gha => gha <= 180
    ? `${fmtDM(gha, 1)} W`
    : `${fmtDM(360 - gha, 1)} E`;

  // largest nominal size (down to a floor) at which a line fits its column
  function fitSize(ctx, text, width, size, opts = {}) {
    let fitted = size;
    while (fitted > size * 0.72
      && plateTextWidth(ctx, text, { ...opts, size: fitted }) > width) fitted -= 0.25;
    return fitted;
  }

  function drawSiderealRatePlate(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500 || h < 330;
    const titleSize = compact ? 8.5 : 11;
    const bodySize = compact ? 8 : 9.2;
    const dataSize = compact ? 8 : 9;
    const fieldTop = compact ? 29 : 44;
    const ruleY = h - (compact ? 42 : 54);
    const fieldBottom = ruleY - (compact ? 5 : 9);
    const fieldH = fieldBottom - fieldTop;
    const cx = w * (compact ? 0.245 : 0.30);
    const cy = fieldTop + fieldH * (compact ? 0.49 : 0.54);
    const R = Math.max(25, Math.min(
      w * (compact ? 0.13 : 0.18),
      fieldH * (compact ? 0.31 : 0.37)
    ));
    const rightX = w * (compact ? 0.445 : 0.56);
    const rightW = w - rightX - (compact ? 7 : 14);
    const moved = Math.max(0, hours.v * STELLAR_RATE);
    const startA = -Math.PI / 2;
    const movedA = startA + moved * D2R;
    const wrap360 = value => ((value % 360) + 360) % 360;
    const currentGha = wrap360(sight.gha + moved);

    plateText(ctx, 'Vega’s GP moves west', w / 2,
      compact ? 11 : 15, {
        size: titleSize, weight: 600, tracking: titleSize * 0.12, align: 'center',
      });
    plateRule(ctx, compact ? 25 : 32, 14, w - 14);

    plateText(ctx, compact ? 'GP TRAVEL' : 'VEGA’S GP TRAVEL AROUND EARTH',
      cx, fieldTop + (compact ? 5 : 8), {
        size: bodySize, align: 'center', underline: !compact,
      });

    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.35 : 1.7;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    for (let degree = 0; degree < 360; degree += 15) {
      const a = startA + degree * D2R;
      const major = degree % 90 === 0;
      plateLine(ctx, {
        x: cx + Math.cos(a) * R * (major ? 0.80 : 0.91),
        y: cy + Math.sin(a) * R * (major ? 0.80 : 0.91),
      }, {
        x: cx + Math.cos(a) * R,
        y: cy + Math.sin(a) * R,
      }, { weight: major ? (compact ? 0.7 : 0.9) : 0.4 });
    }

    plateLine(ctx, { x: cx, y: cy }, {
      x: cx, y: cy - R,
    }, { kind: 'construction', weight: compact ? 0.55 : 0.7 });
    plateVector(ctx, { x: cx, y: cy }, {
      x: cx + Math.cos(movedA) * R * 0.88,
      y: cy + Math.sin(movedA) * R * 0.88,
    }, { kind: 'long', weight: compact ? 0.9 : 1.1, head: compact ? 3.1 : 4 });

    if (moved > 0.25) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 1.35 : 1.75;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.52, startA, movedA, false);
      ctx.stroke();
      ctx.restore();
      plateArrowhead(ctx, {
        x: cx + Math.cos(movedA) * R * 0.52,
        y: cy + Math.sin(movedA) * R * 0.52,
      }, movedA + Math.PI / 2, compact ? 3 : 3.8);
    }

    ctx.save();
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, compact ? 1.7 : 2.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.8 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy - R, compact ? 2.5 : 3.2, 0, TAU);
    ctx.stroke();
    ctx.restore();

    plateText(ctx, 'SIGHT', cx, cy - R - (compact ? 8 : 12), {
      size: bodySize, align: 'center',
    });
    const gpLabelY = cy + R + (compact ? 9 : 14);
    if (moved < 0.05) {
      plateText(ctx, 'GP AT SIGHT', cx, gpLabelY, {
        size: bodySize, align: 'center',
      });
    } else {
      const direct = 'GP NOW';
      const value = `+${moved.toFixed(1)}° west`;
      const directOpts = { size: bodySize };
      const valueOpts = {
        size: dataSize, font: PLATE.dataFont, tracking: 0, uppercase: false,
      };
      const gap = compact ? 3 : 4;
      const directW = plateTextWidth(ctx, direct, directOpts);
      const valueW = plateTextWidth(ctx, value, valueOpts);
      const labelX = cx - (directW + gap + valueW) / 2;
      plateText(ctx, direct, labelX, gpLabelY, directOpts);
      plateDataText(ctx, value, labelX + directW + gap, gpLabelY, {
        size: dataSize,
      });
    }

    // right column flows top to bottom so the larger plate text never
    // collides: why-box, the GP's latitude, then the elapsed-time scale
    const boxY = fieldTop + (compact ? 2 : 5);
    const why = compact
      ? ['EARTH TURNS EAST.', 'THE GP MOVES WEST.', 'ITS LATITUDE HOLDS.']
      : ['EARTH TURNS EAST.', 'THE POINT UNDER VEGA MOVES WEST.', 'ITS LATITUDE STAYS FIXED.'];
    const boxH = plateBox(ctx, rightX, boxY, rightW, why, {
      title: 'WHY THE GP MOVES',
      size: bodySize,
      lineHeight: compact ? 9.5 : 13,
      padding: compact ? 6 : 8,
    });

    const latLabel = 'LATITUDE OF THE GP';
    const latValue = `${fmtDM(Math.abs(sight.dec), 1)} ${sight.dec < 0 ? 'S' : 'N'}, unchanged`;
    const latY = boxY + boxH + (compact ? 13 : 22);
    plateText(ctx, latLabel, rightX, latY, { size: bodySize, weight: 600 });
    plateDataText(ctx, latValue, rightX, latY + (compact ? 12 : 17), {
      size: fitSize(ctx, latValue, rightW, dataSize, { font: PLATE.dataFont, tracking: 0, uppercase: false }),
    });

    const scaleY = fieldBottom - (compact ? 12 : 22);
    const scaleTitle = 'HOURS AFTER THE SIGHT';
    plateText(ctx, scaleTitle, rightX + rightW / 2, scaleY - (compact ? 16 : 20), {
      size: bodySize, weight: 600, align: 'center',
    });
    const scaleX0 = rightX + (compact ? 5 : 9);
    const scaleX1 = rightX + rightW - (compact ? 5 : 9);
    plateLine(ctx, { x: scaleX0, y: scaleY }, {
      x: scaleX1 - (compact ? 3 : 5), y: scaleY,
    }, {
      weight: compact ? 0.9 : 1.2,
    });
    plateArrowhead(ctx, { x: scaleX1, y: scaleY }, 0, compact ? 3 : 3.8);
    for (const hour of [0, 4, 8]) {
      const x = scaleX0 + (scaleX1 - scaleX0) * hour / MAX_HOURS;
      plateLine(ctx, { x, y: scaleY - (compact ? 3 : 5) },
        { x, y: scaleY + (compact ? 3 : 5) }, {
          weight: hour === 0 ? (compact ? 0.75 : 0.9) : 0.55,
        });
      // the 0 h label clears the heavy start tick
      plateDataText(ctx, `${hour} h`, x + (hour === 0 ? 3 : 0), scaleY + (compact ? 10 : 14), {
        size: dataSize,
        align: hour === 0 ? 'left' : hour === 8 ? 'right' : 'center',
      });
    }
    const markerX = scaleX0 + (scaleX1 - scaleX0) * hours.v / MAX_HOURS;
    plateLine(ctx, { x: markerX, y: scaleY - (compact ? 6 : 8) },
      { x: markerX, y: scaleY + (compact ? 6 : 8) }, {
        weight: compact ? 1.4 : 1.8,
      });

    plateRule(ctx, ruleY, 14, w - 14);
    const rateLine = `${hours.v.toFixed(2)} h × ${STELLAR_RATE.toFixed(3)}°/h = ${moved.toFixed(2)}° west`;
    const lonLine = `GP longitude ${lonText(sight.gha)} → ${lonText(currentGha)}`;
    const dataOpts = { font: PLATE.dataFont, tracking: 0, uppercase: false };
    plateDataText(ctx, rateLine, w / 2, ruleY + (compact ? 11 : 17), {
      size: fitSize(ctx, rateLine, w - 28, dataSize, dataOpts), align: 'center',
    });
    plateDataText(ctx, lonLine, w / 2, ruleY + (compact ? 27 : 36), {
      size: fitSize(ctx, lonLine, w - 28, dataSize, dataOpts), align: 'center',
    });
  }
})();
