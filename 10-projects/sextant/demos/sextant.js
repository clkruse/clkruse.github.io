'use strict';
/* §04b: the sextant, rays traced through both mirrors.
   Drafting treatment: flat-fill instrument linework, 2px object edges,
   0.9px leaders/dimensions, back-hatched mirrors, dash-dot sight axis. */

(function demoSextant() {
  const d = createDemo('demo-sextant', { aspect: 1.3, maxH: 600, draw });
  let sunAlt = 40;   // true altitude of the sun, degrees
  let arm = 12;      // physical arm rotation, degrees (arc reads 2×)
  const armSlider = addSlider(d, {
    label: 'index arm', min: 0, max: 60, step: 0.1, value: arm,
    fmt: v => v.toFixed(1) + '°',
    onchange: v => { arm = v; },
  });
  addSlider(d, {
    label: "sun's true altitude", min: 10, max: 70, step: 1, value: sunAlt,
    fmt: v => v.toFixed(0) + '°',
    onchange: v => { sunAlt = v; },
  });
  const readStat = addStat(d, 'arc reads');
  const status = addStat(d, 'in the telescope', true);

  d.canvas.classList.add('grab');
  let geo = null;
  addDrag(d.canvas, {
    move(p) {
      if (!geo) return;
      const a = Math.atan2(p.y - geo.P.y, p.x - geo.P.x) * R2D;
      arm = clamp(a - geo.A0, 0, 60);
      armSlider.set(arm);
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const Pv = { x: w * 0.56, y: h * 0.30 };
    const M = { x: w * 0.30, y: h * 0.60 };
    const E = { x: w * 0.90, y: h * 0.60 };
    const A0 = 78; // arm canvas angle at zero
    geo = { P: Pv, A0 };
    const Rarc = h * 0.52;

    const u = norm({ x: M.x - Pv.x, y: M.y - Pv.y });          // index → horizon mirror
    const mN = norm({ x: 1 - u.x, y: -u.y });                  // horizon-mirror normal
    const iN0 = norm({ x: u.x - 1, y: u.y });                  // index normal at arm = 0
    const iN = rot(iN0, arm * D2R);
    const hRad = sunAlt * D2R;
    const dIn = { x: Math.cos(hRad), y: Math.sin(hRad) };      // sun ray direction (sun is up-left)

    // back-hatch: 0.9px ticks off the non-silvered side of a mirror line
    function hatch(x0, y0, x1, y1, nx, ny) {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      ctx.strokeStyle = P.inkSoft;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let t = 2.5; t <= L - 1; t += 4.5) {
        const bx = x0 + ux * t, by = y0 + uy * t;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - nx * 5 - ux * 3, by - ny * 5 - uy * 3);
      }
      ctx.stroke();
    }
    // clamp a ray from p along dir to the canvas margin
    function toEdge(p, dir) {
      let t = w + h;
      if (dir.x > 0) t = Math.min(t, (w - 6 - p.x) / dir.x);
      if (dir.x < 0) t = Math.min(t, (6 - p.x) / dir.x);
      if (dir.y > 0) t = Math.min(t, (h - 6 - p.y) / dir.y);
      if (dir.y < 0) t = Math.min(t, (6 - p.y) / dir.y);
      return { x: p.x + dir.x * t, y: p.y + dir.y * t };
    }

    // ––– horizon (sea at left, at telescope height) –––
    ctx.strokeStyle = P.sea;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.015, M.y);
    ctx.lineTo(w * 0.12, M.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(46,95,134,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.02 + i * 9, M.y + 8 + i * 7);
      ctx.lineTo(w * 0.09 + i * 9, M.y + 8 + i * 7);
      ctx.stroke();
    }
    label(ctx, 'horizon', w * 0.065, M.y - 15, { color: P.sea, size: 11, halo: P.paper });

    // ––– sun: flat disc, thin ring – a light diagram, not a picture –––
    const sunDist = Math.min(w * 0.52,
      (Pv.y - 48) / Math.max(dIn.y, 0.05),
      (Pv.x - 52) / Math.max(dIn.x, 0.05));
    const sunPos = { x: Pv.x - dIn.x * sunDist, y: Pv.y - dIn.y * sunDist };
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(sunPos.x, sunPos.y, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.sun;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sunPos.x, sunPos.y, 16, 0, TAU); ctx.stroke();

    // ––– frame: spokes pivot → band, hub boss at the pivot, closed arc band –––
    const arcA0 = (A0 - 5) * D2R, arcA1 = (A0 + 65) * D2R;
    const spokeW = h * 0.016;
    const hubR = h * 0.026;
    for (const sa of [(A0 + 2) * D2R, (A0 + 58) * D2R]) {
      // runs from the pivot (capped by the hub) into the band (capped by its fill)
      const sx2 = Pv.x + Math.cos(sa) * (Rarc - h * 0.035), sy2 = Pv.y + Math.sin(sa) * (Rarc - h * 0.035);
      ctx.strokeStyle = P.inkFaint;
      ctx.lineWidth = spokeW;
      ctx.beginPath(); ctx.moveTo(Pv.x, Pv.y); ctx.lineTo(sx2, sy2); ctx.stroke();
      ctx.strokeStyle = P.paperDeep;
      ctx.lineWidth = Math.max(spokeW - 2.2, 1);
      ctx.beginPath(); ctx.moveTo(Pv.x, Pv.y); ctx.lineTo(sx2, sy2); ctx.stroke();
    }
    // arc band: one closed annular sector, so both radial ends are capped
    ctx.beginPath();
    ctx.arc(Pv.x, Pv.y, Rarc, arcA0, arcA1);
    ctx.arc(Pv.x, Pv.y, Rarc - h * 0.045, arcA1, arcA0, true);
    ctx.closePath();
    ctx.fillStyle = P.paperDeep;
    ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
    // heavier outer silhouette on top
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(Pv.x, Pv.y, Rarc, arcA0, arcA1); ctx.stroke();
    // pivot hub: the boss the spokes and the index arm join
    ctx.fillStyle = P.paperDeep;
    ctx.beginPath(); ctx.arc(Pv.x, Pv.y, hubR, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(Pv.x, Pv.y, hubR, 0, TAU); ctx.stroke();

    // graduations: physical every 2.5° = engraved every 5°; majors longer + heavier
    for (let a = 0; a <= 60; a += 2.5) {
      const aa = (A0 + a) * D2R;
      const major = a % 5 === 0;
      const r1g = Rarc - h * 0.045, r2g = r1g + (major ? h * 0.022 : h * 0.013);
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = major ? 1.2 : 0.7;
      ctx.beginPath();
      ctx.moveTo(Pv.x + Math.cos(aa) * r1g, Pv.y + Math.sin(aa) * r1g);
      ctx.lineTo(Pv.x + Math.cos(aa) * r2g, Pv.y + Math.sin(aa) * r2g);
      ctx.stroke();
      if (a % 10 === 0) {
        label(ctx, String(2 * a), Pv.x + Math.cos(aa) * (Rarc + 13), Pv.y + Math.sin(aa) * (Rarc + 13),
          { size: 10.5, color: P.inkSoft, halo: P.paper });
      }
    }
    const noteA = (A0 + 45) * D2R;
    leaderNote(ctx, 'the arc – engraved 2× (0–120°)',
      Pv.x + Math.cos(noteA) * Rarc, Pv.y + Math.sin(noteA) * Rarc,
      noteA, 24, P.inkSoft, { size: 10.5 });

    // ––– ray trace (unchanged) –––
    const r1 = reflect(dIn, iN);
    const tHit = ((M.x - Pv.x) * mN.x + (M.y - Pv.y) * mN.y) / (r1.x * mN.x + r1.y * mN.y);
    const mirrorHalf = h * 0.055;
    let hit = null, r2 = null, aligned = false, offDeg = 2 * arm - sunAlt;
    if (tHit > 0 && isFinite(tHit)) {
      const X = { x: Pv.x + r1.x * tHit, y: Pv.y + r1.y * tHit };
      if (Math.hypot(X.x - M.x, X.y - M.y) < mirrorHalf * 1.7) {
        hit = X;
        r2 = reflect(r1, mN);
        aligned = Math.abs(offDeg) < 0.4;
      }
    }

    // direct horizon ray: dashed construction line, sea → clear glass → objective
    const xObj = w * 0.66 - 4; // telescope objective face
    ctx.strokeStyle = P.sea;
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(w * 0.015, M.y);
    ctx.lineTo(w * 0.635, M.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // sun beam: signal orange, slim heads at each reflection leg's end;
    // aligned = slightly heavier stroke (never a glow)
    ctx.strokeStyle = P.sun;
    ctx.fillStyle = P.sun;
    ctx.lineWidth = aligned ? 2.6 : 1.6;
    const a1 = Math.atan2(dIn.y, dIn.x);
    const e1 = { x: Pv.x - dIn.x * 4.5, y: Pv.y - dIn.y * 4.5 };
    ctx.beginPath();
    ctx.moveTo(sunPos.x + dIn.x * 19, sunPos.y + dIn.y * 19);
    ctx.lineTo(e1.x, e1.y);
    ctx.stroke();
    dimHead(ctx, e1.x, e1.y, a1);
    if (hit) {
      // index mirror → horizon mirror
      const a2 = Math.atan2(r1.y, r1.x);
      const e2 = { x: hit.x - r1.x * 4.5, y: hit.y - r1.y * 4.5 };
      ctx.beginPath(); ctx.moveTo(Pv.x, Pv.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
      dimHead(ctx, e2.x, e2.y, a2);
      // horizon mirror → telescope objective (clamped on-canvas)
      let end;
      if (r2.x > 0.3) {
        end = { x: xObj, y: hit.y + r2.y * ((xObj - hit.x) / r2.x) };
        if (end.y < 6 || end.y > h - 6) end = toEdge(hit, r2);
      } else {
        end = toEdge(hit, r2);
      }
      ctx.beginPath(); ctx.moveTo(hit.x, hit.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      dimHead(ctx, end.x, end.y, Math.atan2(r2.y, r2.x));
    } else {
      // reflected ray misses the horizon mirror: off it goes
      const end = toEdge(Pv, r1);
      ctx.beginPath(); ctx.moveTo(Pv.x, Pv.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      dimHead(ctx, end.x, end.y, Math.atan2(r1.y, r1.x));
    }

    // ––– index arm: outlined flat bar, clamp disc, red reading pointer –––
    const armA = (A0 + arm) * D2R;
    const tip = { x: Pv.x + Math.cos(armA) * (Rarc - h * 0.02), y: Pv.y + Math.sin(armA) * (Rarc - h * 0.02) };
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = h * 0.02;
    ctx.beginPath(); ctx.moveTo(Pv.x, Pv.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = P.paperDeep;
    ctx.lineWidth = Math.max(h * 0.02 - 2.4, 1);
    ctx.beginPath(); ctx.moveTo(Pv.x, Pv.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    // clamp at the arc
    ctx.fillStyle = P.paperDeep;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, h * 0.022, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, h * 0.022, 0, TAU); ctx.stroke();
    // reading pointer (wayfinding red)
    ctx.strokeStyle = P.red;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(Pv.x + Math.cos(armA) * (Rarc - h * 0.05), Pv.y + Math.sin(armA) * (Rarc - h * 0.05));
    ctx.lineTo(Pv.x + Math.cos(armA) * Rarc, Pv.y + Math.sin(armA) * Rarc);
    ctx.stroke();

    // ––– index mirror (rides on the arm pivot): 2px ink, back-hatched –––
    const iDir = rot(iN, Math.PI / 2);
    const iA = { x: Pv.x - iDir.x * mirrorHalf, y: Pv.y - iDir.y * mirrorHalf };
    const iB = { x: Pv.x + iDir.x * mirrorHalf, y: Pv.y + iDir.y * mirrorHalf };
    hatch(iA.x, iA.y, iB.x, iB.y, iN.x, iN.y);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(iA.x, iA.y); ctx.lineTo(iB.x, iB.y); ctx.stroke();
    pointMark(ctx, Pv.x, Pv.y, P.ink);

    // ––– horizon mirror: silvered half hatched, clear half dashed –––
    const mDir = rot(mN, Math.PI / 2);
    const Ms = { x: M.x - mDir.x * mirrorHalf, y: M.y - mDir.y * mirrorHalf }; // silvered end
    const Mc = { x: M.x + mDir.x * mirrorHalf, y: M.y + mDir.y * mirrorHalf }; // clear end
    hatch(Ms.x, Ms.y, M.x, M.y, mN.x, mN.y);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(Ms.x, Ms.y); ctx.lineTo(M.x, M.y); ctx.stroke();
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(M.x, M.y); ctx.lineTo(Mc.x, Mc.y); ctx.stroke();
    ctx.setLineDash([]);

    // ––– telescope: outlined tube, dash-dot sight axis –––
    const ty = M.y;
    ctx.fillStyle = P.paperDeep;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(w * 0.68, ty - h * 0.021, w * 0.20, h * 0.042);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(w * 0.66, ty - h * 0.015, w * 0.03, h * 0.03);
    ctx.fill(); ctx.stroke();
    centerline(ctx, w * 0.648, ty, w * 0.895, ty, P.inkFaint);

    // ––– part labels: leader notes –––
    const iTop = iDir.y < 0 ? iB : iA;
    leaderNote(ctx, 'index mirror', iTop.x, iTop.y, -35 * D2R, 26, P.inkSoft, { size: 10.5 });
    leaderNote(ctx, 'horizon mirror', Ms.x, Ms.y, -125 * D2R, 26, P.inkSoft, { size: 10.5 });
    leaderNote(ctx, 'telescope', w * 0.80, ty + h * 0.021, 75 * D2R, 22, P.inkSoft, { size: 10.5 });
    const armMid = { x: Pv.x + Math.cos(armA) * Rarc * 0.42, y: Pv.y + Math.sin(armA) * Rarc * 0.42 };
    leaderNote(ctx, 'index arm', armMid.x, armMid.y, 50 * D2R, 26, P.inkSoft, { size: 10.5 });

    readStat.set(fmtDM(2 * arm, 1));
    if (aligned) {
      status.set('✓ sun sits on the horizon – altitude = ' + fmtDM(2 * arm, 1), P.good);
    } else if (hit) {
      status.set('sun image ' + fmtDM(Math.abs(offDeg), 1) + (offDeg < 0 ? ' above' : ' below') + ' the horizon', '');
    } else {
      status.set('reflected ray misses the horizon mirror – keep swinging the arm', P.inkFaint);
    }
  }
})();
