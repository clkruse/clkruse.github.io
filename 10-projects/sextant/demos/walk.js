'use strict';
/* Walking away from a star's GP. On the cross-section the observer's
   horizon tilts with the ground beneath them while the starlight stays
   parallel, so the altitude between them shrinks; the first-person panel
   shows the same star sinking from overhead toward the sea. */

(function demoWalk() {
  const d = createDemo('demo-walk', {
    aspect: 1.75,
    maxH: 400,
    compactAspect: 0.8,
    compactMaxH: 470,
    draw,
  });

  const dist = addSlider(d, {
    label: 'distance from the GP',
    min: 0,
    max: 100,
    step: 1,
    value: 25,
    fmt: v => v.toFixed(0) + '°',
  });
  const altStat = addStat(d, 'star’s altitude');

  // which side of the GP the observer stands on; dragging picks it
  let side = 1;
  let geo = null;
  d.canvas.classList.add('grab');
  addDrag(d.canvas, {
    move(p) {
      if (!geo) return;
      const fromUp = Math.atan2(p.x - geo.cx, geo.cy - p.y);
      if (Math.abs(fromUp) > 0.002) side = Math.sign(fromUp);
      dist.set(clamp(Math.round(Math.abs(fromUp) * R2D), 0, 100), { emit: false });
    },
  });

  const fmtDeg = v => `${v.toFixed(0)}°`;

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const z = clamp(dist.v, 0, 100);
    const alt = 90 - z;
    altStat.set(alt >= 0
      ? `90° − ${fmtDeg(z)} = ${fmtDeg(alt)}`
      : 'below the horizon');

    const pad = compact ? 10 : 16;
    const titleY = compact ? 15 : 19;
    plateText(ctx, compact
      ? 'THE STAR SINKS AS YOU WALK'
      : 'WALK AWAY FROM THE GP AND THE STAR SINKS',
    pad, titleY, { size: compact ? 8.5 : 10.5, weight: 600 });

    const fieldTop = titleY + (compact ? 14 : 20);
    const fieldBottom = h - pad;
    let globeBox, viewBox;
    if (compact) {
      const viewH = Math.min(150, (fieldBottom - fieldTop) * 0.36);
      globeBox = { x: pad, y: fieldTop, w: w - pad * 2, h: fieldBottom - fieldTop - viewH - 10 };
      viewBox = { x: pad, y: fieldBottom - viewH, w: w - pad * 2, h: viewH };
    } else {
      const viewW = Math.min(250, w * 0.34);
      globeBox = { x: pad, y: fieldTop, w: w - pad * 3 - viewW, h: fieldBottom - fieldTop };
      viewBox = { x: w - pad - viewW, y: fieldTop, w: viewW, h: fieldBottom - fieldTop };
    }

    drawGlobe(ctx, globeBox, z, alt, compact);
    drawView(ctx, viewBox, alt, compact);
  }

  function drawGlobe(ctx, box, z, alt, compact) {
    const size = compact ? 8 : 9;
    const rayTop = box.y + (compact ? 14 : 18);
    const R = Math.min(box.w * (compact ? 0.3 : 0.33), (box.y + box.h - rayTop) * (compact ? 0.35 : 0.37));
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h - R - (compact ? 22 : 28);
    geo = { cx, cy };
    const up = -Math.PI / 2;

    plateWireSphere(ctx, cx, cy, R, {
      tilt: 0, graticule: false, axis: false, northLabel: false,
    });

    const gp = { x: cx, y: cy - R };
    const a = up + side * z * D2R;
    const you = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    const visible = alt > 0;

    // centre construction and the distance travelled from the GP
    plateLine(ctx, { x: cx, y: cy }, gp, { kind: 'construction', weight: compact ? 0.6 : 0.75 });
    // local zenith: the centre line carried on out past the observer
    const zenithLen = Math.min(R * 0.42, compact ? 34 : 48);
    const zenithEnd = { x: you.x + Math.cos(a) * zenithLen, y: you.y + Math.sin(a) * zenithLen };
    plateLine(ctx, { x: cx, y: cy }, you, { kind: 'construction', weight: compact ? 0.6 : 0.75 });
    plateVector(ctx, you, zenithEnd, { kind: 'construction', weight: 0.75, head: compact ? 3 : 3.6 });

    const centerArcR = Math.min(R * 0.34, compact ? 22 : 32);
    if (z > 0.4) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.75 : 0.9;
      ctx.beginPath();
      arcBetween(ctx, cx, cy, centerArcR, up, a);
      ctx.stroke();
      ctx.restore();
    }

    // parallel starlight: one ray to the GP, one to the observer while the
    // star is still above their horizon
    const head = compact ? 3.2 : 4;
    plateVector(ctx, { x: gp.x, y: rayTop }, gp, { kind: 'long', weight: compact ? 0.8 : 1, head });
    if (visible) {
      plateVector(ctx, { x: you.x, y: rayTop }, you, { kind: 'long', weight: compact ? 0.8 : 1, head });
    }
    plateText(ctx, 'STARLIGHT', cx, rayTop - (compact ? 6 : 8), {
      size: compact ? 7.5 : 8.5, align: 'center',
    });

    // the observer's horizon, tangent to the ground under their feet
    const horizonHalf = Math.min(R * 0.42, compact ? 32 : 48);
    const tangent = a + Math.PI / 2;
    const tx = Math.cos(tangent) * horizonHalf, ty = Math.sin(tangent) * horizonHalf;
    plateLine(ctx, { x: you.x - tx, y: you.y - ty }, { x: you.x + tx, y: you.y + ty }, {
      weight: compact ? 1.1 : 1.35,
    });

    // altitude: from the horizon facing the GP up to the incoming starlight
    const altArcR = Math.min(R * 0.24, compact ? 16 : 22);
    const towardGp = a - side * Math.PI / 2;
    let altLabelAt = null;
    if (visible && alt > 0.4) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.9 : 1.1;
      ctx.beginPath();
      arcBetween(ctx, you.x, you.y, altArcR, towardGp, up);
      ctx.stroke();
      ctx.restore();
      let span = up - towardGp;
      while (span > Math.PI) span -= TAU;
      while (span < -Math.PI) span += TAU;
      const mid = towardGp + span / 2;
      altLabelAt = {
        x: you.x + Math.cos(mid) * (altArcR + (compact ? 13 : 17)),
        y: you.y + Math.sin(mid) * (altArcR + (compact ? 13 : 17)),
      };
    }

    for (const pt of [gp, you]) {
      ctx.save();
      ctx.fillStyle = PLATE.ink;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, compact ? 2.6 : 3.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(you.x, you.y, compact ? 4.4 : 5.4, 0, TAU);
    ctx.stroke();
    ctx.restore();

    const labels = createPlateLabeler(ctx, {
      left: box.x, top: rayTop, right: box.x + box.w, bottom: box.y + box.h, gap: compact ? 2 : 3,
    });
    // keep labels off the marks and lines they describe
    const reserveSegment = (p, q) => {
      const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 6));
      for (let i = 0; i <= n; i++) {
        const x = lerp(p.x, q.x, i / n), y = lerp(p.y, q.y, i / n);
        labels.reserve({ x: x - 2, y: y - 2, w: 4, h: 4 }, 1);
      }
    };
    labels.reserve({ x: gp.x - 5, y: gp.y - 5, w: 10, h: 10 });
    labels.reserve({ x: you.x - 7, y: you.y - 7, w: 14, h: 14 });
    reserveSegment({ x: you.x - tx, y: you.y - ty }, { x: you.x + tx, y: you.y + ty });
    reserveSegment(you, zenithEnd);
    reserveSegment({ x: cx, y: cy }, you);
    reserveSegment({ x: cx, y: cy }, gp);
    if (visible) reserveSegment({ x: you.x, y: rayTop }, you);
    reserveSegment({ x: gp.x, y: rayTop }, gp);
    // the globe outline itself
    for (let t = 0; t < TAU; t += 0.05) {
      labels.reserve({ x: cx + Math.cos(t) * R - 2, y: cy + Math.sin(t) * R - 2, w: 4, h: 4 }, 1);
    }
    // angle readouts sit inside their wedge where it is wide enough, and
    // otherwise in the neighbouring open wedge
    const angleText = (text, at, opts) => {
      plateDataText(ctx, text, at.x, at.y, { ...opts, align: 'center' });
      const tw = plateTextWidth(ctx, text, { ...opts, font: PLATE.dataFont, uppercase: false, tracking: 0 });
      const th = plateSize(opts.size) * 1.2;
      labels.reserve({ x: at.x - tw / 2, y: at.y - th / 2, w: tw, h: th });
    };
    const wedgeRadius = (halfW, spanDeg, minR) =>
      Math.max(minR, (halfW + 4) / Math.sin(Math.max(1e-3, spanDeg * D2R / 2)));
    const halfWidth = (text, size) => plateTextWidth(ctx, text, {
      size, font: PLATE.dataFont, uppercase: false, tracking: 0,
    }) / 2;

    if (altLabelAt) {
      const text = fmtDeg(alt);
      const altSize = compact ? 8 : 9.5;
      const hw = halfWidth(text, altSize);
      let span = up - towardGp;
      while (span > Math.PI) span -= TAU;
      while (span < -Math.PI) span += TAU;
      let at;
      const inside = wedgeRadius(hw, alt, altArcR + (compact ? 11 : 14));
      if (inside <= altArcR + (compact ? 30 : 40)) {
        const mid = towardGp + span / 2;
        at = { x: you.x + Math.cos(mid) * inside, y: you.y + Math.sin(mid) * inside };
      } else {
        // between the incoming starlight and the local zenith
        const mid = up + side * z * D2R / 2;
        const r = wedgeRadius(hw, z, altArcR + (compact ? 12 : 15));
        at = { x: you.x + Math.cos(mid) * r, y: you.y + Math.sin(mid) * r };
      }
      angleText(text, at, { size: altSize, weight: 700 });
    }
    if (z >= 7) {
      const text = fmtDeg(z);
      const zSize = compact ? 7.5 : 9;
      const hw = halfWidth(text, zSize);
      const r = wedgeRadius(hw, z, centerArcR + (compact ? 11 : 14));
      let at;
      if (r < R * 0.8) {
        const mid = up + side * z * D2R / 2;
        at = { x: cx + Math.cos(mid) * r, y: cy + Math.sin(mid) * r };
      } else {
        // narrow wedge: set the figure beside the GP line, level with its arc
        at = { x: cx - side * (hw + 7), y: cy - centerArcR + 2 };
      }
      angleText(text, at, { size: zSize });
    }
    const out = side;
    const align = out < 0 ? 'right' : 'left';
    const away = out < 0 ? 'left' : 'right';
    const gpCandidates = [
      { x: gp.x - out * 8, y: gp.y - 12, align: away },
      { x: gp.x - out * 8, y: gp.y - 26, align: away },
      { x: gp.x - out * 10, y: gp.y + 16, align: away },
    ];
    const atGp = z < 3;
    if (!atGp) labels.place('STAR’S GP', gp, gpCandidates, { size, leader: false, backed: false });
    // the observer label hunts outward around the observer for clear space
    const youCandidates = [];
    for (const r of [14, 22, 32]) {
      for (const turn of [0.9, 1.6, 0.35, 2.2]) {
        const t = a + side * turn;
        const ex = Math.cos(t), ey = Math.sin(t);
        youCandidates.push({
          x: you.x + ex * r, y: you.y + ey * r,
          align: Math.abs(ex) < 0.35 ? 'center' : ex < 0 ? 'right' : 'left',
        });
      }
    }
    labels.place(atGp ? 'YOU, AT THE GP' : 'YOU', you, youCandidates, { size, weight: 700, backed: false, leader: false });
    if (!compact) {
      labels.place('HORIZON', { x: you.x + tx, y: you.y + ty }, [
        { x: you.x - tx * 1.05 - side * 4, y: you.y - ty * 1.05 - 10, align: 'center' },
        { x: you.x + tx * 1.05, y: you.y + ty * 1.05 + 10, align: 'center' },
        { x: you.x - tx * 1.05, y: you.y - ty * 1.05 + 10, align: 'center' },
      ], { size: 7.5, leader: false, fallback: 'hide' });
      plateText(ctx, 'DRAG YOURSELF AROUND THE GLOBE', box.x + box.w / 2, box.y + box.h - 6, {
        size: 7.5, align: 'center',
      });
    }
  }

  function drawView(ctx, box, alt, compact) {
    plateBox(ctx, box.x, box.y, box.w, [], { height: box.h, padding: compact ? 6 : 8 });
    const size = compact ? 7.5 : 8.5;
    plateText(ctx, 'WHAT YOU SEE', box.x + (compact ? 8 : 10), box.y + (compact ? 11 : 15), {
      size: compact ? 8 : 9, weight: 600,
    });
    plateText(ctx, 'FACING THE GP', box.x + box.w - (compact ? 8 : 10), box.y + (compact ? 11 : 15), {
      size: compact ? 7 : 7.5, align: 'right',
    });
    const ruleY = box.y + (compact ? 21 : 28);
    plateLine(ctx, { x: box.x + 7, y: ruleY }, { x: box.x + box.w - 7, y: ruleY }, { weight: 0.55 });

    // sky above a sea horizon; altitude runs linearly up the frame
    const seaH = Math.max(compact ? 14 : 22, box.h * 0.13);
    const horizonY = box.y + box.h - seaH;
    const topY = ruleY + (compact ? 14 : 22);
    const yOf = deg => horizonY - (horizonY - topY) * deg / 90;
    const scaleX = box.x + (compact ? 34 : 42);
    const right = box.x + box.w - 8;

    // sea: short broken strokes thinning toward the eye
    for (let y = horizonY + 5, i = 0; y < box.y + box.h - 3; y += compact ? 5 : 6, i++) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = 0.45;
      ctx.setLineDash([6 + i * 3, 5 + i * 2]);
      ctx.lineDashOffset = i * 7;
      ctx.beginPath();
      ctx.moveTo(box.x + 4, y);
      ctx.lineTo(box.x + box.w - 4, y);
      ctx.stroke();
      ctx.restore();
    }
    plateLine(ctx, { x: box.x + 1, y: horizonY }, { x: box.x + box.w - 1, y: horizonY }, {
      weight: compact ? 1.2 : 1.5,
    });

    // altitude scale
    plateLine(ctx, { x: scaleX, y: horizonY }, { x: scaleX, y: topY }, { weight: 0.8 });
    for (let deg = 0; deg <= 90; deg += 15) {
      const y = yOf(deg);
      const major = deg % 30 === 0;
      plateLine(ctx, { x: scaleX - (major ? 5 : 3), y }, { x: scaleX, y }, { weight: 0.7 });
      if (major) {
        plateDataText(ctx, `${deg}°`, scaleX - 8, deg === 0 ? y - 6 : y, { size, align: 'right' });
        if (deg > 0) {
          plateLine(ctx, { x: scaleX + 3, y }, { x: right, y }, { kind: 'short', weight: 0.3 });
        }
      }
    }
    plateText(ctx, 'HORIZON', right, horizonY - (compact ? 7 : 9), {
      size: compact ? 7 : 7.5, align: 'right',
    });
    plateText(ctx, 'OVERHEAD', right, topY - (compact ? 7 : 9), {
      size: compact ? 7 : 7.5, align: 'right',
    });

    const starX = (scaleX + right) / 2 + (compact ? 0 : 6);
    if (alt >= 0) {
      const sy = yOf(alt);
      // a measured mark from the horizon up to the star
      plateLine(ctx, { x: starX, y: horizonY }, { x: starX, y: sy + 9 }, { kind: 'long', weight: 0.7 });
      starGlyph(ctx, starX, sy, compact ? 5.5 : 7, PLATE.ink);
      // low stars lift their figure clear of the HORIZON label
      plateDataText(ctx, fmtDeg(alt), starX + (compact ? 10 : 13), clamp(sy, topY + 4, horizonY - (compact ? 18 : 24)), {
        size: compact ? 8.5 : 10, weight: 700,
      });
    } else {
      plateText(ctx, 'BELOW THE HORIZON', starX, yOf(compact ? 30 : 22), {
        size: compact ? 7.5 : 8.5, weight: 600, align: 'center',
      });
    }
  }
})();
