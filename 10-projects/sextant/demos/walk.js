'use strict';
/* Walking away from a star's GP. On the cross-section the observer's
   horizon tilts with the ground beneath them while the starlight stays
   parallel, so the altitude between them shrinks; "Your view", called out from
   where you stand, shows the same altitude as a sight schematic. */

(function demoWalk() {
  const d = createDemo('demo-walk', {
    aspect: 1.75,
    maxH: 400,
    compactAspect: 0.85,
    compactMaxH: 680,
    draw,
  });

  const dist = addValue(d, {
    label: 'distance from the GP',
    min: 0,
    max: 100,
    step: 1,
    value: 25,
    fmt: v => v.toFixed(0) + '°',
  });

  // the star sits 20° off vertical, so its GP reads as any point on the
  // globe rather than the pole at the top of the drawing
  const TILT = 20;
  // which side of the GP the observer stands on; dragging picks it
  let side = 1;
  let geo = null;
  d.canvas.classList.add('grab');
  // dragging in the caption's detail swings the line of sight to the
  // pointer; dragging the globe walks you around it
  onDetailDrag(d, a => dist.set(Math.round(90 - clamp(a, 0, 90)), { emit: false }));
  addDrag(d.canvas, {
    hit: p => nearGrab(p, geo && geo.grab),
    move(p) {
      if (!geo) return;
      let fromGp = Math.atan2(p.y - geo.cy, p.x - geo.cx) - geo.gpA;
      while (fromGp > Math.PI) fromGp -= TAU;
      while (fromGp < -Math.PI) fromGp += TAU;
      if (Math.abs(fromGp) > 0.002) side = Math.sign(fromGp);
      dist.set(clamp(Math.round(Math.abs(fromGp) * R2D), 0, 100), { emit: false });
    },
  });

  const fmtDeg = v => `${v.toFixed(0)}°`;

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const z = clamp(dist.v, 0, 100);
    const alt = 90 - z;

    // the outside view, with "Your view" in the caption
    const layout = plateDetailLayout(w, h, compact, ctx);
    const { detail, field } = layout;
    const headH = plateDetailHeading(ctx, layout, 'FROM OUTSIDE · THE SAME MOMENT');
    const globeBox = { x: field.x, y: field.y + headH, w: field.w, h: field.h - headH };

    const look = drawGlobe(ctx, globeBox, z, alt, compact, detail);
    plateAltitudeInstrument(detail, {
      sights: [{ alt, block: plateFigureBlock(ctx, `h = ${fmtDeg(Math.max(0, alt))}`, compact) }],
      mirror: look.mirror,
      below: alt < 0 ? 'STAR BELOW THE HORIZON' : null,
    });
  }

  function drawGlobe(ctx, box, z, alt, compact, detail) {
    const size = compact ? 8 : 9;
    // the star, drawn as in Figure 1-1, at the head of the GP's starlight
    const starR = compact ? 7.5 : 9;
    const starY = box.y + starR + 2;
    const rayTop = starY + starR + 6;
    const R = Math.min(box.w * (compact ? 0.3 : 0.33), (box.y + box.h - rayTop) * (compact ? 0.35 : 0.37));
    // a little left of centre: the tilted starlight carries everything right
    const cx = box.x + box.w * (compact ? 0.44 : 0.45);
    const cy = box.y + box.h - R - (compact ? 14 : 18);
    // the direction to the star, which is also the direction from the
    // centre to the GP
    const up = -Math.PI / 2 + TILT * D2R;
    geo = { cx, cy, gpA: up };
    const toStar = { x: Math.cos(up), y: Math.sin(up) };
    // a ray of starlight into point p, starting level with the others
    const rayFrom = p => {
      const len = (p.y - rayTop) / -toStar.y;
      return { x: p.x + toStar.x * len, y: p.y + toStar.y * len };
    };

    plateWireSphere(ctx, cx, cy, R, {
      tilt: 0, graticule: false, axis: false, northLabel: false,
    });

    const gp = { x: cx + toStar.x * R, y: cy + toStar.y * R };
    const a = up + side * z * D2R;
    const you = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    const visible = alt > 0;

    // centre construction and the distance travelled from the GP
    plateLine(ctx, { x: cx, y: cy }, gp, { kind: 'construction', weight: compact ? 0.6 : 0.75 });
    // local zenith: the centre line carried on out past the observer
    const zenithLen = Math.min(R * 0.42, compact ? 34 : 48);
    const zenithEnd = { x: you.x + Math.cos(a) * zenithLen, y: you.y + Math.sin(a) * zenithLen };
    // a finger takes the observer, or the zenith line over them
    geo.grab = [[you, zenithEnd]];
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

    // the star is so far away that the lines to it from the GP and from you
    // are parallel; both run outward with an arrow toward it, and yours is
    // labelled as aimed at the same star
    const head = compact ? 3.2 : 4;
    const gpRay = rayFrom(gp);
    // yours is a short arrow of fixed length: run all the way up it would
    // read as aimed at a spot on the page instead of the far-off star
    const youLen = compact ? 40 : 58;
    const youRay = { x: you.x + toStar.x * youLen, y: you.y + toStar.y * youLen };
    plateVector(ctx, gp, gpRay, { kind: 'long', weight: compact ? 0.8 : 1, head });
    if (visible) {
      plateVector(ctx, you, youRay, { kind: 'long', weight: compact ? 0.8 : 1, head });
    }
    const star = { x: gpRay.x + toStar.x * ((rayTop - starY) / -toStar.y), y: starY };
    starGlyph(ctx, star.x, star.y, starR, PLATE.ink);

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

    // "Your view" is called out from where you stand
    const callout = plateDetailCallout(ctx, you, detail, { toward: { x: cx, y: cy }, compact });

    const labels = createPlateLabeler(ctx, {
      left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h, gap: compact ? 2 : 3,
    });
    plateDetailMarks(callout).forEach(q => labels.reserve({ x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 }, 1));
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
    if (visible) reserveSegment(youRay, you);
    reserveSegment(gpRay, gp);
    labels.reserve({ x: star.x - starR - 3, y: star.y - starR - 3, w: starR * 2 + 6, h: starR * 2 + 6 });
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
      return { x: at.x, y: at.y, hw: tw / 2, hh: th / 2 };
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
      // named in the "what you see" panel, where there is room beside the star
      angleText(text, at, { size: altSize, weight: 700 });
    }
    if (z >= 7) {
      // the figure and its name travel together as one block, "25°" over
      // "FROM THE GP"
      const text = fmtDeg(z);
      const word = 'FROM THE GP';
      const zSize = compact ? 7.5 : 9;
      const wordSize = compact ? 6.8 : 7.5;
      const numH = plateSize(zSize) * 1.15, wordH = plateSize(wordSize) * 1.15;
      const bhw = Math.max(halfWidth(text, zSize), plateTextWidth(ctx, word, { size: wordSize }) / 2);
      const bhh = (numH + wordH) / 2;
      // always outside the angle: just across the GP line from the wedge,
      // level with its arc
      const p = { x: cx + toStar.x * centerArcR, y: cy + toStar.y * centerArcR };
      const pa = up - side * Math.PI / 2;
      const px = Math.cos(pa), py = Math.sin(pa);
      const off = (compact ? 5 : 7) + Math.abs(px) * bhw + Math.abs(py) * bhh;
      const at = { x: p.x + px * off, y: p.y + py * off };
      plateDataText(ctx, text, at.x, at.y - bhh + numH / 2, { size: zSize, align: 'center' });
      plateText(ctx, word, at.x, at.y + bhh - wordH / 2, { size: wordSize, align: 'center' });
      labels.reserve({ x: at.x - bhw, y: at.y - bhh, w: bhw * 2, h: bhh * 2 });
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
    labels.place(atGp && !compact ? 'YOU, AT THE GP · DRAG' : 'YOU · DRAG', you, youCandidates,
      { size, weight: 700, backed: false, leader: false });
    // your line aims at the same star as the GP's, far off the top of the page
    if (visible && !atGp) {
      // named at the tip of your short arrow
      const word = compact ? 'TO STAR' : 'DIRECTION TO STAR';
      labels.place(word, youRay, [
        { x: youRay.x, y: youRay.y - 16, align: 'center' },
        { x: youRay.x + 10, y: youRay.y - 6, align: 'left' },
        { x: youRay.x - 10, y: youRay.y - 6, align: 'right' },
      ], { size: 7.5, leader: false, fallback: 'hide' });
    }
    if (!compact) {
      labels.place('HORIZON', { x: you.x + tx, y: you.y + ty }, [
        { x: you.x - tx * 1.05 - side * 4, y: you.y - ty * 1.05 - 10, align: 'center' },
        { x: you.x + tx * 1.05, y: you.y + ty * 1.05 + 10, align: 'center' },
        { x: you.x - tx * 1.05, y: you.y - ty * 1.05 + 10, align: 'center' },
      ], { size: 7.5, leader: false, fallback: 'hide' });
    }
    // the detail faces the GP: on its right you look back left to the star.
    // It turns only when you cross the GP, not as the horizon tilts.
    return { mirror: side > 0 };
  }
})();
