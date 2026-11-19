'use strict';
/* §06: dip of the horizon and atmospheric refraction. */

(function demoDip() {
  const d = createDemo('demo-dip', {
    aspect: 1,
    compactAspect: 0.95,
    maxH: 310,
    compactMaxH: 330,
    draw: drawDeckView,
  });
  const eye = addSlider(d, {
    label: 'height of eye', min: 1, max: 50, step: 0.5,
    value: SIGHT_STORY.state.eyeHeightM,
    fmt: v => v.toFixed(1) + ' m',
    onchange: v => SIGHT_STORY.set({ eyeHeightM: v }, { source: 'demo-dip' }),
  });
  const dipStat = addStat(d, 'dip correction');
  const horStat = addStat(d, 'visible horizon (standard air)');
  const where = addStat(d, 'you are on', true);
  d.addPreset('worked', () => {
    const defaults = SIGHT_STORY.defaults;
    eye.set(defaults.eyeHeightM, { emit: false });
    SIGHT_STORY.set({
      eyeHeightM: defaults.eyeHeightM,
      indexCorrectionMin: defaults.indexCorrectionMin,
      hs: defaults.hs,
    }, { source: 'demo-dip-worked' });
  });
  SIGHT_STORY.subscribe((s, source) => {
    if (source !== 'demo-dip') eye.set(s.eyeHeightM, { emit: false });
  });

  function setDipReadout(hm) {
    const dipTrue = 1.76 * Math.sqrt(hm);
    const distTrue = 2.08 * Math.sqrt(hm);
    dipStat.set('−' + dipTrue.toFixed(1) + '′');
    horStat.set(distTrue.toFixed(1) + ' nm');
    where.set(hm < 2.5 ? 'a dinghy – nearly at the waterline' :
      hm < 8 ? 'a sailboat deck' :
        hm < 22 ? "a ship's bridge" : 'the crow’s nest of a tall ship');
    return { dipTrue, distTrue };
  }

  function drawDeckView(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const hm = eye.v;
    const { dipTrue: standardDip } = setDipReadout(hm);
    const compact = w < 500;
    const titleBottom = compact ? 28 : 32;
    const ruleY = h - (compact ? 30 : 38);

    // The note box is sized from its own measured text, so a font change
    // resizes the box instead of overflowing it. The proof takes the rest.
    const boxLines = [
      'Sight line is a tangent',
      'No refraction drawn',
      'Numbers use average air',
    ];
    const boxTitle = 'What is drawn';
    const boxSize = compact ? 8 : 9;
    const boxPad = compact ? 6 : 8;
    const boxLineHeight = (compact ? 15 : 17) * PLATE_TEXT_SCALE;
    const boxTextW = Math.max(
      plateTextWidth(ctx, boxTitle, { size: boxSize, weight: 600, tracking: boxSize * 0.09 }),
      ...boxLines.map(line => plateTextWidth(ctx, line, { size: boxSize, tracking: boxSize * 0.055 }))
    );
    const boxW = compact ? w - 20 : Math.ceil(boxTextW + boxPad * 2 + 4);
    const boxH = boxPad * 2 + boxLineHeight + 5 + boxLines.length * boxLineHeight;
    const boxX = compact ? 10 : w - 14 - boxW;
    const splitX = compact ? w : boxX - 8;
    const boxY = compact
      ? ruleY - 10 - boxH
      : titleBottom + (ruleY - titleBottom - boxH) / 2;

    const proof = compact
      ? {
        left: 8,
        right: w - 8,
        top: titleBottom + 3,
        bottom: boxY - 8,
      }
      : {
        left: 10,
        right: splitX - 7,
        top: titleBottom + 4,
        bottom: ruleY - 5,
      };
    const proofW = proof.right - proof.left;
    const proofH = proof.bottom - proof.top;

    plateText(ctx, 'Why the horizon dips',
      w / 2, titleBottom / 2, {
        size: compact ? 9.5 : 11,
        weight: 600,
        tracking: compact ? 1.15 : 1.45,
        align: 'center',
      });
    plateRule(ctx, titleBottom, 14, w - 14);

    // The sketch omits refraction. Radius and eye height are deliberately not
    // at one scale; the standard dip rule is reported separately below.
    // Eye height is exaggerated further than the Earth so the dip wedge is
    // wide enough to carry its own label. The radius leaves room above the
    // highest eye for the EYE label.
    const eyeScale = compact ? 1.9 : 1.5;
    const maxGapRatio = 0.11 * eyeScale;
    const Rpx = Math.min(
      (proofH - (compact ? 22 : 26)) / (1 + maxGapRatio),
      proofW * (compact ? 0.36 : 0.50)
    );
    // Earth sits left of centre: the open sky to the right of the tangent
    // point carries the horizon label at every eye height.
    const C = {
      x: proof.left + Math.max(compact ? 70 : 90, proofW * (compact ? 0.24 : 0.30)),
      y: proof.bottom,
    };
    const S = { x: C.x, y: C.y - Rpx };
    const eyeGap = Rpx * (0.055 + 0.055 * Math.sqrt(hm / 50)) * eyeScale;
    const E = { x: S.x, y: S.y - eyeGap };
    const centerDistance = Math.hypot(E.x - C.x, E.y - C.y);
    const displayDip = Math.acos(clamp(Rpx / centerDistance, 0, 1));
    const toCenter = norm({ x: C.x - E.x, y: C.y - E.y });
    const tangentDirection = rot(toCenter, -(Math.PI / 2 - displayDip));
    const tangentLength = Math.sqrt(centerDistance * centerDistance - Rpx * Rpx);
    const T = {
      x: E.x + tangentDirection.x * tangentLength,
      y: E.y + tangentDirection.y * tangentLength,
    };
    const tangentAngle = Math.atan2(tangentDirection.y, tangentDirection.x);

    // Solid Earth boundary and a small solid observer/mast establish the
    // physical objects. No texture is used: every remaining line is geometry.
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.45 : 1.9;
    ctx.beginPath();
    ctx.arc(C.x, C.y, Rpx, -Math.PI / 2 - 0.52, -Math.PI / 2 + 1.05);
    ctx.stroke();
    ctx.restore();
    plateLine(ctx, { x: S.x - (compact ? 12 : 18), y: S.y },
      { x: S.x + (compact ? 12 : 18), y: S.y }, {
        weight: compact ? 1.25 : 1.65,
      });
    plateLine(ctx, S, E, { weight: compact ? 1.05 : 1.4 });
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(E.x, E.y, compact ? 2 : 2.7, 0, TAU);
    ctx.fill();

    // Dash-dot lines are axes/references: local radial vertical, eye-level
    // horizontal, and the radius that proves the sight line is tangent.
    plateLine(ctx, C, E, {
      kind: 'construction',
      weight: compact ? 0.45 : 0.6,
    });
    const levelEnd = {
      x: proof.right - (compact ? 4 : 8),
      y: E.y,
    };
    plateLine(ctx, E, levelEnd, {
      kind: 'construction',
      weight: compact ? 0.6 : 0.75,
    });
    plateLine(ctx, C, T, {
      kind: 'construction',
      weight: compact ? 0.55 : 0.7,
    });

    // Horizon photons travel from the tangent point toward the eye. The
    // arrowhead at E prevents the common but physically reversed reading.
    const beyondT = {
      x: T.x + tangentDirection.x * (compact ? 12 : 19),
      y: T.y + tangentDirection.y * (compact ? 12 : 19),
    };
    plateVector(ctx, beyondT, E, {
      kind: 'long',
      weight: compact ? 0.85 : 1.1,
      head: compact ? 3.1 : 3.9,
    });
    rightAngleMark(ctx, T.x, T.y,
      Math.atan2(C.y - T.y, C.x - T.x),
      Math.atan2(E.y - T.y, E.x - T.x),
      compact ? 5 : 7, PLATE.ink);

    const dipArcR = compact ? 22 : 39;
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.6 : 0.8;
    ctx.beginPath();
    arcBetween(ctx, E.x, E.y, dipArcR, 0, tangentAngle);
    ctx.stroke();
    ctx.restore();

    const labels = createPlateLabeler(ctx, {
      left: proof.left,
      top: proof.top,
      right: proof.right,
      bottom: proof.bottom,
      gap: compact ? 2 : 3,
    });
    // "dip" names the angle, so it sits in the wedge just outside its arc
    // and nothing else may cover it.
    const dipSize = compact ? 8 : 9.5;
    const dipW = plateTextWidth(ctx, 'dip', { size: dipSize });
    const dipMid = tangentAngle / 2;
    // Smallest distance along the bisector at which the word clears the
    // arc, the eye-level line and the tangent.
    const dipHalfH = plateSize(dipSize) * 0.36 + 1.5;
    const dipR = Math.max(
      dipArcR + dipW / 2 + 4,
      dipHalfH / Math.sin(dipMid),
      (dipW / 2 * Math.tan(tangentAngle) + dipHalfH)
        / (Math.cos(dipMid) * Math.tan(tangentAngle) - Math.sin(dipMid))
    );
    const dipPoint = {
      x: E.x + Math.cos(dipMid) * dipR,
      y: E.y + Math.sin(dipMid) * dipR,
    };
    plateText(ctx, 'dip', dipPoint.x, dipPoint.y, {
      size: dipSize,
      align: 'center',
    });
    labels.reserve({
      x: dipPoint.x - dipW / 2,
      y: dipPoint.y - plateSize(dipSize) * 0.55,
      w: dipW,
      h: plateSize(dipSize) * 1.1,
    }, 1);

    // The full plate dimensions height at the observer. At 320 px the live
    // footer carries the value, leaving the tangent proof unobstructed.
    if (!compact) {
      const dimX = S.x - 30;
      plateLine(ctx, { x: dimX + 4, y: E.y }, { x: E.x - 4, y: E.y }, {
        weight: 0.55,
      });
      plateLine(ctx, { x: dimX + 4, y: S.y }, { x: S.x - 4, y: S.y }, {
        weight: 0.55,
      });
      plateDimension(ctx, { x: dimX, y: E.y }, { x: dimX, y: S.y },
        '', {
          size: 9,
          tick: 4,
          head: 3.3,
          offset: 10,
        });
      const heightText = `${hm.toFixed(1)} m`;
      plateDataText(ctx, heightText, dimX - 10, (E.y + S.y) / 2, {
        size: 9,
        align: 'right',
      });
      labels.reserve({
        x: dimX - 10 - plateTextWidth(ctx, heightText, { size: 9, font: PLATE.dataFont, tracking: 0, uppercase: false }),
        y: Math.min(E.y, (E.y + S.y) / 2 - 7),
        w: plateTextWidth(ctx, heightText, { size: 9, font: PLATE.dataFont, tracking: 0, uppercase: false }) + 40,
        h: Math.max(S.y - E.y, 14),
      }, 1);
    }

    plateBox(ctx, boxX, boxY, boxW, boxLines, {
      title: boxTitle,
      size: boxSize,
      lineHeight: compact ? 15 : 17,
      padding: boxPad,
    });

    // EYE sits straight above its point, clear of the height dimension.
    labels.place('EYE', null, [
      { x: E.x, y: E.y - (compact ? 10 : 13), align: 'center' },
      { x: E.x - (compact ? 6 : 8), y: E.y - (compact ? 10 : 13), align: 'right' },
    ], {
      size: compact ? 8 : 9,
      leader: false,
    });
    labels.place('EYE-LEVEL HORIZONTAL', null, [
      {
        x: levelEnd.x - (compact ? 2 : 4),
        y: E.y - (compact ? 8 : 10),
        align: 'right',
      },
    ], {
      size: compact ? 8 : 9,
      leader: false,
    });
    // The horizon label continues the sight line past the tangent point,
    // in the open sky between eye level and the falling Earth.
    labels.place('UNREFRACTED HORIZON', T, [
      {
        x: T.x + (compact ? 16 : 22),
        y: T.y - (compact ? 5 : 6),
        align: 'left',
      },
      {
        x: T.x + (compact ? 30 : 40),
        y: T.y + (compact ? 20 : 26),
        align: 'left',
      },
    ], {
      size: compact ? 7.5 : 8,
      head: compact ? 2.6 : 3.2,
    });
    if (!compact) {
      labels.place('EARTH', null, [
        {
          x: C.x + Rpx * 0.55,
          y: C.y - Rpx * 0.38,
          align: 'center',
        },
      ], {
        size: 8,
        leader: false,
        fallback: 'hide',
      });
    }

    plateRule(ctx, ruleY, 14, w - 14);
    plateDataText(ctx, compact
      ? `−1.76′√h(m) = −${standardDip.toFixed(1)}′ · subtract from Hs`
      : `Dip correction = −1.76′√height(m) = −${standardDip.toFixed(1)}′ · subtract from Hs`,
    w / 2, ruleY + (h - ruleY) / 2, {
      size: compact ? 8 : 9.5,
      align: 'center',
      });
  }
})();

(function demoRefraction() {
  const d = createDemo('demo-refraction', {
    aspect: 1,
    compactAspect: 1.05,
    maxH: 340,
    draw: drawAltitudePair,
  });
  const app = addSlider(d, {
    label: 'apparent altitude', min: 0.5, max: 60, step: 0.01,
    value: +SIGHT_STORY.state.apparentLevel.toFixed(2),
    fmt: v => fmtDM(v, 1),
    onchange: v => {
      const s = SIGHT_STORY.state;
      SIGHT_STORY.set({
        hs: v - (s.indexCorrectionMin - s.dipMin) / 60,
      }, { source: 'demo-refraction' });
    },
  });
  const corrStat = addStat(d, 'refraction');
  const note = addStat(d, ' ', true);
  d.addPreset('worked', () => {
    const defaults = SIGHT_STORY.defaults;
    SIGHT_STORY.set({
      eyeHeightM: defaults.eyeHeightM,
      indexCorrectionMin: defaults.indexCorrectionMin,
      hs: defaults.hs,
    }, { source: 'demo-refraction-worked' });
  });
  SIGHT_STORY.subscribe(s => {
    app.set(+s.apparentLevel.toFixed(2), { emit: false });
  });

  const bennett = ha => 1 / Math.tan((ha + 7.31 / (ha + 4.4)) * D2R); // arcmin

  function setRefractionReadout(ha) {
    const R = bennett(ha);
    corrStat.set(R.toFixed(1) + '′');
    note.set(ha <= 3 ? 'near the horizon, refraction is large and unstable' :
      ha >= 45 ? 'high altitude – only a small correction remains' :
        'true altitude = apparent altitude − refraction');
    return R;
  }

  // Reserve a drawn line in a labeler as a chain of thin boxes, so labels
  // avoid the line itself rather than only its end points.
  function reserveLine(labels, a, b, pad = 1) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(length / 6));
    for (let i = 0; i < steps; i++) {
      const p = { x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps };
      const q = { x: a.x + (b.x - a.x) * (i + 1) / steps, y: a.y + (b.y - a.y) * (i + 1) / steps };
      labels.reserve({
        x: Math.min(p.x, q.x),
        y: Math.min(p.y, q.y),
        w: Math.abs(q.x - p.x),
        h: Math.abs(q.y - p.y),
      }, pad);
    }
  }

  function drawAltitudePair(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const ha = app.v;
    const R = setRefractionReadout(ha);
    const ht = ha - R / 60;
    const compact = w < 500;
    const titleBottom = compact ? 28 : 32;
    const ruleY = h - (compact ? 30 : 38);

    // The explanation card is sized from its measured text (widest value
    // states), so a font change resizes the card instead of overflowing it.
    const textSize = compact ? 8 : 9;
    const dataOpts = { size: textSize, font: PLATE.dataFont, tracking: 0, uppercase: false };
    const cardTitle = compact ? 'Why it looks high' : 'Why the star looks high';
    const rText = value => compact
      ? `R ${value}′ · apparent above true`
      : `R = ${value}′ · apparent above true`;
    const htText = value => compact ? 'Ht = Ha − R' : `Ht = Ha − R = ${value}`;
    const causes = [
      'Denser air bends the ray',
      'Eye extends it straight',
      'Star appears high',
    ];
    const textW = Math.max(
      plateTextWidth(ctx, rText('28.8'), dataOpts),
      plateTextWidth(ctx, htText('59° 59.4′'), dataOpts),
      ...causes.map(line => plateTextWidth(ctx, line, { size: textSize })),
      compact ? 0 : plateTextWidth(ctx, cardTitle, { size: textSize, weight: 600 })
    );
    const cardPad = compact ? 8 : 10;
    const rowH = (compact ? 11 : 14) * PLATE_TEXT_SCALE;
    const insetLabelSize = compact ? 7.5 : 8;
    const appLabel = 'apparent';
    const trueLabel = 'true';
    const appLabelW = plateTextWidth(ctx, appLabel, { size: insetLabelSize });
    const trueLabelW = plateTextWidth(ctx, trueLabel, { size: insetLabelSize });

    const cardH = compact ? Math.ceil(cardPad * 2 + rowH * 6) : ruleY - titleBottom - 20;
    const cardW = compact ? w - 20 : Math.ceil(textW + cardPad * 2);
    const card = {
      x: compact ? 10 : w - 14 - cardW,
      y: compact ? ruleY - 10 - cardH : titleBottom + 10,
      w: cardW,
      h: cardH,
    };
    const splitX = compact ? w : card.x - 8;
    const physical = compact
      ? {
        left: 8,
        right: w - 8,
        top: titleBottom + 3,
        bottom: card.y - 8,
      }
      : {
        left: 10,
        right: splitX - 7,
        top: titleBottom + 4,
        bottom: ruleY - 5,
      };

    plateText(ctx, 'Air makes a star look higher',
      w / 2, titleBottom / 2, {
        size: compact ? 9.5 : 11,
        weight: 600,
        tracking: compact ? 1.15 : 1.45,
        align: 'center',
      });
    plateRule(ctx, titleBottom, 14, w - 14);

    const O = {
      x: physical.left + (compact ? 12 : 19),
      y: physical.bottom - (compact ? 18 : 22),
    };
    const mainRight = physical.right - (compact ? 2 : 7);
    const mainTop = physical.top + (compact ? 5 : 10);

    // Solid interfaces encode a denser medium toward the observer. They are
    // sparse physical boundaries, not decorative atmospheric hatching. The
    // bands are tall enough to hold one line of label text.
    const layerGap = compact ? 20 : 24;
    const layerYs = [1, 2, 3].map(i => O.y - i * layerGap);
    const layerLeft = O.x - (compact ? 8 : 12);
    for (const y of layerYs) {
      plateLine(ctx, { x: layerLeft, y }, { x: mainRight, y }, {
        weight: compact ? 0.35 : 0.5,
      });
    }
    plateLine(ctx, O, { x: mainRight, y: O.y }, {
      kind: 'construction',
      weight: compact ? 0.55 : 0.7,
    });

    const apparentA = ha * D2R;
    const drawnRefraction = Math.min(
      clamp(R * 0.45, 1.2, 8),
      Math.max(0.2, ha * 0.78)
    ) * D2R;
    const drawnTrueA = apparentA - drawnRefraction;
    const maxByX = (mainRight - O.x) / Math.max(Math.cos(apparentA), 0.08);
    const maxByY = (O.y - mainTop) / Math.max(Math.sin(apparentA), 0.08);
    const rayLength = Math.max(compact ? 45 : 70, Math.min(maxByX, maxByY));
    const apparentEnd = {
      x: O.x + Math.cos(apparentA) * rayLength,
      y: O.y - Math.sin(apparentA) * rayLength,
    };

    // Integrate the reverse path from eye to space. The small bend is enlarged
    // for inspection, but it is capped above the horizon at low altitude.
    // Numeric altitude and correction values continue to use Bennett's model.
    const path = [{ ...O }];
    let px = O.x;
    let py = O.y;
    const steps = 72;
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const eased = 1 - Math.pow(1 - u, 2.1);
      const angle = apparentA + (drawnTrueA - apparentA) * eased;
      px += Math.cos(angle) * rayLength / steps;
      py -= Math.sin(angle) * rayLength / steps;
      path.push({ x: px, y: py });
    }
    const trueEnd = path[path.length - 1];

    // The eye's straight backward inference is a lighter long-dashed ray.
    plateLine(ctx, O, apparentEnd, {
      kind: 'long',
      weight: compact ? 0.5 : 0.65,
    });
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.9 : 1.15;
    ctx.setLineDash(plateDash('long'));
    ctx.beginPath();
    path.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();

    // Arrowheads point with the photons, from the true source toward the eye.
    for (const fraction of compact ? [0.56] : [0.42, 0.72]) {
      const index = Math.round(fraction * steps);
      const point = path[index];
      const previous = path[Math.max(0, index - 2)];
      plateArrowhead(ctx, point,
        Math.atan2(previous.y - point.y, previous.x - point.x),
        compact ? 3 : 3.7);
    }

    const starR = compact ? 4.2 : 6;
    const drawPlateStar = (point, hollow = false) => {
      const r = starR;
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = hollow ? (compact ? 0.5 : 0.65) : (compact ? 0.85 : 1.05);
      ctx.beginPath();
      ctx.moveTo(point.x - r, point.y);
      ctx.lineTo(point.x + r, point.y);
      ctx.moveTo(point.x, point.y - r);
      ctx.lineTo(point.x, point.y + r);
      ctx.moveTo(point.x - r * 0.5, point.y - r * 0.5);
      ctx.lineTo(point.x + r * 0.5, point.y + r * 0.5);
      ctx.moveTo(point.x + r * 0.5, point.y - r * 0.5);
      ctx.lineTo(point.x - r * 0.5, point.y + r * 0.5);
      ctx.stroke();
      if (!hollow) {
        ctx.fillStyle = PLATE.ink;
        ctx.beginPath();
        ctx.arc(point.x, point.y, compact ? 1.2 : 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };
    const sourceGap = Math.hypot(
      trueEnd.x - apparentEnd.x,
      trueEnd.y - apparentEnd.y
    );
    if (sourceGap >= (compact ? 2.5 : 3.5)) drawPlateStar(apparentEnd, true);
    drawPlateStar(trueEnd, false);
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(O.x, O.y, compact ? 2 : 2.7, 0, TAU);
    ctx.fill();

    // Every drawn line is reserved, so labels pick a seat that touches none.
    const mainLabels = createPlateLabeler(ctx, {
      left: physical.left,
      top: physical.top,
      right: physical.right,
      bottom: physical.bottom,
      gap: compact ? 1.5 : 2,
    });
    for (const y of layerYs) {
      mainLabels.reserve({ x: layerLeft, y, w: mainRight - layerLeft, h: 0 }, 1);
    }
    mainLabels.reserve({ x: O.x, y: O.y, w: mainRight - O.x, h: 0 }, 1);
    reserveLine(mainLabels, O, apparentEnd);
    for (let i = 0; i < steps; i++) reserveLine(mainLabels, path[i], path[i + 1]);
    for (const star of [apparentEnd, trueEnd]) {
      mainLabels.reserve({ x: star.x - starR, y: star.y - starR, w: starR * 2, h: starR * 2 }, 1);
    }
    mainLabels.reserve({ x: O.x - 3, y: O.y - 3, w: 6, h: 6 }, 1);

    const smallSize = compact ? 7.5 : 8;
    const labelSize = compact ? 8 : 9;
    mainLabels.place('horizon', null, [
      { x: mainRight, y: O.y + (compact ? 10 : 12), align: 'right' },
    ], {
      size: smallSize,
      leader: false,
      backed: false,
    });
    mainLabels.place('EYE', O, [
      { x: O.x + (compact ? 12 : 14), y: O.y + (compact ? 10 : 12), align: 'left' },
      { x: O.x + (compact ? 12 : 14), y: O.y - layerGap / 2, align: 'left' },
    ], {
      size: labelSize,
      padding: 1,
      head: compact ? 2.5 : 3.1,
    });

    // The true star's label tries the corners and sides first, then the clear
    // band between air layers to its left (low stars sit among the layers).
    const starOffset = compact ? 9 : 11;
    const starCandidates = [
      { x: trueEnd.x + starOffset, y: trueEnd.y + starOffset, align: 'left' },
      { x: trueEnd.x - starOffset, y: trueEnd.y + starOffset, align: 'right' },
      { x: trueEnd.x + starOffset, y: trueEnd.y - starOffset, align: 'left' },
      { x: trueEnd.x - starOffset, y: trueEnd.y - starOffset, align: 'right' },
    ];
    for (const shift of [6, 16, 28]) {
      starCandidates.push(
        { x: trueEnd.x + starR + shift, y: trueEnd.y, align: 'left' },
        { x: trueEnd.x - starR - shift, y: trueEnd.y, align: 'right' }
      );
    }
    for (let band = 0; band < 4; band++) {
      const bandY = O.y - (band + 0.5) * layerGap;
      if (bandY > trueEnd.y + layerGap || bandY < trueEnd.y - layerGap * 1.5) continue;
      for (const shift of [4, 34, 74]) {
        starCandidates.push({ x: trueEnd.x - starOffset - shift, y: bandY, align: 'right' });
      }
    }
    mainLabels.place('TRUE STAR', trueEnd, starCandidates, {
      size: labelSize,
      padding: 1,
      head: compact ? 2.5 : 3.1,
      fallback: 'hide',
    });

    const airText = compact ? 'DENSER AIR BELOW' : 'AIR GETS DENSER TOWARD THE SEA';
    const aboveLayers = layerYs[2] - layerGap / 2;
    mainLabels.place(airText, null, [
      { x: mainRight, y: aboveLayers, align: 'right' },
      { x: mainRight, y: O.y - 2.5 * layerGap, align: 'right' },
      { x: mainRight, y: O.y - 1.5 * layerGap, align: 'right' },
      { x: O.x, y: physical.top + (compact ? 10 : 12), align: 'left' },
      { x: mainRight, y: physical.top + (compact ? 10 : 12), align: 'right' },
      { x: O.x, y: aboveLayers, align: 'left' },
    ], {
      size: labelSize,
      padding: 1,
      leader: false,
    });
    const bendIndex = Math.round(steps * 0.55);
    mainLabels.place('LIGHT BENDS TO THE EYE', null, [
      {
        x: path[bendIndex].x - (compact ? 7 : 10),
        y: path[bendIndex].y - (compact ? 7 : 10),
        align: 'right',
      },
      {
        x: path[bendIndex].x + (compact ? 7 : 10),
        y: path[bendIndex].y + (compact ? 7 : 10),
        align: 'left',
      },
    ], {
      size: smallSize,
      leader: false,
      fallback: 'hide',
    });

    // The card enlarges only the small angular separation. Apparent is
    // above true, matching Ht = Ha − R at every slider setting.
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.8;
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeRect(card.x, card.y, card.w, card.h);
    ctx.restore();

    const textX = compact ? card.x + card.w - cardPad - textW : card.x + cardPad;
    const titleY = card.y + cardPad + rowH * 0.4;
    plateText(ctx, cardTitle,
      compact ? card.x + card.w / 2 : textX, titleY, {
        size: textSize,
        weight: 600,
        align: compact ? 'center' : 'left',
      });
    const rowY = index => titleY + rowH * (index + 1.1);
    plateDataText(ctx, rText(R.toFixed(1)), textX, rowY(0), dataOpts);

    // Inset: the eye at `detail`, the apparent and true directions, and an
    // arc from one to the other. Labels sit past the clear ends of the lines.
    const causeRuleY = compact ? null : card.y + card.h - cardPad - rowH * 4.2;
    const inset = compact
      ? {
        left: card.x + cardPad,
        right: textX - 14,
        top: rowY(0) - 2,
        bottom: card.y + card.h - cardPad - 4,
      }
      : {
        left: card.x + cardPad,
        right: card.x + card.w - cardPad,
        top: rowY(0) + rowH * 0.9,
        bottom: causeRuleY - rowH * 1.4,
      };
    const detail = { x: inset.left + 4, y: inset.bottom };
    const detailAppA = -34 * D2R;
    const detailSeparation = clamp(R * 0.44, 4, 14) * D2R;
    const detailTrueA = detailAppA + detailSeparation;
    const labelRoom = 6;
    const detailLen = Math.max(30, Math.min(
      (inset.right - detail.x - labelRoom - appLabelW) / Math.cos(detailAppA),
      (inset.right - detail.x - labelRoom - trueLabelW) / Math.cos(-20 * D2R),
      (detail.y - inset.top - 6) / Math.sin(-detailAppA)
    ));
    const apparentPoint = {
      x: detail.x + Math.cos(detailAppA) * detailLen,
      y: detail.y + Math.sin(detailAppA) * detailLen,
    };
    const truePoint = {
      x: detail.x + Math.cos(detailTrueA) * detailLen,
      y: detail.y + Math.sin(detailTrueA) * detailLen,
    };
    plateLine(ctx, detail, {
      x: detail.x + detailLen,
      y: detail.y,
    }, {
      kind: 'construction',
      weight: compact ? 0.5 : 0.65,
    });
    plateLine(ctx, detail, apparentPoint, {
      kind: 'long',
      weight: compact ? 0.5 : 0.65,
    });
    plateLine(ctx, detail, truePoint, {
      kind: 'long',
      weight: compact ? 0.9 : 1.15,
    });
    const photonPoint = {
      x: detail.x + (truePoint.x - detail.x) * 0.55,
      y: detail.y + (truePoint.y - detail.y) * 0.55,
    };
    plateArrowhead(ctx, photonPoint,
      Math.atan2(detail.y - truePoint.y, detail.x - truePoint.x),
      compact ? 3 : 3.7);
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.65 : 0.8;
    ctx.beginPath();
    ctx.arc(detail.x, detail.y, detailLen * 0.62,
      detailAppA, detailTrueA, false);
    ctx.stroke();
    ctx.restore();
    const arcEnd = {
      x: detail.x + Math.cos(detailTrueA) * detailLen * 0.62,
      y: detail.y + Math.sin(detailTrueA) * detailLen * 0.62,
    };
    plateArrowhead(ctx, arcEnd, detailTrueA + Math.PI / 2,
      compact ? 2.7 : 3.3);
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(detail.x, detail.y, compact ? 1.7 : 2.3, 0, TAU);
    ctx.fill();

    // Each label sits just past its own line's end; when the ends are close
    // the pair spreads apart symmetrically to one full text line.
    let apparentLabelY = apparentPoint.y;
    let trueLabelY = truePoint.y;
    const minimumLabelGap = plateSize(insetLabelSize) * 1.25;
    if (trueLabelY - apparentLabelY < minimumLabelGap) {
      const middle = (trueLabelY + apparentLabelY) / 2;
      apparentLabelY = middle - minimumLabelGap / 2;
      trueLabelY = middle + minimumLabelGap / 2;
    }
    plateText(ctx, appLabel, apparentPoint.x + labelRoom, apparentLabelY, {
      size: insetLabelSize,
    });
    plateText(ctx, trueLabel, truePoint.x + labelRoom, trueLabelY, {
      size: insetLabelSize,
    });

    if (compact) {
      plateLine(ctx, {
        x: textX - 8,
        y: rowY(0) - rowH * 0.5,
      }, {
        x: textX - 8,
        y: card.y + card.h - cardPad + 2,
      }, { weight: 0.55 });
      causes.forEach((line, index) => {
        plateText(ctx, line, textX, rowY(index + 1), { size: textSize });
      });
      plateDataText(ctx, htText(), textX, rowY(4), dataOpts);
    } else {
      plateText(ctx, 'angle drawn large', inset.left,
        detail.y + rowH * 0.75, {
          size: insetLabelSize,
        });
      plateLine(ctx, {
        x: card.x + cardPad - 1,
        y: causeRuleY,
      }, {
        x: card.x + card.w - cardPad + 1,
        y: causeRuleY,
      }, { weight: 0.55 });
      causes.forEach((line, index) => {
        plateText(ctx, line, textX, causeRuleY + rowH * (index + 0.75), {
          size: textSize,
        });
      });
      plateDataText(ctx, htText(fmtDM(ht, 1)),
        textX, causeRuleY + rowH * 3.75, dataOpts);
    }

    plateRule(ctx, ruleY, 14, w - 14);
    plateDataText(ctx,
      `True ${fmtDM(ht, 1)} = apparent ${fmtDM(ha, 1)} − refraction ${R.toFixed(1)}′`,
      w / 2, ruleY + (h - ruleY) / 2, {
        size: compact ? 8 : 9.5,
        align: 'center',
      });
  }
})();
