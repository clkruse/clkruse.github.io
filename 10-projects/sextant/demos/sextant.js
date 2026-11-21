'use strict';
/* §04b: the sextant, rays traced through both mirrors (plate treatment). */

(function demoSextant() {
  const d = createDemo('demo-sextant', {
    aspect: 1,
    maxH: 420,
    draw,
  });
  const CONTACT_TOLERANCE_DEG = 0.05;
  // The optics are solved in unit instrument space, then scaled uniformly onto
  // the responsive canvas. Neither the mirror hit nor the image state depends
  // on CSS pixels.
  const EXPLODED_HORIZON_DIRECTION = Object.freeze(norm({ x: -0.758, y: 0.652 }));
  const EXPLODED_MIRROR_HALF = 0.15; // fraction of index-to-horizon distance
  let vegaAlt = SIGHT_STORY.state.hs;
  // Start about ten arcminutes off contact: enough to invite adjustment,
  // close enough that Vega remains visible.
  let arm = Math.round(((vegaAlt - 0.2) / 2) * 10) / 10;
  const armSlider = addSlider(d, {
    label: 'index arm', min: 0, max: 60, step: 0.1, value: arm,
    fmt: v => v.toFixed(1) + '°',
    onchange: v => { arm = v; },
  });
  const vegaSlider = addSlider(d, {
    label: 'Vega altitude', min: 10, max: 70, step: 1 / 600, value: vegaAlt,
    fmt: v => fmtDM(v, 1),
    onchange: v => { vegaAlt = v; },
  });
  const status = addStat(d, 'in the telescope', true);
  SIGHT_STORY.subscribe(s => {
    vegaAlt = s.hs;
    vegaSlider.set(s.hs, { emit: false });
  });

  d.canvas.classList.add('grab');
  let geo = null;
  addDrag(d.canvas, {
    move(p) {
      if (!geo) return;
      const a = Math.atan2(p.y - geo.P.y, p.x - geo.P.x) * R2D;
      arm = clamp(a - geo.A0, 0, 60);
      armSlider.set(arm);
    },
  });

  function draw(ctx, w, h) {
    drawExploded(ctx, w, h);
  }

  // Both states of the light-route note share one width, so the box does
  // not change size when the light starts or stops reaching the mirror.
  const ROUTE_NOTES = {
    meet: {
      title: { compact: 'Light routes', wide: 'Why they meet' },
      lines: ['Vega reflects twice', 'Horizon passes through', 'Arm lines them up'],
    },
    miss: {
      title: { compact: 'No Vega image', wide: 'No Vega image' },
      lines: ['Vega reflects once', 'Misses second mirror', 'Move arm toward contact'],
    },
  };

  // width a plateBox needs for its title and lines, measured the way
  // plateBox draws them, so the box follows the font instead of a guess
  function boxContentWidth(ctx, title, lines, size) {
    let width = plateTextWidth(ctx, title, { size, weight: 600, tracking: size * 0.09 });
    for (const text of lines) {
      width = Math.max(width, plateTextWidth(ctx, text, {
        size,
        tracking: size * 0.055,
        uppercase: PLATE.font === PLATE.dataFont ? false : undefined,
      }));
    }
    return Math.ceil(width);
  }

  function solveOpticalState(towardHorizon) {
    const sight = { x: 1, y: 0 };
    const indexNormal0 = norm({
      x: towardHorizon.x - sight.x,
      y: towardHorizon.y - sight.y,
    });
    const indexNormal = rot(indexNormal0, arm * D2R);
    const incoming = {
      x: Math.cos(vegaAlt * D2R),
      y: Math.sin(vegaAlt * D2R),
    };
    const afterIndex = reflect(incoming, indexNormal);
    const horizonNormal = norm({
      x: sight.x - towardHorizon.x,
      y: sight.y - towardHorizon.y,
    });
    const denom = afterIndex.x * horizonNormal.x + afterIndex.y * horizonNormal.y;
    const tHit = Math.abs(denom) < 1e-8 ? Infinity
      : (towardHorizon.x * horizonNormal.x
        + towardHorizon.y * horizonNormal.y) / denom;
    const hit = tHit > 0 && isFinite(tHit)
      ? {
        x: afterIndex.x * tHit,
        y: afterIndex.y * tHit,
      }
      : null;
    return {
      towardHorizon,
      indexNormal,
      incoming,
      afterIndex,
      horizonNormal,
      afterHorizon: hit ? reflect(afterIndex, horizonNormal) : null,
      hit,
      error: 2 * arm - vegaAlt,
    };
  }

  function projectOpticalState(model, index, scale) {
    return {
      ...model,
      hit: model.hit
        ? {
          x: index.x + model.hit.x * scale,
          y: index.y + model.hit.y * scale,
        }
        : null,
    };
  }

  function explodedOpticalState(index, scale) {
    const model = solveOpticalState(EXPLODED_HORIZON_DIRECTION);
    const reachesMirror = Boolean(model.hit)
      && Math.hypot(
        model.hit.x - EXPLODED_HORIZON_DIRECTION.x,
        model.hit.y - EXPLODED_HORIZON_DIRECTION.y
      ) <= EXPLODED_MIRROR_HALF;
    return {
      ...projectOpticalState(model, index, scale),
      reachesMirror,
    };
  }

  function setOpticalStatus(error, reachesMirror) {
    if (Math.abs(error) < CONTACT_TOLERANCE_DEG) {
      status.set('✓ Vega sits on the horizon: altitude ' + fmtDM(2 * arm, 1), P.good);
    } else if (reachesMirror) {
      status.set('image ' + fmtDM(Math.abs(error), 1)
        + (error < 0 ? ' above' : ' below') + ' the horizon');
    } else {
      status.set('the light misses the horizon mirror; swing the arm toward '
        + fmtDM(vegaAlt / 2, 1), P.inkFaint);
    }
  }

  function drawExploded(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const titleBottom = compact ? 28 : 32;
    const ruleY = h - (compact ? 30 : 40);
    const instrumentBottom = compact ? Math.min(titleBottom + 131, ruleY - 82) : ruleY - 5;

    // The two notes are sized from their measured words. On the desktop
    // plate they share a right-hand column, which widens (and the
    // instrument gives way) only when the words need it.
    const noteSize = compact ? 8 : 9;
    const notePad = compact ? 5 : 8;
    const routeWidth = Math.max(...Object.values(ROUTE_NOTES).map(note =>
      boxContentWidth(ctx, note.title[compact ? 'compact' : 'wide'], note.lines, noteSize)))
      + notePad * 2;
    const faceTitle = compact ? 'Mirror face' : 'Horizon mirror';
    const faceTitleSize = compact ? 8 : 9;
    const faceLabelSize = compact ? 7.5 : 8;
    const faceInset = compact ? 8 : 14;
    const halfLabelWidth = Math.max(
      plateTextWidth(ctx, 'Silvered', { size: faceLabelSize }),
      plateTextWidth(ctx, 'Clear', { size: faceLabelSize })
    );
    const faceKeyLines = compact ? [] : ['Vega → silvered', 'Horizon → clear'];
    const faceWidth = Math.ceil(Math.max(
      plateTextWidth(ctx, faceTitle, { size: faceTitleSize }) + notePad * 2,
      ...faceKeyLines.map(text => plateTextWidth(ctx, text, { size: faceLabelSize }) + notePad * 2),
      (halfLabelWidth + (compact ? 6 : 8)) * 2 + faceInset * 2
    ));
    const columnWidth = compact ? 0
      : Math.max(w * 0.27 - 22, routeWidth, faceWidth);
    const splitX = compact ? w : Math.min(w * 0.73, w - 14 - columnWidth - 8);
    const index = {
      x: w * (compact ? 0.61 : 0.53),
      y: compact ? titleBottom + 36 : titleBottom + (ruleY - titleBottom) * 0.21,
    };
    const opticalScale = compact
      ? Math.min(w * 0.39, instrumentBottom - index.y + 14)
      : Math.min(w * 0.33, (ruleY - titleBottom) * 0.62);
    const horizon = {
      x: index.x + EXPLODED_HORIZON_DIRECTION.x * opticalScale,
      y: index.y + EXPLODED_HORIZON_DIRECTION.y * opticalScale,
    };
    const eyeX = compact ? w - 7 : splitX - 7;
    const mirrorHalf = opticalScale * EXPLODED_MIRROR_HALF;
    const state = explodedOpticalState(index, opticalScale);
    const reachesMirror = state.reachesMirror;
    const imageResult = Math.abs(state.error) < CONTACT_TOLERANCE_DEG
      ? 'contact'
      : (reachesMirror ? 'double-reflection' : 'miss');
    d.canvas.dataset.reachesMirror = String(reachesMirror);
    d.canvas.dataset.imageResult = imageResult;
    d.canvas.dataset.opticalErrorDegrees = state.error.toFixed(4);
    const A0 = 78;
    geo = { P: index, A0 };

    plateText(ctx, 'Light through a sextant', w / 2, titleBottom / 2, {
      size: compact ? 9.5 : 11,
      weight: 600,
      tracking: compact ? 1.15 : 1.45,
      align: 'center',
    });
    plateRule(ctx, titleBottom, 14, w - 14);

    const drawPlateMirror = (point, normal, half, halfSilvered = false) => {
      const along = rot(normal, Math.PI / 2);
      const a = { x: point.x - along.x * half, y: point.y - along.y * half };
      const b = { x: point.x + along.x * half, y: point.y + along.y * half };
      // Edge-on, a half-silvered plate is still one optical plane. The face
      // inset, not a split edge line, identifies its clear and silver regions.
      plateLine(ctx, a, b, { weight: compact ? 1.6 : 2 });
      if (halfSilvered) return { a, b };
      const hatchNormal = norm({ x: -normal.x + along.x, y: -normal.y + along.y });
      const start = -half + 4;
      const finish = half - 3;
      for (let distance = start; distance <= finish; distance += compact ? 5 : 6) {
        const p = {
          x: point.x + along.x * distance,
          y: point.y + along.y * distance,
        };
        plateLine(ctx, p, {
          x: p.x + hatchNormal.x * (compact ? 4 : 5),
          y: p.y + hatchNormal.y * (compact ? 4 : 5),
        }, { weight: 0.45 });
      }
      return { a, b };
    };

    const toInstrumentEdge = (point, direction, pad = 5) => {
      const distances = [];
      if (direction.x > 1e-8) {
        distances.push((splitX - pad - point.x) / direction.x);
      } else if (direction.x < -1e-8) {
        distances.push((pad - point.x) / direction.x);
      }
      if (direction.y > 1e-8) {
        distances.push((instrumentBottom - pad - point.y) / direction.y);
      } else if (direction.y < -1e-8) {
        distances.push((titleBottom + pad - point.y) / direction.y);
      }
      const distance = Math.min(...distances.filter(value => value >= 0 && isFinite(value)));
      return {
        x: point.x + direction.x * distance,
        y: point.y + direction.y * distance,
      };
    };
    const source = toInstrumentEdge(index, {
      x: -state.incoming.x,
      y: -state.incoming.y,
    }, compact ? 5 : 8);
    const directStart = { x: compact ? 9 : 16, y: horizon.y };
    const directEnd = { x: eyeX - (compact ? 7 : 10), y: horizon.y };
    const scopeStart = compact ? w * 0.71 : splitX - w * 0.16;
    const scopeHeight = compact ? 9 : 13;

    // Keep the ray trace attached to a recognizable sextant. The fixed frame
    // is a 60° sector centered on the index-mirror pivot; the moving index arm
    // reaches the engraved arc, whose numbers report twice the arm angle.
    const frameA0 = A0 * D2R;
    const frameA1 = (A0 + 60) * D2R;
    const frameR = Math.min(
      (ruleY - titleBottom) * (compact ? 0.43 : 0.59),
      w * (compact ? 0.35 : 0.32),
      instrumentBottom - index.y - (compact ? 3 : 12)
    );
    const frameBand = compact ? 5 : 8;
    const frameInnerR = frameR - frameBand;
    const pointOnFrame = (angle, radius = frameR) => ({
      x: index.x + Math.cos(angle) * radius,
      y: index.y + Math.sin(angle) * radius,
    });
    const drawOutlinedBar = (from, to, halfWidth) => {
      const direction = norm({ x: to.x - from.x, y: to.y - from.y });
      const perpendicular = { x: -direction.y * halfWidth, y: direction.x * halfWidth };
      ctx.save();
      ctx.fillStyle = PLATE.paper;
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.8 : 1.05;
      ctx.beginPath();
      ctx.moveTo(from.x + perpendicular.x, from.y + perpendicular.y);
      ctx.lineTo(to.x + perpendicular.x, to.y + perpendicular.y);
      ctx.lineTo(to.x - perpendicular.x, to.y - perpendicular.y);
      ctx.lineTo(from.x - perpendicular.x, from.y - perpendicular.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // Solid parts of the instrument, kept as small boxes so the callouts
    // below can step around them instead of knocking them out.
    const solidParts = [];
    const sampleBar = (list, from, to, halfWidth) => {
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(length / 5));
      for (let i = 0; i <= steps; i++) {
        list.push({
          x: from.x + (to.x - from.x) * i / steps - halfWidth,
          y: from.y + (to.y - from.y) * i / steps - halfWidth,
          w: halfWidth * 2,
          h: halfWidth * 2,
        });
      }
    };
    const reserveBar = (from, to, halfWidth) => sampleBar(solidParts, from, to, halfWidth);
    drawOutlinedBar(index, pointOnFrame(frameA0, frameInnerR), compact ? 2.2 : 3.2);
    reserveBar(index, pointOnFrame(frameA0, frameInnerR), compact ? 2.2 : 3.2);
    for (let value = 0; value < 60; value += 2.5) {
      reserveBar(pointOnFrame((A0 + value) * D2R, frameR - frameBand / 2),
        pointOnFrame((A0 + value + 2.5) * D2R, frameR - frameBand / 2), frameBand / 2 + 1);
    }
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.9 : 1.2;
    ctx.beginPath();
    ctx.arc(index.x, index.y, frameR, frameA0, frameA1);
    ctx.arc(index.x, index.y, frameInnerR, frameA1, frameA0, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = compact ? 1.35 : 1.8;
    ctx.beginPath();
    ctx.arc(index.x, index.y, frameR, frameA0, frameA1);
    ctx.stroke();
    ctx.restore();

    // Scale numbers must clear the fixed parts that reach past the limb:
    // the horizon mirror, its mount and the direct horizon line. All three
    // are fixed in the frame, so the search below gives the same seat on
    // every frame.
    const mirrorAlong = rot(state.horizonNormal, Math.PI / 2);
    const scaleObstacles = [
      [
        { x: horizon.x - mirrorAlong.x * mirrorHalf, y: horizon.y - mirrorAlong.y * mirrorHalf },
        { x: horizon.x + mirrorAlong.x * mirrorHalf, y: horizon.y + mirrorAlong.y * mirrorHalf },
      ],
      [index, horizon],
      [directStart, directEnd],
    ];
    const rectClear = (rect, margin, segments = scaleObstacles) => segments.every(([a, b]) => {
      const steps = Math.max(8, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
      for (let i = 0; i <= steps; i++) {
        const x = a.x + (b.x - a.x) * i / steps;
        const y = a.y + (b.y - a.y) * i / steps;
        if (x > rect.x - margin && x < rect.x + rect.w + margin
          && y > rect.y - margin && y < rect.y + rect.h + margin) return false;
      }
      return true;
    });
    // A stray ray (the miss, or the second route far from contact) can pass
    // over the scale outside the limb; a number it would cross is left out
    // for that state rather than struck through.
    const reach = w * 2;
    const strayRays = [];
    if (!reachesMirror) {
      strayRays.push([index, {
        x: index.x + state.afterIndex.x * reach,
        y: index.y + state.afterIndex.y * reach,
      }]);
    } else if (imageResult !== 'contact') {
      strayRays.push([state.hit, {
        x: state.hit.x + state.afterHorizon.x * reach,
        y: state.hit.y + state.afterHorizon.y * reach,
      }]);
    }
    for (let value = 0; value <= 60; value += 5) {
      const angle = (A0 + value) * D2R;
      const major = value % 15 === 0;
      plateLine(ctx, pointOnFrame(angle, frameR - (major ? frameBand + 3 : frameBand)),
        pointOnFrame(angle, frameR), {
          weight: major ? (compact ? 0.7 : 0.9) : 0.45,
        });
      // The scale numbers sit outside the limb, where no ray or bar can
      // cross them; the distance follows the measured text box.
      if (major && ((!compact && value % 30 === 0) || (compact && value === 60))) {
        const text = `${2 * value}°`;
        const size = compact ? 7.5 : 8;
        const textW = plateTextWidth(ctx, text, {
          size, font: PLATE.dataFont, tracking: 0, uppercase: false,
        });
        const textH = size * PLATE_TEXT_SCALE;
        // Start beside the tick; slide toward the middle of the scale, one
        // degree at a time, until the number clears the fixed parts.
        const inward = value < 30 ? 1 : -1;
        let numberPoint = null;
        for (let slide = 0; slide <= 20 && !numberPoint; slide++) {
          const at = angle + inward * slide * D2R;
          const radial = Math.abs(Math.cos(at)) * textW / 2
            + Math.abs(Math.sin(at)) * textH / 2;
          const p = pointOnFrame(at, frameR + (compact ? 5 : 7) + radial);
          const rect = { x: p.x - textW / 2, y: p.y - textH / 2, w: textW, h: textH };
          if (rectClear(rect, compact ? 4 : 6) || slide === 20) numberPoint = p;
        }
        const numberRect = {
          x: numberPoint.x - textW / 2, y: numberPoint.y - textH / 2, w: textW, h: textH,
        };
        if (!rectClear(numberRect, 2, strayRays)) continue;
        solidParts.push({
          x: numberPoint.x - textW / 2, y: numberPoint.y - textH / 2, w: textW, h: textH,
        });
        plateDataText(ctx, text, numberPoint.x, numberPoint.y, {
          size,
          align: 'center',
        });
      }
    }

    const horizonMountAngle = Math.atan2(horizon.y - index.y, horizon.x - index.x);
    drawOutlinedBar(pointOnFrame(horizonMountAngle, frameInnerR), horizon,
      compact ? 2 : 3);
    reserveBar(pointOnFrame(horizonMountAngle, frameInnerR), horizon, compact ? 2 : 3);
    const scopeMount = {
      x: scopeStart - (compact ? 3 : 5),
      y: horizon.y + scopeHeight * 0.55,
    };
    drawOutlinedBar(pointOnFrame((A0 + 8) * D2R, frameInnerR), scopeMount, compact ? 1.5 : 2.2);
    reserveBar(pointOnFrame((A0 + 8) * D2R, frameInnerR), scopeMount, compact ? 1.5 : 2.2);

    const armA = (A0 + arm) * D2R;
    const handleEnd = pointOnFrame(armA, frameInnerR + frameBand * 0.45);
    reserveBar(index, handleEnd, compact ? 2.5 : 3.5);
    const armPerp = {
      x: -Math.sin(armA) * (compact ? 2 : 2.8),
      y: Math.cos(armA) * (compact ? 2 : 2.8),
    };
    plateLine(ctx,
      { x: index.x + armPerp.x, y: index.y + armPerp.y },
      { x: handleEnd.x + armPerp.x, y: handleEnd.y + armPerp.y },
      { weight: compact ? 0.9 : 1.15 });
    plateLine(ctx,
      { x: index.x - armPerp.x, y: index.y - armPerp.y },
      { x: handleEnd.x - armPerp.x, y: handleEnd.y - armPerp.y },
      { weight: compact ? 0.9 : 1.15 });
    plateLine(ctx, pointOnFrame(armA, frameInnerR - 4),
      pointOnFrame(armA, frameR + (compact ? 2 : 3)), {
        weight: compact ? 1.3 : 1.7,
      });
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.8 : 1.05;
    ctx.beginPath();
    ctx.arc(handleEnd.x, handleEnd.y, compact ? 2.8 : 4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    plateVector(ctx, directStart, directEnd, {
      kind: 'long', weight: compact ? 0.8 : 1, head: compact ? 3.2 : 4,
    });
    plateVector(ctx, {
      x: source.x + state.incoming.x * (compact ? 8 : 13),
      y: source.y + state.incoming.y * (compact ? 8 : 13),
    }, {
      x: index.x - state.incoming.x * 4,
      y: index.y - state.incoming.y * 4,
    }, {
      kind: 'long', weight: compact ? 0.9 : 1.05, head: compact ? 3.2 : 4,
    });

    let opticalEnd = null;
    let outgoingVisible = false;
    if (reachesMirror) {
      const hit = state.hit;
      plateVector(ctx, index, {
        x: hit.x - state.afterIndex.x * 4,
        y: hit.y - state.afterIndex.y * 4,
      }, {
        kind: 'long', weight: compact ? 0.9 : 1.05, head: compact ? 3.2 : 4,
      });
      opticalEnd = state.afterHorizon.x > 0.15
        ? {
          x: eyeX - (compact ? 7 : 10),
          y: hit.y + state.afterHorizon.y
            * ((eyeX - (compact ? 7 : 10) - hit.x) / state.afterHorizon.x),
        }
        : toInstrumentEdge(hit, state.afterHorizon, compact ? 5 : 8);
      // Coincidence is an angle-space result, not a pixel-space threshold.
      // Every non-contact state draws the second route at every viewport.
      outgoingVisible = imageResult !== 'contact';
      if (outgoingVisible) {
        plateVector(ctx, hit, opticalEnd, {
          kind: 'long', weight: compact ? 0.9 : 1.05, head: compact ? 3.2 : 4,
        });
      }
    } else {
      opticalEnd = toInstrumentEdge(index, state.afterIndex, compact ? 5 : 8);
      const opticsTop = titleBottom + 4;
      if (opticalEnd.y < opticsTop) {
        const t = (opticsTop - index.y) / (opticalEnd.y - index.y);
        opticalEnd = {
          x: index.x + (opticalEnd.x - index.x) * t,
          y: opticsTop,
        };
      }
      if (opticalEnd.y > instrumentBottom - 4) {
        const t = (instrumentBottom - 4 - index.y) / (opticalEnd.y - index.y);
        opticalEnd = {
          x: index.x + (opticalEnd.x - index.x) * t,
          y: instrumentBottom - 4,
        };
      }
      plateVector(ctx, index, opticalEnd, {
        kind: 'long', weight: compact ? 0.9 : 1.05, head: compact ? 3.2 : 4,
      });
    }
    // Rays, as thin boxes, for the part labels (mirrors, arm), which belong
    // to no ray and must not sit on one.
    const rayParts = [];
    sampleBar(rayParts, source, index, 1);
    sampleBar(rayParts, directStart, directEnd, 1);
    if (reachesMirror) {
      sampleBar(rayParts, index, state.hit, 1);
      if (outgoingVisible) sampleBar(rayParts, state.hit, opticalEnd, 1);
    } else {
      sampleBar(rayParts, index, opticalEnd, 1);
    }

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.7 : 0.9;
    const starR = compact ? 5 : 7;
    ctx.beginPath();
    ctx.moveTo(source.x - starR, source.y);
    ctx.lineTo(source.x + starR, source.y);
    ctx.moveTo(source.x, source.y - starR);
    ctx.lineTo(source.x, source.y + starR);
    ctx.moveTo(source.x - starR * 0.55, source.y - starR * 0.55);
    ctx.lineTo(source.x + starR * 0.55, source.y + starR * 0.55);
    ctx.moveTo(source.x + starR * 0.55, source.y - starR * 0.55);
    ctx.lineTo(source.x - starR * 0.55, source.y + starR * 0.55);
    ctx.stroke();
    ctx.restore();

    const indexEnds = drawPlateMirror(index, state.indexNormal, mirrorHalf);
    const horizonEnds = drawPlateMirror(horizon, state.horizonNormal, mirrorHalf, true);
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath(); ctx.arc(index.x, index.y, compact ? 2.1 : 2.7, 0, TAU); ctx.fill();

    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.2 : 1.6;
    ctx.strokeRect(scopeStart, horizon.y - scopeHeight / 2,
      eyeX - scopeStart, scopeHeight);
    ctx.strokeRect(scopeStart - (compact ? 5 : 7), horizon.y - scopeHeight * 0.33,
      compact ? 6 : 8, scopeHeight * 0.66);
    plateLine(ctx, { x: scopeStart, y: horizon.y }, {
      x: eyeX + 4, y: horizon.y,
    }, { kind: 'construction', weight: 0.55 });

    // Edge view cannot show which half is silvered, so the face key earns a
    // separate register. Its hatching describes the surface without color.
    const cardsY = compact
      ? instrumentBottom + 10
      : titleBottom + (ruleY - titleBottom - 220) / 2;
    const faceBox = compact
      ? { x: 10, y: cardsY, w: Math.max(Math.min(102, w * 0.36), faceWidth), h: 72 }
      : { x: splitX + 8, y: cardsY, w: w - splitX - 22, h: 118 };
    const causalBox = compact
      ? {
        x: faceBox.x + faceBox.w + 7,
        y: cardsY,
        w: w - faceBox.x - faceBox.w - 17,
        h: 72,
      }
      : {
        x: faceBox.x,
        y: cardsY + 128,
        w: faceBox.w,
        h: 92,
      };
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.8;
    ctx.fillRect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
    ctx.strokeRect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
    ctx.restore();
    plateText(ctx, faceTitle,
      faceBox.x + faceBox.w / 2, faceBox.y + (compact ? 9 : 12), {
        size: faceTitleSize,
        align: 'center',
      });
    const face = {
      x: faceBox.x + faceInset,
      y: faceBox.y + (compact ? 23 : 32),
      w: faceBox.w - faceInset * 2,
      h: compact ? 17 : 28,
    };
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.7 : 0.9;
    ctx.fillRect(face.x, face.y, face.w, face.h);
    ctx.strokeRect(face.x, face.y, face.w, face.h);
    ctx.beginPath();
    ctx.rect(face.x, face.y, face.w / 2, face.h);
    ctx.clip();
    ctx.beginPath();
    for (let offset = -face.h; offset < face.w / 2 + face.h; offset += 6) {
      ctx.moveTo(face.x + offset, face.y + face.h);
      ctx.lineTo(face.x + offset + face.h, face.y);
    }
    ctx.stroke();
    ctx.restore();
    plateLine(ctx, {
      x: face.x + face.w / 2,
      y: face.y,
    }, {
      x: face.x + face.w / 2,
      y: face.y + face.h,
    }, { weight: 0.55 });
    plateText(ctx, 'Silvered', face.x + face.w * 0.25,
      faceBox.y + (compact ? 52 : 69), {
        size: faceLabelSize,
        align: 'center',
      });
    plateText(ctx, 'Clear', face.x + face.w * 0.75,
      faceBox.y + (compact ? 52 : 69), {
        size: faceLabelSize,
        align: 'center',
      });
    faceKeyLines.forEach((text, row) => {
      plateText(ctx, text, faceBox.x + faceBox.w / 2, faceBox.y + 89 + row * 15, {
        size: faceLabelSize,
        align: 'center',
      });
    });
    const routeNote = ROUTE_NOTES[reachesMirror ? 'meet' : 'miss'];
    plateBox(ctx, causalBox.x, causalBox.y, causalBox.w, routeNote.lines, {
      title: routeNote.title[compact ? 'compact' : 'wide'],
      size: noteSize,
      lineHeight: compact ? 11 : 16,
      padding: notePad,
      height: causalBox.h,
    });

    // Two passes share one seat memory. Part labels first, kept off the
    // rays; then the ray labels, which sit beside their own ray's end.
    const labelBounds = {
      left: compact ? 7 : 10,
      top: titleBottom + 2,
      right: compact ? w - 7 : splitX - 4,
      bottom: instrumentBottom,
      gap: compact ? 2 : 4,
    };
    const parts = createPlateLabeler(ctx, labelBounds);
    solidParts.concat(rayParts).forEach(rect => parts.reserve(rect, 0));
    const placedParts = [];
    const placePart = (...args) => {
      const placed = parts.place(...args);
      if (placed) placedParts.push(placed.rect);
    };
    const typeSize = compact ? 8 : 9;

    if (!compact) {
      placePart('INDEX MIRROR', indexEnds.b, [
        { x: index.x + 63, y: index.y - 27, align: 'left' },
        { x: index.x + 63, y: index.y + 21, align: 'left' },
        { x: index.x - 58, y: index.y - 27, align: 'right' },
      ], {
        size: typeSize,
      });
      placePart('HORIZON MIRROR', horizonEnds.a, [
        { x: horizon.x - 32, y: horizon.y + 40, align: 'right' },
        { x: horizon.x + 28, y: horizon.y + 42, align: 'left' },
        { x: horizon.x - 24, y: horizon.y - 31, align: 'right' },
      ], {
        size: typeSize,
      });
      const armMid = pointOnFrame(armA, frameInnerR * 0.58);
      const armPointsLeft = armMid.x < index.x;
      // Seats along the arm on both sides, so the label can step past a
      // ray or bar instead of sitting on it.
      const armSeats = [];
      for (const along of [0.58, 0.4, 0.75]) {
        const p = pointOnFrame(armA, frameInnerR * along);
        armSeats.push(
          {
            x: p.x + (armPointsLeft ? -17 : 17),
            y: p.y - 8,
            align: armPointsLeft ? 'right' : 'left',
          },
          {
            x: p.x + (armPointsLeft ? 17 : -17),
            y: p.y + 18,
            align: armPointsLeft ? 'left' : 'right',
          },
          {
            x: p.x + (armPointsLeft ? 17 : -17),
            y: p.y - 8,
            align: armPointsLeft ? 'left' : 'right',
          },
          {
            x: p.x + (armPointsLeft ? -17 : 17),
            y: p.y + 18,
            align: armPointsLeft ? 'right' : 'left',
          },
        );
      }
      placePart('INDEX ARM – DRAG', armMid, armSeats, {
        size: typeSize,
      });
    } else {
      placePart('INDEX MIRROR', index, [
        { x: index.x + 9, y: index.y - 9, align: 'left' },
        { x: index.x + 10, y: index.y + 12, align: 'left' },
      ], {
        size: 8,
      });
      placePart('HORIZON MIRROR', horizon, [
        { x: horizon.x - 9, y: horizon.y + 10, align: 'right' },
        { x: horizon.x + 10, y: horizon.y + 13, align: 'left' },
      ], {
        size: 8,
      });
    }

    const callouts = createPlateLabeler(ctx, labelBounds);
    solidParts.forEach(rect => callouts.reserve(rect, 0));
    placedParts.forEach(rect => callouts.reserve(rect));
    // the first reflection is no ray label's own, so keep them off it
    if (reachesMirror) {
      const firstLeg = [];
      sampleBar(firstLeg, index, state.hit, 1);
      firstLeg.forEach(rect => callouts.reserve(rect, 0));
    }
    callouts.place(compact ? 'VEGA' : 'VEGA LIGHT', source, [
      { x: source.x + 10, y: source.y + 12, align: 'left' },
      { x: source.x - 10, y: source.y + 12, align: 'right' },
      { x: index.x + 17, y: titleBottom + 10, align: 'left' },
    ], {
      size: typeSize,
      leader: false,
    });
    callouts.place(compact ? 'HORIZON' : 'HORIZON LIGHT', directStart, [
      { x: directStart.x, y: horizon.y + (compact ? 11 : 15), align: 'left' },
      { x: directStart.x, y: horizon.y - (compact ? 11 : 15), align: 'left' },
    ], {
      size: typeSize,
      leader: false,
    });
    // The space between the fixed frame bar and the eyepiece is short, so
    // the label names the destination in two words and keeps them in every
    // state; the summary line and the note report contact.
    callouts.place('TO EYE',
      directEnd, [
      { x: eyeX - 2, y: horizon.y + (compact ? 11 : 15), align: 'right' },
      { x: eyeX - 2, y: horizon.y - (compact ? 11 : 15), align: 'right' },
    ], {
      size: compact ? 7.5 : typeSize,
      leader: false,
    });
    // Seats along a ray, beside it: above and below when the ray is
    // shallow, left and right when it is steep.
    const seatsAlongRay = (from, to, text, size, fractions) => {
      const halfWidth = plateTextWidth(ctx, text, { size }) / 2;
      const slope = Math.abs((to.y - from.y) / ((to.x - from.x) || 1e-6));
      const clearance = compact ? 10 : 13;
      return fractions.flatMap(along => {
        const p = {
          x: from.x + (to.x - from.x) * along,
          y: from.y + (to.y - from.y) * along,
        };
        if (slope < 1) {
          const lift = clearance + slope * halfWidth;
          return [
            { x: p.x, y: p.y - lift, align: 'center' },
            { x: p.x, y: p.y + lift, align: 'center' },
          ];
        }
        const side = 6 + clearance / slope;
        return [
          { x: p.x + side, y: p.y, align: 'left' },
          { x: p.x - side, y: p.y, align: 'right' },
        ];
      });
    };
    if (outgoingVisible) {
      callouts.place('Reflected light', opticalEnd, [
        {
          x: opticalEnd.x - 5,
          y: opticalEnd.y - (compact ? 10 : 13),
          align: 'right',
        },
        {
          x: opticalEnd.x + 5,
          y: opticalEnd.y + (compact ? 10 : 13),
          align: 'left',
        },
        // further back along the ray, clear of the frame bars near the eye
        ...seatsAlongRay(state.hit, opticalEnd, 'Reflected light',
          compact ? 7.5 : 8, [0.7, 0.55, 0.4, 0.25]),
      ], {
        size: compact ? 7.5 : 8,
        leader: false,
        fallback: 'hide',
      });
    } else if (!reachesMirror) {
      const exitsAbove = opticalEnd.y < index.y;
      callouts.place('Misses horizon mirror', opticalEnd, [
        {
          x: opticalEnd.x + (opticalEnd.x < index.x ? -5 : 5),
          y: opticalEnd.y + (exitsAbove ? (compact ? 10 : 13) : -(compact ? 10 : 13)),
          align: opticalEnd.x < index.x ? 'right' : 'left',
        },
        {
          x: opticalEnd.x + (opticalEnd.x < index.x ? 5 : -5),
          y: opticalEnd.y + (exitsAbove ? (compact ? 18 : 22) : -(compact ? 18 : 22)),
          align: opticalEnd.x < index.x ? 'left' : 'right',
        },
        ...seatsAlongRay(index, opticalEnd, 'Misses horizon mirror',
          compact ? 7.5 : 8, [0.8, 0.65, 0.5]),
      ], {
        size: compact ? 7.5 : 8,
        leader: false,
        backed: true,
        // the note box says the same thing, so a crowded state drops it
        fallback: 'hide',
      });
    }

    plateRule(ctx, ruleY, 14, w - 14);
    const pathSummary = imageResult === 'contact'
      ? `Arc ${fmtDM(2 * arm, 1)} · Vega and horizon coincide`
      : reachesMirror
        ? `Arc ${fmtDM(2 * arm, 1)} · image ${fmtDM(Math.abs(state.error), 1)} ${state.error < 0 ? 'above' : 'below'} horizon`
        : `Arc ${fmtDM(2 * arm, 1)} · first reflection misses horizon mirror`;
    plateDataText(ctx, pathSummary, w / 2, ruleY + (h - ruleY) / 2, {
      size: compact ? 8 : 9.5,
      align: 'center',
    });

    setOpticalStatus(state.error, reachesMirror);
  }
})();
