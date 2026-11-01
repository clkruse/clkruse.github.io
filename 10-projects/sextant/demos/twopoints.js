'use strict';
/* In a 2D slice through Earth, one measured altitude fixes a distance
   from the GP but not a side: two places, z either side of the GP, see
   the star at exactly the same altitude. The globe figure that follows
   turns this pair into a full ring. */

(function demoTwoPoints() {
  const d = createDemo('demo-twopoints', {
    aspect: 1.55,
    maxH: 420,
    compactAspect: 0.92,
    compactMaxH: 400,
    draw,
  });

  const EXAMPLE_HO = 60;
  const ho = addSlider(d, {
    label: 'measured altitude',
    min: 5,
    max: 85,
    step: 0.5,
    value: EXAMPLE_HO,
    fmt: v => v.toFixed(1) + '°',
  });
  const zStat = addStat(d, 'distance from the GP');
  d.addPreset('sixty', () => ho.set(EXAMPLE_HO, { emit: false }));

  let geo = null;
  d.canvas.classList.add('grab');
  addDrag(d.canvas, {
    move(p) {
      if (!geo) return;
      const fromUp = Math.abs(Math.atan2(p.x - geo.cx, geo.cy - p.y)) * R2D;
      ho.set(clamp(Math.round((90 - fromUp) * 2) / 2, 5, 85), { emit: false });
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const alt = ho.v;
    const z = 90 - alt;
    zStat.set(`90° − ${alt.toFixed(1)}° = ${z.toFixed(1)}°`);

    const pad = compact ? 10 : 16;
    const titleY = compact ? 15 : 19;
    plateText(ctx, compact
      ? 'TWO PLACES, ONE ALTITUDE'
      : 'IN A 2D SLICE, TWO PLACES SEE THE SAME ALTITUDE',
    pad, titleY, { size: compact ? 8.5 : 10.5, weight: 600 });

    const ruleY = h - (compact ? 30 : 36);
    plateRule(ctx, ruleY, pad, w - pad);
    plateDataText(ctx,
      `Ho ${alt.toFixed(1)}° → z = 90° − ${alt.toFixed(1)}° = ${z.toFixed(1)}° · A and B are both ${z.toFixed(1)}° from the GP`,
      w / 2, ruleY + (compact ? 15 : 18), {
        size: compact ? 7 : 10,
        align: 'center',
      });

    const rayTop = titleY + (compact ? 22 : 28);
    const fieldBottom = ruleY - (compact ? 10 : 14);
    const R = Math.min(w * (compact ? 0.3 : 0.2), (fieldBottom - rayTop) * 0.4);
    const cx = w / 2;
    const cy = fieldBottom - R - (compact ? 4 : 8);
    geo = { cx, cy };
    const up = -Math.PI / 2;

    plateWireSphere(ctx, cx, cy, R, {
      tilt: 0, graticule: false, axis: false, northLabel: false,
    });

    const gp = { x: cx, y: cy - R };
    const sides = [-1, 1].map(sign => {
      const a = up + sign * z * D2R;
      return { sign, a, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });

    // centre construction: GP and both candidates
    for (const pt of [gp, ...sides]) {
      plateLine(ctx, { x: cx, y: cy }, pt, { kind: 'construction', weight: compact ? 0.6 : 0.75 });
    }
    const centerArcR = Math.min(R * 0.36, compact ? 22 : 32);
    for (const side of sides) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.7 : 0.85;
      ctx.beginPath();
      arcBetween(ctx, cx, cy, centerArcR, up, side.a);
      ctx.stroke();
      ctx.restore();
      if (z >= 9) {
        const mid = up + side.sign * z * D2R / 2;
        plateDataText(ctx, `${z.toFixed(z % 1 ? 1 : 0)}°`,
          cx + Math.cos(mid) * (centerArcR + (compact ? 10 : 13)),
          cy + Math.sin(mid) * (centerArcR + (compact ? 10 : 13)), {
            size: compact ? 7.5 : 9,
            align: 'center',
          });
      }
    }

    // parallel starlight arriving at the GP and at both candidates
    const head = compact ? 3.2 : 4;
    for (const pt of [gp, ...sides]) {
      plateVector(ctx, pt, { x: pt.x, y: rayTop }, { kind: 'long', weight: compact ? 0.8 : 1, head });
    }
    plateText(ctx, 'PARALLEL STARLIGHT', cx, rayTop - (compact ? 7 : 9), {
      size: compact ? 7.5 : 8.5, align: 'center',
    });

    // each candidate's horizon and the altitude it measures
    const horizonHalf = Math.min(R * 0.42, compact ? 30 : 46);
    const altArcR = Math.min(R * 0.22, compact ? 14 : 20);
    for (const side of sides) {
      const tangent = side.a + Math.PI / 2;
      const tx = Math.cos(tangent) * horizonHalf, ty = Math.sin(tangent) * horizonHalf;
      plateLine(ctx, { x: side.x - tx, y: side.y - ty }, { x: side.x + tx, y: side.y + ty }, {
        weight: compact ? 1 : 1.25,
      });
      // horizon direction that faces the GP
      const towardGp = side.a - side.sign * Math.PI / 2;
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.8 : 0.95;
      ctx.beginPath();
      arcBetween(ctx, side.x, side.y, altArcR, towardGp, up);
      ctx.stroke();
      ctx.restore();
      let span = up - towardGp;
      while (span > Math.PI) span -= TAU;
      while (span < -Math.PI) span += TAU;
      const mid = towardGp + span / 2;
      if (z >= 12) plateDataText(ctx, `${alt.toFixed(alt % 1 ? 1 : 0)}°`,
        side.x + Math.cos(mid) * (altArcR + (compact ? 11 : 14)),
        side.y + Math.sin(mid) * (altArcR + (compact ? 11 : 14)), {
          size: compact ? 7.5 : 9,
          weight: 600,
          align: 'center',
        });
    }

    for (const pt of [gp, ...sides]) {
      ctx.save();
      ctx.fillStyle = PLATE.ink;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, compact ? 2.4 : 3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    const labels = createPlateLabeler(ctx, {
      left: pad, top: rayTop, right: w - pad, bottom: fieldBottom, gap: compact ? 2 : 3,
    });
    const size = compact ? 8 : 9;
    labels.place('STAR’S GP', gp, [
      { x: gp.x + 10, y: gp.y - 12, align: 'left' },
      { x: gp.x - 10, y: gp.y - 12, align: 'right' },
    ], { size, leader: false });
    for (const side of sides) {
      const name = side.sign < 0 ? 'A' : 'B';
      const out = side.sign;
      labels.place(compact ? name : `POSITION ${name}`, side, [
        { x: side.x + out * (compact ? 14 : 20), y: side.y + (compact ? 14 : 18), align: out < 0 ? 'right' : 'left' },
        { x: side.x + out * (compact ? 16 : 24), y: side.y, align: out < 0 ? 'right' : 'left' },
        { x: side.x + out * (compact ? 14 : 20), y: side.y + (compact ? 26 : 32), align: out < 0 ? 'right' : 'left' },
      ], { size, weight: 600 });
    }
    if (!compact) {
      plateText(ctx, 'DRAG A OR B', w - pad, fieldBottom - 4, { size: 7.5, align: 'right' });
    }
  }
})();
