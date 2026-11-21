'use strict';
/* Opening figure: one ray from Earth's center in the star's direction meets
   the surface at the stellar geographical position (GP).
   The star glyph is always a direction marker, never a nearby object. */

(function demoCenter() {
  const d = createDemo('demo-center', {
    aspect: 1.4,
    maxH: 480,
    draw,
  });
  let ang = -52 * D2R;
  d.canvas.classList.add('grab');
  let geo = null;
  addDrag(d.canvas, {
    move(p) {
      if (!geo) return;
      ang = Math.atan2(p.y - geo.cy, p.x - geo.cx);
    },
  });

  function draw(ctx, w, h) {
    drawAngularAddress(ctx, w, h);
  }

  function drawAngularAddress(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 480 || h < 300;
    // the figure's title is set in its caption, so the field starts at the top
    const fieldTop = compact ? 12 : 16;
    const fieldBottom = h - (compact ? 8 : 13);
    // a smaller Earth leaves the star a clear stretch of sky beyond the GP,
    // so its label never crowds the GP and horizon labels
    const extension = compact ? 34 : 64;
    const cx = w * 0.5;
    const cy = (fieldTop + fieldBottom) / 2;
    const R = Math.max(compact ? 34 : 58, Math.min(
      w * (compact ? 0.24 : 0.25),
      // and room past the star for its label at any angle
      (fieldBottom - fieldTop) / 2 - extension - (compact ? 24 : 18)
    ));
    const u = { x: Math.cos(ang), y: Math.sin(ang) };
    const gp = { x: cx + R * u.x, y: cy + R * u.y };
    const tangent = { x: -u.y, y: u.x };
    const star = {
      x: cx + (R + extension) * u.x,
      y: cy + (R + extension) * u.y,
    };
    geo = { cx, cy, R };

    plateWireSphere(ctx, cx, cy, R, {
      graticule: false,
      axis: false,
      northLabel: false,
    });
    plateVector(ctx, { x: cx, y: cy }, {
      x: star.x - u.x * (compact ? 9 : 12),
      y: star.y - u.y * (compact ? 9 : 12),
    }, {
      weight: compact ? 1.2 : 1.5,
      head: compact ? 3.6 : 4.5,
    });

    const horizonHalf = Math.min(R * 0.5, compact ? 32 : 64);
    plateLine(ctx,
      { x: gp.x - tangent.x * horizonHalf, y: gp.y - tangent.y * horizonHalf },
      { x: gp.x + tangent.x * horizonHalf, y: gp.y + tangent.y * horizonHalf },
      { weight: compact ? 0.7 : 0.9 });
    rightAngleMark(ctx, gp.x, gp.y, ang, ang - Math.PI / 2,
      compact ? 6 : 8, PLATE.ink);

    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, compact ? 2 : 2.6, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gp.x, gp.y, compact ? 2.4 : 3, 0, TAU);
    ctx.fill();
    starGlyph(ctx, star.x, star.y, compact ? 7.5 : 9, PLATE.ink);

    // Labels follow what they name at a fixed offset, so they slide with
    // the drag and never hop between seats. Each one's text hangs off its
    // anchor in a set direction; the text's alignment eases from
    // right-aligned through centered to left-aligned as that direction
    // turns, so nothing jumps. Labels away from their subject reach it with
    // a period leader: a short level shoulder off the end of the text, one
    // straight run, and a small arrowhead on the subject.
    const typeSize = compact ? 8 : 9.2;
    const lineH = plateSize(typeSize) * 1.2;
    const hang = (text, anchor, dir, opts = {}) => {
      const tw = plateTextWidth(ctx, text, { size: typeSize, weight: opts.weight });
      const kx = clamp(dir.x / 0.6, -1, 1);
      const ky = clamp(dir.y / 0.6, -1, 1);
      const gap = opts.gap ?? 5;
      let x = anchor.x + kx * (tw / 2 + gap);
      const y = anchor.y + ky * (lineH / 2 + 2) * (1 - Math.abs(kx) * 0.75);
      x = clamp(x, tw / 2 + 6, w - tw / 2 - 6);
      plateText(ctx, text, x, y, { size: typeSize, weight: opts.weight, align: 'center' });
      return { x, y, hw: tw / 2 };
    };
    // the arrowhead stops a hair short of its subject (clear of a dot's
    // radius when there is one) so the mark itself stays unobstructed
    const leaderTo = (box, target, clearance = 0) => {
      const side = target.x < box.x ? -1 : 1;
      const start = { x: box.x + side * (box.hw + 4), y: box.y };
      const shoulder = { x: start.x + side * (compact ? 6 : 9), y: start.y };
      const run = Math.hypot(target.x - shoulder.x, target.y - shoulder.y) || 1;
      const back = Math.min(clearance + (compact ? 2 : 2.5), run * 0.4);
      const tip = {
        x: target.x - (target.x - shoulder.x) / run * back,
        y: target.y - (target.y - shoulder.y) / run * back,
      };
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.55 : 0.6;
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(shoulder.x, shoulder.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.restore();
      plateArrowhead(ctx, tip,
        Math.atan2(target.y - shoulder.y, target.x - shoulder.x), compact ? 4 : 5);
    };
    const polar = (a, r) => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    const dirOf = a => ({ x: Math.cos(a), y: Math.sin(a) });
    const starR = compact ? 7.5 : 9;

    // each leader comes in on the diagonal of the open quadrant between the
    // ray and the horizon, so it never runs alongside either of them
    const diag = (sideSign) => {
      const c = Math.SQRT1_2;
      return { x: u.x * c + sideSign * tangent.x * c, y: u.y * c + sideSign * tangent.y * c };
    };
    const gpDir = diag(1);

    // star: hangs just past the glyph's points, along the star's direction.
    // Near a canvas edge there is no room beyond the star, so the label
    // stacks above it (below, when the star points down) instead of being
    // pushed back across the glyph.
    {
      const a = { x: star.x + u.x * starR * 1.25, y: star.y + u.y * starR * 1.25 };
      const kx = clamp(u.x / 0.6, -1, 1);
      const fitsBeyond = t => {
        const hw = plateTextWidth(ctx, t, { size: typeSize }) / 2;
        const want = a.x + kx * (hw + 6);
        return want - hw >= 6 && want + hw <= w - 6;
      };
      // the full wording when there is room past the star, else the short one
      const text = !compact && fitsBeyond('STAR LOCATION · DRAG')
        ? 'STAR LOCATION · DRAG' : 'STAR · DRAG';
      const hw = plateTextWidth(ctx, text, { size: typeSize }) / 2;
      if (fitsBeyond(text)) {
        hang(text, a, u, { gap: 6 });
      } else {
        // a level ray leaves both sides open: take the one away from the GP label
        const below = Math.abs(u.y) > 0.25 ? u.y > 0 : gpDir.y < 0;
        plateText(ctx, text,
          clamp(star.x, hw + 6, w - hw - 6),
          star.y + (below ? 1 : -1) * (starR + lineH / 2 + 4),
          { size: typeSize, align: 'center' });
      }
    }

    // the GP, its horizon tick and the star all meet at one spot, so the GP
    // and horizon labels stand off on leaders; the star and Earth's center
    // are labeled directly
    const out = compact ? 26 : 42;
    const gpReach = compact ? 40 : 66;
    leaderTo(hang(compact ? 'GP' : 'GROUND POSITION (GP)',
      { x: gp.x + gpDir.x * gpReach, y: gp.y + gpDir.y * gpReach },
      gpDir, { weight: 600 }), gp, compact ? 2.4 : 3);

    // Earth's center: centered under the dot, or over it when the ray points
    // down, so it sits in the half of the globe the ray never crosses
    plateText(ctx, compact ? 'EARTH' : 'EARTH CENTER',
      cx, cy + (u.y <= 0 ? 1 : -1) * (lineH / 2 + 5),
      { size: typeSize, align: 'center' });

    if (!compact) {
      // local horizon: on the far side of the ray from the GP label, its
      // leader coming in on the outer diagonal to a point near the line's end
      const hzDir = diag(-1);
      const hzPt = { x: gp.x - tangent.x * horizonHalf * 0.8, y: gp.y - tangent.y * horizonHalf * 0.8 };
      leaderTo(hang('LOCAL HORIZON',
        { x: hzPt.x + hzDir.x * 44, y: hzPt.y + hzDir.y * 44 }, hzDir), hzPt);

      // the ray is the one mark with no room beside it inside the globe, so
      // its label sits outside, further round from the GP label, on a leader
      const rayAngle = ang + 1.45;
      leaderTo(hang('RAY FROM CENTER TO STAR', polar(rayAngle, R + out * 0.7), dirOf(rayAngle)),
        { x: cx + u.x * R * 0.55, y: cy + u.y * R * 0.55 });
    }
  }
})();
