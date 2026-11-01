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
  const travel = addStat(d, 'GP moved west');
  const decStat = addStat(d, 'declination');

  SIGHT_STORY.subscribe(state => { sight = state; });

  function draw(ctx, w, h) {
    drawSiderealRatePlate(ctx, w, h);
    travel.set((hours.v * STELLAR_RATE).toFixed(1) + '°');
    decStat.set(fmtDM(Math.abs(sight.dec), 1) + (sight.dec < 0 ? ' S' : ' N'));
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

    const boxY = fieldTop + (compact ? 2 : 5);
    const boxH = compact ? 56 : 92;
    plateBox(ctx, rightX, boxY, rightW, [
      'EARTH TURNS EAST.',
      'THE POINT UNDER VEGA MOVES WEST.',
      'DECLINATION STAYS NEARLY FIXED.',
    ], {
      title: 'WHY THE GP MOVES',
      size: bodySize,
      lineHeight: compact ? 9.5 : 14,
      padding: compact ? 6 : 7,
      height: boxH,
    });

    const definitionY = boxY + boxH + (compact ? 8 : 19);
    plateDataText(ctx, compact ? 'GHA = the GP’s angle' :
      'GHA IS THE GP’S ANGLE WEST FROM GREENWICH',
    rightX + rightW / 2, definitionY, {
      size: bodySize, align: 'center',
    });
    if (compact) {
      plateDataText(ctx, 'west from Greenwich', rightX + rightW / 2,
        definitionY + 10, {
          size: bodySize, align: 'center',
        });
    } else {
      plateDataText(ctx, `GHA at sight  ${fmtDM(sight.gha, 1)}`,
        rightX + rightW / 2, definitionY + 30, {
          size: dataSize, align: 'center',
        });
      plateDataText(ctx, `GHA now  ${fmtDM(currentGha, 1)}`,
        rightX + rightW / 2, definitionY + 50, {
          size: dataSize, weight: 600, align: 'center',
        });
    }

    const scaleY = fieldBottom - (compact ? 12 : 25);
    plateText(ctx, compact ? 'ELAPSED TIME → WESTWARD MOVE' :
      'ELAPSED MEAN-SOLAR TIME → PRECISE WESTWARD MOVE',
    rightX + rightW / 2, scaleY - (compact ? 12 : 18), {
      size: bodySize, align: 'center',
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
      plateDataText(ctx, `${hour} h`, x, scaleY + (compact ? 9 : 13), {
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
    plateDataText(ctx, `${hours.v.toFixed(2)} h × ${STELLAR_RATE.toFixed(3)}°/h = ${moved.toFixed(2)}° west`,
      w / 2, ruleY + (compact ? 11 : 17), {
        size: dataSize, align: 'center',
      });
    plateDataText(ctx,
      `GHA ${fmtDM(sight.gha, 1)} + ${fmtDM(moved, 1)} = ${fmtDM(currentGha, 1)}`,
      w / 2, ruleY + (compact ? 27 : 36), {
        size: dataSize, align: 'center',
      });
  }
})();
