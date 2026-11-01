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
    const titleSize = compact ? 8.5 : 10.5;
    const fieldTop = compact ? 31 : 39;
    const fieldBottom = h - (compact ? 8 : 13);
    const extension = compact ? 23 : 38;
    const cx = w * 0.5;
    const cy = (fieldTop + fieldBottom) / 2;
    const R = Math.max(compact ? 34 : 58, Math.min(
      w * (compact ? 0.27 : 0.29),
      (fieldBottom - fieldTop) / 2 - extension
    ));
    const u = { x: Math.cos(ang), y: Math.sin(ang) };
    const gp = { x: cx + R * u.x, y: cy + R * u.y };
    const tangent = { x: -u.y, y: u.x };
    const star = {
      x: cx + (R + extension) * u.x,
      y: cy + (R + extension) * u.y,
    };
    geo = { cx, cy, R };

    plateText(ctx, compact
      ? 'ONE RAY FINDS THE GP'
      : 'ONE CENTER RAY FINDS THE STAR’S GP',
    compact ? 9 : 14, compact ? 16 : 19, {
      size: titleSize,
      align: 'left',
    });

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

    const horizonHalf = Math.min(R * 0.29, compact ? 18 : 34);
    plateLine(ctx,
      { x: gp.x - tangent.x * horizonHalf, y: gp.y - tangent.y * horizonHalf },
      { x: gp.x + tangent.x * horizonHalf, y: gp.y + tangent.y * horizonHalf },
      { weight: compact ? 0.7 : 0.9 });
    rightAngleMark(ctx, gp.x, gp.y, ang, ang + Math.PI / 2,
      compact ? 6 : 8, PLATE.ink);

    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, compact ? 2 : 2.6, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gp.x, gp.y, compact ? 2.4 : 3, 0, TAU);
    ctx.fill();
    starGlyph(ctx, star.x, star.y, compact ? 7.5 : 9, PLATE.ink);

    const callouts = createPlateLabeler(ctx, {
      left: 7,
      top: fieldTop,
      right: w - 7,
      bottom: fieldBottom,
      gap: compact ? 2 : 3,
    });
    const typeSize = compact ? 8 : 9.2;
    const radialAlign = u.x > 0.22 ? 'left' : u.x < -0.22 ? 'right' : 'center';
    const radialCandidate = (point, radial, side, distance, sideDistance) => ({
      x: point.x + radial.x * distance + side.x * sideDistance,
      y: point.y + radial.y * distance + side.y * sideDistance,
      align: radialAlign,
    });
    const gpCandidates = [
      {
        x: gp.x + tangent.x * (compact ? 12 : 16),
        y: gp.y + tangent.y * (compact ? 12 : 16),
        align: tangent.x < -0.18 ? 'right' : tangent.x > 0.18 ? 'left' : 'center',
      },
      {
        x: gp.x - tangent.x * (compact ? 12 : 16),
        y: gp.y - tangent.y * (compact ? 12 : 16),
        align: tangent.x > 0.18 ? 'right' : tangent.x < -0.18 ? 'left' : 'center',
      },
      radialCandidate(gp, u, tangent, compact ? -10 : -13, compact ? 10 : 13),
    ];
    callouts.place(compact ? 'GP' : 'GP · STAR OVERHEAD', gp, gpCandidates, {
      size: typeSize,
      weight: 600,
      leader: false,
    });

    const starCandidates = [
      radialCandidate(star, u, tangent, compact ? -13 : -16, compact ? 12 : 16),
      radialCandidate(star, u, tangent, compact ? -13 : -16, compact ? -12 : -16),
      {
        x: star.x - u.x * (compact ? 18 : 23),
        y: star.y - u.y * (compact ? 18 : 23)
          + (Math.abs(u.x) < 0.3 ? (u.y > 0 ? -10 : 10) : 0),
        align: radialAlign,
      },
    ];
    callouts.place(compact ? 'VEGA · DRAG' : 'VEGA DIRECTION · DRAG',
      star, starCandidates, {
        size: typeSize,
        leader: false,
      });

    const centerCandidates = [
      {
        x: cx + tangent.x * (compact ? 15 : 20),
        y: cy + tangent.y * (compact ? 15 : 20),
        align: tangent.x < -0.18 ? 'right' : tangent.x > 0.18 ? 'left' : 'center',
      },
      {
        x: cx - tangent.x * (compact ? 15 : 20),
        y: cy - tangent.y * (compact ? 15 : 20),
        align: tangent.x > 0.18 ? 'right' : tangent.x < -0.18 ? 'left' : 'center',
      },
    ];
    callouts.place(compact ? 'EARTH' : 'EARTH CENTER', { x: cx, y: cy },
      centerCandidates, {
        size: typeSize,
        leader: false,
        fallback: compact ? 'hide' : undefined,
      });

    if (!compact) {
      const rayPoint = {
        x: cx + u.x * R * 0.58,
        y: cy + u.y * R * 0.58,
      };
      callouts.place('CENTER RAY · LOCAL VERTICAL', rayPoint, [
        {
          x: rayPoint.x + tangent.x * 15,
          y: rayPoint.y + tangent.y * 15,
          align: tangent.x < 0 ? 'right' : 'left',
        },
        {
          x: rayPoint.x - tangent.x * 15,
          y: rayPoint.y - tangent.y * 15,
          align: tangent.x > 0 ? 'right' : 'left',
        },
      ], {
        size: 8.5,
        leader: false,
        fallback: 'hide',
      });
      const horizonEnd = {
        x: gp.x - tangent.x * horizonHalf,
        y: gp.y - tangent.y * horizonHalf,
      };
      callouts.place('LOCAL HORIZON', horizonEnd, [
        {
          x: horizonEnd.x - tangent.x * 9,
          y: horizonEnd.y - tangent.y * 9,
          align: -tangent.x < 0 ? 'right' : 'left',
        },
        {
          x: gp.x + tangent.x * (horizonHalf + 9),
          y: gp.y + tangent.y * (horizonHalf + 9),
          align: tangent.x < 0 ? 'right' : 'left',
        },
      ], {
        size: 8.5,
        leader: false,
        fallback: 'hide',
      });
    }
  }
})();
