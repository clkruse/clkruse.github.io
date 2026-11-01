'use strict';
/* §04a: rotate a mirror, the beam turns twice as fast. */

(function demoMirror() {
  const d = createDemo('demo-mirror', {
    aspect: 1,
    maxH: 320,
    compactAspect: 1.15,
    draw,
  });

  const M0 = 128;
  let theta = 10;
  function signedDegrees(value, includePlus = false) {
    const clean = Math.abs(value) < 0.0005 ? 0 : value;
    const sign = clean < 0 ? '−' : (includePlus && clean > 0 ? '+' : '');
    return sign + Math.abs(clean).toFixed(1) + '°';
  }
  const slider = addSlider(d, {
    label: 'mirror rotation θ', min: -20, max: 24, step: 0.5, value: theta,
    fmt: v => signedDegrees(v, true),
    onchange: v => { theta = v; },
  });
  const beamStat = addStat(d, 'reflected ray turns');

  d.canvas.classList.add('grab');
  let geo = null;
  let dragPivot = null;
  addDrag(d.canvas, {
    start(p) {
      if (!geo) return;
      const pivots = geo.pivots || [geo];
      dragPivot = pivots.reduce((best, q) => {
        const dist = Math.hypot(p.x - q.mx, p.y - q.my);
        return !best || dist < best.dist ? { ...q, dist } : best;
      }, null);
    },
    move(p, dp) {
      if (!dragPivot) return;
      const a1 = Math.atan2(p.y - dp.dy - dragPivot.my, p.x - dp.dx - dragPivot.mx);
      const a2 = Math.atan2(p.y - dragPivot.my, p.x - dragPivot.mx);
      let dd = (a2 - a1) * R2D;
      if (dd > 180) dd -= 360;
      if (dd < -180) dd += 360;
      theta = clamp(theta + dd, -20, 24);
      slider.set(theta);
    },
    end() { dragPivot = null; },
  });

  function mirrorVectors(mirrorDeg) {
    const m = mirrorDeg * D2R;
    const mdir = { x: Math.cos(m), y: Math.sin(m) };
    let normal = rot(mdir, Math.PI / 2);
    if (normal.x > 0) normal = { x: -normal.x, y: -normal.y };
    return {
      mdir,
      normal,
      reflected: reflect({ x: 1, y: 0 }, normal),
    };
  }

  function edgeLength(p, dir, bounds, inset = 12) {
    let t = Infinity;
    if (dir.x > 1e-9) t = Math.min(t, (bounds.right - inset - p.x) / dir.x);
    if (dir.x < -1e-9) t = Math.min(t, (bounds.left + inset - p.x) / dir.x);
    if (dir.y > 1e-9) t = Math.min(t, (bounds.bottom - inset - p.y) / dir.y);
    if (dir.y < -1e-9) t = Math.min(t, (bounds.top + inset - p.y) / dir.y);
    return Math.max(0, t);
  }

  function draw(ctx, w, h) {
    drawBeforeAfter(ctx, w, h);
    beamStat.set(signedDegrees(2 * theta, true)
      + '  =  2 × ' + signedDegrees(theta, true));
  }

  function drawBeforeAfter(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500;
    const titleBottom = compact ? 28 : 32;
    const footerTop = h - (compact ? 30 : 38);
    const bodyTop = titleBottom;
    const bodyBottom = footerTop;
    const splitX = compact ? w - 10 : w * 0.70;
    const optics = compact
      ? {
        left: 10,
        right: w - 10,
        top: bodyTop + 3,
        bottom: Math.min(bodyTop + 111, bodyBottom - 70),
      }
      : {
        left: 14,
        right: splitX - 8,
        top: bodyTop + 7,
        bottom: bodyBottom - 7,
      };
    const opticsH = Math.max(76, optics.bottom - optics.top);
    const p = compact
      ? {
        x: optics.left + (optics.right - optics.left) * 0.56,
        y: optics.top + opticsH * 0.66,
      }
      : {
        x: optics.left + (optics.right - optics.left) * 0.57,
        y: optics.top + opticsH * 0.54,
      };
    const bounds = {
      left: optics.left,
      right: optics.right,
      top: optics.top,
      bottom: optics.bottom,
    };
    const labels = createPlateLabeler(ctx, {
      ...bounds,
      gap: compact ? 2 : 3,
    });
    const ref = mirrorVectors(M0);
    const live = mirrorVectors(M0 + theta);
    const mirrorHalf = Math.min(compact ? 43 : 69, opticsH * (compact ? 0.39 : 0.31));
    const coincident = Math.abs(theta) < 0.25;
    geo = { mx: p.x, my: p.y };

    plateText(ctx, 'A mirror doubles the turn',
      w / 2, titleBottom / 2, {
        size: compact ? 9.5 : 11,
        weight: 600,
        tracking: compact ? 1.15 : 1.45,
        align: 'center',
      });
    plateRule(ctx, titleBottom, 14, w - 14);

    const endOnField = vector => {
      const length = Math.max(8, edgeLength(p, vector, bounds, compact ? 4 : 7) - 2);
      return {
        x: p.x + vector.x * length,
        y: p.y + vector.y * length,
      };
    };
    const mirrorEnds = vectors => ({
      a: {
        x: p.x - vectors.mdir.x * mirrorHalf,
        y: p.y - vectors.mdir.y * mirrorHalf,
      },
      b: {
        x: p.x + vectors.mdir.x * mirrorHalf,
        y: p.y + vectors.mdir.y * mirrorHalf,
      },
    });
    const referenceMirror = mirrorEnds(ref);
    const liveMirror = mirrorEnds(live);
    const referenceRayEnd = endOnField(ref.reflected);
    const liveRayEnd = endOnField(live.reflected);

    // A zero turn has one physical surface and one reflected route. At other
    // settings the short-dashed surface is only the saved starting position.
    if (!coincident) {
      plateLine(ctx, referenceMirror.a, referenceMirror.b, {
        kind: 'short',
        weight: compact ? 0.55 : 0.7,
      });
    }
    plateLine(ctx, liveMirror.a, liveMirror.b, {
      weight: compact ? 1.5 : 1.9,
    });

    const mirrorBack = {
      x: -live.normal.x,
      y: -live.normal.y,
    };
    const hatchDirection = norm({
      x: live.mdir.x + mirrorBack.x,
      y: live.mdir.y + mirrorBack.y,
    });
    for (let distance = -mirrorHalf + 6; distance < mirrorHalf - 3;
      distance += compact ? 8 : 10) {
      if (Math.abs(distance) < 7) continue;
      const hatchStart = {
        x: p.x + live.mdir.x * distance,
        y: p.y + live.mdir.y * distance,
      };
      plateLine(ctx, hatchStart, {
        x: hatchStart.x + hatchDirection.x * (compact ? 5 : 7),
        y: hatchStart.y + hatchDirection.y * (compact ? 5 : 7),
      }, { weight: 0.45 });
    }

    // The incoming direction is fixed. Reflection is solved before layout by
    // v - 2(v·n)n, so the same θ always produces the same 2θ turn.
    plateVector(ctx, { x: bounds.left + 2, y: p.y }, { x: p.x - 6, y: p.y }, {
      kind: 'long', weight: compact ? 0.9 : 1.05, head: compact ? 3.2 : 4,
    });
    if (!coincident) {
      plateVector(ctx, {
        x: p.x + ref.reflected.x * 6,
        y: p.y + ref.reflected.y * 6,
      }, referenceRayEnd, {
        kind: 'long',
        weight: compact ? 0.5 : 0.65,
        head: compact ? 2.8 : 3.3,
      });
    }
    plateVector(ctx, {
      x: p.x + live.reflected.x * 6,
      y: p.y + live.reflected.y * 6,
    }, liveRayEnd, {
      kind: 'long', weight: compact ? 1 : 1.25, head: compact ? 3.4 : 4.2,
    });

    const normalHalf = mirrorHalf * (compact ? 0.82 : 0.95);
    plateLine(ctx, {
      x: p.x - live.normal.x * normalHalf,
      y: p.y - live.normal.y * normalHalf,
    }, {
      x: p.x + live.normal.x * normalHalf,
      y: p.y + live.normal.y * normalHalf,
    }, {
      kind: 'construction',
      weight: compact ? 0.55 : 0.65,
    });

    const shortest = (a, b) => {
      let delta = b - a;
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;
      return delta;
    };
    const midAngle = (a, b) => a + shortest(a, b) / 2;
    const incomingBack = Math.PI;
    const normalA = Math.atan2(live.normal.y, live.normal.x);
    const liveRayA = Math.atan2(live.reflected.y, live.reflected.x);
    const refRayA = Math.atan2(ref.reflected.y, ref.reflected.x);

    const equalR = compact ? 15 : 24;
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.55 : 0.7;
    for (const [a, b] of [[incomingBack, normalA], [normalA, liveRayA]]) {
      ctx.beginPath();
      arcBetween(ctx, p.x, p.y, equalR, a, b);
      ctx.stroke();
      const ma = midAngle(a, b);
      plateLine(ctx, {
        x: p.x + Math.cos(ma) * (equalR - 2.5),
        y: p.y + Math.sin(ma) * (equalR - 2.5),
      }, {
        x: p.x + Math.cos(ma) * (equalR + 2.5),
        y: p.y + Math.sin(ma) * (equalR + 2.5),
      }, { weight: compact ? 0.55 : 0.7 });
    }
    ctx.restore();
    const equalPoint = {
      x: p.x + Math.cos(normalA) * (equalR + (compact ? 10 : 14)),
      y: p.y + Math.sin(normalA) * (equalR + (compact ? 10 : 14)),
    };
    labels.place('EQUAL', null, [
      { ...equalPoint, align: 'center' },
      { x: equalPoint.x - live.normal.y * 12,
        y: equalPoint.y + live.normal.x * 12, align: 'center' },
    ], {
      size: compact ? 7.5 : 8,
      leader: false,
      backed: true,
    });

    if (!coincident) {
      const raySweepR = Math.min(compact ? 50 : 91,
        Math.max(compact ? 34 : 58, Math.min(
          Math.hypot(referenceRayEnd.x - p.x, referenceRayEnd.y - p.y),
          Math.hypot(liveRayEnd.x - p.x, liveRayEnd.y - p.y)) * 0.70));
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.65 : 0.8;
      ctx.beginPath();
      arcBetween(ctx, p.x, p.y, raySweepR, refRayA, liveRayA);
      ctx.stroke();
      ctx.restore();
      const rayMid = midAngle(refRayA, liveRayA);
      const rayValue = {
        x: p.x + Math.cos(rayMid) * (raySweepR + (compact ? 8 : 12)),
        y: p.y + Math.sin(rayMid) * (raySweepR + (compact ? 8 : 12)),
      };
      const rayValueSide = { x: -Math.sin(rayMid), y: Math.cos(rayMid) };
      labels.place(`2θ  ${signedDegrees(2 * theta, true)}`, null, [
        { ...rayValue, align: Math.cos(rayMid) < -0.2 ? 'right' : 'left' },
        {
          x: rayValue.x + rayValueSide.x * (compact ? 13 : 17),
          y: rayValue.y + rayValueSide.y * (compact ? 13 : 17),
          align: Math.cos(rayMid) < -0.2 ? 'right' : 'left',
        },
        {
          x: rayValue.x - rayValueSide.x * (compact ? 13 : 17),
          y: rayValue.y - rayValueSide.y * (compact ? 13 : 17),
          align: Math.cos(rayMid) < -0.2 ? 'right' : 'left',
        },
      ], {
        size: compact ? 8 : 9,
        font: PLATE.dataFont,
        tracking: 0,
        uppercase: false,
        leader: false,
        backed: true,
      });

      const mirrorSweepR = mirrorHalf + (compact ? 7 : 11);
      const mirrorA0 = M0 * D2R;
      const mirrorA1 = (M0 + theta) * D2R;
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.65 : 0.8;
      ctx.beginPath();
      arcBetween(ctx, p.x, p.y, mirrorSweepR, mirrorA0, mirrorA1);
      ctx.stroke();
      ctx.restore();
      const mirrorMid = midAngle(mirrorA0, mirrorA1);
      const mirrorValue = {
        x: p.x + Math.cos(mirrorMid) * (mirrorSweepR + (compact ? 8 : 12)),
        y: p.y + Math.sin(mirrorMid) * (mirrorSweepR + (compact ? 8 : 12)),
      };
      labels.place(`θ  ${signedDegrees(theta, true)}`, null, [
        { ...mirrorValue, align: 'center' },
        {
          x: mirrorValue.x - Math.sin(mirrorMid) * (compact ? 12 : 16),
          y: mirrorValue.y + Math.cos(mirrorMid) * (compact ? 12 : 16),
          align: 'center',
        },
      ], {
        size: compact ? 8 : 9,
        font: PLATE.dataFont,
        tracking: 0,
        uppercase: false,
        leader: false,
        backed: true,
      });
    } else {
      const coincidencePoint = {
        x: p.x + live.reflected.x * Math.min(58,
          Math.hypot(liveRayEnd.x - p.x, liveRayEnd.y - p.y) * 0.60),
        y: p.y + live.reflected.y * Math.min(58,
          Math.hypot(liveRayEnd.x - p.x, liveRayEnd.y - p.y) * 0.60),
      };
      plateText(ctx, compact ? 'start = now' : 'start and now coincide',
        coincidencePoint.x - live.reflected.y * (compact ? 8 : 12),
        coincidencePoint.y + live.reflected.x * (compact ? 8 : 12), {
          size: compact ? 8 : 9,
          align: 'center',
        });
    }

    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, compact ? 2 : 2.6, 0, TAU);
    ctx.fill();

    const noteX = compact ? 10 : splitX + 8;
    const noteW = compact ? w - 20 : Math.min(180, w - noteX - 14);
    const noteH = compact ? 64 : 100;
    const noteY = compact
      ? bodyBottom - noteH - 5
      : bodyTop + (bodyBottom - bodyTop - noteH) / 2;
    plateBox(ctx, noteX, noteY, noteW, [
      'Incoming light is fixed',
      'Normal turns with mirror',
      'Reflected ray turns twice',
    ], {
      title: 'Why 2θ',
      size: compact ? 8 : 9,
      lineHeight: compact ? 11 : 16,
      padding: compact ? 5 : 9,
      height: noteH,
      });

    labels.place('INCOMING LIGHT', null, [
      { x: bounds.left + 3, y: p.y + (compact ? 9 : 13), align: 'left' },
    ], {
      size: compact ? 8 : 9,
      leader: false,
      backed: true,
    });
    const rayLabelCandidate = (end, vector, fraction, offset) => {
      const normal = { x: -vector.y, y: vector.x };
      return {
        x: p.x + (end.x - p.x) * fraction + normal.x * offset,
        y: p.y + (end.y - p.y) * fraction + normal.y * offset,
        align: 'center',
      };
    };
    if (!coincident || !compact) {
      labels.place(coincident ? 'REFLECTED LIGHT' : 'REFLECTED LIGHT NOW',
        null, [
          rayLabelCandidate(liveRayEnd, live.reflected, compact ? 0.72 : 0.78,
            compact ? 8 : 11),
          rayLabelCandidate(liveRayEnd, live.reflected, compact ? 0.55 : 0.60,
            compact ? -8 : -11),
        ], {
          size: compact ? 8 : 9,
          leader: false,
          backed: true,
        });
    }
    if (!coincident && !compact) {
      labels.place('REFLECTED LIGHT AT START', null, [
        rayLabelCandidate(referenceRayEnd, ref.reflected, compact ? 0.61 : 0.66,
          compact ? 7 : 10),
        rayLabelCandidate(referenceRayEnd, ref.reflected, compact ? 0.48 : 0.54,
          compact ? -7 : -10),
      ], {
        size: 8,
        leader: false,
        backed: true,
        fallback: 'hide',
      });
    }
    labels.place('MIRROR NORMAL', null, [
      {
        x: p.x + live.normal.x * normalHalf,
        y: p.y + live.normal.y * normalHalf - (compact ? 6 : 8),
        align: live.normal.x < 0 ? 'right' : 'left',
      },
    ], {
      size: compact ? 7.5 : 8,
      leader: false,
      fallback: 'hide',
    });
    labels.place('MIRROR – DRAG',
      {
        x: p.x + live.mdir.x * mirrorHalf * 0.72,
        y: p.y + live.mdir.y * mirrorHalf * 0.72,
      }, [
        {
          x: p.x + live.mdir.x * mirrorHalf + (live.mdir.x < 0 ? -7 : 7),
          y: p.y + live.mdir.y * mirrorHalf + (compact ? 7 : 10),
          align: live.mdir.x < 0 ? 'right' : 'left',
        },
      ], {
        size: compact ? 7.5 : 8,
        head: compact ? 2.7 : 3.2,
        fallback: 'hide',
      });

    plateRule(ctx, footerTop, 14, w - 14);
    plateDataText(ctx,
      `Mirror ${signedDegrees(theta, true)} → reflected ray ${signedDegrees(2 * theta, true)}`,
      w / 2, footerTop + (h - footerTop) / 2, {
        size: compact ? 8 : 9.5,
        align: 'center',
      });
  }
})();
