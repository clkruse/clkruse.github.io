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
  // Story semantics. The numbered series remain available for independent
  // comparison figures, but the worked sight uses named roles everywhere.
  P.measured = cssVar('--measured');
  P.corrected = cssVar('--corrected');
  P.ephemeris = cssVar('--ephemeris');
  P.predicted = cssVar('--predicted');
  P.constraint = cssVar('--constraint');
  P.fix = cssVar('--fix');
  P.brass = P.s2;              // primary measurement color: ink blue
  P.sun = P.s3;                // signal orange
  P.good = cssVar('--s7');
  P.green = cssVar('--s7');
  P.dark = matchMedia('(prefers-color-scheme: dark)').matches;
  // the globe base recedes in light mode so the figure's marks carry the
  // contrast (owner request); dark mode keeps the fuller ink
  P.globeLimb = P.dark ? P.ink : '#a9a9a9';
  P.globeCoast = P.dark ? P.inkSoft : '#c2c2c2';
  // Graticules are construction geometry, not data. Keep them at the
  // hairline value in both themes so they never compete with a GP or LOP.
  P.globeGrat = P.line;
  // constants below: dark-sky scenes and representational content
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

/* Monochrome technical-plate primitives. The plates use the page's crisp
   white/dark ground and opposite ink; hierarchy comes only from line
   weight, pattern, and spacing. */
const PLATE = Object.freeze({
  get ink() { return P.ink; },
  get paper() { return P.paper; },
  // one bundled face (assets/fonts, declared in style.css) for labels and
  // values alike, as the period plates set everything in Futura.
  // plateDataText still differs: untracked and case-preserving.
  font: 'Jost, "Avenir Next Condensed", "Helvetica Neue", Helvetica, sans-serif',
  dataFont: 'Jost, "Avenir Next Condensed", "Helvetica Neue", Helvetica, sans-serif',
});

// Canvas text never asks the browser to fetch a web font, so request the
// plate faces up front; visible figures redraw every frame and pick them
// up as soon as they arrive.
if (document.fonts?.load) {
  ['400', '600'].forEach(weight => document.fonts.load(`${weight} 12px Jost`));
  // labels pick their seats on the first frames, possibly in a fallback
  // face; once Jost arrives, let every figure choose again
  document.fonts.ready.then(() => {
    document.querySelectorAll('canvas').forEach(c => { c._plateLabelMemory = new Map(); });
  });
}

// Demos lay out in nominal plate sizes; every glyph is drawn this much
// larger so figure text reads at article scale.
const PLATE_TEXT_SCALE = 1.22;
const plateSize = size => (size || 9) * PLATE_TEXT_SCALE;
// digits advance on one fixed width so changing numbers never shift the
// text around them (tabular figures, which canvas cannot request)
const DIGIT = /[0-9]/;

function plateTextWidth(ctx, text, opts = {}) {
  const value = opts.uppercase === false ? String(text) : String(text).toUpperCase();
  const size = plateSize(opts.size);
  const tracking = opts.tracking ?? size * 0.075;
  ctx.save();
  ctx.font = `${opts.weight || 500} ${size}px ${opts.font || PLATE.font}`;
  const figure = ctx.measureText('0').width;
  let width = 0;
  for (const char of value) width += DIGIT.test(char) ? figure : ctx.measureText(char).width;
  ctx.restore();
  return width + Math.max(0, value.length - 1) * tracking;
}

function plateText(ctx, text, x, y, opts = {}) {
  const value = opts.uppercase === false ? String(text) : String(text).toUpperCase();
  const size = plateSize(opts.size);
  const tracking = opts.tracking ?? size * 0.075;
  const width = plateTextWidth(ctx, value, opts);
  const align = opts.align || 'left';
  let cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;

  ctx.save();
  ctx.font = `${opts.weight || 500} ${size}px ${opts.font || PLATE.font}`;
  ctx.fillStyle = PLATE.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = opts.baseline || 'middle';
  const figure = ctx.measureText('0').width;
  for (const char of value) {
    if (DIGIT.test(char)) {
      const glyph = ctx.measureText(char).width;
      ctx.fillText(char, cursor + (figure - glyph) / 2, y);
      cursor += figure + tracking;
    } else {
      ctx.fillText(char, cursor, y);
      cursor += ctx.measureText(char).width + tracking;
    }
  }
  if (opts.underline) {
    const start = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(start, y + size * 0.72);
    ctx.lineTo(start + width, y + size * 0.72);
    ctx.stroke();
  }
  ctx.restore();
  return width;
}

function plateDataText(ctx, text, x, y, opts = {}) {
  return plateText(ctx, text, x, y, {
    ...opts,
    font: opts.font || PLATE.dataFont,
    tracking: opts.tracking ?? 0,
    uppercase: false,
  });
}

function plateDash(kind = 'solid') {
  if (kind === 'long') return [8, 5];
  if (kind === 'short') return [3, 3];
  if (kind === 'construction') return [8, 3, 1.5, 3];
  return [];
}

function plateLine(ctx, a, b, opts = {}) {
  ctx.save();
  ctx.strokeStyle = PLATE.ink;
  ctx.lineWidth = opts.weight || 1;
  ctx.setLineDash(plateDash(opts.kind));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function plateArrowhead(ctx, point, angle, size = 4.5) {
  ctx.save();
  ctx.fillStyle = PLATE.ink;
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  ctx.lineTo(point.x - size * Math.cos(angle - 0.42), point.y - size * Math.sin(angle - 0.42));
  ctx.lineTo(point.x - size * Math.cos(angle + 0.42), point.y - size * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function plateVector(ctx, a, b, opts = {}) {
  plateLine(ctx, a, b, opts);
  plateArrowhead(ctx, b, Math.atan2(b.y - a.y, b.x - a.x), opts.head || 4.5);
}

function plateLeader(ctx, target, labelPoint, opts = {}) {
  const elbow = opts.elbow || {
    x: labelPoint.x + (target.x >= labelPoint.x ? 13 : -13),
    y: labelPoint.y,
  };
  ctx.save();
  ctx.strokeStyle = PLATE.ink;
  ctx.lineWidth = 0.55;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(labelPoint.x, labelPoint.y);
  ctx.lineTo(elbow.x, elbow.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.restore();
  plateArrowhead(ctx, target, Math.atan2(target.y - elbow.y, target.x - elbow.x), opts.head || 3.5);
}

/* Places technical labels from preferred candidate positions. Occupied
   labels and reserved diagram zones are rejected; a displaced label gets a
   paper knockout and a leader, while low-priority labels can disappear in
   compact/crowded states instead of colliding. */
function createPlateLabeler(ctx, {
  left = 6,
  top = 6,
  right = Infinity,
  bottom = Infinity,
  gap = 3,
} = {}) {
  const occupied = [];
  // Labelers are rebuilt every frame; the canvas remembers which candidate
  // each label used last, so a label only moves when its spot is blocked
  // rather than hopping back and forth as the geometry changes.
  const memory = ctx.canvas._plateLabelMemory ??= new Map();
  const seen = new Map();
  const memoryKey = (text, opts) => {
    const base = opts.key ?? String(text).replace(/[−+-]?\d[\d,]*(\.\d+)?/g, '#');
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return `${base}|${n}`;
  };
  const expand = (rect, amount) => ({
    x: rect.x - amount,
    y: rect.y - amount,
    w: rect.w + amount * 2,
    h: rect.h + amount * 2,
  });
  const overlaps = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x
    && a.y < b.y + b.h && a.y + a.h > b.y;
  const outside = rect =>
    rect.x < left || rect.y < top
    || rect.x + rect.w > right || rect.y + rect.h > bottom;
  const overlapArea = (a, b) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const rectFor = (text, candidate, opts) => {
    const size = plateSize(opts.size);
    const padding = opts.padding ?? 2;
    const width = plateTextWidth(ctx, text, opts) + padding * 2;
    const height = size * 1.25 + padding * 2;
    const align = candidate.align || opts.align || 'left';
    const x = align === 'center'
      ? candidate.x - width / 2
      : align === 'right' ? candidate.x - width : candidate.x;
    return { x, y: candidate.y - height / 2, w: width, h: height, align, padding };
  };
  const clamped = rect => ({
    ...rect,
    x: clamp(rect.x, left, Math.max(left, right - rect.w)),
    y: clamp(rect.y, top, Math.max(top, bottom - rect.h)),
  });

  return {
    reserve(rect, padding = gap) {
      occupied.push(expand(rect, padding));
    },
    place(text, target, candidates, opts = {}) {
      const list = Array.isArray(candidates) ? candidates : [candidates];
      const tested = list.map(candidate => {
        const rect = rectFor(text, candidate, opts);
        const collisions = occupied.filter(other => overlaps(expand(rect, gap), other));
        const penalty = collisions.reduce((sum, other) => sum + overlapArea(expand(rect, gap), other), 0)
          + (outside(rect) ? 1e6 : 0);
        return { candidate, rect, penalty };
      });
      const key = memoryKey(text, opts);
      const seat = memory.get(key) || {};
      const last = tested[seat.index];
      let choice = last && last.penalty === 0 ? last : tested.find(item => item.penalty === 0);
      if (!choice) {
        if (opts.fallback === 'hide') {
          memory.delete(key);
          return null;
        }
        choice = tested.reduce((best, item) => item.penalty < best.penalty ? item : best);
        choice = { ...choice, rect: clamped(choice.rect) };
      }

      memory.set(key, { index: tested.findIndex(item => item.candidate === choice.candidate) });

      const moved = choice !== tested[0] || choice.penalty > 0;
      const rect = choice.rect;
      if (target && opts.leader !== false) {
        const anchor = {
          x: target.x < rect.x ? rect.x
            : target.x > rect.x + rect.w ? rect.x + rect.w
              : clamp(target.x, rect.x, rect.x + rect.w),
          y: target.y < rect.y ? rect.y
            : target.y > rect.y + rect.h ? rect.y + rect.h
              : clamp(target.y, rect.y, rect.y + rect.h),
        };
        plateLeader(ctx, target, anchor, { head: opts.head || 3.2 });
      }
      if (opts.backed !== false || moved) {
        ctx.save();
        ctx.fillStyle = PLATE.paper;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      }
      const textX = rect.align === 'center'
        ? rect.x + rect.w / 2
        : rect.align === 'right' ? rect.x + rect.w - rect.padding : rect.x + rect.padding;
      plateText(ctx, text, textX, rect.y + rect.h / 2, {
        ...opts,
        align: rect.align,
      });
      occupied.push(expand(rect, gap));
      return { rect, candidate: choice.candidate, moved };
    },
  };
}

function plateBox(ctx, x, y, width, lines, opts = {}) {
  const padding = opts.padding || 7;
  const size = opts.size || 7.5;
  const lineHeight = (opts.lineHeight || size * 1.35) * PLATE_TEXT_SCALE;
  const titleGap = opts.title ? lineHeight + 5 : 0;
  const height = opts.height || padding * 2 + titleGap + lines.length * lineHeight;

  ctx.save();
  ctx.fillStyle = PLATE.paper;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PLATE.ink;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x, y, width, height);
  if (opts.title) {
    plateText(ctx, opts.title, x + padding, y + padding + size * 0.45, {
      size, weight: 600, tracking: size * 0.09,
    });
    ctx.beginPath();
    ctx.moveTo(x + padding, y + padding + lineHeight);
    ctx.lineTo(x + width - padding, y + padding + lineHeight);
    ctx.stroke();
  }
  lines.forEach((line, index) => {
    const entry = typeof line === 'string' ? { text: line } : line;
    const entryFont = entry.font || opts.font || PLATE.font;
    plateText(ctx, entry.text, x + padding + (entry.indent || 0),
      y + padding + titleGap + lineHeight * (index + 0.48), {
        size: entry.size || size,
        weight: entry.weight || 500,
        tracking: entry.tracking ?? size * 0.055,
        font: entryFont,
        uppercase: entry.uppercase ?? (entryFont === PLATE.dataFont ? false : undefined),
      });
  });
  ctx.restore();
  return height;
}

function plateRule(ctx, y, x1, x2) {
  plateLine(ctx, { x: x1, y }, { x: x2, y }, { kind: 'long', weight: 0.9 });
}

function plateHatch(ctx, path, bounds, opts = {}) {
  const spacing = opts.spacing || 5;
  const slope = opts.slope ?? 0.42;
  const extra = bounds.h * Math.abs(slope) + spacing;
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = PLATE.ink;
  ctx.lineWidth = opts.weight || 0.45;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let x = bounds.x - extra; x <= bounds.x + bounds.w + extra; x += spacing) {
    ctx.moveTo(x, bounds.y + bounds.h);
    ctx.lineTo(x + bounds.h * slope, bounds.y);
  }
  ctx.stroke();
  ctx.restore();
}

function plateWireSphere(ctx, cx, cy, radius, opts = {}) {
  ctx.save();
  ctx.fillStyle = PLATE.paper;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
  ctx.restore();

  if (opts.hatchSide) {
    const lune = new Path2D();
    lune.moveTo(cx, cy - radius);
    if (opts.hatchSide === 'right') {
      lune.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2, false);
      lune.ellipse(cx, cy, radius * 0.34, radius, 0, Math.PI / 2, -Math.PI / 2, true);
    } else {
      lune.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2, true);
      lune.ellipse(cx, cy, radius * 0.34, radius, 0, Math.PI / 2, Math.PI * 1.5, false);
    }
    lune.closePath();
    plateHatch(ctx, lune, {
      x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2,
    }, { spacing: Math.max(3, radius / 24), weight: 0.4 });
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((opts.tilt || 0) * D2R);
  ctx.strokeStyle = PLATE.ink;
  ctx.lineWidth = 0.75;

  if (opts.graticule !== false) {
    ctx.setLineDash(plateDash('long'));
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.27, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.27, 0, 0, Math.PI);
    ctx.stroke();

    ctx.setLineDash(plateDash('long'));
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.27, radius, 0, Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.27, radius, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  }

  if (opts.axis !== false) {
    ctx.setLineDash(plateDash('construction'));
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(0, -radius - 11);
    ctx.lineTo(0, radius + 11);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  ctx.strokeStyle = PLATE.ink;
  ctx.lineWidth = 1.65;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy);
  ctx.lineTo(cx + 4, cy);
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.stroke();
  if (opts.northLabel !== false) {
    plateText(ctx, 'N', cx, cy - radius - 17, {
      size: opts.labelSize || 8.5, align: 'center',
    });
  }
}

function plateDimension(ctx, a, b, text, opts = {}) {
  plateLine(ctx, a, b, { weight: 0.65 });
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  const tick = opts.tick || 4;
  plateLine(ctx,
    { x: a.x - normal.x * tick, y: a.y - normal.y * tick },
    { x: a.x + normal.x * tick, y: a.y + normal.y * tick },
    { weight: 0.55 });
  plateLine(ctx,
    { x: b.x - normal.x * tick, y: b.y - normal.y * tick },
    { x: b.x + normal.x * tick, y: b.y + normal.y * tick },
    { weight: 0.55 });
  plateArrowhead(ctx, a, angle + Math.PI, opts.head || 3.5);
  plateArrowhead(ctx, b, angle, opts.head || 3.5);
  plateDataText(ctx, text, (a.x + b.x) / 2 + normal.x * (opts.offset || -8),
    (a.y + b.y) / 2 + normal.y * (opts.offset || -8), {
      size: opts.size || 7.5,
      align: 'center',
      font: opts.font || PLATE.dataFont,
      tracking: opts.tracking ?? 0,
    });
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


/* ––––– demo scaffolding ––––– */

// figure numbers, NASA style: section, then count within it ("1-2", "B-3").
// Part openers are skipped; a figure before any numbered section counts as 0.
// (set on the caption: CSS attr() in ::before reads the caption itself)
{
  let section = '0', count = 0;
  document.querySelectorAll('.article h2, figure.demo').forEach(el => {
    if (el.tagName === 'H2') {
      const m = (el.querySelector('.sec-no')?.textContent || '').trim().match(/^(\d+)\.0$|^([A-Z])$/);
      if (m) { section = m[1] || m[2]; count = 0; }
      return;
    }
    el.dataset.no = `${section}-${++count}`;
    el.querySelector('figcaption')?.setAttribute('data-no', el.dataset.no);
  });
}

const allDemos = [];
const visibleDemos = new Set();
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    const d = e.target._demo;
    if (!d) continue;
    if (e.isIntersecting) visibleDemos.add(d); else visibleDemos.delete(d);
  }
}, { rootMargin: '80px' });

function createDemo(figId, {
  aspect = 1.6,
  maxH = 560,
  compactAspect = aspect,
  compactMaxH = maxH,
  draw,
}) {
  const fig = document.getElementById(figId);
  const canvas = fig.querySelector('canvas');
  const controls = fig.querySelector('.demo-controls');
  // sliders, then actions, then the numeric readout strip, whatever order
  // a demo adds them in
  const group = cls => controls && el('div', cls, controls);
  const groups = {
    rows: group('ctl-rows'),
    actions: group('ctl-actions'),
    readouts: group('ctl-readouts'),
  };
  const humanName = figId.replace(/^demo-/, '').replaceAll('-', ' ');
  const d = {
    fig, canvas, controls, groups, ctx: canvas.getContext('2d'),
    w: 0, h: 0, dpr: 1, t: 0, draw,
    presets: new Map(),
  };
  d.addPreset = (name, apply) => {
    d.presets.set(name, apply);
    return d;
  };
  d.applyPreset = (name, options = {}) => {
    const apply = d.presets.get(name);
    if (!apply) return false;
    apply(options);
    canvas.dispatchEvent(new CustomEvent('demo:preset', {
      bubbles: true,
      detail: { figure: figId, preset: name },
    }));
    return true;
  };
  allDemos.push(d);

  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `${humanName} interactive figure`);
  canvas._demo = d;
  io.observe(canvas);
  const fit = () => {
    const cssW = canvas.parentElement.clientWidth;
    if (!cssW) return;
    const compact = cssW < 500;
    const activeAspect = Math.max(0.25, Number(compact ? compactAspect : aspect) || 1.6);
    const activeMaxH = Math.max(120, Number(compact ? compactMaxH : maxH) || 560);
    // a figure and its controls should fit on one screen, so a reader can
    // move a slider and watch the drawing without scrolling
    const chrome = (controls?.offsetHeight || 0) + 56;
    const availH = Math.max(260, Math.round(window.innerHeight * 0.94) - chrome);
    const cssH = Math.min(activeMaxH, Math.round(cssW / activeAspect), availH);
    d.dpr = Math.min(2, window.devicePixelRatio || 1);
    d.w = cssW; d.h = cssH;
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * d.dpr);
    canvas.height = Math.round(cssH * d.dpr);
  };
  new ResizeObserver(fit).observe(canvas.parentElement);
  allFits.push(fit);
  d.refit = fit;
  fit();
  return d;
}

const allFits = [];
window.addEventListener('resize', () => allFits.forEach(f => f()));
// controls are added after createDemo returns, so size once more when the page settles
window.addEventListener('load', () => allFits.forEach(f => f()));

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
  const wrap = el('div', 'ctl', d.groups.rows);
  const l = el('span', 'ctl-label', wrap);
  l.textContent = lab;
  const input = el('input', '', wrap);
  input.type = 'range';
  input.min = min; input.max = max; input.step = step; input.value = value;
  input.setAttribute('aria-label', lab);
  const val = el('span', 'ctl-value', wrap);
  const paint = () => {
    const formatted = fmt(+input.value);
    val.textContent = formatted;
    input.setAttribute('aria-valuetext', formatted);
    input.style.setProperty('--fill', (100 * (input.value - min) / (max - min)) + '%');
  };
  input.addEventListener('input', () => { paint(); onchange && onchange(+input.value); });
  paint();
  return {
    get v() { return +input.value; },
    input,
    set(x, { emit = false } = {}) {
      input.value = x;
      paint();
      if (emit && onchange) onchange(+input.value);
    },
  };
}

function addStat(d, lab, wide) {
  const wrap = el('div', 'ctl-readout', d.groups.readouts);
  if (wide) wrap.classList.add('wide');
  const l = el('span', 'ctl-label', wrap);
  l.textContent = lab.trim();
  const val = el('span', 'ctl-value', wrap);
  return {
    // figure chrome stays monochrome like the plates; a demo's status
    // color only marks the readout as a flagged state
    set(text, color) {
      val.textContent = text;
      wrap.classList.toggle('flagged', Boolean(color));
    },
  };
}

function addButton(d, lab, fn, cls = '') {
  const b = el('button', 'demo-btn ' + cls, d.groups.actions);
  b.textContent = lab;
  b.addEventListener('click', fn);
  return b;
}

function addCheck(d, lab, fn) {
  const wrap = el('label', 'ctl-check', d.groups.actions);
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

function drawPaneDivider(ctx, x, h) {
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 12);
  ctx.lineTo(x, h - 12);
  ctx.stroke();
}

function deckGaugeLayout(h, { top = 44, bottom = 64 } = {}) {
  const y90 = top;
  const yNeg90 = h - bottom;
  const y0 = (y90 + yNeg90) / 2;
  return {
    y0,
    y90,
    yNeg90,
    yOf: deg => y0 - (y0 - y90) * deg / 90,
  };
}

function drawEarthCrust(ctx, cx, cy, R, thickness = 20) {
  ctx.fillStyle = P.paperDeep;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.arc(cx, cy, Math.max(8, R - thickness), 0, TAU, true);
  ctx.fill('evenodd');
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
}

(function demoAltitude() {
  const d = createDemo('demo-altitude', {
    aspect: 1.5,
    maxH: 520,
    compactAspect: 0.9,
    compactMaxH: 340,
    draw,
  });
  // star direction is fixed (up the page). You walk away from the GP;
  // your horizon and overhead tilt with you. Altitude is the angle
  // between that tilted horizon and the unmoving star.
  const starA = -90 * D2R;
  const S = { x: Math.cos(starA), y: Math.sin(starA) };
  const FALLBACK_WORKED_SIGHT = { ho: 42.5011, z: 47.4989 };
  let workedSight = FALLBACK_WORKED_SIGHT;
  let theta = -workedSight.z * D2R;
  const normalizeTheta = angle => {
    if (!Number.isFinite(angle)) return 0;
    let normalized = angle % TAU;
    if (normalized > Math.PI) normalized -= TAU;
    if (normalized < -Math.PI) normalized += TAU;
    return normalized;
  };
  const setTheta = angle => { theta = normalizeTheta(angle); };
  const thetaDistanceDeg = () =>
    Math.min(180, Math.abs(normalizeTheta(theta)) * R2D);
  const thetaSide = () => theta > 0 ? 1 : -1;
  const altStat = addStat(d, 'corrected altitude Ho');
  const fromStat = addStat(d, 'zenith distance z');
  const applyWorked = (state = workedSight) => {
    workedSight = state;
    setTheta(-clamp(Number(state.z) || 0, 0, 180) * D2R);
  };
  d.addPreset('worked', () => applyWorked());
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof SIGHT_STORY === 'undefined') return;
    SIGHT_STORY.subscribe(state => applyWorked(state));
  }, { once: true });
  d.canvas._qaTheta = deg => { setTheta(Number(deg) * D2R); };

  d.canvas.classList.add('grab');
  let geo = null;
  addDrag(d.canvas, {
    move(p) {
      if (!geo) return;
      if (geo.local && p.x >= geo.local.x) {
        const rayA = clamp(
          Math.atan2(p.y - geo.local.origin.y, p.x - geo.local.origin.x),
          -Math.PI / 2,
          Math.PI / 2
        );
        const dist = clamp(90 + rayA * R2D, 0, 180);
        setTheta(thetaSide() * dist * D2R);
        return;
      }
      const a = Math.atan2(p.y - geo.cy, p.x - geo.cx);
      setTheta(a - starA);
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const fromDeg = thetaDistanceDeg();
    const altitude = 90 - fromDeg;
    const below = altitude < 0;
    const compact = w < 500 || h < 330;
    const titleSize = compact ? 8.5 : 10.5;
    const fieldTop = compact ? 31 : 41;
    const fieldBottom = h - (compact ? 8 : 12);
    const splitX = w * (compact ? 0.47 : 0.53);
    const earthTop = fieldTop + (compact ? 22 : 27);
    const cx = splitX * 0.5;
    const cy = earthTop + (fieldBottom - earthTop) * (compact ? 0.57 : 0.56);
    const R = Math.min(
      splitX * (compact ? 0.34 : 0.35),
      (fieldBottom - earthTop) * (compact ? 0.34 : 0.36)
    );
    const rightX = splitX + (compact ? 5 : 13);
    const rightW = w - rightX - (compact ? 6 : 14);

    plateText(ctx, compact
      ? 'ALTITUDE + ZENITH DISTANCE'
      : 'ALTITUDE AND ZENITH DISTANCE COMPLETE A RIGHT ANGLE',
    compact ? 9 : 14, compact ? 15 : 19, {
      size: titleSize,
      align: 'left',
    });

    plateText(ctx, compact ? 'EARTH PROOF' : 'EARTH-CENTER PROOF',
      splitX * 0.5, fieldTop + (compact ? 8 : 10), {
        size: compact ? 7.5 : 8.5,
        weight: 600,
        align: 'center',
      });

    plateWireSphere(ctx, cx, cy, R, {
      tilt: 0,
      graticule: false,
      axis: false,
      northLabel: false,
    });

    const gp = { x: cx, y: cy - R };
    const oA = starA + theta;
    const u = { x: Math.cos(oA), y: Math.sin(oA) };
    const observer = { x: cx + R * u.x, y: cy + R * u.y };
    const rayTop = earthTop + (compact ? 6 : 8);
    const samePoint = fromDeg < 1.2;
    const coincidentRays = !samePoint && Math.abs(observer.x - gp.x) < 1.2;

    plateLine(ctx, { x: cx, y: cy }, observer, {
      kind: 'construction',
      weight: compact ? 0.6 : 0.75,
    });
    if (!samePoint) {
      plateLine(ctx, { x: cx, y: cy }, gp, {
        kind: 'construction',
        weight: compact ? 0.6 : 0.75,
      });
    }

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 1.7 : 2.15;
    ctx.beginPath();
    ctx.arc(cx, cy, R, starA, oA, theta < 0);
    ctx.stroke();
    ctx.restore();

    if (samePoint) {
      plateVector(ctx, gp, { x: gp.x, y: rayTop }, {
        kind: 'long',
        weight: compact ? 0.85 : 1,
        head: compact ? 3.2 : 4,
      });
    } else {
      plateVector(ctx, observer, { x: observer.x, y: rayTop }, {
        kind: 'long',
        weight: compact ? 0.85 : 1,
        head: compact ? 3.2 : 4,
      });
      if (!coincidentRays) {
        plateVector(ctx, gp, { x: gp.x, y: rayTop }, {
          kind: 'long',
          weight: compact ? 0.85 : 1,
          head: compact ? 3.2 : 4,
        });
      }
    }

    if (!samePoint && !coincidentRays) {
      const rayFloor = Math.min(observer.y, gp.y);
      const markY = rayTop + (rayFloor - rayTop) * 0.52;
      const raySeparation = Math.abs(observer.x - gp.x);
      const drawParallelMark = (x, y) => {
        const length = compact ? 4.5 : 6;
        const spacing = compact ? 3 : 4;
        for (const offset of [-spacing / 2, spacing / 2]) {
          plateLine(ctx,
            { x: x - length / 2, y: y + offset + length * 0.34 },
            { x: x + length / 2, y: y + offset - length * 0.34 },
            { weight: compact ? 0.65 : 0.8 });
        }
      };
      drawParallelMark(observer.x, markY);
      drawParallelMark(gp.x, markY + (raySeparation < 18 ? (compact ? 8 : 10) : 0));
    }

    if (!samePoint) {
      const verticalLength = Math.min(R * 0.31, compact ? 18 : 34);
      const verticalEnd = {
        x: observer.x + u.x * verticalLength,
        y: observer.y + u.y * verticalLength,
      };
      plateVector(ctx, observer, verticalEnd, {
        kind: 'construction',
        weight: compact ? 0.65 : 0.8,
        head: compact ? 3 : 3.8,
      });
    }

    const centerArcR = Math.min(R * 0.42, compact ? 17 : 29);
    if (!samePoint) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.7 : 0.85;
      ctx.beginPath();
      arcBetween(ctx, cx, cy, centerArcR, starA, oA);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = PLATE.ink;
    ctx.beginPath(); ctx.arc(observer.x, observer.y, compact ? 2.2 : 2.8, 0, TAU); ctx.fill();
    if (!samePoint) {
      ctx.beginPath(); ctx.arc(gp.x, gp.y, compact ? 2.2 : 2.8, 0, TAU); ctx.fill();
    }

    const zMid = starA + theta / 2;
    if (!samePoint && fromDeg >= 9) {
      plateDataText(ctx, 'z',
        cx + Math.cos(zMid) * (centerArcR + (compact ? 7 : 10)),
        cy + Math.sin(zMid) * (centerArcR + (compact ? 7 : 10)), {
          size: compact ? 8 : 9.5,
          align: 'center',
        });
    }

    plateText(ctx, compact ? 'PARALLEL VEGA RAYS' : 'PARALLEL RAYS TO VEGA',
      splitX * 0.5, earthTop - (compact ? 5 : 6), {
        size: compact ? 7.5 : 8.5,
        align: 'center',
      });

    const labels = createPlateLabeler(ctx, {
      left: 7,
      top: earthTop,
      right: splitX - 4,
      bottom: fieldBottom,
      gap: compact ? 2 : 3,
    });
    const pointSize = compact ? 8 : 9;
    if (samePoint) {
      labels.place('GP = YOU', gp, [
        { x: gp.x + (compact ? 11 : 15), y: gp.y + (compact ? 14 : 18), align: 'left' },
        { x: gp.x - (compact ? 11 : 15), y: gp.y + (compact ? 14 : 18), align: 'right' },
      ], {
        size: pointSize,
      });
    } else {
      const closePoints = Math.hypot(observer.x - gp.x, observer.y - gp.y)
        < (compact ? 22 : 31);
      labels.place('VEGA GP', gp, [
        {
          x: gp.x - (compact ? 9 : 12),
          y: gp.y - (compact ? 11 : 14),
          align: 'right',
        },
        {
          x: gp.x + (compact ? 9 : 12),
          y: gp.y + (compact ? 13 : 17),
          align: 'left',
        },
      ], {
        size: pointSize,
      });
      const observerOnLeft = observer.x <= cx;
      labels.place(compact ? 'YOU' : 'YOU · OBSERVER', observer, [
        {
          x: observer.x + (observerOnLeft ? -(compact ? 10 : 13) : (compact ? 10 : 13)),
          y: observer.y + (closePoints ? (compact ? 14 : 18) : (compact ? 14 : 18)),
          align: observerOnLeft ? 'right' : 'left',
        },
        {
          x: observer.x + (observerOnLeft ? (compact ? 11 : 14) : -(compact ? 11 : 14)),
          y: observer.y + (compact ? 22 : 28),
          align: observerOnLeft ? 'left' : 'right',
        },
      ], {
        size: pointSize,
      });
    }

    const boxY = fieldTop + (compact ? 6 : 8);
    const boxHeight = Math.min(
      compact ? 206 : 278,
      Math.max(compact ? 158 : 190,
        fieldBottom - boxY - (compact ? 63 : 78))
    );
    plateBox(ctx, rightX, boxY, rightW, [], {
      height: boxHeight,
      padding: compact ? 6 : 8,
    });
    const boxCenter = rightX + rightW / 2;
    plateText(ctx, compact ? 'AT THE OBSERVER' : 'LOCAL ANGLES AT THE OBSERVER',
      boxCenter, boxY + (compact ? 12 : 16), {
        size: compact ? 8 : 9.5,
        weight: 600,
        align: 'center',
      });
    plateLine(ctx,
      { x: rightX + (compact ? 6 : 9), y: boxY + (compact ? 24 : 31) },
      { x: rightX + rightW - (compact ? 6 : 9), y: boxY + (compact ? 24 : 31) }, {
        weight: 0.55,
      });

    const diagramTop = boxY + (compact ? 32 : 40);
    const diagramBottom = boxY + boxHeight - (compact ? 8 : 12);
    const diagramH = diagramBottom - diagramTop;
    const localOrigin = {
      x: rightX + rightW * (compact ? 0.43 : 0.42),
      y: diagramTop + diagramH * 0.57,
    };
    const rayLength = Math.min(
      rightW * (compact ? 0.31 : 0.3),
      diagramH * (compact ? 0.34 : 0.35)
    );
    const horizonHalf = Math.min(rightW * 0.35, rayLength * 0.98);
    const zenithA = -Math.PI / 2;
    const horizonA = 0;
    const rayA = zenithA + fromDeg * D2R;
    const zenithEnd = {
      x: localOrigin.x,
      y: localOrigin.y - rayLength,
    };
    const rayEnd = {
      x: localOrigin.x + Math.cos(rayA) * rayLength,
      y: localOrigin.y + Math.sin(rayA) * rayLength,
    };

    plateLine(ctx,
      { x: localOrigin.x - horizonHalf, y: localOrigin.y },
      { x: localOrigin.x + horizonHalf, y: localOrigin.y }, {
        weight: compact ? 0.8 : 1,
      });
    plateVector(ctx, localOrigin, zenithEnd, {
      kind: 'construction',
      weight: compact ? 0.7 : 0.85,
      head: compact ? 3.1 : 3.8,
    });
    plateVector(ctx, localOrigin, rayEnd, {
      kind: 'long',
      weight: compact ? 0.9 : 1.05,
      head: compact ? 3.4 : 4.1,
    });
    rightAngleMark(ctx, localOrigin.x, localOrigin.y, horizonA, zenithA,
      Math.min(compact ? 6 : 8, rayLength * 0.18), PLATE.ink);

    const hoArcR = rayLength * (compact ? 0.34 : 0.32);
    if (Math.abs(altitude) >= 4) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.7 : 0.85;
      ctx.beginPath();
      ctx.arc(localOrigin.x, localOrigin.y, hoArcR,
        horizonA, rayA, rayA < horizonA);
      ctx.stroke();
      ctx.restore();
      const hoMid = rayA / 2;
      plateDataText(ctx, 'Ho',
        localOrigin.x + Math.cos(hoMid) * (hoArcR + (compact ? 7 : 10)),
        localOrigin.y + Math.sin(hoMid) * (hoArcR + (compact ? 7 : 10)), {
          size: compact ? 8 : 9.5,
          align: 'center',
        });
    } else {
      plateDataText(ctx, 'Ho', localOrigin.x + hoArcR + (compact ? 8 : 11),
        localOrigin.y + (compact ? 9 : 12), {
          size: compact ? 8 : 9.5,
          align: 'center',
        });
    }

    const zArcR = rayLength * (compact ? 0.64 : 0.62);
    if (fromDeg >= 4) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.7 : 0.85;
      ctx.beginPath();
      ctx.arc(localOrigin.x, localOrigin.y, zArcR,
        zenithA, rayA, false);
      ctx.stroke();
      ctx.restore();
      const zMid = zenithA + fromDeg * D2R / 2;
      plateDataText(ctx, 'z',
        localOrigin.x + Math.cos(zMid) * (zArcR + (compact ? 7 : 10)),
        localOrigin.y + Math.sin(zMid) * (zArcR + (compact ? 7 : 10)), {
          size: compact ? 8 : 9.5,
          align: 'center',
        });
    } else {
      plateDataText(ctx, 'z', localOrigin.x + zArcR + (compact ? 7 : 10),
        localOrigin.y - zArcR * 0.72, {
          size: compact ? 8 : 9.5,
          align: 'center',
        });
    }

    plateText(ctx, 'LOCAL ZENITH', zenithEnd.x, zenithEnd.y - (compact ? 9 : 11), {
      size: compact ? 7.5 : 8.5,
      align: 'center',
    });
    plateText(ctx, 'LOCAL HORIZON',
      localOrigin.x - horizonHalf, localOrigin.y + (compact ? 10 : 13), {
        size: compact ? 7.5 : 8.5,
        align: 'left',
      });

    const nearHorizon = Math.abs(altitude) < 28;
    plateText(ctx, 'TO VEGA',
      nearHorizon ? rayEnd.x : rayEnd.x + (compact ? 5 : 7),
      nearHorizon
        ? rayEnd.y + (altitude >= 0 ? -(compact ? 9 : 11) : (compact ? 9 : 11))
        : rayEnd.y, {
        size: compact ? 7.5 : 8.5,
        align: nearHorizon ? 'right' : 'left',
      });

    ctx.fillStyle = PLATE.ink;
    ctx.beginPath();
    ctx.arc(localOrigin.x, localOrigin.y, compact ? 2.1 : 2.6, 0, TAU);
    ctx.fill();

    geo = {
      mode: 'proof',
      cx,
      cy,
      R,
      splitX,
      y0: fieldBottom,
      y90: fieldTop,
      local: {
        x: rightX,
        y: boxY,
        width: rightW,
        height: boxHeight,
        origin: localOrigin,
      },
    };

    const dataTop = boxY + boxHeight + (compact ? 9 : 14);
    plateText(ctx, 'CURRENT ANGLES', boxCenter, dataTop, {
      size: compact ? 8 : 9,
      weight: 600,
      align: 'center',
    });
    plateDataText(ctx, `Ho = ${fmtDM(altitude, 1)}`,
      boxCenter, dataTop + (compact ? 15 : 20), {
        size: compact ? 8 : 10,
        align: 'center',
      });
    plateDataText(ctx, `z = ${fmtDM(fromDeg, 1)}`,
      boxCenter, dataTop + (compact ? 30 : 40), {
        size: compact ? 8 : 10,
        align: 'center',
      });
    plateDataText(ctx, `Ho + z = 90°`,
      boxCenter, dataTop + (compact ? 47 : 60), {
        size: compact ? 8.5 : 10.5,
        weight: 600,
        align: 'center',
      });

    altStat.set(fmtDM(altitude, 1), below ? P.red : '');
    fromStat.set(fmtDM(fromDeg, 1));
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

// ocean disc, configurable graticule, coastline-filled land, ink limb
function drawGlobeBase(ctx, toView, cx, cy, R, options = {}) {
  const {
    longitudeStep = 30,
    latitudes = [-60, -30, 30, 60],
    graticuleWeight = 0.75,
    equatorWeight = 1,
    coastlineWeight = 1,
    limbWeight = 2,
    showCenter = true,
  } = options;

  ctx.fillStyle = P.paperDeep;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

  if (graticuleWeight > 0) {
    ctx.strokeStyle = P.globeGrat;
    ctx.lineWidth = graticuleWeight;
    if (longitudeStep > 0) {
      for (let lon = 0; lon < 360; lon += longitudeStep) {
        const pts = [];
        for (let lat = -87; lat <= 87; lat += 3) pts.push([lon, lat]);
        globeArc(ctx, toView, pts, cx, cy, R);
      }
    }
    for (const lat of latitudes) {
      const pts = [];
      for (let lon = 0; lon <= 360; lon += 3) pts.push([lon, lat]);
      globeArc(ctx, toView, pts, cx, cy, R);
    }
  }
  if (equatorWeight > 0) {
    ctx.strokeStyle = P.globeGrat;
    ctx.lineWidth = equatorWeight;
    const eq = [];
    for (let lon = 0; lon <= 360; lon += 3) eq.push([lon, 0]);
    globeArc(ctx, toView, eq, cx, cy, R);
  }

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
  if (coastlineWeight > 0) {
    ctx.strokeStyle = P.globeCoast;
    ctx.lineWidth = coastlineWeight;
    for (const ring of LAND) {
      const pts = [];
      for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
      globeArc(ctx, toView, pts, cx, cy, R);
    }
  }

  if (limbWeight > 0) {
    ctx.strokeStyle = P.globeLimb;
    ctx.lineWidth = limbWeight;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  }
  if (showCenter) centerMark(ctx, cx, cy, 7, P.globeLimb);
}


