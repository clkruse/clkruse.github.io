'use strict';
/* §6, "The stars move!": a star's ground position is fixed in space (it is
   wherever the line from Earth's center to the star meets the surface), but
   the Earth turns under it. The globe is seen from the side under fixed
   starlight, as in Figures 1-1 and 3-1: the GP stays put on the page while
   the ground turns east beneath it, and its track is left on the ground
   along one parallel. One generic star at 40° N; its GP starts at 30° W.
   You stand still on the ground at 20° N, 30° W, under the GP's start, and
   "Your view" in the caption shows the star sinking as the ground carries
   you away from the GP. */

const MOTION = (() => {
  const RATE = 360 / 23.9344696;        // degrees of Earth rotation per hour
  const DEC = 40;
  const LON0 = -30;
  const MAX_H = 24;
  const YOU = { lat: 20, lon: -30 };

  const wrap180 = l => {
    const x = ((((l + 180) % 360) + 360) % 360) - 180;
    return x === -180 ? 180 : x;
  };
  const lonText = l => {
    const x = wrap180(l);
    const a = Math.abs(x);
    return a < 0.05 ? '0.0°' : `${a.toFixed(1)}° ${x < 0 ? 'W' : 'E'}`;
  };
  const fmtH = v => {
    let hh = Math.floor(v);
    let mm = Math.round((v - hh) * 60);
    if (mm === 60) { hh += 1; mm = 0; }
    return `${hh}h ${String(mm).padStart(2, '0')}m`;
  };

  // a run of points; null lifts the pen
  function polyline(ctx, pts, { kind = 'solid', weight = 1 } = {}) {
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = weight;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(plateDash(kind));
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (!p) { pen = false; continue; }
      if (pen) ctx.lineTo(p.x, p.y);
      else { ctx.moveTo(p.x, p.y); pen = true; }
    }
    ctx.stroke();
    ctx.restore();
  }

  // coastlines in thin ink. project(lat, lon) gives a point, or null where
  // it is out of sight; jump(lonA, lonB) lifts the pen across a map's seam
  function strokeLand(ctx, project, weight, jump) {
    const pts = [];
    for (const ring of LAND) {
      let prev = null;
      for (let i = 0; i < ring.length; i += 2) {
        const lon = ring[i];
        if (jump && prev !== null && jump(prev, lon)) pts.push(null);
        pts.push(project(ring[i + 1], lon));
        prev = lon;
      }
      pts.push(null);
    }
    polyline(ctx, pts, { weight });
  }

  function dot(ctx, p, r) {
    ctx.save();
    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function ring(ctx, p, r, { dashed = false, weight = 1.1 } = {}) {
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.fillStyle = PLATE.paper;
    ctx.lineWidth = weight;
    if (dashed) ctx.setLineDash(plateDash('short'));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // text hung off an anchor in a direction, easing from right- through
  // centre- to left-aligned as the direction turns, as in Figure 1-1
  function hang(ctx, text, anchor, dir, { size = 9, weight = 500, gap = 5, bounds = null } = {}) {
    const tw = plateTextWidth(ctx, text, { size, weight });
    const lh = plateSize(size) * 1.2;
    const kx = clamp(dir.x / 0.6, -1, 1);
    const ky = clamp(dir.y / 0.6, -1, 1);
    let x = anchor.x + kx * (tw / 2 + gap);
    const y = anchor.y + ky * (lh / 2 + gap * 0.6) * (1 - Math.abs(kx) * 0.75);
    if (bounds) x = clamp(x, bounds.x + tw / 2 + 2, bounds.x + bounds.w - tw / 2 - 2);
    plateText(ctx, text, x, y, { size, weight, align: 'center' });
    return { x: x - tw / 2, y: y - lh / 2, w: tw, h: lh };
  }

  function heading(ctx, x, y, text, compact) {
    plateText(ctx, text, x, y, { size: compact ? 8 : 9, weight: 600, align: 'center' });
  }

  // text on a paper ground, so it reads over coastlines and grid
  function backedText(ctx, text, x, y, opts) {
    const tw = plateTextWidth(ctx, text, opts);
    const th = plateSize(opts.size) * 1.25;
    const align = opts.align || 'left';
    const left = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(left - 3, y - th / 2, tw + 6, th);
    ctx.restore();
    plateText(ctx, text, x, y, opts);
  }

  return { RATE, DEC, LON0, MAX_H, YOU, lonText, fmtH, strokeLand, dot, ring, hang, heading, backedText };
})();

(function demoMotion() {
  const M = MOTION;
  const TILT = 18;
  const d = createDemo('demo-motion', {
    aspect: 1.5, maxH: 460, compactAspect: 0.85, compactMaxH: 520, draw,
  });
  // no slider: the reader turns the globe itself, or steps it a quarter
  // hour at a time with the arrow keys
  const hours = addValue(d, { label: 'time', min: 0, max: M.MAX_H, step: 0.25, value: 3 });
  const timeStat = addStat(d, 'Time');
  const latStat = addStat(d, 'GP latitude');
  const lonStat = addStat(d, 'GP longitude');
  let geo = null;
  d.canvas.classList.add('grab');
  addDrag(d.canvas, {
    touch: 'x',
    move(p, dp) {
      if (!geo) return;
      // the ground follows the pointer: drag right to turn the Earth east
      hours.set(clamp(hours.v + dp.dx / geo.R * R2D / M.RATE, 0, M.MAX_H));
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const size = compact ? 8 : 9;
    const pad = compact ? 10 : 16;
    const detail = plateCaptionDetail(ctx);
    M.heading(ctx, w / 2, pad + 4, 'THE STARLIGHT HOLDS STILL · THE EARTH TURNS UNDER IT', compact);
    const starR = compact ? 7 : 9;
    const starY = pad + (compact ? 30 : 36) + starR;
    const rayTop = starY + starR + 6;
    const below = compact ? 46 : 56;
    const R = Math.max(40, Math.min(w * (compact ? 0.4 : 0.27), (h - rayTop - below - 24) / 2));
    const cx = w / 2;
    const cy = h - below - R;
    geo = { R };

    const moved = hours.v * M.RATE;
    const scene = drawPlateGlobeFrame(ctx, { spin: -M.LON0 + moved, tilt: TILT }, cx, cy, R, compact, {
      showCenter: false,
      gridLatitudes: [-60, -30, 0, 30, 60],
      gridLongitudeStep: 30,
      // canvas ignores a zero line width, so the far side's grid is drawn
      // at a hairline too faint to see
      gridHiddenWeight: 0.01,
      gridVisibleWeight: compact ? 0.3 : 0.36,
      outlineWeight: compact ? 1.4 : 1.7,
    });
    const pr = scene.project;
    M.strokeLand(ctx, (lat, lon) => { const q = pr(lat, lon); return q.front ? q : null; }, compact ? 0.5 : 0.6);

    // the GP's parallel
    // sampled from the GP, which holds still on the page, so the samples
    // (and the label at the parallel's left end) hold still as it turns
    const par = [];
    for (let k = -60; k <= 60; k++) par.push(pr(M.DEC, M.LON0 - moved + k * 3));
    strokePlateHemisphere(ctx, par, true, { kind: 'long', weight: compact ? 0.55 : 0.7 });

    // the GP's track over the ground, solid in front and dashed behind
    const track = [];
    const steps = Math.max(2, Math.ceil(moved));
    for (let i = 0; i <= steps; i++) track.push(pr(M.DEC, M.LON0 - moved * i / steps));
    strokePlateHemisphere(ctx, track, false, { kind: 'short', weight: 0.75 });
    strokePlateHemisphere(ctx, track, true, { weight: compact ? 1.8 : 2.2 });
    for (let k = 1; k * M.RATE <= moved + 1e-6; k++) {
      const lon = M.LON0 - k * M.RATE;
      const q = pr(M.DEC, lon);
      if (!q.front) continue;
      const q2 = pr(M.DEC, lon + 1);
      const tt = norm({ x: q2.x - q.x, y: q2.y - q.y });
      const tk = compact ? 3.5 : 4.5;
      plateLine(ctx, { x: q.x - tt.y * tk, y: q.y + tt.x * tk }, { x: q.x + tt.y * tk, y: q.y - tt.x * tk },
        { weight: compact ? 0.7 : 0.85 });
    }
    // you, standing still on the ground and carried east with it
    const you = pr(M.YOU.lat, M.YOU.lon);
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = you.front ? 1.3 : 0.8;
    if (!you.front) ctx.setLineDash(plateDash('short'));
    ctx.beginPath();
    ctx.arc(you.x, you.y, compact ? 3.6 : 4.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const callout = you.front ? plateDetailCallout(ctx, you, detail, { toward: { x: cx, y: cy }, compact }) : null;

    const start = pr(M.DEC, M.LON0);
    if (moved > 2) M.ring(ctx, start, compact ? 3.2 : 4, { dashed: !start.front, weight: start.front ? 1.1 : 0.8 });

    // starlight straight out from the GP, which stays put on the page
    const gp = pr(M.DEC, M.LON0 - moved);
    const u = norm({ x: gp.x - cx, y: gp.y - cy });
    const len = (gp.y - rayTop) / -u.y;
    const rayEnd = { x: gp.x + u.x * len, y: gp.y + u.y * len };
    plateVector(ctx, gp, rayEnd, { kind: 'long', weight: compact ? 0.8 : 1, head: compact ? 3.2 : 4 });
    const star = { x: rayEnd.x + u.x * ((rayTop - starY) / -u.y), y: starY };
    starGlyph(ctx, star.x, star.y, starR, PLATE.ink);
    M.dot(ctx, gp, compact ? 2.8 : 3.4);

    // the turn, as an arrow round the axis under the globe
    const ay = cy + R + (compact ? 14 : 18);
    const rx = R * 0.5, ry = compact ? 6 : 8;
    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.9 : 1.1;
    ctx.beginPath();
    ctx.ellipse(cx, ay - ry, rx, ry, 0, Math.PI * 0.92, Math.PI * 0.1, true);
    ctx.stroke();
    ctx.restore();
    const ea = Math.PI * 0.1;
    const tip = { x: cx + rx * Math.cos(ea), y: ay - ry + ry * Math.sin(ea) };
    plateArrowhead(ctx, tip, Math.atan2(ry * Math.cos(ea), -rx * Math.sin(ea)), compact ? 4 : 5);
    plateText(ctx, 'DRAG TO TURN THE EARTH', cx, ay + (compact ? 10 : 13), { size, weight: 600, align: 'center' });

    // labels
    const bounds = { x: pad, w: w - pad * 2 };
    M.hang(ctx, 'STAR', { x: star.x + starR + 2, y: star.y }, { x: 1, y: 0 }, { size, weight: 600, gap: 4 });
    // the starlight is named where it runs clear of the globe
    const limbTop = cy - Math.sqrt(Math.max(0, R * R - (rayEnd.x - cx) ** 2));
    if (limbTop - rayTop > 16) {
      plateText(ctx, 'STARLIGHT', rayEnd.x - 6, (limbTop + rayTop) / 2, { size: size - 0.5, align: 'right' });
    }
    // the track always runs east of the GP, so its name sits to the west
    M.backedText(ctx, compact ? 'GP' : 'GP · STAYS UNDER THE STAR', gp.x - 8, gp.y - (compact ? 8 : 10),
      { size, weight: 600, align: 'right' });
    if (you.front) {
      // under you, clear of the call-out ring
      const ry = callout ? callout.ring.r : 6;
      M.backedText(ctx, 'YOU', you.x, you.y + ry + (compact ? 7 : 8), { size, weight: 600, align: 'center' });
    }
    if (moved > 12 && start.front) {
      M.backedText(ctx, 'GP AT 0 h', clamp(start.x, bounds.x + 30, bounds.x + bounds.w - 30), start.y + (compact ? 11 : 13),
        { size: size - 0.5, align: 'center' });
    }
    // the parallel, named at its left end
    let left = null;
    for (const q of par) if (q.front && (!left || q.x < left.x)) left = q;
    if (left && !compact) {
      plateText(ctx, `${M.DEC}° N`, left.x - 6, left.y, { size: size - 1, align: 'right' });
    }

    timeStat.set(M.fmtH(hours.v));
    latStat.set(`${M.DEC.toFixed(1)}° N`);
    lonStat.set(M.lonText(M.LON0 - moved));

    // your view: the star's altitude from where you stand, 90° less your
    // distance from the GP.
    const z = globeAngularDistance(M.YOU, { lat: M.DEC, lon: M.LON0 - moved });
    const alt = 90 - z;
    if (detail) {
      // nothing in the sketch to drag: let the page scroll over it
      detail.canvas.classList.remove('grab');
      detail.canvas.style.touchAction = 'auto';
    }
    plateAltitudeInstrument(detail, {
      sights: [{ alt, block: plateFigureBlock(ctx, `h = ${Math.max(0, alt).toFixed(0)}°`, compact) }],
      // always looking west, toward where the GP goes, so the sketch never flips
      mirror: true,
      below: alt < 0 ? 'STAR BELOW THE HORIZON' : null,
    });
  }
})();
