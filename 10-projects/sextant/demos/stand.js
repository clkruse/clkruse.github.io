'use strict';
/* Measuring altitude on land (§4.0), drawn as a drafted elevation. A
   telescope rides in a yoke on a pedestal and its angle is read off a
   graduated quadrant behind the pivot: aim it at the star and the
   quadrant reads the star's altitude. Put the same pedestal on a rolling
   deck and it no longer measures anything steady, since the deck it
   measures from tilts under it while the star stays put. */

(function demoStand() {
  const d = createDemo('demo-stand', {
    aspect: 1.75,
    maxH: 420,
    compactAspect: 0.88,
    compactMaxH: 520,
    draw,
  });

  // the star's true altitude
  const STAR = 35;
  // the telescope's field of view, as a half-angle: a sighting telescope
  // sees a few degrees of sky, so the star shows only near the axis
  const FOV = 2;
  // the telescope's angle above its own base, as read off the quadrant
  const aim = addValue(d, {
    label: 'telescope angle',
    min: 0,
    max: 90,
    step: 0.5,
    value: 20,
    fmt: v => `${v.toFixed(1)}°`,
  });
  let atSea = false;
  addCheck(d, 'on a rocking deck', v => { atSea = v; });

  let geo = null;
  d.canvas.classList.add('grab');
  // which end of the telescope the drag took hold of: the eyepiece end
  // swings the tube from behind, the objective end from in front
  let byBack = false;
  addDrag(d.canvas, {
    hit: p => nearGrab(p, geo && geo.grab),
    start(p) {
      if (!geo) return;
      byBack = (p.x - geo.P.x) * geo.u.x + (p.y - geo.P.y) * geo.u.y < 0;
      this.move(p);
    },
    move(p) {
      if (!geo) return;
      // the pointer's angle seen from the pivot, measured from the base
      let a = Math.atan2(geo.P.y - p.y, p.x - geo.P.x) * R2D - geo.roll + (byBack ? 180 : 0);
      while (a > 180) a -= 360;
      while (a <= -180) a += 360;
      if (a < -45) a = a < -135 ? 90 : 0;
      a = clamp(a, 0, 90);
      aim.set(Math.round(a * 2) / 2, { emit: false });
    },
  });

  // the deck's roll in degrees: two swells, so it never quite repeats
  const rollAt = t => 6.5 * Math.sin(t * 1.25) + 2.2 * Math.sin(t * 2.7 + 1.1);
  // eased in and out as the deck switch flips
  let sea = 0;

  // line weights: the instrument's outline, its lesser parts, and the
  // thin work of dimensions, leaders and hatching
  const HEAVY = 1.35, MEDIUM = 0.9, THIN = 0.55;

  function draw(ctx, w, h, t) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    sea += ((atSea ? 1 : 0) - sea) * 0.06;
    if (Math.abs(sea - (atSea ? 1 : 0)) < 0.002) sea = atSea ? 1 : 0;
    const roll = rollAt(t) * sea;
    const ink = PLATE.ink;
    const pad = compact ? 10 : 16;
    const lsize = compact ? 6.5 : 7;
    const poly = pts => {
      const path = new Path2D();
      pts.forEach((q, i) => path[i ? 'lineTo' : 'moveTo'](q.x, q.y));
      path.closePath();
      return path;
    };
    const outline = (path, weight = HEAVY) => {
      ctx.save();
      ctx.fillStyle = PLATE.paper; ctx.fill(path);
      ctx.strokeStyle = ink; ctx.lineWidth = weight; ctx.setLineDash([]); ctx.stroke(path);
      ctx.restore();
    };

    plateText(ctx, atSea ? 'THE SAME STAND ON A ROLLING DECK' : 'A TELESCOPE ON A LEVEL STAND',
      w / 2, pad + 4, { size: compact ? 7.5 : 9, weight: 600, align: 'center' });

    // ——— the frame that rolls with the deck, about the pedestal's foot ———
    const G = { x: w * 0.5, y: h - (compact ? 40 : 44) };
    const H = Math.min(h * (compact ? 0.34 : 0.37), compact ? 130 : 152);
    const rr = roll * D2R;
    const cr = Math.cos(rr), sr = Math.sin(rr);
    // a point u along the deck and v up from it, on the page
    const on = (u, v) => ({ x: G.x + u * cr - v * sr, y: G.y - (u * sr + v * cr) });
    const P = on(0, H);
    // a direction a degrees up from the deck, on the page
    const deckDir = a => ({ x: Math.cos((a + roll) * D2R), y: -Math.sin((a + roll) * D2R) });
    // the telescope pivots near its balance point
    const L = Math.min(w * (compact ? 0.46 : 0.36), (P.y - pad - 30) / 0.58);
    const fore = L * 0.58, aft = L * 0.42;
    const Ra = Math.min(aft * 0.8, H - 30);
    const trueAim = aim.v + roll;
    const onStar = Math.abs(trueAim - STAR) < 0.3;
    geo = { P, roll, u: deckDir(aim.v) };

    // ——— ground or deck: a heavy line over a hatched strip ———
    const gl = compact ? w * 0.44 : Math.min(w * 0.42, 300);
    ctx.save();
    ctx.translate(G.x, G.y); ctx.rotate(-rr);
    const sp = new Path2D(); sp.rect(-gl, 0, gl * 2, 7);
    plateHatch(ctx, sp, { x: -gl, y: 0, w: gl * 2, h: 7 }, { spacing: 4, weight: 0.45, slope: -1 });
    ctx.restore();
    plateLine(ctx, on(-gl, 0), on(gl, 0), { weight: HEAVY });

    // the true horizontal, once the deck stops being level, and the roll
    if (sea > 0.01) {
      ctx.save();
      ctx.globalAlpha = sea;
      plateLine(ctx, { x: pad, y: G.y }, { x: w - pad, y: G.y }, { kind: 'long', weight: THIN });
      plateText(ctx, 'TRUE HORIZONTAL', pad, G.y + 12, { size: lsize, align: 'left' });
      // the roll, dimensioned at the deck's end
      const rd = gl * 0.94;
      ctx.strokeStyle = ink; ctx.lineWidth = THIN;
      ctx.beginPath(); ctx.arc(G.x, G.y, rd, Math.min(0, -rr), Math.max(0, -rr)); ctx.stroke();
      const rl = { x: G.x + rd + 8, y: G.y - Math.sin(rr) * rd / 2 };
      plateText(ctx, 'ROLL', rl.x, rl.y - 6, { size: lsize, weight: 600, align: 'left' });
      plateDataText(ctx, `${roll >= 0 ? '+' : '−'}${Math.abs(roll).toFixed(1)}°`, rl.x, rl.y + 6, { size: lsize + 0.5, align: 'left' });
      ctx.restore();
    }

    // ——— the star and its line of sight ———
    const sd = { x: Math.cos(STAR * D2R), y: -Math.sin(STAR * D2R) };
    const starR = compact ? 6.5 : 8;
    const reach = Math.min((w - pad - 16 - P.x) / sd.x, (P.y - pad - 30) / -sd.y);
    const star = { x: P.x + sd.x * reach, y: P.y + sd.y * reach };
    plateLine(ctx, { x: star.x - sd.x * (starR + 4), y: star.y - sd.y * (starR + 4) }, P, { kind: 'construction', weight: THIN });
    starGlyph(ctx, star.x, star.y, starR, ink);
    plateText(ctx, 'STAR', star.x - starR - 6, star.y, { size: lsize + 0.5, weight: 600, align: 'right' });

    // ——— the pedestal ———
    const bw = compact ? 34 : 46, cw = compact ? 5 : 6.5;
    // base plate on two levelling feet
    const foot = s => outline(poly([on(s * (bw - 9), 0), on(s * (bw - 3), 0), on(s * (bw - 4), 4), on(s * (bw - 8), 4)]), MEDIUM);
    foot(-1); foot(1);
    outline(poly([on(-bw, 4), on(bw, 4), on(bw, 10), on(-bw, 10)]));
    // the column, tapering up to the yoke
    const yokeY = H - (compact ? 16 : 20);
    outline(poly([on(-cw * 1.5, 10), on(cw * 1.5, 10), on(cw, yokeY), on(-cw, yokeY)]));
    // a spirit level on the base plate
    const vial = on(bw * 0.52, 14);
    const vw = compact ? 8 : 10, vh = compact ? 2.6 : 3;
    ctx.save();
    ctx.translate(vial.x, vial.y); ctx.rotate(-rr);
    ctx.fillStyle = PLATE.paper; ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM;
    ctx.beginPath(); ctx.roundRect(-vw, -vh, vw * 2, vh * 2, vh); ctx.fill(); ctx.stroke();
    ctx.lineWidth = THIN;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * vh * 1.4, -vh); ctx.lineTo(sx * vh * 1.4, vh); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(clamp(roll * 1.4, -vw + vh, vw - vh), 0, vh * 0.7, 0, TAU); ctx.stroke();
    ctx.restore();

    // ——— the graduated quadrant, fixed behind the pivot ———
    // 0° level behind the pivot, 90° straight down the column; the
    // telescope's index arm swings down across it as the front rises
    const back = a => deckDir(a + 180);
    const rp = (q, r) => ({ x: P.x + q.x * r, y: P.y + q.y * r });
    const band = compact ? 7 : 9;
    const rim = Ra + band * 0.3;
    const quad = new Path2D();
    quad.moveTo(P.x, P.y);
    for (let a = 0; a <= 90; a += 1) { const q = rp(back(a), rim); quad.lineTo(q.x, q.y); }
    quad.closePath();
    outline(quad, MEDIUM);
    // the limb: an inner line, and graduations every 2°, longer every 10°
    ctx.save();
    ctx.strokeStyle = ink; ctx.lineWidth = THIN;
    ctx.beginPath();
    for (let a = 0; a <= 90; a += 1) { const q = rp(back(a), rim - band); ctx[a ? 'lineTo' : 'moveTo'](q.x, q.y); }
    ctx.stroke();
    for (let a = 0; a <= 90; a += 2) {
      const q = back(a);
      const len = a % 10 === 0 ? band : band * 0.45;
      const q0 = rp(q, rim - len), q1 = rp(q, rim);
      ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
    }
    ctx.restore();
    for (const a of compact ? [0, 30, 60, 90] : [0, 20, 40, 60, 80]) {
      const q = rp(back(a === 90 ? 84 : a), rim + (compact ? 9 : 10));
      plateDataText(ctx, `${a}`, q.x, q.y, { size: compact ? 6.5 : 7, align: 'center' });
    }

    // centerline of the pedestal, through the pivot
    plateLine(ctx, on(0, -10), on(0, H + 16), { kind: 'construction', weight: THIN });

    // ——— the telescope ———
    const u = deckDir(aim.v);
    const n = { x: -u.y, y: u.x };
    const at = (s, tt = 0) => ({ x: P.x + u.x * s + n.x * tt, y: P.y + u.y * s + n.y * tt });
    const seg = (s0, s1, r, weight = HEAVY) => outline(poly([at(s0, r), at(s1, r), at(s1, -r), at(s0, -r)]), weight);
    const tr = compact ? 4.2 : 5.4;
    // a finger takes the telescope, from eyepiece to objective
    geo.grab = [[at(-aft), at(fore)]];
    // the index arm: from the pivot down to the limb, pointing at the reading
    const bk = back(aim.v);
    plateLine(ctx, P, rp(bk, rim), { weight: MEDIUM });
    plateArrowhead(ctx, rp(bk, rim - 1), Math.atan2(bk.y, bk.x), compact ? 5 : 6);
    // eyepiece, focuser, main tube, objective cell, dew shield
    seg(-aft, -aft + L * 0.07, tr * 0.55, MEDIUM);
    seg(-aft + L * 0.07, -aft + L * 0.13, tr * 0.78, MEDIUM);
    seg(-aft + L * 0.13, fore * 0.8, tr);
    seg(fore * 0.8, fore * 0.87, tr * 1.22);
    seg(fore * 0.87, fore, tr * 1.14, MEDIUM);
    // the objective lens, sectioned
    plateLine(ctx, at(fore * 0.835, tr * 1.1), at(fore * 0.835, -tr * 1.1), { weight: THIN });
    // the clamp ring the yoke holds
    seg(-L * 0.045, L * 0.045, tr * 1.32, MEDIUM);
    // the optical axis, a centerline out along the line of sight
    plateLine(ctx, at(-aft - 8), at(fore + (onStar ? 0 : 70)), { kind: 'construction', weight: THIN });
    // the field of view: two edges spreading from the objective, the same
    // window of sky the eyepiece shows
    const fl = fore * (compact ? 0.75 : 0.95);
    for (const sg of [1, -1]) {
      const a0 = at(fore, -sg * tr * 1.14), fd = deckDir(aim.v + sg * FOV);
      plateLine(ctx, a0, { x: a0.x + fd.x * fl, y: a0.y + fd.y * fl }, { kind: 'short', weight: THIN });
    }

    // the yoke: a fork round the clamp ring, its pivot drawn with a center mark
    const yr = tr * 1.9;
    const yoke = new Path2D();
    const yl = on(-cw * 1.2, yokeY), yrr = on(cw * 1.2, yokeY);
    yoke.moveTo(yl.x, yl.y);
    yoke.lineTo(yrr.x, yrr.y);
    const ya = on(yr, H);
    yoke.lineTo(ya.x, ya.y);
    yoke.arc(P.x, P.y, yr, -rr, Math.PI - rr, true);
    yoke.closePath();
    outline(yoke, MEDIUM);
    ctx.save();
    ctx.fillStyle = PLATE.paper; ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM;
    ctx.beginPath(); ctx.arc(P.x, P.y, compact ? 3 : 3.6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = THIN;
    const cm = compact ? 6 : 7.5;
    ctx.beginPath();
    ctx.moveTo(P.x - cm, P.y); ctx.lineTo(P.x + cm, P.y);
    ctx.moveTo(P.x, P.y - cm); ctx.lineTo(P.x, P.y + cm);
    ctx.stroke();
    ctx.restore();

    // ——— the altitude, dimensioned from the base's level line ———
    const Rd = fore * (compact ? 0.62 : 0.56);
    plateLine(ctx, P, rp(deckDir(0), Rd + 12), { kind: 'construction', weight: THIN });
    if (aim.v > 1.5) {
      ctx.save();
      ctx.strokeStyle = ink; ctx.lineWidth = THIN;
      ctx.beginPath();
      for (let a = 0; a <= aim.v; a += 0.5) { const q = rp(deckDir(a), Rd); ctx[a ? 'lineTo' : 'moveTo'](q.x, q.y); }
      const qe = rp(deckDir(aim.v), Rd); ctx.lineTo(qe.x, qe.y);
      ctx.stroke();
      ctx.restore();
      const tan = a => { const q = deckDir(a + 90); return Math.atan2(q.y, q.x); };
      plateArrowhead(ctx, rp(deckDir(aim.v), Rd), tan(aim.v), 4);
      plateArrowhead(ctx, rp(deckDir(0), Rd), tan(0) + Math.PI, 4);
    }
    {
      const text = `${aim.v.toFixed(1)}°`;
      const ds = compact ? 8.5 : 10;
      const tw = plateTextWidth(ctx, text, { size: ds, weight: 700, font: PLATE.dataFont, uppercase: false, tracking: 0 });
      // in a break in the arc where the angle is wide, beyond it where narrow
      const q = aim.v > 14 ? rp(deckDir(aim.v / 2), Rd) : rp(deckDir(aim.v + 9), Rd + 4);
      ctx.save();
      ctx.fillStyle = PLATE.paper;
      ctx.fillRect(q.x - tw / 2 - 3, q.y - ds * 0.65, tw + 6, ds * 1.3);
      ctx.restore();
      plateDataText(ctx, text, q.x, q.y, { size: ds, weight: 700, align: 'center' });
    }

    // ——— names, on leaders ———
    const leader = (target, lx, ly, text, align = 'left', weight = 500) => {
      plateLeader(ctx, target, { x: lx + (align === 'left' ? -4 : 4), y: ly }, { head: 3.2 });
      plateText(ctx, text, lx, ly, { size: lsize, weight, align });
    };
    // the telescope, named off its upper side toward the front
    const tt = at(fore * 0.42, -tr);
    leader(tt, tt.x - (compact ? 26 : 40), tt.y - (compact ? 26 : 30),
      onStar && !compact ? 'TELESCOPE · ON THE STAR' : 'TELESCOPE · DRAG', 'right', 700);
    // the quadrant, from its lower limb out to the left
    const qa = rp(back(compact ? 50 : 55), rim);
    leader(qa, P.x - Ra - (compact ? 22 : 34), qa.y + (compact ? 20 : 24), 'GRADUATED ARC', 'right');
    // the pedestal and its level, out to the right
    const lx = P.x + (compact ? 34 : 52);
    const pc = on(cw * 1.3, H * 0.42);
    leader(pc, lx, pc.y, 'PEDESTAL', 'left');
    const vt = on(bw * 0.52 + vw, 14);
    leader(vt, lx, vt.y - (compact ? 12 : 14), 'SPIRIT LEVEL', 'left');
    if (sea < 0.5) { const ge = on(gl, 0); plateText(ctx, 'LEVEL GROUND', ge.x, ge.y - 8, { size: lsize, align: 'right' }); }
    else { const ge = on(-gl, 0); plateText(ctx, 'DECK', ge.x + 2, ge.y - 8, { size: lsize, align: 'left' }); }

    // ——— the eyepiece: a reticle, and the star wherever the telescope leaves it ———
    const vr = compact ? 34 : Math.min(h * 0.15, w * 0.085);
    const view = { x: pad + vr + 4, y: (compact ? 104 : 136) + vr };
    const k = vr / FOV;
    const off = (trueAim - STAR) * k;
    plateEyepiece(ctx, view.x, view.y, vr, () => {
      ctx.save();
      ctx.strokeStyle = ink; ctx.lineWidth = THIN;
      ctx.beginPath();
      ctx.moveTo(view.x - vr, view.y); ctx.lineTo(view.x + vr, view.y);
      ctx.moveTo(view.x, view.y - vr); ctx.lineTo(view.x, view.y + vr);
      // a tick every half degree along both hairs, longer every degree
      for (let g = -FOV; g <= FOV; g += 0.5) {
        if (!g) continue;
        const len = g % 1 === 0 ? 4 : 2;
        ctx.moveTo(view.x + g * k, view.y - len); ctx.lineTo(view.x + g * k, view.y + len);
        ctx.moveTo(view.x - len, view.y + g * k); ctx.lineTo(view.x + len, view.y + g * k);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(view.x, view.y, vr * 0.16, 0, TAU); ctx.stroke();
      ctx.restore();
      if (Math.abs(off) < vr) starGlyph(ctx, view.x, view.y + off, compact ? 5 : 6.5, ink);
    }, { title: 'EYEPIECE VIEW', compact });
    if (Math.abs(off) >= vr) {
      const sg = Math.sign(off);
      plateArrowhead(ctx, { x: view.x + 7, y: view.y + sg * (vr - 5) }, sg > 0 ? Math.PI / 2 : -Math.PI / 2, 5);
    }

    // ——— the data block ———
    const rows = sea < 0.5
      ? [['ARC READING', `${aim.v.toFixed(1)}°`], ['STAR', onStar ? 'CENTERED' : Math.abs(off) >= vr ? 'OUT OF VIEW' : 'IN VIEW']]
      : [['STAR ABOVE DECK', `${(STAR - roll).toFixed(1)}°`], ['TRUE ALTITUDE', `${STAR.toFixed(1)}°`]];
    const bx = pad, by = pad + (compact ? 18 : 22);
    const rh = compact ? 15 : 17;
    const c1 = compact ? 86 : 104, c2 = compact ? 64 : 76;
    ctx.save();
    ctx.strokeStyle = ink; ctx.lineWidth = MEDIUM;
    ctx.strokeRect(bx + 0.5, by + 0.5, c1 + c2, rh * rows.length);
    ctx.lineWidth = THIN;
    ctx.beginPath();
    ctx.moveTo(bx + c1 + 0.5, by); ctx.lineTo(bx + c1 + 0.5, by + rh * rows.length);
    for (let i = 1; i < rows.length; i++) { ctx.moveTo(bx, by + rh * i + 0.5); ctx.lineTo(bx + c1 + c2, by + rh * i + 0.5); }
    ctx.stroke();
    ctx.restore();
    rows.forEach(([name, value], i) => {
      const y = by + rh * (i + 0.5) + 0.5;
      plateText(ctx, name, bx + 6, y, { size: compact ? 6 : 6.5, weight: 600 });
      if (/\d/.test(value)) plateDataText(ctx, value, bx + c1 + c2 - 6, y, { size: compact ? 8.5 : 9.5, weight: 700, align: 'right' });
      else plateText(ctx, value, bx + c1 + c2 - 6, y, { size: compact ? 6 : 6.5, weight: 700, align: 'right' });
    });
  }
})();
