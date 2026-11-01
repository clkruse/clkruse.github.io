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
  const readStat = addStat(d, 'the arc reads');
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
    readStat.set(fmtDM(2 * arm, 1) + '  =  twice the arm');
    if (Math.abs(error) < CONTACT_TOLERANCE_DEG) {
      status.set('✓ Vega and horizon coincide – altitude = ' + fmtDM(2 * arm, 1), P.good);
    } else if (reachesMirror) {
      status.set('image ' + fmtDM(Math.abs(error), 1)
        + (error < 0 ? ' above' : ' below') + ' the horizon');
    } else {
      status.set('reflected light misses the horizon mirror – swing the arm toward '
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
    const splitX = compact ? w : w * 0.73;
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

    drawOutlinedBar(index, pointOnFrame(frameA0, frameInnerR), compact ? 2.2 : 3.2);
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

    for (let value = 0; value <= 60; value += 5) {
      const angle = (A0 + value) * D2R;
      const major = value % 15 === 0;
      plateLine(ctx, pointOnFrame(angle, frameR - (major ? frameBand + 3 : frameBand)),
        pointOnFrame(angle, frameR), {
          weight: major ? (compact ? 0.7 : 0.9) : 0.45,
        });
      if (major && Math.abs(value - arm) > 4) {
        const numberPoint = pointOnFrame(angle, frameInnerR - (compact ? 7 : 10));
        if ((!compact && value % 30 === 0) || (compact && value === 60)) {
          plateDataText(ctx, `${2 * value}°`, numberPoint.x, numberPoint.y + 2, {
            size: compact ? 7.5 : 8,
            align: 'center',
          });
        }
      }
    }

    const horizonMountAngle = Math.atan2(horizon.y - index.y, horizon.x - index.x);
    drawOutlinedBar(pointOnFrame(horizonMountAngle, frameInnerR), horizon,
      compact ? 2 : 3);
    drawOutlinedBar(pointOnFrame((A0 + 8) * D2R, frameInnerR), {
      x: scopeStart - (compact ? 3 : 5),
      y: horizon.y + scopeHeight * 0.55,
    }, compact ? 1.5 : 2.2);

    const armA = (A0 + arm) * D2R;
    const handleEnd = pointOnFrame(armA, frameInnerR + frameBand * 0.45);
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
      ? { x: 10, y: cardsY, w: Math.min(102, w * 0.36), h: 72 }
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
    plateText(ctx, compact ? 'Mirror face' : 'Horizon mirror · face',
      faceBox.x + faceBox.w / 2, faceBox.y + (compact ? 9 : 12), {
        size: compact ? 8 : 9,
        align: 'center',
      });
    const face = {
      x: faceBox.x + (compact ? 8 : 14),
      y: faceBox.y + (compact ? 23 : 32),
      w: faceBox.w - (compact ? 16 : 28),
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
        size: compact ? 7.5 : 8,
        align: 'center',
      });
    plateText(ctx, 'Clear', face.x + face.w * 0.75,
      faceBox.y + (compact ? 52 : 69), {
        size: compact ? 7.5 : 8,
        align: 'center',
      });
    if (!compact) {
      plateText(ctx, 'Vega → silvered', faceBox.x + faceBox.w / 2,
        faceBox.y + 89, {
          size: 8,
          align: 'center',
        });
      plateText(ctx, 'Horizon → clear', faceBox.x + faceBox.w / 2,
        faceBox.y + 104, {
          size: 8,
          align: 'center',
        });
    }
    const routeLines = reachesMirror ? [
      'Vega reflects twice',
      'Horizon passes through',
      'Arm brings both together',
    ] : [
      'Vega reflects once',
      'Second mirror is missed',
      'Move arm toward contact',
    ];
    plateBox(ctx, causalBox.x, causalBox.y, causalBox.w, routeLines, {
      title: reachesMirror
        ? (compact ? 'Light routes' : 'Why they meet')
        : (compact ? 'No Vega image' : 'Why no Vega image'),
      size: compact ? 8 : 9,
      lineHeight: compact ? 11 : 16,
      padding: compact ? 5 : 8,
      height: causalBox.h,
    });

    const callouts = createPlateLabeler(ctx, {
      left: compact ? 7 : 10,
      top: titleBottom + 2,
      right: compact ? w - 7 : splitX - 4,
      bottom: instrumentBottom,
      gap: compact ? 2 : 4,
    });
    const typeSize = compact ? 8 : 9;

    if (!compact) {
      callouts.place('INDEX MIRROR', indexEnds.b, [
        { x: index.x + 63, y: index.y - 27, align: 'left' },
        { x: index.x + 63, y: index.y + 21, align: 'left' },
        { x: index.x - 58, y: index.y - 27, align: 'right' },
      ], {
        size: typeSize,
      });
      callouts.place('HORIZON MIRROR', horizonEnds.a, [
        { x: horizon.x - 32, y: horizon.y + 40, align: 'right' },
        { x: horizon.x + 28, y: horizon.y + 42, align: 'left' },
        { x: horizon.x - 24, y: horizon.y - 31, align: 'right' },
      ], {
        size: typeSize,
      });
      const armMid = pointOnFrame(armA, frameInnerR * 0.58);
      const armPointsLeft = armMid.x < index.x;
      callouts.place('INDEX ARM – DRAG', armMid, [
        {
          x: armMid.x + (armPointsLeft ? -17 : 17),
          y: armMid.y - 8,
          align: armPointsLeft ? 'right' : 'left',
        },
        {
          x: armMid.x + (armPointsLeft ? 17 : -17),
          y: armMid.y + 18,
          align: armPointsLeft ? 'left' : 'right',
        },
        { x: index.x + 65, y: index.y + 52, align: 'left' },
      ], {
        size: typeSize,
      });
    } else {
      callouts.place('INDEX MIRROR', index, [
        { x: index.x + 9, y: index.y - 9, align: 'left' },
        { x: index.x + 10, y: index.y + 12, align: 'left' },
      ], {
        size: 8,
      });
      callouts.place('HORIZON MIRROR', horizon, [
        { x: horizon.x - 9, y: horizon.y + 10, align: 'right' },
        { x: horizon.x + 10, y: horizon.y + 13, align: 'left' },
      ], {
        size: 8,
      });
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
      ], {
        size: compact ? 7.5 : 8,
        leader: false,
        backed: true,
      });
    }
    callouts.place(imageResult === 'contact' ? 'SHARED ROUTE TO TELESCOPE' : 'TO TELESCOPE',
      directEnd, [
      { x: eyeX - 2, y: horizon.y + (compact ? 11 : 15), align: 'right' },
      { x: eyeX - 2, y: horizon.y - (compact ? 11 : 15), align: 'right' },
    ], {
      size: compact ? 7.5 : typeSize,
      leader: false,
    });

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
