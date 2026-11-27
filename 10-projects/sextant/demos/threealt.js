'use strict';
/* Four views of one star, side by side: at its GP, 30°, 70° and 90° away.
   Small multiples of the "Your view" sketch from the figures' captions, so
   the altitude falls from 90° to 60° to 20° to 0° as the distance grows.
   On a phone they sit two by two. */

(function demoThreeAlt() {
  const VIEWS = [
    { alt: 90, name: 'AT THE GP' },
    { alt: 60, name: '30° FROM THE GP' },
    { alt: 20, name: '70° FROM THE GP' },
    { alt: 0, name: '90° FROM THE GP' },
  ];

  const d = createDemo('demo-threealt', {
    aspect: 3.6, maxH: 200, compactAspect: 1.1, compactMaxH: 340, draw, still: true,
  });

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const gap = compact ? 10 : 14;
    const nameH = compact ? 18 : 22;
    const cols = compact ? 2 : 4, rows = VIEWS.length / cols;
    // panels keep the caption sketch's proportions, as large as fit
    const pw = Math.min((w - gap * (cols - 1)) / cols, ((h - gap * (rows - 1)) / rows - nameH - 2) / 1.02);
    const ph = pw * 1.02;
    const x0 = (w - (pw * cols + gap * (cols - 1))) / 2;
    const top = Math.max(1, (h - rows * (ph + nameH) - gap * (rows - 1)) / 2);

    VIEWS.forEach((v, i) => {
      const y0 = top + Math.floor(i / cols) * (ph + nameH + gap);
      const box = { ctx, canvas: d.canvas, x: x0 + (i % cols) * (pw + gap), y: y0, w: pw, h: ph, compact: true };
      plateAltitudeInstrument(box, {
        title: '',
        sights: [{ alt: v.alt, block: plateFigureBlock(ctx, `h = ${v.alt}°`, true) }],
      });
      if (v.alt === 0) {
        // the sketch leaves a 0° reading unlabeled; set it over the star,
        // at the same scale the sketch uses
        const O = { x: box.x + pw * 0.23, y: box.y + ph * 0.85 };
        const r = Math.min(pw * 0.64, O.y - box.y - 18 - 10);
        const b = plateFigureBlock(ctx, 'h = 0°', true);
        const bx = Math.min(O.x + r - b.w / 2, box.x + pw - b.w - 6);
        const by = O.y - 18;
        ctx.save();
        ctx.fillStyle = PLATE.paper;
        ctx.fillRect(bx - 3, by - b.h / 2 - 1, b.w + 6, b.h + 2);
        ctx.restore();
        b.draw(bx, by, 1, ctx);
      }
      plateText(ctx, v.name, box.x + pw / 2, y0 + ph + nameH / 2 + 2,
        { size: compact ? 6.5 : 7.5, weight: 600, align: 'center' });
    });
  }
})();
