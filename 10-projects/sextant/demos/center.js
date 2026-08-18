'use strict';
/* Opening figure: you stand at the center of a transparent Earth and
   point a laser at a star. The ray meets the surface once – that point
   is the star's ground position. Drag the star; the GP rides the limb. */

(function demoCenter() {
  const d = createDemo('demo-center', { aspect: 1.4, maxH: 480, draw });
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
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.47, cy = h * 0.54;
    const R = Math.min(h * 0.34, w * 0.28);
    geo = { cx, cy, R };

    label(ctx, 'from the center, looking out', 14, 18,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'left' });

    // transparent earth: no fill, so the center stays visible
    ctx.strokeStyle = P.inkFaint;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.92, cy);
    ctx.lineTo(cx + R * 0.92, cy);
    ctx.moveTo(cx, cy - R * 0.92);
    ctx.lineTo(cx, cy + R * 0.92);
    ctx.stroke();

    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();

    const ux = Math.cos(ang), uy = Math.sin(ang);
    const gp = { x: cx + R * ux, y: cy + R * uy };

    let tEdge = 1e9;
    if (ux > 1e-6) tEdge = Math.min(tEdge, (w - 18 - cx) / ux);
    if (ux < -1e-6) tEdge = Math.min(tEdge, (18 - cx) / ux);
    if (uy > 1e-6) tEdge = Math.min(tEdge, (h - 18 - cy) / uy);
    if (uy < -1e-6) tEdge = Math.min(tEdge, (18 - cy) / uy);
    const dist = clamp(Math.min(R * 2.45, tEdge), R + 38, 1e9);
    const star = { x: cx + dist * ux, y: cy + dist * uy };

    // the laser: one line, center through GP to the star
    ctx.strokeStyle = P.s2;
    ctx.fillStyle = P.s2;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(star.x - ux * 15, star.y - uy * 15);
    ctx.stroke();
    dimHead(ctx, star.x - ux * 15, star.y - uy * 15, Math.atan2(uy, ux), 9, 2.7);

    const mid = { x: cx + ux * R * 0.52, y: cy + uy * R * 0.52 };
    const n = { x: -uy, y: ux };
    const nSide = n.x >= 0 ? n : { x: -n.x, y: -n.y };
    if (R > 70) {
      label(ctx, 'laser', mid.x + nSide.x * 14, mid.y + nSide.y * 14,
        { color: P.s2, size: 10.5, halo: P.paper, align: nSide.x >= 0 ? 'left' : 'right' });
    }

    pointMark(ctx, gp.x, gp.y, P.s2);
    const gpLead = ang + (ux >= 0 ? -0.95 : 0.95);
    leaderNote(ctx, 'GP', gp.x, gp.y, gpLead, 26, P.s2, { size: 10.5 });

    starGlyph(ctx, star.x, star.y, 9, P.ink);
    const sAlign = ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center';
    const sOff = sAlign === 'center' ? (uy > 0 ? 16 : -16) : 0;
    const sx = star.x + (sAlign === 'left' ? 16 : sAlign === 'right' ? -16 : 0);
    const sy = clamp(star.y + sOff + (sAlign === 'center' ? 0 : 2), 14, h - 14);
    label(ctx, 'star – drag', sx, sy,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: sAlign });

    pointMark(ctx, cx, cy, P.ink);
    leaderNote(ctx, 'you', cx, cy, ang + Math.PI, 28, P.inkSoft, { size: 10.5 });

    const earthY = cy + R + 16;
    const gpLow = uy > 0.72;
    label(ctx, 'earth', gpLow ? cx - R - 8 : cx, gpLow ? cy : earthY,
      { color: P.inkFaint, size: 10.5, halo: P.paper,
        align: gpLow ? 'right' : 'center' });
  }
})();
