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
  const latSlider = addSlider(d, {
    label: 'your latitude', min: 5, max: 80, step: 0.5, value: lat,
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
    const phiMid = aObs * 0.5;
    plateDataText(ctx, 'φ',
      cx + Math.cos(phiMid) * (rPhi + (lat < 12 ? 8 : compact ? 9 : 12)),
      cy + Math.sin(phiMid) * (rPhi + (compact ? 9 : 12)), {
        size: compact ? 8 : 10,
        align: 'center',
      });

    const rH = Math.min(compact ? 16 : 29, R * 0.29);
    angleDim(ctx, O.x, O.y, rH, tangentAngle, -Math.PI / 2,
      PLATE.ink, compact ? 0.8 : 1);
    const hMid = (tangentAngle - Math.PI / 2) * 0.5;
    plateDataText(ctx, 'h',
      O.x + Math.cos(hMid) * (rH + (lat < 12 ? 10 : compact ? 9 : 12)),
      O.y + Math.sin(hMid) * (rH + (compact ? 9 : 12)), {
        size: compact ? 8 : 10,
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
      plateText(ctx, 'NCP', Math.min(x + w - 3, O.x + 7), starY + 6, {
        size: labelSize,
        align: O.x > x + w - 38 ? 'right' : 'left',
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
      plateText(ctx, 'EQUATOR', Math.max(x + 2, cx - R - 8), cy + 9, {
        size: labelSize,
        align: 'right',
      });
      plateText(ctx, 'POLAR AXIS', cx - 7, starY + 6, {
        size: labelSize,
        align: 'right',
      });
      plateText(ctx, compact ? 'NCP' : 'NCP DIRECTION', O.x + 8, starY + 6, {
        size: labelSize,
      });
    }

    if (compactCallout) {
      const youY = clamp(O.y + 13, diagramTop + 22, diagramBottom - 20);
      compactCallout('YOU', O, youY);
      compactCallout('HORIZON', lat < 25 ? horizonA : horizonB,
        clamp(youY + 15, diagramTop + 37, diagramBottom - 4));
    } else {
      const horizonLabelPoint = lat < 25 ? horizonA : horizonB;
      if (!paired) {
        plateText(ctx, 'HORIZON',
          clamp(horizonLabelPoint.x, x + 4, x + w - 4),
          clamp(horizonLabelPoint.y + (lat < 25 ? -7 : 9),
            diagramTop + 6, diagramBottom - 3), {
            size: labelSize,
            align: horizonLabelPoint.x > x + w * 0.72 ? 'right' : 'left',
          });
      }

      const youLabel = {
        x: clamp(O.x + (lat > 65 ? 12 : 18), x + 8, x + w - 28),
        y: clamp(O.y + (lat > 65 ? 16 : 13), diagramTop + 10, diagramBottom - 4),
      };
      plateLeader(ctx, O, youLabel, { head: compact ? 2.3 : 3 });
      plateText(ctx, 'YOU', youLabel.x + 3, youLabel.y, {
        size: labelSize,
      });
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
    const sinLat = Math.max(0.08, -Math.sin(idealAngle));
    const cap = paired ? Math.max(58, w - 34) : compact ? 230 : 185;
    const maxByWidth = (right - origin.x) / cosLat;
    const maxByHeight = (origin.y - diagramTop - 5) / sinLat;
    const sightLength = Math.max(44, Math.min(cap, maxByWidth, maxByHeight));
    const idealPole = {
      x: origin.x + Math.cos(idealAngle) * sightLength,
      y: origin.y + Math.sin(idealAngle) * sightLength,
    };
    const polaris = {
      x: origin.x + Math.cos(polarisAngle) * sightLength,
      y: origin.y + Math.sin(polarisAngle) * sightLength,
    };
    const labelSize = compact ? 7.5 : 8.5;

    plateText(ctx, paired ? '(B) DECK HEIGHT' : '(B) DECK / LOCAL ALTITUDE',
      x, titleY, {
        size: compact ? 7.5 : 9,
        weight: 600,
      });
    plateRule(ctx, ruleY, x, x + w);

    plateLine(ctx, { x: origin.x - (compact ? 8 : 12), y: origin.y }, {
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
    starGlyph(ctx, polaris.x, polaris.y, compact ? 5.5 : 6.5, PLATE.ink);

    const rH = compact ? 24 : 32;
    angleDim(ctx, origin.x, origin.y, rH, 0, idealAngle,
      PLATE.ink, compact ? 0.85 : 1.05);
    const hMid = idealAngle * 0.5;
    plateDataText(ctx, 'h',
      origin.x + Math.cos(hMid) * (rH + (lat < 12 ? 9 : compact ? 10 : 13)),
      origin.y + Math.sin(hMid) * (rH + (compact ? 10 : 13)), {
        size: compact ? 8.5 : 10,
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

    const ncpAlign = idealPole.x > x + w * 0.72 ? 'right' : 'left';
    const ncpY = clamp(idealPole.y + (lat < 30 ? 10 : -7),
      diagramTop + 5, origin.y - 8);
    plateText(ctx, paired ? 'NCP' : 'NCP · IDEAL',
      idealPole.x + (ncpAlign === 'right' ? -4 : 6),
      ncpY, {
        size: labelSize,
        align: ncpAlign,
      });
    const polarisAlign = polaris.x > x + w * 0.72 ? 'right' : 'left';
    let polarisY = clamp(polaris.y + (lat < 30 ? -10 : 10),
      diagramTop + 5, origin.y - 8);
    const labelGap = labelSize * 1.55;
    if (Math.abs(polarisY - ncpY) < labelGap) {
      polarisY = ncpY + labelGap <= origin.y - 8
        ? ncpY + labelGap
        : ncpY - labelGap;
    }
    plateText(ctx, 'POLARIS',
      polaris.x + (polarisAlign === 'right' ? -4 : 6),
      clamp(polarisY, diagramTop + 5, origin.y - 8), {
        size: labelSize,
        align: polarisAlign,
      });
    if (!paired) {
      plateText(ctx, 'OFFSET ENLARGED', right, diagramTop + 7, {
        size: compact ? 7.5 : 8,
        align: 'right',
      });
    }

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
