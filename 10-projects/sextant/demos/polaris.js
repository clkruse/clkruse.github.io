'use strict';
/* §03: North Star height = latitude, as a monochrome plate. (A) The globe
   proof: the polar axis is square to the equator and the local vertical is
   square to the horizon, so the pole's altitude h equals latitude φ.
   (B) The deck view: the ideal pole direction at h = φ, with real Polaris
   drawn a small (enlarged) offset away. Drag either pane to change latitude. */

(function demoPolaris() {
  const d = createDemo('demo-polaris', {
    aspect: 1.3,
    maxH: 520,
    compactAspect: 0.64,
    compactMaxH: 440,
    draw,
  });
  let lat = 45;
  const latSlider = addValue(d, {
    label: 'latitude', min: 5, max: 80, step: 0.5, value: lat,
    fmt: v => v.toFixed(1) + '° N',
    onchange: v => { lat = v; },
  });
  const hStat = addStat(d, 'pole altitude (ideal)');
  const note = addStat(d, ' ', true);

  d.canvas.classList.add('grab');
  let geo = null, pane = null;
  addDrag(d.canvas, {
    start(p) {
      if (geo) {
        pane = geo.layout === 'stacked'
          ? (p.y < geo.localTop ? 'plate-globe' : 'plate-local')
          : (p.x < geo.splitX ? 'plate-globe' : 'plate-local');
      } else pane = null;
    },
    move(p) {
      if (!geo) return;
      if (pane === 'plate-globe') {
        lat = clamp(-Math.atan2(
          p.y - geo.globe.cy,
          p.x - geo.globe.cx,
        ) * R2D, 5, 80);
      } else if (pane === 'plate-local') {
        lat = clamp(-Math.atan2(
          p.y - geo.local.y,
          p.x - geo.local.x,
        ) * R2D, 5, 80);
      }
      latSlider.set(lat);
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    drawPolarisPlate(ctx, w, h);
    hStat.set(fmtDM(lat, 0));
  }

  function drawPolarisPlate(ctx, w, h) {
    const compact = w < 500;
    const stacked = compact && h >= 370;
    const margin = compact ? 8 : 14;
    const caveatH = compact ? 68 : 74;
    let globeBounds;
    let localBounds;
    let caveatBounds;
    let layout;
    let splitX = null;

    if (!compact) {
      layout = 'columns';
      splitX = Math.round(w * 0.50);
      const caveatY = h - margin - caveatH;
      globeBounds = {
        x: margin,
        y: 0,
        w: splitX - margin * 2,
        h: h - margin,
      };
      localBounds = {
        x: splitX + 16,
        y: 0,
        w: w - splitX - 16 - margin,
        h: caveatY - 8,
      };
      caveatBounds = {
        x: localBounds.x,
        y: caveatY,
        w: localBounds.w,
        h: caveatH,
      };
      plateLine(ctx, { x: splitX, y: 8 }, { x: splitX, y: h - 8 }, {
        weight: 0.7,
      });
    } else if (stacked) {
      layout = 'stacked';
      const caveatY = h - margin - caveatH;
      const splitY = clamp(Math.round(h * 0.38), 142, 180);
      globeBounds = {
        x: margin,
        y: 0,
        w: w - margin * 2,
        h: splitY,
      };
      localBounds = {
        x: margin,
        y: splitY + 4,
        w: w - margin * 2,
        h: caveatY - splitY - 10,
      };
      caveatBounds = {
        x: margin,
        y: caveatY,
        w: w - margin * 2,
        h: caveatH,
      };
    } else {
      layout = 'paired';
      splitX = Math.round(w * 0.50);
      const caveatY = h - margin - caveatH;
      globeBounds = {
        x: margin,
        y: 0,
        w: splitX - margin - 5,
        h: caveatY - 6,
      };
      localBounds = {
        x: splitX + 5,
        y: 0,
        w: w - splitX - margin - 5,
        h: caveatY - 6,
      };
      caveatBounds = {
        x: margin,
        y: caveatY,
        w: w - margin * 2,
        h: caveatH,
      };
      plateLine(ctx, { x: splitX, y: 6 }, {
        x: splitX,
        y: caveatY - 10,
      }, { weight: 0.65 });
    }

    const globeGeo = drawPlateGlobeProof(ctx, globeBounds, {
      compact,
      paired: layout === 'paired',
    });
    const localGeo = drawPlateLocalAltitude(ctx, localBounds, {
      compact,
      paired: layout === 'paired',
    });
    drawPlatePolarisCaveat(ctx, caveatBounds, compact);

    geo = {
      layout,
      splitX,
      localTop: localBounds.y,
      globe: globeGeo,
      local: localGeo,
    };

    note.set(lat < 12
      ? 'the exact pole skims the horizon; real Polaris circles around it'
      : lat > 70
        ? 'the exact pole is high; Polaris still moves slightly above and below latitude'
        : 'pole altitude equals latitude exactly; Polaris needs a small hour-angle correction');
  }

  // Label geometry helpers. Lines are reserved as chains of small points so
  // the labeler keeps text off every stroke; seat() puts a label's nearest
  // corner a fixed distance from a point in a given direction.
  const reservePoints = (labels, points, pad = 1.5) => {
    for (const p of points) labels.reserve({ x: p.x - 0.75, y: p.y - 0.75, w: 1.5, h: 1.5 }, pad);
  };
  const segmentPoints = (a, b, step = 3) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    return Array.from({ length: n + 1 }, (_, i) => ({
      x: a.x + (b.x - a.x) * i / n,
      y: a.y + (b.y - a.y) * i / n,
    }));
  };
  const arcPoints = (cx, cy, r, a1, a2, step = 3) => {
    const n = Math.max(2, Math.ceil(Math.abs(a2 - a1) * r / step));
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = a1 + (a2 - a1) * i / n;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
  };
  const LABEL_PAD = 1;
  const seat = (ctx, text, size, p, dir, dist) => {
    const width = plateTextWidth(ctx, text, { size }) + LABEL_PAD * 2;
    const height = plateSize(size) * 1.25 + LABEL_PAD * 2;
    const fx = clamp(dir.x * 3, -1, 1);
    const fy = clamp(dir.y * 3, -1, 1);
    return {
      x: p.x + dir.x * dist + fx * width / 2,
      y: p.y + dir.y * dist + fy * height / 2,
      align: 'center',
    };
  };
  const unit = deg => ({ x: Math.cos(deg * D2R), y: Math.sin(deg * D2R) });
  // An angle's symbol sits on the bisector while the wedge is wide enough
  // to hold it; a narrow wedge moves it once, to a fixed seat just outside.
  const angleSymbolPoint = (ctx, symbol, size, center, fromDeg, toDeg, rho, outsideDeg) => {
    const width = plateTextWidth(ctx, symbol, { size, font: PLATE.dataFont, uppercase: false, tracking: 0 });
    const clearance = Math.max(width, plateSize(size) * 0.75) / 2 + 3;
    const half = Math.abs(toDeg - fromDeg) / 2;
    const deg = rho * Math.sin(half * D2R) >= clearance
      ? (fromDeg + toDeg) / 2
      : outsideDeg(Math.asin(Math.min(1, clearance / rho)) * R2D);
    const p = { x: center.x + Math.cos(deg * D2R) * rho, y: center.y + Math.sin(deg * D2R) * rho };
    return { ...p, rect: { x: p.x - width / 2 - 1, y: p.y - plateSize(size) * 0.45, w: width + 2, h: plateSize(size) * 0.9 } };
  };

  function drawPlateGlobeProof(ctx, bounds, { compact, paired }) {
    const { x, y, w, h } = bounds;
    const titleY = y + (compact ? 10 : 15);
    const ruleY = y + (compact ? 22 : 31);
    const equationY = y + h - (compact ? 10 : 16);
    const invariantY = equationY - (compact ? 13 : 18);
    const diagramTop = ruleY + (compact ? 7 : 11);
    const diagramBottom = invariantY - (compact ? 8 : 14);
    const radiusByWidth = w * (paired ? 0.27 : compact ? 0.145 : 0.31);
    const radiusByHeight = (diagramBottom - diagramTop) * (compact ? 0.35 : 0.34);
    const R = Math.max(22, Math.min(radiusByWidth, radiusByHeight, compact ? 54 : 108));
    const cx = x + w * (paired ? 0.50 : compact ? 0.42 : 0.45);
    const cy = diagramTop + (diagramBottom - diagramTop) * 0.59;
    const starY = diagramTop + 2;
    const aObs = -lat * D2R;
    const u = { x: Math.cos(aObs), y: Math.sin(aObs) };
    const O = { x: cx + R * u.x, y: cy + R * u.y };
    const tangent = rot(u, Math.PI / 2);
    const tNorth = tangent.y < 0
      ? tangent
      : { x: -tangent.x, y: -tangent.y };
    const tangentAngle = Math.atan2(tNorth.y, tNorth.x);
    const horizonLength = R * (compact ? 0.68 : 0.72);
    const horizonA = {
      x: O.x + tNorth.x * horizonLength,
      y: O.y + tNorth.y * horizonLength,
    };
    const horizonB = {
      x: O.x - tNorth.x * horizonLength * 0.72,
      y: O.y - tNorth.y * horizonLength * 0.72,
    };
    const labelSize = compact ? 7.5 : 8.5;
    let compactCallout = null;

    plateText(ctx, paired ? '(A) GLOBE PROOF' : '(A) GLOBE / EQUAL-ANGLE PROOF',
      x, titleY, {
        size: compact ? 7.5 : 9,
        weight: 600,
      });
    plateRule(ctx, ruleY, x, x + w);

    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.25 : 1.7;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    plateLine(ctx, { x: cx - R - (compact ? 8 : 18), y: cy }, {
      x: cx + R + (compact ? 10 : 20),
      y: cy,
    }, { kind: 'construction', weight: compact ? 0.5 : 0.65 });
    plateLine(ctx, { x: cx, y: cy + R + (compact ? 7 : 15) }, {
      x: cx,
      y: starY + 5,
    }, { kind: 'construction', weight: compact ? 0.5 : 0.65 });
    rightAngleMark(ctx, cx, cy, 0, -Math.PI / 2,
      compact ? 6.5 : 10, PLATE.ink);

    plateLine(ctx, { x: cx, y: cy }, O, {
      weight: compact ? 0.75 : 0.95,
    });
    plateLine(ctx, horizonA, horizonB, {
      weight: compact ? 0.8 : 1,
    });
    rightAngleMark(ctx, O.x, O.y, aObs, tangentAngle,
      compact ? 5.5 : 8, PLATE.ink);

    const poleTop = { x: O.x, y: starY + (compact ? 5 : 9) };
    plateVector(ctx, O, poleTop, {
      weight: compact ? 1 : 1.25,
      head: compact ? 3 : 4,
    });

    const rPhi = R * 0.36;
    angleDim(ctx, cx, cy, rPhi, 0, aObs, PLATE.ink,
      compact ? 0.8 : 1);
    const symbolSize = compact ? 8 : 10;
    // φ: between the equator and the radius; when narrow, just above the radius.
    const phiAt = angleSymbolPoint(ctx, 'φ', symbolSize, { x: cx, y: cy },
      0, -lat, rPhi + (compact ? 9 : 12), off => -lat - off);
    plateDataText(ctx, 'φ', phiAt.x, phiAt.y, {
      size: symbolSize,
      align: 'center',
    });

    const rH = Math.min(compact ? 16 : 29, R * 0.29);
    angleDim(ctx, O.x, O.y, rH, tangentAngle, -Math.PI / 2,
      PLATE.ink, compact ? 0.8 : 1);
    // h: between the horizon and the vertical; when narrow, just right of the vertical.
    const hAt = angleSymbolPoint(ctx, 'h', symbolSize, O,
      tangentAngle * R2D, -90, rH + (compact ? 9 : 12), off => -90 + off);
    plateDataText(ctx, 'h', hAt.x, hAt.y, {
      size: symbolSize,
      align: 'center',
    });

    centerMark(ctx, cx, cy, compact ? 4 : 5.5, PLATE.ink);
    pointMark(ctx, O.x, O.y, PLATE.ink);

    if (paired) {
      plateText(ctx, 'EQ.', x + 2, cy + 8, { size: labelSize });
      plateText(ctx, 'AXIS', cx - 5, starY + 6, {
        size: labelSize,
        align: 'right',
      });
      // right of the pole line when it fits, else left of it
      const ncpFitsRight = O.x + 7 + plateTextWidth(ctx, 'NCP', { size: labelSize }) <= x + w - 2;
      plateText(ctx, 'NCP', ncpFitsRight ? O.x + 7 : O.x - 7, starY + 6, {
        size: labelSize,
        align: ncpFitsRight ? 'left' : 'right',
      });
    } else if (compact) {
      const rightLabelX = x + w - 3;
      compactCallout = (text, target, labelY) => {
        const textWidth = plateTextWidth(ctx, text, { size: labelSize });
        const anchor = {
          x: rightLabelX - textWidth - 4,
          y: labelY,
        };
        ctx.save();
        ctx.fillStyle = PLATE.paper;
        ctx.fillRect(anchor.x - 2, labelY - labelSize * 0.72,
          textWidth + 6, labelSize * 1.44);
        ctx.restore();
        plateLeader(ctx, target, anchor, { head: 2.3 });
        plateText(ctx, text, rightLabelX, labelY, {
          size: labelSize,
          align: 'right',
        });
      };
      const axisLabelY = diagramTop + 5;
      const axisWidth = plateTextWidth(ctx, 'POLAR AXIS', { size: labelSize });
      ctx.save();
      ctx.fillStyle = PLATE.paper;
      ctx.fillRect(x, axisLabelY - labelSize * 0.72,
        axisWidth + 5, labelSize * 1.44);
      ctx.restore();
      plateLeader(ctx, { x: cx, y: starY + 6 }, {
        x: x + axisWidth + 3,
        y: axisLabelY,
      }, { head: 2.3 });
      plateText(ctx, 'POLAR AXIS', x + 1, axisLabelY, {
        size: labelSize,
      });
      plateText(ctx, 'EQUATOR', x + 1, cy + 9, {
        size: labelSize,
      });
      compactCallout('NCP', poleTop, diagramTop + 5);
    } else {
      const labels = createPlateLabeler(ctx, {
        left: x,
        top: ruleY + 3,
        right: x + w,
        bottom: invariantY - 8,
        gap: 1.5,
      });
      reservePoints(labels, arcPoints(cx, cy, R, 0, TAU), 1.5);
      reservePoints(labels, segmentPoints(
        { x: cx - R - 18, y: cy }, { x: cx + R + 20, y: cy }));
      reservePoints(labels, segmentPoints(
        { x: cx, y: cy + R + 15 }, { x: cx, y: starY + 5 }));
      reservePoints(labels, segmentPoints({ x: cx, y: cy }, O));
      reservePoints(labels, segmentPoints(horizonA, horizonB));
      reservePoints(labels, segmentPoints(O, poleTop));
      reservePoints(labels, arcPoints(cx, cy, rPhi, aObs, 0));
      reservePoints(labels, arcPoints(O.x, O.y, rH, tangentAngle, -Math.PI / 2));
      labels.reserve({ x: cx - 6, y: cy - 11, w: 17, h: 17 }, 1);
      labels.reserve({ x: O.x - 9, y: O.y - 9, w: 18, h: 18 }, 1);
      labels.reserve(phiAt.rect, 1);
      labels.reserve(hAt.rect, 1);
      const opts = { size: labelSize, padding: LABEL_PAD, backed: false, leader: false };

      labels.place('POLAR AXIS', null, [
        { x: cx - 7, y: starY + 6, align: 'right' },
        { x: cx - 7, y: starY + 20, align: 'right' },
      ], opts);
      labels.place('TO NCP', null, [
        { x: O.x + 8, y: starY + 6, align: 'left' },
        { x: O.x - 8, y: starY + 6, align: 'right' },
        { x: O.x + 8, y: starY + 20, align: 'left' },
      ], opts);
      // outside the globe at the line's end when there is room, else just
      // inside the limb, under the line
      labels.place('EQUATOR', null, [
        { x: cx - R - 8, y: cy + 10, align: 'right' },
        { x: cx - R + 9, y: cy + 11, align: 'left' },
        { x: cx - R + 9, y: cy - 11, align: 'left' },
      ], opts);
      // YOU sits in the open wedge between the zenith line and the south
      // half of the horizon, on its bisector.
      const youDeg = -lat / 2;
      labels.place('YOU', null, [
        seat(ctx, 'YOU', labelSize, O, unit(youDeg), 7),
        seat(ctx, 'YOU', labelSize, O, unit(youDeg - 25), 8),
        seat(ctx, 'YOU', labelSize, O, unit(youDeg + 25), 8),
      ], opts);
      // HORIZON at the clear south end of its own line, else in the open
      // column beside the globe with a leader.
      const south = { x: -tNorth.x, y: -tNorth.y };
      const placed = labels.place('HORIZON', null, [
        seat(ctx, 'HORIZON', labelSize, horizonB, south, 4),
        seat(ctx, 'HORIZON', labelSize, horizonA, tNorth, 4),
      ], { ...opts, fallback: 'hide' });
      if (!placed) {
        const target = {
          x: O.x + south.x * horizonLength * 0.45,
          y: O.y + south.y * horizonLength * 0.45,
        };
        labels.place('HORIZON', target, [12, -14, 26, -28, 40, 54].map(dy => ({
          x: x + w - 2,
          y: target.y + dy,
          align: 'right',
        })), { size: labelSize, padding: LABEL_PAD, backed: false });
      }
    }

    if (compactCallout) {
      const youY = clamp(O.y + 13, diagramTop + 22, diagramBottom - 20);
      compactCallout('YOU', O, youY);
      // the south end stays below YOU, so the two leaders never cross
      compactCallout('HORIZON', horizonB,
        clamp(youY + 15, diagramTop + 37, diagramBottom - 4));
    }

    plateText(ctx, paired ? 'IDEAL: PERPENDICULAR PAIRS' : 'TWO PERPENDICULAR PAIRS',
      x + w / 2, invariantY, {
        size: compact ? 7.5 : 8,
        weight: 600,
        align: 'center',
      });
    plateDataText(ctx, `h = φ = ${lat.toFixed(1)}°`, x + w / 2, equationY, {
      size: compact ? 8.5 : 10,
      weight: 600,
      align: 'center',
    });

    return { cx, cy };
  }

  function drawPlateLocalAltitude(ctx, bounds, { compact, paired }) {
    const { x, y, w, h } = bounds;
    const titleY = y + (compact ? 10 : 15);
    const ruleY = y + (compact ? 22 : 31);
    const realEquationY = y + h - (compact ? 9 : 14);
    const idealEquationY = realEquationY - (compact ? 17 : 20);
    const diagramTop = ruleY + (compact ? 8 : 12);
    const origin = {
      x: x + (compact ? 22 : 28),
      y: idealEquationY - (compact ? 25 : 32),
    };
    const right = x + w - (compact ? 5 : 7);
    const idealAngle = -lat * D2R;
    const offset = (compact ? 4.5 : 3.5) * D2R;
    const polarisAngle = idealAngle - offset;
    const cosLat = Math.max(0.08, Math.cos(idealAngle));
    const cap = paired ? Math.max(58, w - 34) : compact ? 230 : 185;
    const labelSize = compact ? 7.5 : 8.5;
    const ncpText = paired ? 'NCP' : 'NCP · IDEAL';
    // keep room beyond the tip for its label when the line runs flat
    const tipRoom = plateTextWidth(ctx, ncpText, { size: labelSize }) + 10;
    const maxByWidth = Math.max(44 * cosLat, right - tipRoom - origin.x) / cosLat;
    // the star rides above the ideal line; keep a label's height clear above it
    const starR = compact ? 5.5 : 6.5;
    const topRoom = plateSize(labelSize) * 1.25 + starR + 4;
    const maxByHeight = (origin.y - diagramTop - topRoom)
      / Math.max(0.08, Math.sin(lat * D2R + offset));
    const sightLength = Math.max(44, Math.min(cap, maxByWidth, maxByHeight));
    const idealPole = {
      x: origin.x + Math.cos(idealAngle) * sightLength,
      y: origin.y + Math.sin(idealAngle) * sightLength,
    };
    const polaris = {
      x: origin.x + Math.cos(polarisAngle) * sightLength,
      y: origin.y + Math.sin(polarisAngle) * sightLength,
    };

    plateText(ctx, paired ? '(B) DECK HEIGHT' : '(B) DECK / LOCAL ALTITUDE',
      x, titleY, {
        size: compact ? 7.5 : 9,
        weight: 600,
      });
    plateRule(ctx, ruleY, x, x + w);

    const horizonStart = { x: origin.x - (compact ? 8 : 12), y: origin.y };
    plateLine(ctx, horizonStart, {
      x: right,
      y: origin.y,
    }, { weight: compact ? 0.9 : 1.1 });
    plateVector(ctx, origin, idealPole, {
      weight: compact ? 1.05 : 1.3,
      head: compact ? 3.2 : 4.2,
    });
    plateLine(ctx, origin, polaris, {
      kind: 'short',
      weight: compact ? 0.65 : 0.75,
    });
    starGlyph(ctx, polaris.x, polaris.y, starR, PLATE.ink);

    const rH = compact ? 24 : 32;
    angleDim(ctx, origin.x, origin.y, rH, 0, idealAngle,
      PLATE.ink, compact ? 0.85 : 1.05);
    const symbolSize = compact ? 8.5 : 10;
    // h: inside its wedge while it fits, else above the Polaris line
    const hAt = angleSymbolPoint(ctx, 'h', symbolSize, origin,
      0, -lat, rH + (compact ? 10 : 13), off => -lat - offset * R2D - off);
    plateDataText(ctx, 'h', hAt.x, hAt.y, {
      size: symbolSize,
      align: 'center',
    });

    pointMark(ctx, origin.x, origin.y, PLATE.ink);
    plateText(ctx, 'NORTH HORIZON', right, origin.y + (compact ? 10 : 12), {
      size: labelSize,
      align: 'right',
    });
    plateText(ctx, paired ? 'EYE' : 'OBSERVER', origin.x, origin.y + (compact ? 11 : 13), {
      size: labelSize,
    });

    const labels = createPlateLabeler(ctx, {
      left: x,
      top: ruleY + 3,
      right: x + w,
      bottom: origin.y - 2,
      gap: 1.5,
    });
    reservePoints(labels, segmentPoints(horizonStart, { x: right, y: origin.y }), 0.5);
    reservePoints(labels, segmentPoints(origin, idealPole));
    reservePoints(labels, segmentPoints(origin, polaris));
    reservePoints(labels, arcPoints(origin.x, origin.y, rH, idealAngle, 0));
    labels.reserve({
      x: polaris.x - starR, y: polaris.y - starR, w: starR * 2, h: starR * 2,
    }, 1);
    labels.reserve(hAt.rect, 1);
    const opts = { size: labelSize, padding: LABEL_PAD, backed: false, leader: false };
    if (!paired) {
      labels.place('OFFSET ENLARGED', null, [
        { x: right, y: diagramTop + 7, align: 'right' },
        { x: right, y: diagramTop + 21, align: 'right' },
      ], { ...opts, size: compact ? 7.5 : 8 });
    }
    // Polaris sits off the ideal line on one side; its label goes further
    // out on that side, and the ideal pole's label on the other.
    const chord = {
      x: polaris.x - idealPole.x,
      y: polaris.y - idealPole.y,
    };
    const chordLength = Math.hypot(chord.x, chord.y) || 1;
    const outward = { x: chord.x / chordLength, y: chord.y / chordLength };
    const inward = { x: -outward.x, y: -outward.y };
    const along = { x: Math.cos(idealAngle), y: Math.sin(idealAngle) };
    labels.place('POLARIS', null, [
      seat(ctx, 'POLARIS', labelSize, polaris, outward, starR + 3),
      seat(ctx, 'POLARIS', labelSize, polaris, { x: 0, y: -1 }, starR + 3),
      seat(ctx, 'POLARIS', labelSize, polaris, { x: -1, y: 0 }, starR + 3),
    ], opts);
    // lean the ideal pole's label back along its line, away from the star
    const awayLength = Math.hypot(inward.x - along.x * 0.5, inward.y - along.y * 0.5) || 1;
    const away = {
      x: (inward.x - along.x * 0.5) / awayLength,
      y: (inward.y - along.y * 0.5) / awayLength,
    };
    labels.place(ncpText, null, [
      seat(ctx, ncpText, labelSize, idealPole, away, 6),
      seat(ctx, ncpText, labelSize, idealPole, inward, 6),
      seat(ctx, ncpText, labelSize, idealPole, along, 8),
      seat(ctx, ncpText, labelSize, idealPole, { x: 1, y: 0 }, 8),
    ], opts);

    plateDataText(ctx, `ideal pole: h = φ = ${lat.toFixed(1)}°`,
      x + w / 2, idealEquationY, {
        size: compact ? 8 : 9,
        weight: 600,
        align: 'center',
      });
    plateDataText(ctx, 'Polaris altitude ≈ φ',
      x + w / 2, realEquationY, {
        size: compact ? 8 : 9,
        weight: 600,
        align: 'center',
      });

    return origin;
  }

  function drawPlatePolarisCaveat(ctx, bounds, compact) {
    plateBox(ctx, bounds.x, bounds.y, bounds.w, [
      {
        text: 'Polaris is about 0.7° from the pole.',
        font: PLATE.dataFont,
        uppercase: false,
        tracking: 0,
      },
      {
        text: 'Hour angle sets observed altitude above or below φ.',
        font: PLATE.dataFont,
        uppercase: false,
        tracking: 0,
      },
    ], {
      title: 'REAL-STAR CAVEAT',
      size: compact ? 7.5 : 8,
      lineHeight: compact ? 10.5 : 11.5,
      padding: compact ? 6 : 7,
      height: bounds.h,
    });
  }
})();
