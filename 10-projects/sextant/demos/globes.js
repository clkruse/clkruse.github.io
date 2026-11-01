'use strict';
/* Globe figures: circle of position (§02) and crossing circles (§04).
   Both are drawn as monochrome plate wire globes; makeGlobe supplies the
   shared drag-to-rotate view and projection (globeView/drawGlobeBase from
   app.js, used by demos/lopzoom.js). */

function makeGlobe(d, spin0, tilt0, hit) {
  const g = { spin: spin0, tilt: tilt0, armed: true };
  g.view = globeView(g.spin, g.tilt);
  addDrag(d.canvas, {
    start(p) { g.armed = !hit || hit(p); },
    move(p, dp) {
      if (!g.armed) return;
      g.spin += dp.dx * 0.35;
      g.tilt = clamp(g.tilt + dp.dy * 0.35, -72, 72);
    },
  });
  g.proj = (latDeg, lonDeg, R, cx, cy) => {
    const v = g.view(lonDeg, latDeg);
    return { x: cx + R * v.X, y: cy - R * v.Y, front: v.Z > 0 };
  };
  g.base = (ctx, cx, cy, R, opts = {}) => {
    g.view = globeView(g.spin, g.tilt);
    drawGlobeBase(ctx, g.view, cx, cy, R, opts);
  };
  return g;
}

function destPoint(lat, lon, dist, az) {
  const la = lat * D2R, dr = dist * D2R, azr = az * D2R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(dr) + Math.cos(la) * Math.sin(dr) * Math.cos(azr));
  const lo2 = lon * D2R + Math.atan2(
    Math.sin(azr) * Math.sin(dr) * Math.cos(la),
    Math.cos(dr) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 * R2D, lon: lo2 * R2D };
}

function latLonToVec(lat, lon) {
  const la = lat * D2R, lo = lon * D2R;
  return { x: Math.cos(la) * Math.cos(lo), y: Math.cos(la) * Math.sin(lo), z: Math.sin(la) };
}

function globeAngularDistance(a, b) {
  const av = latLonToVec(a.lat, a.lon), bv = latLonToVec(b.lat, b.lon);
  return Math.acos(clamp(av.x * bv.x + av.y * bv.y + av.z * bv.z, -1, 1)) * R2D;
}

/* Plate globe rendering: a monochrome orthographic wire globe whose
   graticule and small circles use the same live spherical projection
   without changing the shared globe machinery. */
function strokePlateHemisphere(ctx, points, front, opts = {}) {
  ctx.save();
  ctx.strokeStyle = PLATE.ink;
  ctx.lineWidth = opts.weight || 1;
  ctx.setLineDash(plateDash(opts.kind || 'solid'));
  ctx.beginPath();
  let pen = false;
  for (const point of points) {
    if (point.front === front) {
      if (pen) ctx.lineTo(point.x, point.y);
      else {
        ctx.moveTo(point.x, point.y);
        pen = true;
      }
    } else {
      pen = false;
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawPlateGlobeFrame(ctx, globe, cx, cy, radius, compact, opts = {}) {
  const view = globeView(globe.spin, globe.tilt);
  const project = (lat, lon) => {
    const point = view(lon, lat);
    return {
      x: cx + radius * point.X,
      y: cy - radius * point.Y,
      front: point.Z > 0,
    };
  };
  const hiddenGridWeight = opts.gridHiddenWeight
    ?? (compact ? 0.28 : 0.34);
  const visibleGridWeight = opts.gridVisibleWeight
    ?? (compact ? 0.38 : 0.48);
  const strokeReference = points => {
    strokePlateHemisphere(ctx, points, false, {
      kind: 'long',
      weight: hiddenGridWeight,
    });
    strokePlateHemisphere(ctx, points, true, {
      kind: 'short',
      weight: visibleGridWeight,
    });
  };

  ctx.save();
  ctx.fillStyle = PLATE.paper;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
  ctx.restore();

  const latitudes = opts.gridLatitudes
    ?? (compact ? [-45, 0, 45] : [-60, -30, 0, 30, 60]);
  const longitudeSampleStep = opts.gridLongitudeSampleStep
    ?? (compact ? 6 : 4);
  for (const lat of latitudes) {
    const points = [];
    for (let lon = -180; lon <= 180; lon += longitudeSampleStep) {
      points.push(project(lat, lon));
    }
    strokeReference(points);
  }
  const longitudeStep = opts.gridLongitudeStep
    ?? (compact ? 60 : 45);
  const latitudeSampleStep = opts.gridLatitudeSampleStep
    ?? (compact ? 5 : 3);
  for (let lon = -180; lon < 180; lon += longitudeStep) {
    const points = [];
    for (let lat = -90; lat <= 90; lat += latitudeSampleStep) {
      points.push(project(lat, lon));
    }
    strokeReference(points);
  }

  ctx.save();
  ctx.strokeStyle = PLATE.ink;
  ctx.lineWidth = compact ? 1.45 : 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
  if (opts.showCenter !== false) {
    plateLine(ctx, { x: cx - (compact ? 3 : 5), y: cy },
      { x: cx + (compact ? 3 : 5), y: cy }, {
        kind: 'construction',
        weight: compact ? 0.45 : 0.6,
      });
    plateLine(ctx, { x: cx, y: cy - (compact ? 3 : 5) },
      { x: cx, y: cy + (compact ? 3 : 5) }, {
        kind: 'construction',
        weight: compact ? 0.45 : 0.6,
      });
  }
  return { project };
}

function drawPlatePositionCircle(ctx, scene, lat, lon, angularRadius, style) {
  const points = [];
  for (let azimuth = 0; azimuth <= 360; azimuth += 2) {
    const point = destPoint(lat, lon, angularRadius, azimuth);
    points.push(scene.project(point.lat, point.lon));
  }
  strokePlateHemisphere(ctx, points, false, {
    kind: 'long',
    weight: style.hiddenWeight || 0.48,
  });
  strokePlateHemisphere(ctx, points, true, {
    kind: style.kind || 'solid',
    weight: style.weight || 1.5,
  });
  return points;
}

function plateRingAnchor(points, cx, cy, direction, front = true, minDistance = 12) {
  let best = null;
  let bestScore = -Infinity;
  for (const point of points) {
    if (point.front !== front) continue;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const distance = Math.hypot(dx, dy);
    if (distance < minDistance) continue;
    const score = dx * direction.x + dy * direction.y - Math.abs(distance - 0.82 * Math.max(distance, 1)) * 0.08;
    if (score > bestScore) {
      best = point;
      bestScore = score;
    }
  }
  return best;
}

(function demoCircle() {
  const d = createDemo('demo-circle', {
    aspect: 1.64,
    maxH: 400,
    compactAspect: 1.44,
    compactMaxH: 196,
    draw,
  });
  const g = makeGlobe(d, 127.2129, 38.81);
  const GP = { lat: 38.81, lon: -127.2129 };
  let workedSight = SIGHT_STORY.state;
  const alt = addSlider(d, {
    label: 'corrected altitude Ho', min: 5, max: 85, step: 0.001, value: workedSight.ho,
    fmt: v => v.toFixed(1) + '°',
  });
  const radStat = addStat(d, 'circle radius');
  const applyWorked = (state = workedSight) => {
    workedSight = state;
    GP.lat = state.gp.lat;
    GP.lon = state.gp.lon;
    alt.set(state.ho, { emit: false });
  };
  d.addPreset('worked', () => applyWorked());
  d.addPreset('high-altitude', () => alt.set(75, { emit: false }));
  d.addPreset('low-altitude', () => alt.set(15, { emit: false }));
  SIGHT_STORY.subscribe(applyWorked);

  function draw(ctx, w, h) {
    const zr = 90 - alt.v;
    drawShrinkingProof(ctx, w, h, zr);
    radStat.set(fmtNM(zr * 60));
  }

  function drawPlateRadius(ctx, scene, zr, cx, cy, R, compact) {
    const minimumLength = compact ? 20 : 28;
    const preferredDirection = { x: 0.65, y: 0.76 };
    let best = null;

    for (let azimuth = 0; azimuth < 360; azimuth += 15) {
      const steps = Math.max(8, Math.ceil(zr / 4));
      const points = [];
      let allFront = true;
      for (let index = 0; index <= steps; index++) {
        const point = destPoint(GP.lat, GP.lon, zr * index / steps, azimuth);
        const projected = scene.project(point.lat, point.lon);
        if (!projected.front) allFront = false;
        points.push(projected);
      }
      if (!allFront) continue;

      let length = 0;
      for (let index = 1; index < points.length; index++) {
        length += Math.hypot(
          points[index].x - points[index - 1].x,
          points[index].y - points[index - 1].y
        );
      }
      if (length < minimumLength) continue;

      const end = points[points.length - 1];
      const direction = norm({ x: end.x - points[0].x, y: end.y - points[0].y });
      const score = length + R * 0.12 * (
        direction.x * preferredDirection.x + direction.y * preferredDirection.y
      );
      if (!best || score > best.score) best = { points, length, score };
    }

    if (!best) return null;

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.6 : 0.75;
    ctx.setLineDash([]);
    ctx.beginPath();
    best.points.forEach((point, index) => {
      if (index) ctx.lineTo(point.x, point.y);
      else ctx.moveTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();

    const end = best.points[best.points.length - 1];
    const beforeEnd = best.points[best.points.length - 2];
    plateArrowhead(ctx, end,
      Math.atan2(end.y - beforeEnd.y, end.x - beforeEnd.x),
      compact ? 3.2 : 4);

    if (best.length >= (compact ? 32 : 44)) {
      const middleIndex = Math.floor(best.points.length / 2);
      const middle = best.points[middleIndex];
      const before = best.points[Math.max(0, middleIndex - 1)];
      const after = best.points[Math.min(best.points.length - 1, middleIndex + 1)];
      const tangent = norm({ x: after.x - before.x, y: after.y - before.y });
      let normal = { x: -tangent.y, y: tangent.x };
      const away = { x: middle.x - cx, y: middle.y - cy };
      if (normal.x * away.x + normal.y * away.y < 0) {
        normal = { x: -normal.x, y: -normal.y };
      }
      plateDataText(ctx, 'z',
        middle.x + normal.x * (compact ? 7 : 9),
        middle.y + normal.y * (compact ? 7 : 9), {
          size: compact ? 8 : 9,
          align: 'center',
        });
    }
    return end;
  }

  function drawShrinkingProof(ctx, w, h, zr) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 540 || h < 330;
    const margin = compact ? 7 : 14;
    const fieldTop = compact ? 29 : 39;
    const fieldBottom = h - (compact ? 15 : 24);
    const splitX = w * (compact ? 0.6 : 0.68);
    const cx = margin + (splitX - margin) * 0.5;
    const cy = fieldTop + (fieldBottom - fieldTop) * (compact ? 0.46 : 0.5);
    const R = Math.min(
      (splitX - margin) * 0.445,
      (fieldBottom - fieldTop) * (compact ? 0.42 : 0.44)
    );

    plateText(ctx, compact
      ? 'ALTITUDE SETS THE RADIUS'
      : 'ALTITUDE SETS THE CIRCLE’S RADIUS',
    compact ? 9 : 14, compact ? 15 : 19, {
      size: compact ? 8.5 : 10.5,
      align: 'left',
    });

    const scene = drawPlateGlobeFrame(ctx, g, cx, cy, R, compact, {
      showCenter: false,
      gridLatitudes: compact ? [0] : [-45, 0, 45],
      gridLongitudeStep: compact ? 90 : 60,
      gridHiddenWeight: compact ? 0.22 : 0.26,
      gridVisibleWeight: compact ? 0.3 : 0.36,
    });
    drawPlateRadius(ctx, scene, zr, cx, cy, R, compact);
    const ring = drawPlatePositionCircle(ctx, scene, GP.lat, GP.lon, zr, {
      weight: compact ? 1.55 : 2,
      kind: 'solid',
      hiddenWeight: compact ? 0.52 : 0.65,
    });
    const gpPoint = scene.project(GP.lat, GP.lon);
    if (gpPoint.front) {
      starGlyph(ctx, gpPoint.x, gpPoint.y, compact ? 5.5 : 7, PLATE.ink);
    } else {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.7 : 0.85;
      ctx.setLineDash(plateDash('long'));
      ctx.beginPath();
      ctx.arc(gpPoint.x, gpPoint.y, compact ? 4.5 : 6, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(gpPoint.x, gpPoint.y, compact ? 1.2 : 1.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    const callouts = createPlateLabeler(ctx, {
      left: margin,
      top: fieldTop,
      right: splitX - 4,
      bottom: fieldBottom,
      gap: compact ? 2 : 3,
    });
    const ringHasFront = ring.some(point => point.front);
    const ringTarget = plateRingAnchor(ring, cx, cy, { x: 0, y: 1 },
      ringHasFront, 0) || ring[0];
    const ringScreenRadius = Math.max(...ring.map(point =>
      Math.hypot(point.x - gpPoint.x, point.y - gpPoint.y)));
    const smallRing = ringScreenRadius < (compact ? 18 : 25);
    callouts.place('POSITION CIRCLE', ringTarget, smallRing
      ? [
        {
          x: ringTarget.x,
          y: ringTarget.y + (compact ? 15 : 20),
          align: 'center',
        },
        {
          x: cx,
          y: fieldBottom - (compact ? 7 : 9),
          align: 'center',
        },
      ]
      : [
        {
          x: cx,
          y: fieldBottom - (compact ? 7 : 9),
          align: 'center',
        },
        {
          x: ringTarget.x,
          y: ringTarget.y + (compact ? 11 : 15),
          align: 'center',
        },
      ], {
        size: compact ? 8 : 9,
      });

    const gpDistance = Math.hypot(gpPoint.x - cx, gpPoint.y - cy);
    let gpDirection = gpDistance > 2
      ? norm({ x: gpPoint.x - cx, y: gpPoint.y - cy })
      : { x: 0.8, y: -0.6 };
    if (Math.abs(gpDirection.x) < 0.12) {
      gpDirection = norm({ x: 0.72, y: gpDirection.y });
    }
    const gpSide = { x: -gpDirection.y, y: gpDirection.x };
    callouts.place(gpPoint.front ? 'VEGA GP' : 'VEGA GP · FAR SIDE', gpPoint, [
      {
        x: gpPoint.x + gpDirection.x * (compact ? 10 : 14),
        y: gpPoint.y + gpDirection.y * (compact ? 10 : 14),
        align: gpDirection.x < 0 ? 'right' : 'left',
      },
      {
        x: gpPoint.x + gpSide.x * (compact ? 12 : 17),
        y: gpPoint.y + gpSide.y * (compact ? 12 : 17),
        align: gpSide.x < 0 ? 'right' : 'left',
      },
      {
        x: margin + 2,
        y: fieldTop + (compact ? 8 : 11),
        align: 'left',
      },
    ], {
      size: compact ? 8 : 9,
    });

    plateText(ctx, 'DRAG GLOBE', splitX - (compact ? 4 : 8),
      h - (compact ? 7 : 11), {
        size: compact ? 7.5 : 8,
        align: 'right',
      });

    const cardX = splitX + (compact ? 5 : 14);
    const cardW = w - cardX - (compact ? 6 : 15);
    const cardH = compact
      ? Math.min(140, fieldBottom - fieldTop - 8)
      : Math.min(190, (fieldBottom - fieldTop) * 0.72);
    const cardY = fieldTop + (fieldBottom - fieldTop - cardH) / 2;
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.restore();
    const cardCenter = cardX + cardW / 2;
    plateDataText(ctx, 'Ho → z → radius',
      cardCenter, cardY + cardH * 0.11, {
        size: compact ? 8.5 : 10.5,
        weight: 600,
        align: 'center',
      });
    plateLine(ctx,
      { x: cardX + (compact ? 7 : 11), y: cardY + cardH * 0.2 },
      { x: cardX + cardW - (compact ? 7 : 11), y: cardY + cardH * 0.2 }, {
        weight: 0.55,
      });
    const rowSize = compact ? 8 : 10;
    plateDataText(ctx, `Ho = ${fmtDM(alt.v, 1)}`,
      cardCenter, cardY + cardH * 0.32, {
        size: rowSize,
        align: 'center',
      });
    plateDataText(ctx, 'z = 90° − Ho',
      cardCenter, cardY + cardH * 0.46, {
        size: rowSize,
        align: 'center',
      });
    plateDataText(ctx, `z = ${fmtDM(zr, 1)}`,
      cardCenter, cardY + cardH * 0.6, {
        size: rowSize,
        align: 'center',
      });
    plateDataText(ctx, 'radius ≈ z × 60 nm',
      cardCenter, cardY + cardH * 0.74, {
        size: rowSize,
        align: 'center',
      });
    plateDataText(ctx,
      `≈ ${Math.round(zr * 60).toLocaleString('en-US')} nm`,
      cardCenter, cardY + cardH * 0.89, {
        size: compact ? 8.5 : 10.5,
        weight: 600,
        align: 'center',
      });
  }
})();

(function demoTwoStar() {
  const d = createDemo('demo-twostar', {
    aspect: 1.45,
    maxH: 540,
    draw,
  });
  const DEFAULT_SPIN = 120;
  const DEFAULT_TILT = 15;
  const g = makeGlobe(d, DEFAULT_SPIN, DEFAULT_TILT);
  const A = { lat: 38.81, lon: -127.2129 };
  const B = { lat: -16.7, lon: -100 };
  const DR = { lat: -5.7901, lon: -145 };
  const THIRD_BASE = { lat: 19.2, lon: 70 };
  let workedSight = SIGHT_STORY.state;
  const altA = addSlider(d, {
    label: 'Vega Ho', min: 15, max: 70, step: 0.001, value: workedSight.ho,
    fmt: v => v.toFixed(1) + '°',
    onchange: () => updateThirdAvailability(),
  });
  const altB = addSlider(d, {
    label: 'Sirius Ho', min: 15, max: 70, step: 0.001, value: 44.65,
    fmt: v => v.toFixed(1) + '°',
    onchange: () => updateThirdAvailability(),
  });
  const sepStat = addStat(d, 'candidates apart', true);
  const thirdStat = addStat(d, 'third-circle miss', true);
  let thirdRevealed = false;
  const thirdButton = addButton(d, 'reveal third sight', () => {
    const current = intersections(90 - altA.v, 90 - altB.v);
    if (!current) {
      setThirdRevealed(false);
      return;
    }
    setThirdRevealed(!thirdRevealed);
  });
  thirdButton.setAttribute('aria-pressed', 'false');
  function setThirdRevealed(revealed) {
    thirdRevealed = Boolean(revealed);
    thirdButton.textContent = thirdRevealed ? 'hide third sight' : 'reveal third sight';
    thirdButton.setAttribute('aria-pressed', String(thirdRevealed));
  }
  function updateThirdAvailability() {
    const hasCandidates = Boolean(intersections(90 - altA.v, 90 - altB.v));
    if (!hasCandidates && thirdRevealed) setThirdRevealed(false);
    thirdButton.disabled = !hasCandidates;
    thirdButton.hidden = !hasCandidates;
    return hasCandidates;
  }
  const applyWorked = (state = workedSight, { resetStage = false } = {}) => {
    workedSight = state;
    A.lat = state.gp.lat;
    A.lon = state.gp.lon;
    DR.lat = state.assumed.lat;
    DR.lon = state.assumed.lon;
    altA.set(state.ho, { emit: false });
    if (resetStage) {
      setThirdRevealed(false);
    }
  };
  d.addPreset('worked', () => applyWorked(workedSight, { resetStage: true }));
  SIGHT_STORY.subscribe(state => applyWorked(state));

  function intersections(zA, zB) {
    const n1 = latLonToVec(A.lat, A.lon), n2 = latLonToVec(B.lat, B.lon);
    const c1 = Math.cos(zA * D2R), c2 = Math.cos(zB * D2R);
    const dd = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
    const den = 1 - dd * dd;
    if (den < 1e-9) return null;
    const a = (c1 - c2 * dd) / den, b = (c2 - c1 * dd) / den;
    const x0 = { x: a * n1.x + b * n2.x, y: a * n1.y + b * n2.y, z: a * n1.z + b * n2.z };
    const m2 = x0.x * x0.x + x0.y * x0.y + x0.z * x0.z;
    const h2 = 1 - m2;
    if (h2 < 0) return null;
    const cr = {
      x: n1.y * n2.z - n1.z * n2.y,
      y: n1.z * n2.x - n1.x * n2.z,
      z: n1.x * n2.y - n1.y * n2.x,
    };
    const tt = Math.sqrt(h2 / den);
    const mk = s => {
      const v = { x: x0.x + s * tt * cr.x, y: x0.y + s * tt * cr.y, z: x0.z + s * tt * cr.z };
      return { lat: Math.asin(clamp(v.z, -1, 1)) * R2D, lon: Math.atan2(v.y, v.x) * R2D, v };
    };
    return [mk(1), mk(-1)];
  }

  function pickNearDR(ints) {
    return globeAngularDistance(ints[0], DR) <= globeAngularDistance(ints[1], DR) ? 0 : 1;
  }

  function candidateSeparation(ints) {
    return globeAngularDistance(ints[0], ints[1]) * 60;
  }

  function thirdSightSolution(kept, rejected) {
    let third = { ...THIRD_BASE };
    let z3 = globeAngularDistance(kept, third);
    if (z3 > 90) {
      third = {
        lat: -THIRD_BASE.lat,
        lon: ((THIRD_BASE.lon + 180 + 540) % 360) - 180,
      };
      z3 = globeAngularDistance(kept, third);
    }
    return {
      third,
      z3,
      miss: Math.abs(globeAngularDistance(rejected, third) - z3) * 60,
    };
  }

  function draw(ctx, w, h) {
    updateThirdAvailability();
    drawThirdSight(ctx, w, h);
  }

  function drawThirdSight(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 560 || h < 340;
    const ruleY = compact ? h - 38 : h - 75;
    const fieldTop = compact ? 38 : 42;
    const fieldBottom = ruleY - (compact ? 5 : 9);
    const cx = w * 0.5;
    const cy = fieldTop + (fieldBottom - fieldTop) * 0.52;
    const R = Math.min(
      w * (compact ? 0.22 : 0.285),
      (fieldBottom - fieldTop) * (compact ? 0.46 : 0.44)
    );
    const zA = 90 - altA.v;
    const zB = 90 - altB.v;
    const ints = intersections(90 - altA.v, 90 - altB.v);

    plateText(ctx, !ints
      ? 'THE TWO CIRCLES DO NOT CROSS'
      : thirdRevealed
        ? 'THE THIRD CIRCLE LEAVES ONE FIX'
        : 'TWO CIRCLES USUALLY CROSS TWICE',
    compact ? 9 : 14, compact ? 15 : 19, {
      size: compact ? 8.5 : 10.5,
      align: 'left',
    });

    const scene = drawPlateGlobeFrame(ctx, g, cx, cy, R, compact, {
      showCenter: false,
      gridLatitudes: compact ? [0] : [-45, 0, 45],
      gridLongitudeStep: compact ? 90 : 60,
      gridHiddenWeight: compact ? 0.22 : 0.26,
      gridVisibleWeight: compact ? 0.3 : 0.36,
    });
    const ringA = drawPlatePositionCircle(ctx, scene, A.lat, A.lon, zA, {
      weight: compact ? 1.55 : 2,
      kind: 'solid',
      hiddenWeight: compact ? 0.5 : 0.6,
    });
    const ringB = drawPlatePositionCircle(ctx, scene, B.lat, B.lon, zB, {
      weight: compact ? 1.1 : 1.45,
      kind: 'solid',
      hiddenWeight: compact ? 0.5 : 0.6,
    });

    const callouts = createPlateLabeler(ctx, {
      left: 7,
      top: fieldTop,
      right: w - 7,
      bottom: fieldBottom,
      gap: compact ? 1.5 : 3,
    });
    const ringType = compact ? 7.5 : 9;
    const labelRing = (text, points, direction) => {
      const target = plateRingAnchor(points, cx, cy, direction);
      if (!target) return;
      const radial = norm({ x: target.x - cx, y: target.y - cy });
      const side = { x: -radial.y, y: radial.x };
      callouts.place(text, target, [
        {
          x: target.x + radial.x * (compact ? 7 : 10),
          y: target.y + radial.y * (compact ? 7 : 10),
          align: radial.x < -0.15 ? 'right' : radial.x > 0.15 ? 'left' : 'center',
        },
        {
          x: target.x + side.x * (compact ? 8 : 11),
          y: target.y + side.y * (compact ? 8 : 11),
          align: side.x < 0 ? 'right' : 'left',
        },
      ], {
        size: ringType,
        leader: false,
      });
    };
    labelRing(compact ? 'VEGA' : 'VEGA CIRCLE', ringA, { x: -0.9, y: -0.25 });
    labelRing(compact ? 'SIRIUS' : 'SIRIUS CIRCLE', ringB, { x: 0.85, y: -0.25 });

    if (!ints) {
      sepStat.set('no common crossings', P.red);
      thirdStat.set('unavailable until the first two circles cross', P.red);
    } else {
      const pick = pickNearDR(ints);
      const kept = ints[pick];
      const rejected = ints[1 - pick];
      let sight = null;
      if (thirdRevealed) {
        sight = thirdSightSolution(kept, rejected);
        const ringC = drawPlatePositionCircle(ctx, scene,
          sight.third.lat, sight.third.lon, sight.z3, {
            weight: compact ? 1.2 : 1.55,
            kind: 'solid',
            hiddenWeight: compact ? 0.5 : 0.6,
          });
        labelRing(compact ? 'THIRD' : 'THIRD-STAR CIRCLE',
          ringC, { x: 0.15, y: 1 });
      }

      ints.forEach((candidate, index) => {
        const point = scene.project(candidate.lat, candidate.lon);
        if (!point.front) return;
        const retained = index === pick;
        ctx.save();
        ctx.strokeStyle = PLATE.ink;
        ctx.fillStyle = PLATE.ink;
        ctx.lineWidth = compact ? 0.8 : 1;
        if (thirdRevealed && !retained) {
          const cross = compact ? 4.5 : 6;
          ctx.beginPath();
          ctx.moveTo(point.x - cross, point.y - cross);
          ctx.lineTo(point.x + cross, point.y + cross);
          ctx.moveTo(point.x + cross, point.y - cross);
          ctx.lineTo(point.x - cross, point.y + cross);
          ctx.stroke();
          ctx.setLineDash(plateDash('short'));
          ctx.beginPath();
          ctx.arc(point.x, point.y, compact ? 6 : 8, 0, TAU);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(point.x, point.y, compact ? 1.8 : 2.5, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(point.x, point.y, compact ? 5 : 7, 0, TAU);
          ctx.stroke();
          if (retained) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, compact ? 7.5 : 10, 0, TAU);
            ctx.stroke();
          }
        }
        ctx.restore();

        const shortText = thirdRevealed
          ? (retained ? 'FIX' : 'MISSED')
          : (retained ? 'NEAR EXPECTED POSITION' : 'OTHER CROSSING');
        const longText = thirdRevealed
          ? (retained ? 'ALL THREE CIRCLES AGREE' : 'THIRD CIRCLE MISSES')
          : (retained ? 'CANDIDATE NEAR EXPECTED POSITION' : 'OTHER CANDIDATE');
        const outward = norm({ x: point.x - cx, y: point.y - cy });
        callouts.place(compact ? shortText : longText, point, [
          {
            x: point.x + outward.x * (compact ? 10 : 15),
            y: point.y + outward.y * (compact ? 10 : 15),
            align: outward.x < 0 ? 'right' : 'left',
          },
          {
            x: point.x - outward.y * (compact ? 11 : 16),
            y: point.y + outward.x * (compact ? 11 : 16),
            align: -outward.y < 0 ? 'right' : 'left',
          },
        ], {
          size: compact ? 8 : 9,
          fallback: 'hide',
        });
      });

      if (thirdRevealed) {
        sepStat.set(fmtNM(candidateSeparation(ints)));
        thirdStat.set(fmtNM(sight.miss));
      } else {
        sepStat.set(fmtNM(candidateSeparation(ints)));
        thirdStat.set('hidden');
      }
    }

    const separationText = ints
      ? `${Math.round(candidateSeparation(ints)).toLocaleString('en-US')} nm apart`
      : 'no common crossing';
    const mixedLine = (segments, x, y, size, align = 'center') => {
      const widths = segments.map(segment => plateTextWidth(ctx, segment.text, segment.data
        ? {
          size,
          weight: segment.weight || 500,
          font: PLATE.dataFont,
          tracking: 0,
          uppercase: false,
        }
        : {
          size,
          weight: segment.weight || 500,
        }));
      const total = widths.reduce((sum, width) => sum + width, 0);
      let cursor = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
      segments.forEach((segment, index) => {
        if (segment.data) {
          plateDataText(ctx, segment.text, cursor, y, {
            size,
            weight: segment.weight || 500,
          });
        } else {
          plateText(ctx, segment.text, cursor, y, {
            size,
            weight: segment.weight || 500,
          });
        }
        cursor += widths[index];
      });
    };
    plateRule(ctx, ruleY, compact ? 8 : 13, w - (compact ? 8 : 13));
    if (compact) {
      mixedLine([
        { text: 'VEGA · ' },
        { text: `Ho ${altA.v.toFixed(1)}°`, data: true },
        { text: '   SIRIUS · ' },
        { text: `Ho ${altB.v.toFixed(1)}°`, data: true },
      ], w / 2, ruleY + 10, 8);
      if (!ints) {
        plateText(ctx, 'NO COMMON CROSSING · ADJUST ALTITUDES',
          w / 2, ruleY + 27, {
            size: 8,
            align: 'center',
          });
      } else if (thirdRevealed) {
        mixedLine([
          { text: 'THIRD CIRCLE CHOOSES FIX · ' },
          { text: separationText, data: true },
        ], w / 2, ruleY + 27, 8);
      } else {
        mixedLine([
          { text: 'TWO CANDIDATES · ' },
          { text: separationText, data: true },
          { text: ' · REVEAL THIRD' },
        ], w / 2, ruleY + 27, 8);
      }
    } else {
      mixedLine([
        { text: 'VEGA · ' },
        { text: `Ho ${fmtDM(altA.v, 1)}`, data: true },
      ], 16, ruleY + 20, 9.5, 'left');
      mixedLine([
        { text: 'SIRIUS · ' },
        { text: `Ho ${fmtDM(altB.v, 1)}`, data: true },
      ], w - 16, ruleY + 20, 9.5, 'right');
      if (!ints) {
        plateText(ctx, 'THE CIRCLES DO NOT CROSS · ADJUST EITHER ALTITUDE',
          w / 2, ruleY + 51, {
            size: 10,
            align: 'center',
          });
      } else if (thirdRevealed) {
        mixedLine([
          { text: 'THIRD CIRCLE CHOOSES THE FIX · ' },
          { text: separationText, data: true },
        ], w / 2, ruleY + 51, 10);
      } else {
        mixedLine([
          { text: 'TWO CANDIDATES · ' },
          { text: separationText, data: true },
          { text: ' · REVEAL THIRD SIGHT' },
        ], w / 2, ruleY + 51, 10);
      }
    }
  }
})();
