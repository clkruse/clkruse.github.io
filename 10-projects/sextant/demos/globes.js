'use strict';
/* Plate globe helpers: the monochrome wire globe, rings of position and
   great-circle arithmetic that the ring of position (§3, demos/ring.js),
   the two-ring fix (§3.1, demos/fix.js) and the worked example draw with.
   makeGlobe supplies a drag-to-rotate view and projection (globeView and
   drawGlobeBase from app.js) for demos/lopzoom.js. */

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
  ctx.lineWidth = opts.outlineWeight ?? (compact ? 1.45 : 1.8);
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
