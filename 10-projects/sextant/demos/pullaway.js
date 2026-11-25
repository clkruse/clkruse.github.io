'use strict';
/* Pull a star away from the Earth. Close up, the line from you to
   the star and the line through its GP meet at a visible angle, and the
   altitude you measure falls short of 90° minus your distance from the GP.
   As the star recedes the two lines close up until they are parallel. */

(function demoPullaway() {
  const MI_PER_R = 3959; // Earth radius in miles
  const LY_MI = 5.879e12;
  const STOPS = {
    near: 1.9,
    moon: 238900 / MI_PER_R,
    sun: 92.96e6 / MI_PER_R,
    vega: 25.04 * LY_MI / MI_PER_R,
  };
  const LO = Math.log10(1.35), HI = Math.log10(STOPS.vega);
  const toD = v => 10 ** (LO + (HI - LO) * v / 1000);
  const toV = D => 1000 * (Math.log10(D) - LO) / (HI - LO);

  const fmtDist = D => {
    const mi = D * MI_PER_R;
    if (mi > LY_MI * 0.01) return `${(mi / LY_MI).toFixed(mi > LY_MI * 10 ? 0 : 1)} light-years`;
    if (mi >= 1e9) return `${(mi / 1e9).toFixed(1)} billion miles`;
    if (mi >= 1e6) return `${(mi / 1e6).toFixed(mi >= 1e7 ? 0 : 1)} million miles`;
    return `${Math.round(mi / (mi > 1e5 ? 100 : 10)) * (mi > 1e5 ? 100 : 10)} miles`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  const fmtAngle = deg => {
    if (deg >= 1) return `${deg.toFixed(1)}°`;
    const m = deg * 60;
    if (m >= 1) return `${m.toFixed(0)}′`;
    const s = m * 60;
    if (s >= 0.1) return `${s.toFixed(1)}″`;
    return `${s.toFixed(Math.min(12, 1 - Math.floor(Math.log10(s))))}″`;
  };

  const d = createDemo('demo-pullaway', {
    aspect: 1.6, maxH: 460, compactAspect: 0.95, compactMaxH: 520, draw,
  });
  const dist = addSlider(d, {
    label: 'star’s distance', min: 0, max: 1000, step: 0.1, value: toV(STOPS.near),
    fmt: v => fmtDist(toD(v)),
  });
  // the slider's scale carries the Moon, the Sun and Vega in place of
  // its even divisions
  const scale = document.createElement('div');
  scale.className = 'ctl-scale';
  dist.input.replaceWith(scale);
  scale.append(dist.input);
  for (const [name, D] of [['The Moon', STOPS.moon], ['The Sun', STOPS.sun], ['Star', STOPS.vega]]) {
    const mark = document.createElement('span');
    mark.className = 'ctl-scale-mark';
    mark.style.setProperty('--at', toV(D) / 1000);
    const tick = document.createElement('i');
    const word = document.createElement('span');
    word.textContent = name;
    if (toV(D) > 960) mark.classList.add('end');
    mark.append(tick, word);
    scale.append(mark);
  }

  let z = 40;
  let geo = null;
  d.canvas.classList.add('grab');
  addDrag(d.canvas, {
    hit: p => geo && Math.hypot(p.x - geo.you.x, p.y - geo.you.y) < 30,
    move(p) {
      if (!geo) return;
      const t = Math.atan2(p.y - geo.cy, p.x - geo.cx) + Math.PI / 2;
      z = clamp(Math.round(t * R2D), 8, 80);
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const pad = compact ? 10 : 16;
    const D = toD(dist.v);
    const topY = pad + (compact ? 26 : 30);
    const R = Math.min(w * (compact ? 0.26 : 0.18), h * (compact ? 0.2 : 0.23));
    const cx = w * (compact ? 0.4 : 0.42), cy = h - R - pad - (compact ? 20 : 26);
    const up = -Math.PI / 2, a = up + z * D2R;
    const C = { x: cx, y: cy };
    const gp = { x: cx, y: cy - R };
    const you = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    geo = { cx, cy, you };

    plateWireSphere(ctx, cx, cy, R, { tilt: 0, graticule: false, axis: false, northLabel: false });
    plateLine(ctx, C, gp, { kind: 'construction', weight: 0.75 });
    plateLine(ctx, C, you, { kind: 'construction', weight: 0.75 });

    // the star, straight above the GP at D Earth radii from the centre
    const starY = cy - D * R;
    const onPage = starY >= topY;
    // from you toward the star, in exact arithmetic so a far star still aims true
    const vx = cx - you.x, vy = starY - you.y, vl = Math.hypot(vx, vy);
    const dir = { x: vx / vl, y: vy / vl };
    const gpEnd = onPage ? { x: cx, y: starY } : { x: cx, y: topY };
    const youEnd = onPage ? { x: cx, y: starY } : {
      x: you.x + dir.x * (topY - you.y) / dir.y, y: topY,
    };
    const head = compact ? 3.4 : 4.2;
    const back = (p, q, r) => {
      const L = Math.hypot(q.x - p.x, q.y - p.y);
      return { x: q.x - (q.x - p.x) / L * r, y: q.y - (q.y - p.y) / L * r };
    };
    const starR = compact ? 7.5 : 9;
    if (onPage) {
      plateLine(ctx, gp, back(gp, gpEnd, starR + 3), { kind: 'long', weight: 1 });
      plateLine(ctx, you, back(you, youEnd, starR + 3), { kind: 'long', weight: 1 });
      starGlyph(ctx, cx, starY, starR, PLATE.ink);
    } else {
      plateVector(ctx, gp, gpEnd, { kind: 'long', weight: 1, head });
      plateVector(ctx, you, youEnd, { kind: 'long', weight: 1, head });
    }

    // the angle between the two lines, at the star: R sin z / |you to star|
    const p = Math.asin(Math.min(1, R * Math.sin(z * D2R) / vl));
    const pDeg = p * R2D;
    // exact for any distance: law of sines in Earth radii
    const youToStar = Math.sqrt(D * D + 1 - 2 * D * Math.cos(z * D2R));
    const pTrue = Math.asin(Math.sin(z * D2R) / youToStar) * R2D;
    const size = compact ? 7.5 : 8.5;

    if (onPage && pDeg > 1.5) {
      const ar = Math.min(compact ? 26 : 34, (cy - R - starY) * 0.5);
      ctx.save(); ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 0.9;
      ctx.beginPath();
      arcBetween(ctx, cx, starY, ar, Math.PI / 2, Math.atan2(-dir.y, -dir.x));
      ctx.stroke(); ctx.restore();
      const mid = (Math.PI / 2 + Math.atan2(-dir.y, -dir.x)) / 2;
      plateDataText(ctx, fmtAngle(pTrue), cx - 8, starY + ar * 0.75,
        { size: size + 0.5, weight: 700, align: 'right' });
      plateText(ctx, 'STAR', cx - starR - 6, starY, { size, align: 'right' });
    } else if (!onPage) {
      const mx = (gpEnd.x + youEnd.x) / 2;
      const text = compact ? `STAR ${fmtDist(D)} UP` : `TO THE STAR, ${fmtDist(D)} OFF THE PAGE`;
      plateText(ctx, text, mx, pad + 6, { size, weight: 600, align: 'center' });
    }

    // horizon and the altitude you measure
    const hh = Math.min(R * 0.45, compact ? 34 : 50);
    const tx = Math.cos(a + Math.PI / 2) * hh, ty = Math.sin(a + Math.PI / 2) * hh;
    plateLine(ctx, { x: you.x - tx, y: you.y - ty }, { x: you.x + tx, y: you.y + ty }, { weight: compact ? 1.1 : 1.35 });
    const towardGp = a - Math.PI / 2, toStarA = Math.atan2(dir.y, dir.x);
    const altR = compact ? 16 : 22;
    ctx.save(); ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 1;
    ctx.beginPath(); arcBetween(ctx, you.x, you.y, altR, towardGp, toStarA); ctx.stroke(); ctx.restore();
    const alt = 90 - z - pTrue;
    // the reading sits inside its wedge when the wedge is wide enough for it,
    // and otherwise in the open wedge between the starlight and the zenith
    const altText = `${alt.toFixed(1)}°`;
    const hw = plateTextWidth(ctx, altText, { size: size + 0.5, font: PLATE.dataFont, uppercase: false, tracking: 0 }) / 2;
    const span = toStarA - towardGp;
    const inside = (hw + 5) / Math.sin(Math.max(1e-3, Math.abs(span) / 2));
    const [am, ar] = inside <= altR + 34
      ? [towardGp + span / 2, Math.max(inside, altR + 14)]
      : [(toStarA + a) / 2, Math.max(altR + 14, (hw + 5) / Math.sin(Math.max(1e-3, Math.abs(a - toStarA) / 2)))];
    plateDataText(ctx, altText, you.x + Math.cos(am) * ar, you.y + Math.sin(am) * ar,
      { size: size + 0.5, weight: 700, align: 'center' });

    // distance from the GP, at the centre
    const cr = compact ? 18 : 26;
    ctx.save(); ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 0.8;
    ctx.beginPath(); arcBetween(ctx, cx, cy, cr, up, a); ctx.stroke(); ctx.restore();
    plateDataText(ctx, `${z}°`, cx - 8, cy - cr - 6, { size, align: 'right' });
    plateText(ctx, 'FROM THE GP', cx - 8, cy - cr + 8, { size: size - 1, align: 'right' });

    for (const q of [gp, you]) {
      ctx.save(); ctx.fillStyle = PLATE.ink; ctx.beginPath();
      ctx.arc(q.x, q.y, compact ? 2.6 : 3.2, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = PLATE.ink; ctx.lineWidth = 1.3; ctx.beginPath();
    ctx.arc(you.x, you.y, compact ? 4.4 : 5.4, 0, TAU); ctx.stroke(); ctx.restore();
    plateText(ctx, 'STAR’S GP', gp.x - 8, gp.y - 12, { size, align: 'right' });
    plateText(ctx, 'YOU · DRAG', you.x + 14, you.y - 12, { size, weight: 700 });

  }
})();
