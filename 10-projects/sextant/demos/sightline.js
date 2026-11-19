'use strict';
/* Altitude is measured up from the horizon. Standing on a star's GP, the
   reader swings a line of sight up from the horizon until it meets the
   star at 90°, the same direction as a flagpole planted at the spot. */

(function demoSightline() {
  const d = createDemo('demo-sightline', {
    aspect: 1.9,
    maxH: 360,
    compactAspect: 1.05,
    compactMaxH: 360,
    draw,
  });

  const SNAP = 1.5;
  const sight = addSlider(d, {
    label: 'line of sight',
    min: 0,
    max: 90,
    step: 1,
    value: 30,
    fmt: v => v.toFixed(0) + '°',
  });

  let geo = null;
  d.canvas.classList.add('grab');
  addDrag(d.canvas, {
    move(p) {
      if (!geo) return;
      let a = Math.atan2(geo.eye.y - p.y, p.x - geo.eye.x) * R2D;
      // pointing past vertical, or below the horizon, pins to the ends
      if (a > 90 || a < -90) a = a > 0 || a < -90 ? 90 : 0;
      a = clamp(a, 0, 90);
      if (90 - a <= SNAP) a = 90;
      sight.set(Math.round(a), { emit: false });
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const overhead = 90 - sight.v <= SNAP;
    const alt = overhead ? 90 : sight.v;
    const altText = `${alt.toFixed(0)}°`;

    const pad = compact ? 10 : 16;
    const titleY = compact ? 15 : 19;
    plateText(ctx, compact
      ? 'ALTITUDE: ANGLE UP FROM THE HORIZON'
      : 'ALTITUDE: THE ANGLE UP FROM THE HORIZON',
    pad, titleY, { size: compact ? 8.5 : 10.5, weight: 600 });

    const starY = titleY + (compact ? 40 : 42);
    const groundY = h - (compact ? 62 : 64);
    const span = groundY - starY;
    const cx = compact ? w * 0.42 : w * 0.44;
    const eye = { x: cx, y: groundY };
    geo = { eye };

    // Earth: a broad arc whose top is the observer's spot, hatched just
    // inside the surface
    const R = Math.max(w, span) * 1.7;
    const ec = { x: cx, y: groundY + R };
    const band = compact ? 12 : 14;
    const shell = new Path2D();
    shell.arc(ec.x, ec.y, R, 0, TAU);
    shell.arc(ec.x, ec.y, R - band, 0, TAU, true);
    plateHatch(ctx, shell, { x: 0, y: groundY - 2, w, h: h - groundY + 2 }, {
      spacing: compact ? 5 : 6, weight: 0.45,
    });
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.4 : 1.7;
    ctx.beginPath();
    ctx.arc(ec.x, ec.y, R, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // horizon: the level line tangent at the observer
    const horizonLeft = Math.max(pad, cx - (compact ? cx - pad : Math.min(cx - pad, span * 1.05)));
    const horizonRight = w - pad;
    plateLine(ctx, { x: horizonLeft, y: groundY }, { x: horizonRight, y: groundY }, {
      kind: 'long', weight: compact ? 0.9 : 1,
    });

    // star straight overhead, with its light coming down the vertical
    const star = { x: cx, y: starY };
    const starR = compact ? 6 : 7;
    const poleH = span * 0.3;
    const poleTop = { x: cx, y: groundY - poleH };
    plateVector(ctx, { x: cx, y: starY + starR + 6 }, { x: cx, y: poleTop.y - 6 }, {
      kind: 'short', weight: 0.7, head: compact ? 3.2 : 3.6,
    });
    starGlyph(ctx, star.x, star.y, starR, PLATE.ink);

    // flagpole at the GP, flag streaming left, away from the sight line
    plateLine(ctx, eye, poleTop, { weight: compact ? 1.3 : 1.5 });
    const flagW = compact ? 14 : 17, flagH = compact ? 9 : 11;
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.fillStyle = PLATE.paper;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(poleTop.x, poleTop.y);
    ctx.lineTo(poleTop.x - flagW, poleTop.y + flagH / 2);
    ctx.lineTo(poleTop.x, poleTop.y + flagH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    rightAngleMark(ctx, eye.x, eye.y, Math.PI, -Math.PI / 2, compact ? 8 : 9, PLATE.ink);

    // the reader's line of sight, pivoting at the eye
    const a = -alt * D2R;
    const reach = Math.min(span * 0.8, w - pad - cx - (compact ? 18 : 30));
    const sightLen = overhead ? span - starR - 10 : reach;
    const end = { x: eye.x + Math.cos(a) * sightLen, y: eye.y + Math.sin(a) * sightLen };
    if (overhead) {
      plateVector(ctx, eye, end, { weight: compact ? 2.2 : 2.6, head: compact ? 5 : 6 });
    } else {
      plateVector(ctx, eye, end, { kind: 'long', weight: compact ? 1.3 : 1.5, head: compact ? 4.5 : 5 });
    }

    // the altitude angle, from the horizon up to the sight line
    const arcR = Math.min(compact ? 38 : 50, reach * 0.36);
    if (alt > 0.4) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 1 : 1.15;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, arcR, a, 0);
      ctx.stroke();
      ctx.restore();
    }

    // observer dot on top of the construction
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, compact ? 3.6 : 4.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const labels = createPlateLabeler(ctx, {
      left: pad, top: titleY + 10, right: w - pad, bottom: h - 4, gap: compact ? 2 : 3,
    });
    const size = compact ? 8 : 9;
    // keep labels off the marks they describe
    labels.reserve({ x: eye.x - 6, y: eye.y - 6, w: 12, h: 12 });
    labels.reserve({ x: star.x - starR - 2, y: star.y - starR - 2, w: starR * 2 + 4, h: starR * 2 + 4 });
    labels.reserve({ x: poleTop.x - flagW - 2, y: poleTop.y - 2, w: flagW + 4, h: flagH + 4 });

    // a wide angle labels inside its arc; a shallow one lifts clear of
    // the sight line so the number never sits on a stroke
    const labelAngle = alt >= 24 ? a / 2 : -(alt + 14) * D2R;
    const angleOut = arcR + (compact ? 19 : 23);
    labels.place(altText, null, [
      { x: eye.x + Math.cos(labelAngle) * angleOut, y: eye.y + Math.sin(labelAngle) * angleOut, align: 'center' },
      { x: eye.x + arcR + 8, y: eye.y - arcR * 0.5 - 14, align: 'left' },
    ], { size: compact ? 9.5 : 11, weight: 600, font: PLATE.dataFont, uppercase: false, tracking: 0, leader: false, backed: false });

    if (overhead) {
      labels.place('ALTITUDE 90° · STAR OVERHEAD', star, [
        { x: star.x + starR + 8, y: star.y, align: 'left' },
        { x: star.x + starR + 8, y: star.y + 16, align: 'left' },
      ], { size, weight: 600, leader: false });
    } else {
      labels.place('STAR', star, [
        { x: star.x + starR + 8, y: star.y, align: 'left' },
        { x: star.x - starR - 8, y: star.y, align: 'right' },
      ], { size, weight: 600, leader: false });
      labels.place('LINE OF SIGHT', end, [
        { x: end.x + 8, y: end.y - 10, align: 'left' },
        { x: end.x - 8, y: end.y - 12, align: 'right' },
        { x: end.x + 8, y: end.y + 12, align: 'left' },
        { x: end.x, y: end.y - 16, align: 'center' },
      ], { size, leader: false, fallback: 'hide' });
    }

    labels.place('FLAGPOLE', poleTop, [
      { x: poleTop.x - flagW - 8, y: poleTop.y + flagH / 2, align: 'right' },
      { x: poleTop.x - 8, y: poleTop.y + flagH + 14, align: 'right' },
    ], { size, leader: false, fallback: 'hide' });
    labels.place('HORIZON 0°', null, [
      { x: horizonLeft, y: groundY - (compact ? 10 : 12), align: 'left' },
    ], { size, leader: false });
    labels.place(compact ? 'YOU, AT THE GP' : 'YOU, STANDING AT THE STAR’S GP', eye, [
      { x: eye.x, y: groundY + band + (compact ? 14 : 17), align: 'center' },
    ], { size, weight: 600, leader: false });

    if (!compact) {
      plateText(ctx, 'DRAG THE LINE OF SIGHT', w - pad, titleY, { size: 7.5, align: 'right' });
    }
  }
})();
