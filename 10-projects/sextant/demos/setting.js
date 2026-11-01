'use strict';
/* Walking away from a star's GP lowers it by the same angle you travel:
   90° overhead at the GP, on the horizon 90° away. A graph carries the
   linear rule; a small deck view shows what that altitude looks like. */

(function demoSetting() {
  const d = createDemo('demo-setting', {
    aspect: 2,
    maxH: 380,
    compactAspect: 0.78,
    compactMaxH: 470,
    draw,
  });

  const FALLBACK_WORKED_Z = 47.4989;
  const dist = addSlider(d, {
    label: 'distance from the GP',
    min: 0,
    max: 90,
    step: 0.1,
    value: FALLBACK_WORKED_Z,
    fmt: v => v.toFixed(1) + '°',
  });
  const altStat = addStat(d, 'star’s altitude');
  const applyWorked = (state = SIGHT_STORY.state) => {
    dist.set(clamp(state.z, 0, 90), { emit: false });
  };
  d.addPreset('worked', () => applyWorked());
  SIGHT_STORY.subscribe(applyWorked);

  let geo = null;
  d.canvas.classList.add('grab');
  addDrag(d.canvas, {
    move(p) {
      if (!geo) return;
      const t = (p.x - geo.x0) / (geo.x1 - geo.x0);
      dist.set(clamp(Math.round(t * 900) / 10, 0, 90), { emit: false });
    },
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const z = clamp(dist.v, 0, 90);
    const alt = 90 - z;
    altStat.set(`90° − ${z.toFixed(1)}° = ${alt.toFixed(1)}°`);

    const pad = compact ? 10 : 16;
    const titleY = compact ? 15 : 19;
    plateText(ctx, compact
      ? 'ONE DEGREE TRAVELED, ONE DEGREE LOWER'
      : 'THE STAR SINKS ONE DEGREE FOR EVERY DEGREE YOU TRAVEL',
    pad, titleY, { size: compact ? 8.5 : 10.5, weight: 600 });

    const ruleY = h - (compact ? 30 : 36);
    plateRule(ctx, ruleY, pad, w - pad);
    plateDataText(ctx,
      `altitude = 90° − distance · 90° − ${z.toFixed(1)}° = ${alt.toFixed(1)}°`,
      w / 2, ruleY + (compact ? 15 : 18), {
        size: compact ? 8 : 10,
        align: 'center',
      });

    // deck view and graph share the field between title and footer
    const fieldTop = titleY + (compact ? 14 : 20);
    const fieldBottom = ruleY - (compact ? 8 : 12);
    let deck, plot;
    if (compact) {
      const deckH = Math.min(132, (fieldBottom - fieldTop) * 0.36);
      deck = { x: pad, y: fieldTop, w: w - pad * 2, h: deckH };
      plot = { x: pad, y: fieldTop + deckH + 10, w: w - pad * 2, h: fieldBottom - fieldTop - deckH - 10 };
    } else {
      const deckW = Math.min(250, w * 0.3);
      plot = { x: pad, y: fieldTop, w: w - pad * 3 - deckW, h: fieldBottom - fieldTop };
      deck = { x: w - pad - deckW, y: fieldTop, w: deckW, h: fieldBottom - fieldTop };
    }

    drawGraph(ctx, plot, z, alt, compact);
    drawDeck(ctx, deck, alt, compact);
  }

  function drawGraph(ctx, box, z, alt, compact) {
    const left = box.x + (compact ? 30 : 40);
    const right = box.x + box.w - (compact ? 10 : 18);
    const top = box.y + (compact ? 12 : 16);
    const bottom = box.y + box.h - (compact ? 30 : 36);
    const xOf = deg => left + (right - left) * deg / 90;
    const yOf = deg => bottom - (bottom - top) * deg / 90;
    geo = { x0: left, x1: right };
    const size = compact ? 7.5 : 8.5;

    plateLine(ctx, { x: left, y: bottom }, { x: right, y: bottom }, { weight: 1 });
    plateLine(ctx, { x: left, y: bottom }, { x: left, y: top }, { weight: 1 });
    for (let deg = 0; deg <= 90; deg += 15) {
      const major = deg % 30 === 0;
      const tick = major ? 5 : 3;
      plateLine(ctx, { x: xOf(deg), y: bottom }, { x: xOf(deg), y: bottom + tick }, { weight: 0.7 });
      plateLine(ctx, { x: left - tick, y: yOf(deg) }, { x: left, y: yOf(deg) }, { weight: 0.7 });
      if (major) {
        plateDataText(ctx, deg === 0 ? '0° GP' : `${deg}°`, xOf(deg), bottom + (compact ? 12 : 14), {
          size, align: deg === 0 ? 'left' : 'center',
        });
        plateDataText(ctx, `${deg}°`, left - 7, yOf(deg), { size, align: 'right' });
        if (deg > 0) {
          plateLine(ctx, { x: left, y: yOf(deg) }, { x: right, y: yOf(deg) }, {
            kind: 'short', weight: 0.35,
          });
        }
      }
    }
    plateText(ctx, 'DISTANCE TRAVELED FROM THE GP', (left + right) / 2,
      bottom + (compact ? 24 : 28), { size, align: 'center' });
    plateText(ctx, 'STAR’S ALTITUDE', left + 6, top - (compact ? 7 : 10), { size });

    // the rule itself: a straight line from overhead to the horizon
    plateLine(ctx, { x: xOf(0), y: yOf(90) }, { x: xOf(90), y: yOf(0) }, {
      weight: compact ? 1.6 : 2,
    });

    const point = { x: xOf(z), y: yOf(alt) };
    plateLine(ctx, point, { x: point.x, y: bottom }, { kind: 'long', weight: 0.8 });
    plateLine(ctx, point, { x: left, y: point.y }, { kind: 'long', weight: 0.8 });
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, compact ? 3.6 : 4.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const labels = createPlateLabeler(ctx, {
      left: left + 2, top: top - 2, right, bottom: bottom - 2, gap: 2,
    });
    labels.reserve({ x: point.x - 6, y: point.y - 6, w: 12, h: 12 });
    labels.place(`YOU · ${alt.toFixed(1)}°`, point, [
      { x: point.x + 12, y: point.y - 12, align: 'left' },
      { x: point.x + 12, y: point.y + 14, align: 'left' },
      { x: point.x - 12, y: point.y + 14, align: 'right' },
      { x: point.x - 12, y: point.y - 12, align: 'right' },
    ], { size: compact ? 8 : 9, weight: 600, leader: false });
    if (!compact) {
      plateText(ctx, 'DRAG ALONG THE LINE', right, top + 2, { size: 7.5, align: 'right' });
    }
  }

  function drawDeck(ctx, box, alt, compact) {
    plateBox(ctx, box.x, box.y, box.w, [], { height: box.h, padding: compact ? 6 : 8 });
    const size = compact ? 7.5 : 8.5;
    plateText(ctx, 'FROM THE DECK', box.x + box.w / 2, box.y + (compact ? 11 : 15), {
      size: compact ? 8 : 9, weight: 600, align: 'center',
    });
    plateLine(ctx,
      { x: box.x + 7, y: box.y + (compact ? 21 : 28) },
      { x: box.x + box.w - 7, y: box.y + (compact ? 21 : 28) }, { weight: 0.55 });

    const innerTop = box.y + (compact ? 27 : 38);
    const innerBottom = box.y + box.h - (compact ? 16 : 22);
    const reach = Math.min((innerBottom - innerTop) * 0.82, box.w * 0.42);
    const origin = { x: box.x + box.w / 2, y: innerBottom - (compact ? 4 : 10) };
    const half = Math.min(box.w * 0.44, reach * 1.08);

    plateLine(ctx, { x: origin.x - half, y: origin.y }, { x: origin.x + half, y: origin.y }, {
      weight: compact ? 1.1 : 1.4,
    });
    plateText(ctx, 'HORIZON 0°', origin.x - half, origin.y + (compact ? 9 : 12), { size });
    plateVector(ctx, origin, { x: origin.x, y: origin.y - reach }, {
      kind: 'construction', weight: 0.8, head: 3.6,
    });
    plateText(ctx, 'OVERHEAD 90°', origin.x - 5, origin.y - reach + 2, { size, align: 'right' });

    const a = -alt * D2R;
    const end = { x: origin.x + Math.cos(a) * reach * 0.92, y: origin.y + Math.sin(a) * reach * 0.92 };
    plateVector(ctx, origin, end, { kind: 'long', weight: compact ? 1 : 1.2, head: 4 });
    starGlyph(ctx, end.x + Math.cos(a) * 8, end.y + Math.sin(a) * 8, compact ? 4.5 : 5.5, PLATE.ink);

    const arcR = Math.min(reach * 0.34, compact ? 26 : 36);
    if (alt > 2) {
      ctx.save();
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, arcR, a, 0);
      ctx.stroke();
      ctx.restore();
      const mid = a / 2;
      plateDataText(ctx, `${alt.toFixed(1)}°`,
        origin.x + Math.cos(mid) * (arcR + 6), origin.y + Math.sin(mid) * (arcR + 6), {
          size: compact ? 8 : 9, weight: 600,
        });
    }
  }
})();
