'use strict';
/* §09: intercepts and the cocked hat. */

(function demoIntercept() {
  const d = createDemo('demo-intercept', { aspect: 1.2, maxH: 620, draw });
  const STARS = [
    { name: 'Capella', zn: 42, c: 's1' },
    { name: 'Regulus', zn: 158, c: 's2' },
    { name: 'Sirius', zn: 262, c: 's3' },
  ];
  let state = null;
  const status = addStat(d, 'plot', true);
  const btns = STARS.map((s, i) =>
    addButton(d, `sight ${s.name} (Zn ${String(s.zn).padStart(3, '0')}°)`, () => takeSight(i)));
  const revealBtn = addButton(d, 'reveal the ship', () => {
    if (state.sights.filter(s => s.taken).length === 3) state.revealed = true;
  });
  addButton(d, 'new position', reset, 'subtle');

  function reset() {
    const ang = Math.random() * TAU, r = 8 + Math.random() * 14;
    state = {
      truth: { x: Math.cos(ang) * r, y: Math.sin(ang) * r }, // nm, east/north
      sights: STARS.map(() => ({ taken: false, anim: 0, a: 0 })),
      revealed: false,
    };
    for (const s of state.sights) s.noise = (Math.random() - 0.5) * 2.6;
    status.set('take the three sights');
  }
  reset();

  function takeSight(i) {
    const s = state.sights[i];
    if (s.taken) return;
    const zn = STARS[i].zn * D2R;
    const u = { x: Math.sin(zn), y: Math.cos(zn) }; // toward star, east/north
    s.a = state.truth.x * u.x + state.truth.y * u.y + s.noise; // intercept, nm
    s.taken = true;
    s.anim = 0;
    const n = state.sights.filter(x => x.taken).length;
    status.set(n < 3 ? `${3 - n} more sight${n === 2 ? '' : 's'} to go` :
      'three lines close into the cocked hat – the ship is inside');
  }

  function draw(ctx, w, h, t, ) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.5;
    const scale = Math.min(w, h) / 95; // px per nm
    const toPx = p => ({ x: cx + p.x * scale, y: cy - p.y * scale });

    // chart grid, 10 nm
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 10 * scale, 0); ctx.lineTo(cx + i * 10 * scale, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, cy + i * 10 * scale); ctx.lineTo(w, cy + i * 10 * scale);
      ctx.stroke();
    }
    // scale bar: ruler segment with small end ticks
    ctx.strokeStyle = P.inkSoft;
    ctx.lineWidth = 1;
    const sbX1 = w - 24 - 10 * scale, sbX2 = w - 24, sbY = h - 26;
    ctx.beginPath();
    ctx.moveTo(sbX1, sbY); ctx.lineTo(sbX2, sbY);
    ctx.moveTo(sbX1, sbY - 5); ctx.lineTo(sbX1, sbY);
    ctx.moveTo(sbX2, sbY - 5); ctx.lineTo(sbX2, sbY);
    ctx.stroke();
    label(ctx, '10 nm', w - 24 - 5 * scale, h - 38, { size: 10.5, color: P.inkSoft, halo: P.paper });
    // north arrow: 0.9px shaft, slim head
    ctx.strokeStyle = P.inkSoft;
    ctx.fillStyle = P.inkSoft;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(30, 58); ctx.lineTo(30, 26);
    ctx.stroke();
    dimHead(ctx, 30, 26, -Math.PI / 2);
    label(ctx, 'N', 30, 15, { size: 11, color: P.inkSoft, halo: P.paper });

    // assumed position
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
    ctx.stroke();
    label(ctx, 'assumed position', cx, cy + 24, { size: 10.5, color: P.inkSoft, halo: P.paper });

    const lines = [];
    state.sights.forEach((s, i) => {
      btns[i].disabled = s.taken;
      if (!s.taken) return;
      s.anim = Math.min(1, s.anim + 0.02);
      const st = STARS[i];
      const stColor = P[st.c];
      const zn = st.zn * D2R;
      const u = { x: Math.sin(zn), y: Math.cos(zn) };
      const perp = { x: -u.y, y: u.x };
      const I = { x: s.a * u.x, y: s.a * u.y };
      const Ipx = toPx(I);
      const ease = 1 - Math.pow(1 - s.anim, 3);

      // azimuth ray: dashed reference line, carries no light
      ctx.strokeStyle = stColor;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.9;
      ctx.setLineDash([5, 4]);
      const far = toPx({ x: u.x * 44 * ease, y: u.y * 44 * ease });
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(far.x, far.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // star direction marker
      if (ease > 0.95) {
        // star glyph just past the ray tip; name clear of both glyph and ray
        const gx = far.x + u.x * 12, gy = far.y - u.y * 12;
        starGlyph(ctx, gx, gy, 6, stColor);
        if (Math.abs(u.y) >= 0.5) {
          const side = u.x >= 0 ? 1 : -1;
          label(ctx, st.name, gx + side * 11, gy,
            { size: 10.5, color: stColor, halo: P.paper, align: side > 0 ? 'left' : 'right' });
        } else {
          label(ctx, st.name, gx, gy + (u.y <= 0 ? 17 : -17), { size: 10.5, color: stColor, halo: P.paper });
        }
      }
      if (ease < 0.4) return;
      const ease2 = (ease - 0.4) / 0.6;
      // intercept: 1.1px dimension line with slim head, AP → I
      ctx.strokeStyle = stColor;
      ctx.fillStyle = stColor;
      ctx.lineWidth = 1.1;
      const Ie = toPx({ x: I.x * ease2, y: I.y * ease2 });
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(Ie.x, Ie.y);
      ctx.stroke();
      if (Math.hypot(Ie.x - cx, Ie.y - cy) > 9) {
        dimHead(ctx, Ie.x, Ie.y, Math.atan2(Ie.y - cy, Ie.x - cx));
      }
      if (ease2 > 0.9) {
        // LOP: 2px flat object stroke
        const L1 = toPx({ x: I.x + perp.x * 42, y: I.y + perp.y * 42 });
        const L2 = toPx({ x: I.x - perp.x * 42, y: I.y - perp.y * 42 });
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(L1.x, L1.y);
        ctx.lineTo(L2.x, L2.y);
        ctx.stroke();
        // label out at the line's end, clear of the crowded center
        const endIn = toPx({ x: I.x + perp.x * 34, y: I.y + perp.y * 34 });
        label(ctx, `a = ${Math.abs(s.a).toFixed(1)}′ ${s.a >= 0 ? 'toward' : 'away'}`,
          endIn.x, endIn.y - 12, { size: 10.5, color: stColor, halo: P.paper });
        lines.push({ I, dir: perp, color: stColor });
      }
    });

    // cocked hat
    if (lines.length === 3) {
      const pts = [];
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          const p = lineIntersect(lines[i], lines[j]);
          if (p) pts.push(p);
        }
      }
      if (pts.length === 3) {
        ctx.beginPath();
        pts.forEach((p, k) => {
          const q = toPx(p);
          if (k === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        });
        ctx.closePath();
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = P.brass;
        ctx.fill();
        ctx.restore();
        const c = { x: (pts[0].x + pts[1].x + pts[2].x) / 3, y: (pts[0].y + pts[1].y + pts[2].y) / 3 };
        const cpx = toPx(c);
        label(ctx, 'the cocked hat', cpx.x, cpx.y - 22, { size: 11, color: P.brass, halo: P.paper });
        if (state.revealed) {
          const tp = toPx(state.truth);
          pointMark(ctx, tp.x, tp.y, P.red);
          ctx.strokeStyle = P.red;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(tp.x, tp.y, 9, 0, TAU); ctx.stroke();
          label(ctx, 'the ship', tp.x, tp.y + 22, { size: 11, color: P.red, halo: P.paper });
          const errNm = Math.hypot(c.x - state.truth.x, c.y - state.truth.y);
          status.set(`fix taken at the hat's center – ${errNm.toFixed(1)} nm from the true position`, P.good);
        }
      }
    }
    revealBtn.disabled = !(lines.length === 3) || state.revealed;
  }

  function lineIntersect(a, b) {
    // a.I + s*a.dir = b.I + u*b.dir
    const det = a.dir.x * (-b.dir.y) - (-b.dir.x) * a.dir.y;
    if (Math.abs(det) < 1e-9) return null;
    const rx = b.I.x - a.I.x, ry = b.I.y - a.I.y;
    const s = (rx * (-b.dir.y) - (-b.dir.x) * ry) / det;
    return { x: a.I.x + s * a.dir.x, y: a.I.y + s * a.dir.y };
  }
})();
