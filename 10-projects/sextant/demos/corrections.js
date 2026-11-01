'use strict';
/* §06: dip of the horizon and atmospheric refraction. */

(function demoDip() {
  const d = createDemo('demo-dip', {
    aspect: 1,
    compactAspect: 0.95,
    maxH: 310,
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
    const splitX = compact ? w : w * 0.64;
    const proof = compact
      ? {
        left: 8,
        right: w - 8,
        top: titleBottom + 3,
        bottom: Math.min(titleBottom + 120, ruleY - 116),
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
    const Rpx = Math.min(
      proofH * (compact ? 0.70 : 0.84),
      proofW * (compact ? 0.36 : 0.50)
    );
    const C = {
      x: proof.left + proofW * (compact ? 0.31 : 0.37),
      y: proof.bottom + (compact ? -2 : 4),
    };
    const S = { x: C.x, y: C.y - Rpx };
    const eyeGap = Rpx * (0.055 + 0.055 * Math.sqrt(hm / 50));
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
    plateLine(ctx, E, {
      x: proof.right - (compact ? 4 : 8),
      y: E.y,
    }, {
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

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.6 : 0.8;
    ctx.beginPath();
    arcBetween(ctx, E.x, E.y, compact ? 25 : 39, 0, tangentAngle);
    ctx.stroke();
    ctx.restore();
    const dipMid = tangentAngle / 2;
    plateText(ctx, 'dip', E.x + Math.cos(dipMid) * (compact ? 32 : 49),
      E.y + Math.sin(dipMid) * (compact ? 32 : 49), {
        size: compact ? 8 : 9.5,
        align: 'center',
      });

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
      plateDataText(ctx, `${hm.toFixed(1)} m`, dimX - 10, (E.y + S.y) / 2, {
        size: 9,
        align: 'right',
      });
    }

    const boxX = compact ? 10 : splitX + 8;
    const boxW = compact ? w - 20 : w - boxX - 14;
    const boxY = compact
      ? proof.bottom + (ruleY - proof.bottom - 98) / 2
      : titleBottom + (ruleY - titleBottom - 110) / 2;
    const boxH = compact ? 98 : Math.min(110, ruleY - boxY - 6);
    plateBox(ctx, boxX, boxY, boxW, [
      'Tangent is geometric',
      'No refraction in this proof',
      'Standard dip uses average air',
      'Standard range uses average air',
    ], {
      title: 'What is drawn',
      size: compact ? 8 : 9,
      lineHeight: compact ? 15 : 17,
      padding: compact ? 6 : 8,
      height: boxH,
      });

    const labels = createPlateLabeler(ctx, {
      left: proof.left,
      top: proof.top,
      right: proof.right,
      bottom: proof.bottom,
      gap: compact ? 2 : 3,
    });
    labels.place('EYE', E, [
      { x: E.x - (compact ? 8 : 12), y: E.y - (compact ? 7 : 10), align: 'right' },
      { x: E.x + (compact ? 8 : 12), y: E.y - (compact ? 7 : 10), align: 'left' },
    ], {
      size: compact ? 8 : 9,
      head: compact ? 2.6 : 3.2,
    });
    labels.place('EYE-LEVEL HORIZONTAL', null, [
      {
        x: splitX - (compact ? 10 : 15),
        y: E.y - (compact ? 6 : 9),
        align: 'right',
      },
    ], {
      size: compact ? 8 : 9,
      leader: false,
    });
    labels.place('GEOMETRIC TANGENT', null, [
      {
        x: E.x + (T.x - E.x) * (compact ? 0.68 : 0.66),
        y: E.y + (T.y - E.y) * (compact ? 0.68 : 0.66)
          - (compact ? 9 : 13),
        align: 'center',
      },
    ], {
      size: compact ? 8 : 9,
      leader: false,
      backed: true,
    });
    labels.place('UNREFRACTED HORIZON', T, [
      {
        x: T.x + (compact ? 9 : 13),
        y: T.y + (compact ? 9 : 13),
        align: 'left',
      },
      {
        x: T.x - (compact ? 9 : 13),
        y: T.y + (compact ? 9 : 13),
        align: 'right',
      },
    ], {
      size: compact ? 7.5 : 8,
      head: compact ? 2.6 : 3.2,
    });
    if (!compact) {
      labels.place('EARTH', null, [
        {
          x: C.x + Rpx * 0.76,
          y: C.y - Rpx * 0.36,
          align: 'left',
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

  function drawAltitudePair(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const ha = app.v;
    const R = setRefractionReadout(ha);
    const ht = ha - R / 60;
    const compact = w < 500;
    const titleBottom = compact ? 28 : 32;
    const ruleY = h - (compact ? 30 : 38);
    const splitX = compact ? w : w * 0.62;
    const physical = compact
      ? {
        left: 8,
        right: w - 8,
        top: titleBottom + 3,
        bottom: Math.min(titleBottom + 103, ruleY - 101),
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
      x: physical.left + (compact ? 10 : 19),
      y: physical.bottom - (compact ? 10 : 22),
    };
    const mainRight = physical.right - (compact ? 2 : 7);
    const mainTop = physical.top + (compact ? 5 : 10);

    // Solid interfaces encode a denser medium toward the observer. They are
    // sparse physical boundaries, not decorative atmospheric hatching.
    const layerGap = compact ? 12 : 18;
    for (let i = 1; i <= 3; i++) {
      const y = O.y - i * layerGap;
      plateLine(ctx, { x: O.x - (compact ? 8 : 12), y },
        { x: mainRight, y }, {
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

    const drawPlateStar = (point, hollow = false) => {
      const r = compact ? 4.2 : 6;
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

    plateText(ctx, compact ? 'DENSER AIR BELOW' : 'AIR GETS DENSER TOWARD THE SEA',
      O.x, physical.top + (compact ? 3 : 5), {
        size: compact ? 8 : 9,
        align: 'left',
      });
    plateText(ctx, 'horizon', mainRight, O.y + (compact ? 7 : 10), {
      size: compact ? 7.5 : 8,
      align: 'right',
    });

    const mainLabels = createPlateLabeler(ctx, {
      left: physical.left,
      top: physical.top,
      right: physical.right,
      bottom: physical.bottom,
      gap: compact ? 2 : 3,
    });
    mainLabels.place('EYE', O, [
      { x: O.x + (compact ? 9 : 13), y: O.y - (compact ? 8 : 11), align: 'left' },
    ], {
      size: compact ? 8 : 9,
      head: compact ? 2.5 : 3.1,
    });
    const sourceLabelAbove = ha < 5;
    mainLabels.place('TRUE STAR', trueEnd, [
      {
        x: trueEnd.x + (compact ? 7 : 10),
        y: trueEnd.y + (sourceLabelAbove ? -(compact ? 8 : 11) : (compact ? 8 : 11)),
        align: 'left',
      },
      {
        x: trueEnd.x - (compact ? 7 : 10),
        y: trueEnd.y + (sourceLabelAbove ? -(compact ? 8 : 11) : (compact ? 8 : 11)),
        align: 'right',
      },
    ], {
      size: compact ? 8 : 9,
      head: compact ? 2.5 : 3.1,
      fallback: 'hide',
    });
    mainLabels.place('LIGHT BENDS TO THE EYE', null, [
      {
        x: path[Math.round(steps * 0.55)].x,
        y: path[Math.round(steps * 0.55)].y - (compact ? 7 : 10),
        align: 'center',
      },
    ], {
      size: compact ? 7.5 : 8,
      leader: false,
      backed: true,
      fallback: 'hide',
    });

    // The right card enlarges only the small angular separation. Apparent is
    // above true, matching Ht = Ha − R at every slider setting.
    const card = compact
      ? {
        x: 10,
        y: physical.bottom + 9,
        w: w - 20,
        h: Math.min(88, ruleY - physical.bottom - 19),
      }
      : {
        x: splitX + 8,
        y: titleBottom + 10,
        w: w - splitX - 22,
        h: ruleY - titleBottom - 20,
      };
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.8;
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeRect(card.x, card.y, card.w, card.h);
    ctx.restore();
    plateText(ctx, compact ? 'Why it looks high' : 'Why the star looks high',
      card.x + card.w / 2, card.y + (compact ? 9 : 13), {
        size: compact ? 8 : 9,
        weight: 600,
        align: 'center',
      });
    plateDataText(ctx, compact
      ? `R ${R.toFixed(1)}′ · apparent above true`
      : `R = ${R.toFixed(1)}′ · apparent direction above true`,
    compact ? card.x + 118 : card.x + card.w / 2,
    card.y + (compact ? 24 : 31), {
      size: compact ? 8 : 9,
      align: compact ? 'left' : 'center',
    });

    const detail = compact
      ? { x: card.x + 16, y: card.y + card.h - 14 }
      : { x: card.x + 19, y: card.y + card.h * 0.61 };
    const detailLen = compact ? 67 : card.w - 55;
    const detailAppA = -34 * D2R;
    const detailSeparation = clamp(R * 0.44, 4, 14) * D2R;
    const detailTrueA = detailAppA + detailSeparation;
    const apparentPoint = {
      x: detail.x + Math.cos(detailAppA) * detailLen,
      y: detail.y + Math.sin(detailAppA) * detailLen,
    };
    const truePoint = {
      x: detail.x + Math.cos(detailTrueA) * detailLen,
      y: detail.y + Math.sin(detailTrueA) * detailLen,
    };
    plateLine(ctx, detail, {
      x: Math.min(card.x + card.w - 7, detail.x + detailLen),
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
    ctx.arc(detail.x, detail.y, detailLen * 0.54,
      detailAppA, detailTrueA, false);
    ctx.stroke();
    ctx.restore();
    const arcEnd = {
      x: detail.x + Math.cos(detailTrueA) * detailLen * 0.54,
      y: detail.y + Math.sin(detailTrueA) * detailLen * 0.54,
    };
    plateArrowhead(ctx, arcEnd, detailTrueA + Math.PI / 2,
      compact ? 2.7 : 3.3);
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(detail.x, detail.y, compact ? 1.7 : 2.3, 0, TAU);
    ctx.fill();

    let apparentLabelY = apparentPoint.y - (compact ? 6 : 8);
    let trueLabelY = truePoint.y + (compact ? 7 : 9);
    const minimumLabelGap = compact ? 16 : 14;
    if (trueLabelY - apparentLabelY < minimumLabelGap) {
      const middle = (trueLabelY + apparentLabelY) / 2;
      apparentLabelY = middle - minimumLabelGap / 2;
      trueLabelY = middle + minimumLabelGap / 2;
    }
    plateText(ctx, compact ? 'apparent' : 'apparent altitude',
      compact ? card.x + 96 : card.x + card.w - 8,
      apparentLabelY, {
        size: compact ? 7.5 : 8,
        align: 'right',
      });
    plateText(ctx, compact ? 'true' : 'true altitude',
      compact ? card.x + 96 : card.x + card.w - 8,
      trueLabelY, {
        size: compact ? 7.5 : 8,
        align: 'right',
      });

    if (compact) {
      plateLine(ctx, {
        x: card.x + 107,
        y: card.y + 30,
      }, {
        x: card.x + 107,
        y: card.y + card.h - 7,
      }, { weight: 0.55 });
      const causeX = card.x + 118;
      plateText(ctx, 'Denser air bends the ray', causeX, card.y + 39, {
        size: 8,
      });
      plateText(ctx, 'Eye extends last direction straight', causeX, card.y + 52, {
        size: 8,
      });
      plateText(ctx, 'Star appears high', causeX, card.y + 65, {
        size: 8,
      });
      plateDataText(ctx, 'Ht = Ha − R', causeX, card.y + 79, {
        size: 8,
      });
    } else {
      plateText(ctx, 'angle drawn large', card.x + 10,
        card.y + card.h * 0.67 - 8, {
        size: 8,
      });
      const causeRuleY = card.y + card.h * 0.67;
      plateLine(ctx, {
        x: card.x + 9,
        y: causeRuleY,
      }, {
        x: card.x + card.w - 9,
        y: causeRuleY,
      }, { weight: 0.55 });
      plateText(ctx, 'Denser air bends the ray', card.x + 10, causeRuleY + 18, {
        size: 9,
      });
      plateText(ctx, 'Eye extends the last direction straight',
        card.x + 10, causeRuleY + 35, {
          size: 9,
        });
      plateText(ctx, 'Star appears high', card.x + 10, causeRuleY + 52, {
        size: 9,
      });
      plateDataText(ctx, `Ht = Ha − R = ${fmtDM(ht, 1)}`,
        card.x + 10, card.y + card.h - 12, {
          size: 9,
        });
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
