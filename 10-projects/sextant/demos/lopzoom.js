'use strict';
/* §11: a circle of position at two scales. Left: the ring on the globe.
   Right: the waters around the ship, where that ring is a straight line
   of position, perpendicular to the azimuth toward the GP. */

(function demoLopZoom() {
  const d = createDemo('demo-lopzoom', { aspect: 1.55, maxH: 540, draw });
  let splitX = 1e9;
  const g = makeGlobe(d, -28, 20, p => p.x < splitX);
  const GP = { lat: 39, lon: -30 };
  const azYou = 220; // azimuth from the GP out to the ship
  const alt = addSlider(d, {
    label: 'measured altitude', min: 20, max: 70, step: 0.5, value: 52,
    fmt: v => v.toFixed(1) + '°',
  });
  const note = addStat(d, 'near the ship', true);

  function initialAzimuth(lat1, lon1, lat2, lon2) {
    const p1 = lat1 * D2R, p2 = lat2 * D2R, dL = (lon2 - lon1) * D2R;
    const y = Math.sin(dL) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dL);
    return (Math.atan2(y, x) * R2D + 360) % 360;
  }

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    splitX = w * 0.52;
    const zr = 90 - alt.v;
    const youLL = destPoint(GP.lat, GP.lon, zr, azYou);
    const zn = initialAzimuth(youLL.lat, youLL.lon, GP.lat, GP.lon);

    /* ————— left: the globe ————— */

    const cx = splitX * 0.5, cy = h * 0.52;
    const R = Math.min(h * 0.40, splitX * 0.40);
    g.base(ctx, cx, cy, R);
    g.posCircle(ctx, GP.lat, GP.lon, zr, R, cx, cy, P.s2);

    label(ctx, 'on the globe', splitX * 0.5, 18, { color: P.inkSoft, size: 10.5 });

    // azimuth radius, GP to you, if the path faces front
    const N = 20;
    const ray = [];
    let rayOk = true;
    for (let i = 0; i <= N; i++) {
      const p = destPoint(GP.lat, GP.lon, (zr * i) / N, azYou);
      const q = g.proj(p.lat, p.lon, R, cx, cy);
      if (!q.front) { rayOk = false; break; }
      ray.push(q);
    }
    if (rayOk && ray.length > 1) {
      ctx.strokeStyle = P.s2;
      ctx.fillStyle = P.s2;
      ctx.lineWidth = 0.9;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(ray[0].x, ray[0].y);
      for (let i = 1; i < ray.length; i++) ctx.lineTo(ray[i].x, ray[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      const end = ray[ray.length - 1], prev = ray[ray.length - 2];
      dimHead(ctx, end.x, end.y, Math.atan2(end.y - prev.y, end.x - prev.x), 7, 2.3);
    }

    const gp = g.proj(GP.lat, GP.lon, R, cx, cy);
    if (gp.front) {
      starGlyph(ctx, gp.x, gp.y, 7, P.s2);
      label(ctx, "star's GP", gp.x, gp.y - 16, { color: P.s2, size: 11, halo: P.paper });
    }
    const yp = g.proj(youLL.lat, youLL.lon, R, cx, cy);
    if (yp.front) {
      pointMark(ctx, yp.x, yp.y, P.ink);
      // zoom frame around you
      const box = 16;
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(yp.x - box, yp.y - box, box * 2, box * 2);
      leaderNote(ctx, 'you', yp.x, yp.y, 50 * D2R, 22, P.inkSoft, { size: 10.5 });
    }

    /* ————— divider ————— */

    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 12);
    ctx.lineTo(splitX, h - 12);
    ctx.stroke();

    /* ————— right: the local chart ————— */

    const chx = splitX + (w - splitX) * 0.5;
    const chy = h * 0.52;
    const scale = Math.min(w - splitX, h) / 78; // px per nm
    const toPx = (e, n) => ({ x: chx + e * scale, y: chy - n * scale });

    label(ctx, 'near the ship – the same circle',
      splitX + (w - splitX) * 0.5, 18, { color: P.inkSoft, size: 10.5 });

    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX + 8, 28, w - splitX - 16, h - 40);
    ctx.clip();

    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(chx + i * 10 * scale, 0); ctx.lineTo(chx + i * 10 * scale, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(splitX, chy + i * 10 * scale); ctx.lineTo(w, chy + i * 10 * scale);
      ctx.stroke();
    }

    const znR = zn * D2R;
    const u = { x: Math.sin(znR), y: Math.cos(znR) }; // east, north toward GP
    const perp = { x: -u.y, y: u.x };

    // azimuth toward the GP
    ctx.strokeStyle = P.s2;
    ctx.fillStyle = P.s2;
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 4]);
    const far = toPx(u.x * 36, u.y * 36);
    ctx.beginPath();
    ctx.moveTo(chx, chy);
    ctx.lineTo(far.x, far.y);
    ctx.stroke();
    ctx.setLineDash([]);
    dimHead(ctx, far.x, far.y, Math.atan2(far.y - chy, far.x - chx), 7, 2.3);
    starGlyph(ctx, far.x + u.x * 10, far.y - u.y * 10, 6, P.s2);
    label(ctx, 'toward GP', far.x + u.x * 10, far.y - u.y * 10 - 14,
      { color: P.s2, size: 10.5, halo: P.paper });

    // LOP: the circle, locally a straight line
    const L1 = toPx(perp.x * 40, perp.y * 40);
    const L2 = toPx(-perp.x * 40, -perp.y * 40);
    ctx.strokeStyle = P.s2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L1.x, L1.y);
    ctx.lineTo(L2.x, L2.y);
    ctx.stroke();
    const endIn = toPx(perp.x * 28, perp.y * 28);
    label(ctx, 'line of position', endIn.x, endIn.y - 12,
      { color: P.s2, size: 10.5, halo: P.paper });

    const aAz = Math.atan2(-u.y, u.x); // canvas angle of azimuth (y down)
    const aPerp = Math.atan2(-perp.y, perp.x);
    rightAngleMark(ctx, chx, chy, aAz, aPerp, 12, P.inkSoft);

    ctx.restore();

    // you, at the assumed/true point on the line
    pointMark(ctx, chx, chy, P.ink);
    label(ctx, 'you', chx, chy + 18, { color: P.inkSoft, size: 10.5, halo: P.paper });

    // north arrow
    ctx.strokeStyle = P.inkSoft;
    ctx.fillStyle = P.inkSoft;
    ctx.lineWidth = 0.9;
    const nx = splitX + 28, ny = 58;
    ctx.beginPath();
    ctx.moveTo(nx, ny + 22); ctx.lineTo(nx, ny);
    ctx.stroke();
    dimHead(ctx, nx, ny, -Math.PI / 2);
    label(ctx, 'N', nx, ny - 12, { size: 11, color: P.inkSoft, halo: P.paper });

    // scale bar
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1;
    const sbX2 = w - 22, sbX1 = sbX2 - 10 * scale, sbY = h - 24;
    ctx.beginPath();
    ctx.moveTo(sbX1, sbY); ctx.lineTo(sbX2, sbY);
    ctx.moveTo(sbX1, sbY - 5); ctx.lineTo(sbX1, sbY);
    ctx.moveTo(sbX2, sbY - 5); ctx.lineTo(sbX2, sbY);
    ctx.stroke();
    label(ctx, '10 nm', (sbX1 + sbX2) / 2, h - 36, { size: 10.5, color: P.inkSoft, halo: P.paper });

    note.set('the arc is a straight line, perpendicular to the GP');
  }
})();
