'use strict';
/* §01a: the geographical position, on a real globe. An orthographic Earth
   (coastlines from demos/world.js) with three stars around it, each ray
   through the Earth's center piercing the surface at that star's GP.

   Two motions, kept physically honest:
   - the TIME slider turns the Earth about its axis under the stars: the
     continents rotate on screen, the stars stay put, and every GP sweeps
     west along its parallel of declination;
   - DRAGGING orbits the viewer around the whole rigid scene: Earth and
     stars turn together, each GP staying glued to its spot on the ground.
     Stars are occluded when they swing behind the globe.

   State: t (hours), viewAz/viewTilt (camera direction in the star frame).
   The Earth-frame view longitude is viewAz + 15*(t-12), so time moves the
   ground while the stars hold still on screen. Star glyphs sit at a fixed
   scene distance from the center (not to scale, the caption says so).
   Globe rendering is the shared globeView/drawGlobeBase from app.js. */

(function demoGP() {
  const d = createDemo('demo-gp', { aspect: 1.5, maxH: 500, draw });

  let t = 12;            // hours
  let viewAz = 104;      // camera azimuth in the star frame, degrees
  let viewTilt = 20;     // camera tilt, degrees (+ = north pole toward us)
  let dragged = false;

  // dec is each star's real declination; lon is its GP longitude at 12:00
  const STARS = [
    { name: 'Vega', dec: 38.8, lon: -77, main: true },
    { name: 'Capella', dec: 46.0, lon: -123 },
    { name: 'Sirius', dec: -16.7, lon: -144 },
  ];

  addSlider(d, {
    label: 'time of day', min: 0, max: 24, step: 0.25, value: t,
    fmt: v => `${String(Math.floor(v) % 24).padStart(2, '0')}:${String(Math.round(v % 1 * 60)).padStart(2, '0')}`,
    onchange: v => { t = v; },
  });
  const latStat = addStat(d, "Vega's GP – latitude");
  const lonStat = addStat(d, "Vega's GP – longitude");

  d.canvas.classList.add('grab');
  d.canvas._spin = (az, tilt) => {          // for scripted QA sweeps
    viewAz = az;
    if (tilt !== undefined) viewTilt = tilt;
    dragged = true;
  };
  let last = null;
  let geo = null;
  addDrag(d.canvas, {
    start(p) { last = p; },
    move(p) {
      if (!geo) return;
      viewAz = (viewAz + (p.x - last.x) / geo.R * 57) % 360;
      viewTilt = clamp(viewTilt + (p.y - last.y) / geo.R * 57, -70, 70);
      last = p;
      dragged = true;
    },
  });

  const wrap180 = v => ((v % 360) + 540) % 360 - 180;

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5, cy = h * 0.55;
    const R = Math.min(h * 0.36, w * 0.27);
    geo = { R };

    const earthSpin = 15 * (t - 12);
    const viewLon = viewAz + earthSpin;
    const toView = globeView(viewLon, viewTilt);
    drawGlobeBase(ctx, toView, cx, cy, R);

    // ––– the stars and their points –––
    const placedNames = [{ x: 70, y: 18 }];   // the corner hint; star names dodge it too
    for (const s of STARS) {
      const gpLon = wrap180(s.lon - earthSpin);
      const v = toView(gpLon, s.dec);        // the star's direction = its GP's
      const m2 = Math.hypot(v.X, v.Y);
      const dir2 = m2 > 1e-6 ? { x: v.X / m2, y: -v.Y / m2 } : null;

      // glyph distance: a fixed scene radius, pulled in near the sheet edge
      let dist = R * 2.9;
      if (dir2) {
        let tMax = 1e9;
        if (dir2.x > 1e-6) tMax = Math.min(tMax, (w - 16 - cx) / dir2.x);
        if (dir2.x < -1e-6) tMax = Math.min(tMax, (16 - cx) / dir2.x);
        if (dir2.y > 1e-6) tMax = Math.min(tMax, (h - 16 - cy) / dir2.y);
        if (dir2.y < -1e-6) tMax = Math.min(tMax, (16 - cy) / dir2.y);
        dist = Math.min(dist, tMax / Math.max(m2, 1e-6));
      }
      const px = cx + dist * m2 * (dir2 ? dir2.x : 0);
      const py = cy + dist * m2 * (dir2 ? dir2.y : 0);
      const r2 = dist * m2;                  // glyph's distance from center on screen

      const behind = v.Z <= 0;
      if (behind && r2 < R + 10) continue;   // occluded by the globe

      if (!behind) {
        // the ray from the GP up to its star
        const gpx = cx + R * v.X, gpy = cy - R * v.Y;
        if (dir2) centerline(ctx, gpx, gpy, px - dir2.x * 16, py - dir2.y * 16, P.inkSoft);

        // Vega's zenith arrow, foreshortened gracefully as its GP faces us
        const gap = r2 - R;                  // screen room between GP and glyph
        if (s.main && dir2 && gap > 30) {
          const len = Math.min(R * 0.42, gap - 16);
          ctx.strokeStyle = P.s2;
          ctx.fillStyle = P.s2;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(gpx, gpy);
          ctx.lineTo(gpx + dir2.x * len, gpy + dir2.y * len);
          ctx.stroke();
          dimHead(ctx, gpx + dir2.x * len, gpy + dir2.y * len, Math.atan2(dir2.y, dir2.x), 9, 2.7);
          if (gap > 60) {
            const n = dir2.y * dir2.y > 0.88 ? { x: 1, y: 0 } : { x: -dir2.y, y: dir2.x };
            const side = n.x >= 0 ? n : { x: -n.x, y: -n.y };
            label(ctx, 'straight overhead – 90°',
              gpx + dir2.x * len * 0.55 + side.x * 13, gpy + dir2.y * len * 0.55 + side.y * 13 + 4,
              { color: P.s2, size: 10.5, halo: P.paper, align: 'left' });
          }
        }

        pointMark(ctx, gpx, gpy, P.ink);
        const leadA = dir2 ? Math.atan2(-dir2.y, -dir2.x) + (s.main ? -0.85 : 0.85) : 2.2;
        leaderNote(ctx, s.name + "'s GP", gpx, gpy, leadA, 30, P.inkSoft, { size: 10.5 });
      } else if (dir2) {
        // peeking out from behind the limb: just the outer stub of its ray
        centerline(ctx, cx + dir2.x * (R + 4), cy + dir2.y * (R + 4), px - dir2.x * 14, py - dir2.y * 14, P.inkFaint);
      }

      starGlyph(ctx, px, py, s.main ? 9 : 7, P.ink);
      if (dir2) {
        const lx = clamp(px + dir2.x * 17, 30, w - 30);
        const align = dir2.x > 0.35 ? 'left' : dir2.x < -0.35 ? 'right' : 'center';
        let ly = clamp(py + dir2.y * 17 + (align === 'center' ? (dir2.y > 0 ? 8 : -6) : 2), 12, h - 12);
        // when two stars line up on screen, step the later label clear
        for (const q of placedNames) {
          if (Math.abs(lx - q.x) < 78 && Math.abs(ly - q.y) < 13) ly = q.y + (ly >= h / 2 ? -15 : 15);
        }
        placedNames.push({ x: lx, y: ly });
        label(ctx, s.name, lx, ly, { color: P.inkSoft, size: 10.5, halo: P.paper, align });
      }
    }

    label(ctx, dragged ? 'the stars ride along' : 'drag to look around', 14, 18,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'left' });

    latStat.set(Math.abs(STARS[0].dec).toFixed(1) + '° ' + (STARS[0].dec >= 0 ? 'N' : 'S'));
    const vLon = wrap180(STARS[0].lon - earthSpin);
    lonStat.set(Math.abs(vLon).toFixed(1) + '° ' + (vLon >= 0 ? 'E' : 'W'));
  }
})();
