/* Celestial Navigation – interactive diagrams.
   Vanilla canvas, no libraries. */
'use strict';

/* ––––– shared helpers ––––– */

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const rot = (v, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};
const reflect = (d, n) => {
  const k = 2 * (d.x * n.x + d.y * n.y);
  return { x: d.x - k * n.x, y: d.y - k * n.y };
};
const norm = v => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/* blueprint palette, matched to /ml/embeddings */
/* Palette per the Rams page spec: neutrals and series colors are read live
   from the CSS variables so every diagram follows light/dark. Fixed values
   are representational (sea, sun, night sky) or sit on always-dark scenes. */
const P = {};
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function readPalette() {
  P.ink = cssVar('--ink');
  P.inkSoft = cssVar('--faint');
  P.inkFaint = cssVar('--faint');
  P.paper = cssVar('--paper');
  P.paperDeep = cssVar('--codebg');
  P.line = cssVar('--hair');
  P.red = cssVar('--red');
  P.s1 = cssVar('--s1');
  P.s2 = cssVar('--s2');
  P.s3 = cssVar('--s3');
  P.brass = P.s2;              // primary measurement color: ink blue
  P.sun = P.s3;                // signal orange
  P.good = cssVar('--s7');
  P.green = cssVar('--s7');
  P.dark = matchMedia('(prefers-color-scheme: dark)').matches;
  // the globe base recedes in light mode so the figure's marks carry the
  // contrast (owner request); dark mode keeps the fuller ink
  P.globeLimb = P.dark ? P.ink : '#a9a9a9';
  P.globeCoast = P.dark ? P.inkSoft : '#c2c2c2';
  P.globeGrat = P.dark ? P.inkFaint : '#dcdcdc';
  // constants below: dark-sky scenes and representational content
  P.brassBright = '#4d6fa8';   // series 2, dark stop: legible on sky and on paper
  P.blue = '#c23f52';          // series 1, dark stop: second circle on the globe
  P.sunCore = '#ffb066';
  P.sea = '#2e5f86';
  P.seaDeep = '#1d3f5e';
  P.night = '#0e1626';
  P.nightDeep = '#0a1120';
  P.starlight = '#e9edf3';
}
readPalette();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readPalette);

const MONO = '"Helvetica Neue", Helvetica, Arial, sans-serif';

// arc from angle a1 to a2 taking the SHORT way around
function arcBetween(ctx, x, y, r, a1, a2) {
  let d = a2 - a1;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  ctx.arc(x, y, r, a1, a1 + d, d < 0);
}

function fmtDM(v, minDecimals = 0) {
  const sign = v < 0 ? '−' : '';
  v = Math.abs(v);
  let d = Math.floor(v);
  let m = (v - d) * 60;
  const rounded = +m.toFixed(minDecimals);
  if (rounded >= 60) { d += 1; m = 0; } else m = rounded;
  const ms = minDecimals > 0 ? m.toFixed(minDecimals) : String(Math.round(m));
  return `${sign}${d}° ${ms.padStart(minDecimals > 0 ? 4 : 2, '0')}′`;
}
const fmtNM = v => Math.round(v).toLocaleString('en-US') + ' nm';

function textW(ctx, text, size = 12, weight = 500, font = MONO) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

function label(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || 500} ${opts.size || 12}px ${opts.font || MONO}`;
  ctx.fillStyle = opts.color || P.inkSoft;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  if (opts.halo) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = opts.halo;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

function arrow(ctx, x1, y1, x2, y2, size = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(a - 0.44), y2 - size * Math.sin(a - 0.44));
  ctx.lineTo(x2 - size * Math.cos(a + 0.44), y2 - size * Math.sin(a + 0.44));
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

function starGlyph(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? r : r * 0.36;
    const a = (i / 8) * TAU - Math.PI / 2;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](rr * Math.cos(a), rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function sunGlyph(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  g.addColorStop(0, 'rgba(255,176,102,0.85)');
  g.addColorStop(1, 'rgba(255,176,102,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  const g2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g2.addColorStop(0, P.sunCore);
  g2.addColorStop(1, P.sun);
  ctx.fillStyle = g2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function boatGlyph(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath(); // hull
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(-s * 0.7, s * 0.55, 0, s * 0.55);
  ctx.quadraticCurveTo(s * 0.7, s * 0.55, s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); // sail
  ctx.moveTo(s * 0.06, -s * 0.12);
  ctx.lineTo(s * 0.06, -s * 1.5);
  ctx.quadraticCurveTo(s * 0.75, -s * 0.55, s * 0.14, -s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, -s * 0.12);
  ctx.lineTo(-s * 0.08, -s * 1.32);
  ctx.quadraticCurveTo(-s * 0.62, -s * 0.5, -s * 0.16, -s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ––––– demo scaffolding ––––– */

const visibleDemos = new Set();
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    const d = e.target._demo;
    if (!d) continue;
    if (e.isIntersecting) visibleDemos.add(d); else visibleDemos.delete(d);
  }
}, { rootMargin: '80px' });

function createDemo(figId, { aspect = 1.6, maxH = 560, draw }) {
  const fig = document.getElementById(figId);
  const canvas = fig.querySelector('canvas');
  const controls = fig.querySelector('.demo-controls');
  const d = { fig, canvas, controls, ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1, t: 0, draw };
  canvas._demo = d;
  io.observe(canvas);
  const fit = () => {
    const cssW = canvas.parentElement.clientWidth;
    if (!cssW) return;
    // never let a panel outgrow the viewport (matters for the sticky right panel)
    const availH = Math.max(280, window.innerHeight - 330);
    const cssH = Math.min(maxH, Math.round(cssW / aspect), availH);
    d.dpr = Math.min(2, window.devicePixelRatio || 1);
    d.w = cssW; d.h = cssH;
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * d.dpr);
    canvas.height = Math.round(cssH * d.dpr);
  };
  new ResizeObserver(fit).observe(canvas.parentElement);
  allFits.push(fit);
  fit();
  return d;
}

const allFits = [];
window.addEventListener('resize', () => allFits.forEach(f => f()));

let lastTS = 0;
function frame(ts) {
  const dt = clamp((ts - lastTS) / 1000 || 0.016, 0, 0.05);
  lastTS = ts;
  // cold-load race: on a first (uncached) load the stylesheet may not have
  // applied when readPalette() first ran, leaving every color empty and the
  // canvases painting default black. Re-read until the CSS vars are live.
  if (!P.ink) {
    readPalette();
    if (!P.ink) { requestAnimationFrame(frame); return; }
  }
  for (const d of visibleDemos) {
    if (!d.w) continue;
    d.t += dt;
    const ctx = d.ctx;
    ctx.save();
    ctx.setTransform(d.dpr, 0, 0, d.dpr, 0, 0);
    ctx.clearRect(0, 0, d.w, d.h);
    d.draw(ctx, d.w, d.h, d.t);
    ctx.restore();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* controls */

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

function addSlider(d, { label: lab, min, max, step = 1, value, fmt = v => v, onchange }) {
  const wrap = el('div', 'ctl', d.controls);
  const l = el('span', 'ctl-label', wrap);
  l.textContent = lab;
  const input = el('input', '', wrap);
  input.type = 'range';
  input.min = min; input.max = max; input.step = step; input.value = value;
  const val = el('span', 'ctl-value', wrap);
  const paint = () => {
    val.textContent = fmt(+input.value);
    input.style.setProperty('--fill', (100 * (input.value - min) / (max - min)) + '%');
  };
  input.addEventListener('input', () => { paint(); onchange && onchange(+input.value); });
  paint();
  return {
    get v() { return +input.value; },
    set(x) { input.value = x; paint(); },
  };
}

function addStat(d, lab, wide) {
  const wrap = el('div', 'ctl', d.controls);
  if (wide) wrap.style.flex = '2 1 340px';
  const l = el('span', 'ctl-label', wrap);
  l.textContent = lab;
  const val = el('span', 'ctl-value', wrap);
  val.style.textAlign = 'left';
  val.style.minWidth = '0';
  val.style.whiteSpace = 'normal';
  val.style.lineHeight = '1.4';
  return {
    // stats default to ink: the red is reserved for the slider numerals
    set(text, color) { val.textContent = text; val.style.color = color || 'var(--ink)'; },
  };
}

function addButton(d, lab, fn, cls = '') {
  const b = el('button', 'demo-btn ' + cls, d.controls);
  b.textContent = lab;
  b.addEventListener('click', fn);
  return b;
}

function addCheck(d, lab, fn) {
  const wrap = el('label', 'ctl-check', d.controls);
  const input = el('input', '', wrap);
  input.type = 'checkbox';
  const span = el('span', '', wrap);
  span.textContent = lab;
  input.addEventListener('input', () => fn(input.checked));
  return { get v() { return input.checked; } };
}

/* pointer dragging (pos in css px, move gets deltas) */
function addDrag(canvas, handlers) {
  let dragging = false, last = null;
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', e => {
    dragging = true;
    last = pos(e);
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
    handlers.start && handlers.start(last);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const p = pos(e);
    handlers.move && handlers.move(p, { dx: p.x - last.x, dy: p.y - last.y });
    last = p;
  });
  const up = () => {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('grabbing');
    handlers.end && handlers.end();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   HERO – night sea, twinkling stars, a slow sight
   –––––––––––––––––––––––––––––––––––––––––––––––– */

(function hero() {
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  const stars = [];
  for (let i = 0; i < 170; i++) {
    stars.push({
      x: Math.random(), y: Math.random() * 0.72,
      r: Math.random() * 1.3 + 0.4,
      base: Math.random() * 0.5 + 0.35,
      spd: Math.random() * 1.6 + 0.4,
      ph: Math.random() * TAU,
    });
  }
  // bright navigation stars the sight cycles through (upper-right region)
  const navStars = [
    { x: 0.87, y: 0.14, name: '58° 30′' },
    { x: 0.80, y: 0.30, name: '41° 06′' },
    { x: 0.95, y: 0.40, name: '24° 48′' },
  ];
  let t = 0, lastT = 0;
  function draw(ts) {
    const dt = clamp((ts - lastT) / 1000 || 0.016, 0, 0.05);
    lastT = ts;
    t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) { requestAnimationFrame(draw); return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hor = h * 0.76;
    // sky
    let g = ctx.createLinearGradient(0, 0, 0, hor);
    g.addColorStop(0, '#070f1a');
    g.addColorStop(0.75, '#12253a');
    g.addColorStop(1, '#1b3550');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hor);
    // sea
    g = ctx.createLinearGradient(0, hor, 0, h);
    g.addColorStop(0, '#122b41');
    g.addColorStop(1, '#081420');
    ctx.fillStyle = g;
    ctx.fillRect(0, hor, w, h - hor);
    // stars
    for (const s of stars) {
      const a = s.base + 0.3 * Math.sin(t * s.spd + s.ph);
      ctx.fillStyle = `rgba(233,237,243,${clamp(a, 0.08, 1)})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, TAU);
      ctx.fill();
    }
    // moon-glint path on sea
    ctx.fillStyle = 'rgba(233,237,243,0.05)';
    for (let i = 0; i < 14; i++) {
      const yy = hor + 6 + i * (h - hor) / 15;
      const ww = 30 + i * 10 + 12 * Math.sin(t * 0.7 + i);
      ctx.fillRect(w * 0.2 - ww / 2 + 8 * Math.sin(t * 0.4 + i * 1.7), yy, ww, 1.4);
    }
    // horizon line
    ctx.strokeStyle = 'rgba(233,237,243,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hor);
    ctx.lineTo(w, hor);
    ctx.stroke();
    // the sight: boat on horizon, measuring cycle (kept right of the titles)
    const bx = w * 0.70, by = hor - 2;
    boatGlyph(ctx, bx, by, Math.max(14, w * 0.016), 'rgba(10,18,28,0.95)');
    ctx.strokeStyle = 'rgba(10,18,28,0.95)';
    // cycle through nav stars: 6s each (1.2 rise, 3.4 hold, 1.4 fade)
    const cyc = 6, phase = (t % (cyc * navStars.length)) / cyc;
    const idx = Math.floor(phase), local = phase - idx;
    const star = navStars[idx];
    let alpha = 1, sweep = 1;
    if (local < 0.2) { sweep = local / 0.2; }
    else if (local > 0.77) { alpha = 1 - (local - 0.77) / 0.23; }
    const sx = star.x * w, sy = star.y * h;
    // star highlight
    ctx.save();
    ctx.globalAlpha = alpha;
    const pulse = 1 + 0.15 * Math.sin(t * 3);
    starGlyph(ctx, sx, sy, 7 * pulse, 'rgba(255,196,132,0.95)');
    // angle geometry
    const aStar = Math.atan2(by - 14 - sy, sx - bx); // above horizontal
    const aDraw = aStar * sweep;
    const rayLen = Math.hypot(sx - bx, sy - (by - 14));
    ctx.strokeStyle = 'rgba(138,164,204,0.85)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(bx, by - 14);
    ctx.lineTo(bx + rayLen * Math.cos(aDraw), by - 14 - rayLen * Math.sin(aDraw));
    ctx.stroke();
    ctx.setLineDash([]);
    // horizon reference + arc
    ctx.strokeStyle = 'rgba(233,237,243,0.4)';
    ctx.beginPath();
    ctx.moveTo(bx, by - 14);
    ctx.lineTo(bx + Math.min(150, rayLen * 0.6), by - 14);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(138,164,204,0.9)';
    ctx.beginPath();
    ctx.arc(bx, by - 14, 60, -aDraw, 0);
    ctx.stroke();
    if (sweep === 1) {
      label(ctx, star.name, bx + 74, by - 24 - 30 * Math.sin(aStar / 2), {
        color: `rgba(138,164,204,${alpha})`, size: 12,
      });
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 01 – altitude & zenith distance (cross-section)
   –––––––––––––––––––––––––––––––––––––––––––––––– */

/* ––––– drafting helpers: engineering-drawing vocabulary –––––
   line system: 2px object, 1px construction, 0.9px dimension;
   dash-dot centerlines, slim double-headed dimension arcs,
   leader notes with target dots, right-angle marks. */

function dimHead(ctx, x, y, a, len = 7.5, half = 2.3) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - len * Math.cos(a) - half * Math.sin(a), y - len * Math.sin(a) + half * Math.cos(a));
  ctx.lineTo(x - len * Math.cos(a) + half * Math.sin(a), y - len * Math.sin(a) - half * Math.cos(a));
  ctx.closePath();
  ctx.fill();
}

// angle dimension: arc from a1 to a2 the short way, slim arrowheads at both
// ends. Nothing ever draws outside the span: as the arc tightens the heads
// scale down with it, and below the size where even small heads read, the
// mark degrades to a bare arc. (An angle's rays are not extension lines, so
// the flip-arrows-outside convention reads as a defect here.)
function angleDim(ctx, cx, cy, r, a1, a2, color, lw = 1.1) {
  let dd = a2 - a1;
  while (dd > Math.PI) dd -= TAU;
  while (dd < -Math.PI) dd += TAU;
  const sgn = Math.sign(dd) || 1;
  const arcLen = Math.abs(dd) * r;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  if (arcLen < 14) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, a1, a1 + dd, sgn < 0);
    ctx.stroke();
    return;
  }
  const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  const p2 = { x: cx + r * Math.cos(a1 + dd), y: cy + r * Math.sin(a1 + dd) };
  const hl = clamp(arcLen * 0.3, 4.2, 7.5); // head length shrinks with the span
  const hh = hl * 0.31;
  const trim = Math.min(Math.abs(dd) * 0.3, (hl - 1) / r);
  ctx.beginPath();
  ctx.arc(cx, cy, r, a1 + sgn * trim, a1 + dd - sgn * trim, sgn < 0);
  ctx.stroke();
  dimHead(ctx, p1.x, p1.y, a1 - sgn * Math.PI / 2, hl, hh);
  dimHead(ctx, p2.x, p2.y, a1 + dd + sgn * Math.PI / 2, hl, hh);
}

// leader note: dot on the target, diagonal, short horizontal run, text
function leaderNote(ctx, text, tx, ty, dir, len, color, opts = {}) {
  const ex = tx + Math.cos(dir) * len, ey = ty + Math.sin(dir) * len;
  const rd = Math.cos(dir) >= 0 ? 1 : -1;
  const rx = ex + rd * 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(ex, ey);
  ctx.lineTo(rx, ey);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(tx, ty, 1.7, 0, TAU); ctx.fill();
  label(ctx, text, rx + rd * 5, ey, {
    color: opts.color || color, size: opts.size || 11,
    align: rd > 0 ? 'left' : 'right', halo: opts.halo || P.paper,
  });
}

function centerline(ctx, x1, y1, x2, y2, color, lw = 0.9) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash([11, 4, 2, 4]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
}

function centerMark(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
  ctx.stroke();
}

function rightAngleMark(ctx, x, y, aA, aB, s, color) {
  const ax = Math.cos(aA) * s, ay = Math.sin(aA) * s;
  const bx = Math.cos(aB) * s, by = Math.sin(aB) * s;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x + ax, y + ay);
  ctx.lineTo(x + ax + bx, y + ay + by);
  ctx.lineTo(x + bx, y + by);
  ctx.stroke();
}

function pointMark(ctx, x, y, color, r = 3.2) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.paper;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(x, y, r + 0.8, 0, TAU); ctx.stroke();
}

(function demoAltitude() {
  const d = createDemo('demo-altitude', { aspect: 1.5, maxH: 520, draw });
  // a generic star at infinity: rays arrive parallel, so the drawing can
  // stand the GP at the top of the globe without calling that point a pole.
  const starA = -90 * D2R; // canvas angle of the incoming rays
  const S = { x: Math.cos(starA), y: Math.sin(starA) };
  let theta = 48 * D2R; // observer offset from GP
  const altStat = addStat(d, 'altitude h');
  const zStat = addStat(d, 'zenith dist z');
  const distStat = addStat(d, 'distance from GP');

  d.canvas.classList.add('grab');
  let geo = null, pane = null;
  addDrag(d.canvas, {
    start(p) {
      pane = geo && p.x < geo.splitX ? 'left' : 'right';
    },
    move(p) {
      if (!geo) return;
      if (pane === 'left') {
        const hDrag = clamp((geo.y0 - p.y) / (geo.y0 - geo.y90) * 90, 0, 89.9);
        const side = theta >= 0 ? 1 : -1;
        theta = side * (90 - hDrag) * D2R;
      } else {
        const a = Math.atan2(p.y - geo.cy, p.x - geo.cx);
        let off = a - starA;
        while (off > Math.PI) off -= TAU;
        while (off < -Math.PI) off += TAU;
        theta = clamp(off, -2.6, 2.6);
      }
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    const zdeg = Math.abs(theta) * R2D;
    const hdeg = 90 - zdeg;
    const below = hdeg < 0;
    const tiny = zdeg < 8;
    const hC = P.s2;  // altitude: ink blue, in both views
    const zC = P.s1;  // zenith distance: crimson

    /* ————— left pane: the height gauge, from the deck ————— */

    const splitX = w * 0.36;
    const ax = 66;
    const y0 = h - 64, y90 = 44;
    const yOf = deg => y0 - (y0 - y90) * deg / 90;
    geo = geo || {};
    geo.splitX = splitX;
    geo.y0 = y0;
    geo.y90 = y90;

    label(ctx, 'from the deck', splitX * 0.5, 18, { color: P.inkSoft, size: 10.5 });

    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - 14, y0);
    ctx.lineTo(splitX - 24, y0);
    ctx.stroke();
    label(ctx, 'horizon', splitX - 24, y0 + 12, { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'right' });

    ctx.strokeStyle = P.inkSoft;
    ctx.fillStyle = P.inkSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, y0);
    ctx.lineTo(ax, y90);
    ctx.stroke();
    for (let a = 10; a <= 90; a += 10) {
      const major = a % 30 === 0;
      ctx.lineWidth = major ? 1 : 0.75;
      ctx.beginPath();
      ctx.moveTo(ax, yOf(a));
      ctx.lineTo(ax - (major ? 7 : 4), yOf(a));
      ctx.stroke();
      if (major) {
        label(ctx, a + '°', ax - 14, yOf(a), { color: P.inkFaint, size: 9.5, align: 'right' });
      }
    }

    if (!below) {
      const sx = ax + 52;
      const sy = yOf(hdeg);
      ctx.strokeStyle = P.inkFaint;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(ax + 4, sy);
      ctx.lineTo(sx - 14, sy);
      ctx.stroke();
      ctx.strokeStyle = hC;
      ctx.fillStyle = hC;
      ctx.lineWidth = 1.1;
      if (sy < y0 - 26) {
        ctx.beginPath();
        ctx.moveTo(sx, y0 - 3);
        ctx.lineTo(sx, sy + 14);
        ctx.stroke();
        dimHead(ctx, sx, sy + 14, -Math.PI / 2, 7, 2.3);
        dimHead(ctx, sx, y0 - 3, Math.PI / 2, 7, 2.3);
      }
      const hTxt = 'h = ' + fmtDM(hdeg);
      label(ctx, hTxt, Math.min(sx + 12, splitX - 12 - textW(ctx, hTxt, 11)),
        Math.min((y0 + sy) / 2, y0 - 16), { color: hC, size: 11, halo: P.paper, align: 'left' });
      starGlyph(ctx, sx, sy, 8, P.ink);
      const dragTxt = 'Vega – drag';
      const dragX = Math.min(sx + 16, splitX - 12 - textW(ctx, dragTxt, 10.5));
      label(ctx, dragTxt, dragX, dragX < sx + 16 ? sy - 18 : sy - 12,
        { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'left' });
    } else {
      label(ctx, 'Vega is below the horizon', splitX * 0.52, y0 + 34,
        { color: P.inkSoft, size: 10.5, halo: P.paper });
    }

    /* ————— divider ————— */

    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 12);
    ctx.lineTo(splitX, h - 12);
    ctx.stroke();

    /* ————— right pane: the same moment, seen from outside ————— */

    const cx = splitX + (w - splitX) * 0.44, cy = h * 0.60;
    const R = Math.min(h * 0.295, (w - splitX) * 0.28);
    geo.cx = cx; geo.cy = cy; geo.R = R;

    label(ctx, 'from outside – the same moment', splitX + (w - splitX) * 0.5, 18, { color: P.inkSoft, size: 10.5 });

    const starY = 52;
    const oA = starA + theta;
    const O = { x: cx + R * Math.cos(oA), y: cy + R * Math.sin(oA) };
    const u = { x: Math.cos(oA), y: Math.sin(oA) };
    const gp = { x: cx + R * Math.cos(starA), y: cy + R * Math.sin(starA) };

    ctx.fillStyle = P.paperDeep;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    centerMark(ctx, cx, cy, 7, P.inkSoft);
    label(ctx, 'earth', cx, cy + R * 0.5, { color: P.inkFaint, size: 10.5 });

    // GP ray: parallel to the observer's sight line, labeled so the
    // parallelism is stated. Star glyph rides the observer's line.
    centerline(ctx, cx, cy + 10, cx, starY + 8, P.inkFaint);
    label(ctx, 'to Vega, too', cx - 8, starY, { color: P.inkFaint, size: 9.5, halo: P.paper, align: 'right' });

    pointMark(ctx, gp.x, gp.y, P.ink);
    if (!tiny) {
      leaderNote(ctx, 'GP', gp.x, gp.y, -28 * D2R, 26, P.inkSoft, { size: 10.5, halo: P.paper });
    }

    // surface arc from GP to you: the distance z, just inside the limb
    if (!tiny && !below) {
      ctx.strokeStyle = zC;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      arcBetween(ctx, cx, cy, R - 3.5, starA, oA);
      ctx.stroke();
    }

    const tHat = rot(u, Math.PI / 2);
    const tUp = (tHat.x * S.x + tHat.y * S.y) >= 0 ? tHat : { x: -tHat.x, y: -tHat.y };
    const angT = Math.atan2(tUp.y, tUp.x);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(O.x + tUp.x * R * 0.55, O.y + tUp.y * R * 0.55);
    ctx.lineTo(O.x - tUp.x * R * 0.9, O.y - tUp.y * R * 0.9);
    ctx.stroke();
    const hlx = O.x - tUp.x * R * 0.9 + 4;
    label(ctx, 'horizon', Math.min(hlx, w - 10), O.y - tUp.y * R * 0.9 + 13,
      { color: P.inkSoft, size: 10.5, halo: P.paper, align: hlx > w - 80 ? 'right' : 'left' });

    if (!below) {
      ctx.strokeStyle = hC;
      ctx.fillStyle = hC;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(O.x, O.y);
      ctx.lineTo(O.x, starY + 22);
      ctx.stroke();
      dimHead(ctx, O.x, starY + 22, -Math.PI / 2, 9, 2.7);
      starGlyph(ctx, O.x, starY, 9, P.ink);
      label(ctx, 'Vega', O.x + 16, starY, { color: P.inkSoft, size: 10.5, halo: P.paper, align: 'left' });

      const rH = R * 0.34;
      angleDim(ctx, O.x, O.y, rH, angT, -Math.PI / 2, hC);
      const mH = (angT - Math.PI / 2) / 2;
      label(ctx, 'h', O.x + Math.cos(mH) * (rH + 13), O.y + Math.sin(mH) * (rH + 13),
        { color: hC, halo: P.paper, size: 11.5 });
    }

    // z at the Earth's center: complement of h, the angle you have sailed
    if (!below && zdeg >= 6) {
      const rZ = R * 0.42;
      angleDim(ctx, cx, cy, rZ, starA, oA, zC);
      const mZ = (starA + oA) / 2;
      const crowded = zdeg < 18;
      if (!crowded) {
        label(ctx, 'z', cx + Math.cos(mZ) * (rZ + 14), cy + Math.sin(mZ) * (rZ + 14),
          { color: zC, halo: P.paperDeep, size: 11.5 });
      }
    }

    pointMark(ctx, O.x, O.y, P.ink);
    let away = Math.atan2(u.y - tUp.y, u.x - tUp.x);
    if (Math.cos(away) > 0 && O.x + Math.cos(away) * 34 + 72 > w - 6) away = Math.PI - away;
    leaderNote(ctx, 'you – drag', O.x, O.y, away, 28, P.inkSoft, { size: 10.5 });

    altStat.set(below ? 'below horizon' : fmtDM(hdeg), below ? P.red : '');
    zStat.set(fmtDM(zdeg));
    distStat.set(zdeg * 60 < 60 ? (zdeg * 60).toFixed(0) + ' nm' : fmtNM(zdeg * 60));
  }
})();

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   globe machinery for § 02 and § 03
   –––––––––––––––––––––––––––––––––––––––––––––––– */

// great-circle destination: from (lat,lon) travel angular distance dist° along azimuth az°

/* ––––– § 02 circle of position ––––– */

/* ––––– § 03 two circles cross ––––– */

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 04a – rotate a mirror, beam turns twice as fast
   –––––––––––––––––––––––––––––––––––––––––––––––– */

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 04b – the sextant, rays traced through both mirrors
   –––––––––––––––––––––––––––––––––––––––––––––––– */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 05 – through the telescope
   –––––––––––––––––––––––––––––––––––––––––––––––– */

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 06a – dip of the horizon
   –––––––––––––––––––––––––––––––––––––––––––––––– */

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 06b – atmospheric refraction
   –––––––––––––––––––––––––––––––––––––––––––––––– */

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 07 – the clockwork Earth
   –––––––––––––––––––––––––––––––––––––––––––––––– */

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 08 – the noon sight
   –––––––––––––––––––––––––––––––––––––––––––––––– */

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   § 09 – intercepts and the cocked hat
   –––––––––––––––––––––––––––––––––––––––––––––––– */

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   shared 3D globe rendering – coastline data comes
   from demos/world.js (const LAND). Fill notes:
   hidden points fold out to r = 2 - sin c, keeping
   every ring a simple closed curve so a nonzero
   fill clipped to the disc is exact (naive limb-
   clamping smears giant false fills). A ring that
   contains the view ANTIPODE bounds its own
   complement: detected with a spherical ray-cast
   toward a deep-ocean anchor and cancelled with an
   opposite-orientation outer loop. Edges whose
   geodesic passes hard by the antipode are walked
   around on an outer arc.
   –––––––––––––––––––––––––––––––––––––––––––––––– */

// world (lon,lat) -> view space {X right, Y up, Z toward viewer}
function globeView(viewLonDeg, tiltDeg) {
  const tilt = tiltDeg * D2R, cT = Math.cos(tilt), sT = Math.sin(tilt);
  return (lonDeg, latDeg) => {
    const lam = (lonDeg + viewLonDeg) * D2R, phi = latDeg * D2R;
    const X = Math.cos(phi) * Math.sin(lam);
    const Y = Math.sin(phi), Z = Math.cos(phi) * Math.cos(lam);
    return { X, Y: Y * cT - Z * sT, Z: Y * sT + Z * cT };
  };
}

// stroke a lon/lat polyline, only the segments facing the viewer
function globeArc(ctx, toView, pts, cx, cy, R) {
  ctx.beginPath();
  let pen = false;
  for (const [lon, lat] of pts) {
    const v = toView(lon, lat);
    if (v.Z <= 0) { pen = false; continue; }
    const x = cx + R * v.X, y = cy - R * v.Y;
    if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    pen = true;
  }
  ctx.stroke();
}

// ocean disc, 30-degree graticule, coastline-filled land, 2px ink limb
function drawGlobeBase(ctx, toView, cx, cy, R) {
  ctx.fillStyle = P.paperDeep;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

  ctx.strokeStyle = P.globeGrat;
  ctx.lineWidth = 0.75;
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = [];
    for (let lat = -87; lat <= 87; lat += 3) pts.push([lon, lat]);
    globeArc(ctx, toView, pts, cx, cy, R);
  }
  for (const lat of [-60, -30, 30, 60]) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 3) pts.push([lon, lat]);
    globeArc(ctx, toView, pts, cx, cy, R);
  }
  ctx.strokeStyle = P.globeGrat;
  ctx.lineWidth = 1;
  const eq = [];
  for (let lon = 0; lon <= 360; lon += 3) eq.push([lon, 0]);
  globeArc(ctx, toView, eq, cx, cy, R);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = P.paper;

  const ANCHORS = [[-123.4, -48.9], [-20, -35], [-165, 35]];   // open ocean
  let anch = null;
  for (const [lo, la] of ANCHORS) {
    const v = toView(lo, la);
    if (!anch || Math.abs(v.Z) < Math.abs(anch.Z)) anch = v;
  }
  const sideOf = v => v.X * anch.Y - v.Y * anch.X;
  const crossesArc = (p1, p2) => {
    const n1 = { x: p1.Y * p2.Z - p1.Z * p2.Y, y: p1.Z * p2.X - p1.X * p2.Z, z: p1.X * p2.Y - p1.Y * p2.X };
    // n2 = A x anchor = (anch.Y, -anch.X, 0); c = n1 x n2
    const c = { x: n1.z * anch.X, y: n1.z * anch.Y, z: -n1.x * anch.X - n1.y * anch.Y };
    const dot = c.x * (p1.X + p2.X) + c.y * (p1.Y + p2.Y) + c.z * (p1.Z + p2.Z);
    if (dot < 0) { c.x = -c.x; c.y = -c.y; c.z = -c.z; }
    const fromA = c.x * anch.X + c.y * anch.Y;
    const toN = (c.y * anch.Z - c.z * anch.Y) * anch.Y - (c.z * anch.X - c.x * anch.Z) * anch.X;
    return fromA >= 0 && toN >= 0;
  };
  const foldXY = v => {
    if (v.Z > 0) return [cx + R * v.X, cy - R * v.Y];
    const m = Math.hypot(v.X, v.Y);
    const s = m > 1e-9 ? (2 - m) / m : 0;
    return [cx + R * v.X * s, cy - R * v.Y * s];
  };

  for (const ring of LAND) {
    let anyFront = false, area = 0, crossings = 0;
    let firstV = null, firstXY = null, firstSide = 0;
    let prevV = null, prevXY = null, prevSide = 0;
    ctx.beginPath();
    const segArea = (a, b) => (a[0] - cx) * (b[1] - cy) - (b[0] - cx) * (a[1] - cy);
    const emitEdge = (v1, xy1, v2, xy2, depth) => {
      if (v1.Z <= 0 || v2.Z <= 0) {
        const dx = xy2[0] - xy1[0], dy = xy2[1] - xy1[1];
        if (dx * dx + dy * dy > 900) {
          const mx = v1.X + v2.X, my = v1.Y + v2.Y, mz = v1.Z + v2.Z;
          const n = Math.hypot(mx, my, mz);
          if (n > 1e-9) {
            const vm = { X: mx / n, Y: my / n, Z: mz / n };
            const xym = foldXY(vm);
            if (depth >= 6 || (vm.Z < 0 && Math.hypot(vm.X, vm.Y) < 0.02)) {
              const th1 = Math.atan2(xy1[1] - cy, xy1[0] - cx);
              const thm = Math.atan2(xym[1] - cy, xym[0] - cx);
              const th2 = Math.atan2(xy2[1] - cy, xy2[0] - cx);
              const wPI = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
              const dA = wPI(thm - th1), dB = wPI(th2 - thm);
              const rr = R * 2.1;
              ctx.arc(cx, cy, rr, th1, th1 + dA, dA < 0);
              ctx.arc(cx, cy, rr, thm, thm + dB, dB < 0);
              ctx.lineTo(xy2[0], xy2[1]);
              area += rr * rr * (dA + dB);
              return;
            }
            emitEdge(v1, xy1, vm, xym, depth + 1);
            emitEdge(vm, xym, v2, xy2, depth + 1);
            return;
          }
        }
      }
      ctx.lineTo(xy2[0], xy2[1]);
      area += segArea(xy1, xy2);
    };
    for (let i = 0; i < ring.length; i += 2) {
      const v = toView(ring[i], ring[i + 1]);
      if (v.Z > 0) anyFront = true;
      const side = sideOf(v);
      const xy = foldXY(v);
      if (!prevV) {
        ctx.moveTo(xy[0], xy[1]);
        firstV = v; firstXY = xy; firstSide = side;
      } else {
        if (prevSide * side < 0 && crossesArc(prevV, v)) crossings++;
        emitEdge(prevV, prevXY, v, xy, 0);
      }
      prevV = v; prevXY = xy; prevSide = side;
    }
    if (prevSide * firstSide < 0 && crossesArc(prevV, firstV)) crossings++;
    emitEdge(prevV, prevXY, firstV, firstXY, 0);
    if (!anyFront) continue;
    if (crossings % 2 === 1) {
      ctx.moveTo(cx + R * 2.2, cy);
      ctx.arc(cx, cy, R * 2.2, 0, TAU, area > 0);
    }
    ctx.fill();
  }
  ctx.restore();

  // coastline strokes: stored polylines as-is (rings self-close in the
  // data; the isthmus-cut pieces must NOT get a drawn closing edge)
  ctx.strokeStyle = P.globeCoast;
  ctx.lineWidth = 1;
  for (const ring of LAND) {
    const pts = [];
    for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
    globeArc(ctx, toView, pts, cx, cy, R);
  }

  ctx.strokeStyle = P.globeLimb;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  centerMark(ctx, cx, cy, 7, P.globeLimb);
}

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   layout controller – the /ml/embeddings pattern:
   on wide screens the figures live in a sticky right
   panel and swap with the section being read; on
   narrow screens they sit inline in the text.
   –––––––––––––––––––––––––––––––––––––––––––––––– */

(function layoutController() {
  const figIds = ['hero-fig', 'demo-gp', 'demo-altitude', 'demo-circle', 'demo-polaris', 'demo-twostar',
    'demo-samesky', 'demo-clock', 'demo-almanac', 'demo-mirror', 'demo-sextant', 'demo-scope',
    'demo-dip', 'demo-refraction', 'demo-noon', 'demo-noongeom', 'demo-lopzoom', 'demo-intercept'];
  const figs = figIds.map(id => document.getElementById(id)).filter(Boolean);
  const panel = document.getElementById('right-panel');
  const leftScroll = document.querySelector('.left-scroll');
  const header = document.querySelector('.pixel-header');
  if (!panel || !leftScroll) return;

  // each figure leaves a marker at its home spot; demo markers double as scroll anchors
  const homes = new Map();
  for (const f of figs) {
    const a = document.createElement('div');
    if (f.id !== 'hero-fig') {
      a.className = 'fig-anchor';
      a.dataset.fig = f.id;
    }
    f.before(a);
    homes.set(f, a);
  }

  const mq = window.matchMedia('(min-width: 1100px)');
  let desktop = false, active = null;

  function setHeaderVar() {
    document.documentElement.style.setProperty('--header-h', (header.offsetHeight + 26) + 'px');
  }

  function show(id) {
    if (active === id) return;
    active = id;
    for (const f of figs) f.style.display = f.id === id ? '' : 'none';
    const pnl = document.getElementById(id).querySelector('.demo-panel');
    if (pnl) { // restart the fade
      pnl.style.animation = 'none';
      void pnl.offsetWidth;
      pnl.style.animation = '';
    }
    panel.scrollTop = 0;
  }

  function spy() {
    if (!desktop) return;
    const leftTop = leftScroll.getBoundingClientRect().top;
    // anchors mark where each figure sat inline (right after the text that
    // introduces it), so swap as soon as that spot nears the bottom of the view
    const trigger = leftTop + leftScroll.clientHeight * 0.8;
    let cur = 'hero-fig';
    for (const a of leftScroll.querySelectorAll('.fig-anchor')) {
      if (a.getBoundingClientRect().top < trigger) cur = a.dataset.fig;
    }
    show(cur);
  }

  function enter() {
    setHeaderVar();
    for (const f of figs) {
      panel.appendChild(f);
      f.style.display = 'none';
    }
    active = null;
    spy();
  }

  function exit() {
    for (const f of figs) {
      homes.get(f).after(f);
      f.style.display = '';
    }
    active = null;
  }

  function apply() {
    const isDesktop = mq.matches;
    if (isDesktop === desktop) { if (isDesktop) setHeaderVar(); return; }
    desktop = isDesktop;
    if (desktop) enter(); else exit();
  }

  leftScroll.addEventListener('scroll', spy, { passive: true });
  // scrolling with the cursor over the figure panel should still read the article
  panel.addEventListener('wheel', e => {
    if (panel.scrollHeight <= panel.clientHeight + 4) {
      leftScroll.scrollTop += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
  mq.addEventListener('change', apply);
  window.addEventListener('resize', () => { if (desktop) setHeaderVar(); });
  apply();
})();

