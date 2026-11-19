'use strict';
/* §10 worked example: the draft's eight steps for one Vega sight, taken at
   35.5° at 05:45:12 UT on 16 May 2025. A ruled almanac worksheet fills in
   step by step while the globe beside it builds the same arithmetic:
   GHA Aries from Greenwich, Vega's SHA from Aries, the GP, and finally the
   ring at 90° − altitude. Uses the plate globe helpers from globes.js. */

(function demoWorked() {
  const d = createDemo('demo-worked', {
    aspect: 1.7,
    maxH: 430,
    compactAspect: 0.62,
    compactMaxH: 600,
    draw,
  });

  const step = addSlider(d, {
    label: 'step',
    min: 1,
    max: 8,
    step: 1,
    value: 8,
    fmt: v => v + ' of 8',
  });

  // almanac values for the sight (degrees)
  const HS = 35.5;
  const GHA_ARIES_05 = 309 + 10.0 / 60;
  const GHA_ARIES = 320 + 29.9 / 60;
  const SHA = 80 + 32.8 / 60;
  const GHA_VEGA = 41 + 2.7 / 60;
  const DEC = 38 + 48.1 / 60;
  const Z = 90 - HS;
  // GHA runs west from Greenwich; east longitude is negative GHA
  const lonOf = gha => {
    let lon = -gha;
    while (lon <= -180) lon += 360;
    while (lon > 180) lon -= 360;
    return lon;
  };
  const VEGA = { lat: DEC, lon: lonOf(GHA_VEGA) };

  // worksheet rows, names already set in capitals so units can stay lower case
  const ROWS = [
    [['SEXTANT ALTITUDE', '35.5°'], ['TIME', '05:45:12 UT · 16 May 2025']],
    [['GHA ARIES AT 05h', '309° 10.0′']],
    [['+ INCREMENT FOR 45m 12s', '11° 19.9′']],
    [['= GHA ARIES', '320° 29.9′']],
    [['+ SHA VEGA', '80° 32.8′'], ['SUM', '400° 62.7′']],
    [['− 360°, CARRY 60′ INTO A DEGREE', ''], ['= GHA VEGA', '41° 02.7′']],
    [['VEGA GP LATITUDE (DEC)', '38° 48.1′ N'], ['VEGA GP LONGITUDE', '41° 02.7′ W']],
    [['RING RADIUS 90° − 35.5°', '54.5°']],
  ];
  const ACTIONS = [
    'Measure the altitude and note the time',
    'Look up GHA Aries for the hour',
    'Add the increment for the minutes and seconds',
    'GHA Aries at the moment of the sight',
    'Add Vega’s offset from Aries',
    'Remove the full turn and tidy the minutes',
    'Vega’s ground position',
    'Draw the ring at 90° − altitude',
  ];
  const LINE_COUNT = ROWS.reduce((n, row) => n + row.length, 0);

  function draw(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 500;
    const s = Math.round(step.v);
    const pad = compact ? 10 : 16;
    const titleY = compact ? 15 : 19;

    plateText(ctx, compact ? 'WORKED SIGHT · VEGA' : 'WORKED SIGHT · VEGA · 16 MAY 2025',
      pad, titleY, { size: compact ? 8.5 : 10.5, weight: 600 });

    const ruleY = h - (compact ? 30 : 36);
    plateRule(ctx, ruleY, pad, w - pad);
    plateText(ctx, `Step ${s} · ${ACTIONS[s - 1]}`, w / 2, ruleY + (compact ? 15 : 18), {
      size: compact ? 8 : 9.5, align: 'center', weight: 600,
    });

    const fieldTop = titleY + (compact ? 14 : 20);
    const fieldBottom = ruleY - (compact ? 8 : 12);
    if (compact) {
      const sheetH = Math.min((fieldBottom - fieldTop) * 0.47, LINE_COUNT * 18 + 8);
      drawSheet(ctx, { x: pad, y: fieldTop, w: w - pad * 2, h: sheetH }, s, compact);
      drawGlobe(ctx, {
        x: pad, y: fieldTop + sheetH + 8, w: w - pad * 2,
        h: fieldBottom - fieldTop - sheetH - 8,
      }, s, compact);
    } else {
      const sheetW = Math.min(w * 0.47, 360);
      drawSheet(ctx, { x: pad, y: fieldTop, w: sheetW, h: fieldBottom - fieldTop }, s, compact);
      const gx = pad + sheetW + 18;
      drawGlobe(ctx, { x: gx, y: fieldTop, w: w - pad - gx, h: fieldBottom - fieldTop }, s, compact);
    }
  }

  function drawSheet(ctx, box, s, compact) {
    const size = compact ? 7.8 : 8.6;
    const lineH = Math.min(compact ? 18 : 23, (box.h - 6) / LINE_COUNT);
    const numX = box.x + 2;
    const nameX = box.x + (compact ? 22 : 28);
    const valueX = box.x + box.w - 2;
    let y = box.y + lineH * 0.5 + 2;

    ROWS.forEach((row, index) => {
      const n = index + 1;
      const current = n === s;
      const revealed = n <= s;
      if (index > 0) {
        plateLine(ctx, { x: box.x, y: y - lineH * 0.5 }, { x: box.x + box.w, y: y - lineH * 0.5 }, {
          weight: 0.35,
        });
      }
      plateDataText(ctx, current ? `▸${n}` : String(n), numX, y, {
        size, weight: current ? 700 : 500,
      });
      if (!revealed) {
        plateLine(ctx, { x: nameX, y }, { x: nameX + (box.w - (nameX - box.x)) * 0.5, y }, {
          kind: 'short', weight: 0.5,
        });
        y += lineH * row.length;
        return;
      }
      for (const [name, value] of row) {
        plateText(ctx, name, nameX, y, {
          size, uppercase: false, weight: current ? 700 : 500,
        });
        if (value) {
          plateDataText(ctx, value, valueX, y, {
            size, align: 'right', weight: current ? 700 : 400,
          });
        }
        y += lineH;
      }
    });
  }

  function arcPoints(scene, lat, lon0, lon1) {
    const points = [];
    const n = Math.max(2, Math.ceil(Math.abs(lon1 - lon0) / 2));
    for (let i = 0; i <= n; i++) points.push(scene.project(lat, lon0 + (lon1 - lon0) * i / n));
    return points;
  }

  function strokeArc(ctx, points, weight, opts = {}) {
    strokePlateHemisphere(ctx, points, false, { kind: 'long', weight: Math.min(weight, 0.6) });
    strokePlateHemisphere(ctx, points, true, { kind: opts.kind || 'solid', weight });
    if (opts.head) {
      const front = points.filter(point => point.front);
      if (front.length >= 2) {
        const a = front[front.length - 1], b = front[front.length - 2];
        plateArrowhead(ctx, a, Math.atan2(a.y - b.y, a.x - b.x), opts.head);
      }
    }
  }

  function dot(ctx, point, r, hollow) {
    ctx.save();
    ctx.fillStyle = hollow ? PLATE.paper : PLATE.ink;
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function midFront(points) {
    const front = points.filter(point => point.front);
    return front[Math.floor(front.length / 2)] || null;
  }

  function drawGlobe(ctx, box, s, compact) {
    const R = Math.max(40, Math.min(box.w, box.h) / 2 - (compact ? 6 : 10));
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    // centred west of Greenwich and tilted north: the Atlantic, Greenwich,
    // Aries' GP over Africa, and the whole ring all face the reader
    const globe = { spin: 12, tilt: 22 };
    const scene = drawPlateGlobeFrame(ctx, globe, cx, cy, R, compact, {
      gridLatitudes: [-30, 0, 30, 60],
      gridLongitudeStep: 30,
    });

    const view = globeView(globe.spin, globe.tilt);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = P.globeCoast;
    ctx.lineWidth = compact ? 0.5 : 0.65;
    for (const ring of LAND) {
      const pts = [];
      for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
      globeArc(ctx, view, pts, cx, cy, R);
    }
    ctx.restore();

    const labels = createPlateLabeler(ctx, {
      left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h, gap: 2,
    });
    const size = compact ? 7.5 : 8.5;
    const bold = compact ? 1.4 : 1.8;
    const thin = compact ? 0.7 : 0.85;
    const head = compact ? 3.4 : 4.2;

    // Greenwich meridian: where every GHA starts
    const greenwich = [];
    for (let lat = -80; lat <= 80; lat += 3) greenwich.push(scene.project(lat, 0));
    strokeArc(ctx, greenwich, s === 1 ? bold : thin, { kind: 'construction' });
    const gwLabel = scene.project(52, 0);

    const ghaLat = -8, shaLat = -18;
    const reserved = [];

    if (s >= 2 && s <= 5) {
      const gha = s === 2 ? GHA_ARIES_05 : GHA_ARIES;
      const arc = arcPoints(scene, ghaLat, 0, -gha);
      strokeArc(ctx, arc, s <= 4 ? bold : thin, { head });
      if (s === 3) {
        const inc = arcPoints(scene, 0, lonOf(GHA_ARIES_05), lonOf(GHA_ARIES));
        strokeArc(ctx, inc, bold, { head });
        dot(ctx, scene.project(0, lonOf(GHA_ARIES_05)), compact ? 2.4 : 3, true);
        const m = midFront(inc);
        if (m) reserved.push(['+11° 19.9′', m, [
          { x: m.x, y: m.y - 14, align: 'center' },
          { x: m.x, y: m.y + 14, align: 'center' },
        ], { data: true }]);
      }
      const start = midFront(arc.slice(0, Math.ceil(arc.length * 0.15)));
      if (start && (s === 2 || s === 4)) reserved.push([`GHA ARIES ${fmtDM(gha, 1)} W`, start, [
        { x: start.x - 12, y: start.y + 18, align: 'right' },
        { x: start.x + 12, y: start.y + 20, align: 'left' },
      ], { leader: true }]);
    }

    const aries = scene.project(0, lonOf(s === 2 ? GHA_ARIES_05 : GHA_ARIES));
    if (s >= 2) {
      dot(ctx, aries, compact ? 2.8 : 3.4, s >= 5);
      if (s <= 5) reserved.push([s === 2 ? 'ARIES AT 05h' : 'ARIES', aries, [
        { x: aries.x + 10, y: aries.y - 12, align: 'left' },
        { x: aries.x - 10, y: aries.y - 12, align: 'right' },
        { x: aries.x + 10, y: aries.y + 12, align: 'left' },
      ], { leader: false, raw: s === 2 }]);
    }

    if (s >= 5) {
      const sha = arcPoints(scene, shaLat, lonOf(GHA_ARIES), VEGA.lon);
      strokeArc(ctx, sha, s === 5 ? bold : thin, { head });
      const m = midFront(sha);
      if (m && s === 5) reserved.push([`SHA ${fmtDM(SHA, 1)}`, m, [
        { x: m.x, y: m.y + 14, align: 'center' },
        { x: m.x, y: m.y - 14, align: 'center' },
      ], { leader: false, data: true }]);
    }

    if (s >= 6) {
      const gha = arcPoints(scene, ghaLat, 0, VEGA.lon);
      strokeArc(ctx, gha, s === 6 ? bold : thin, { head });
      const m = midFront(gha);
      if (m && s === 6) reserved.push([`GHA VEGA ${fmtDM(GHA_VEGA, 1)}`, m, [
        { x: m.x, y: m.y - 13, align: 'center' },
        { x: m.x - 8, y: m.y - 13, align: 'right' },
      ], { leader: false, data: true }]);
    }

    if (s >= 7) {
      const decLine = [];
      for (let lat = shaLat; lat <= DEC; lat += 2) decLine.push(scene.project(lat, VEGA.lon));
      decLine.push(scene.project(DEC, VEGA.lon));
      strokeArc(ctx, decLine, s === 7 ? bold : thin, { kind: s === 7 ? 'solid' : 'long' });
      const m = scene.project(DEC / 2, VEGA.lon);
      if (s === 7) reserved.push([`DEC ${fmtDM(DEC, 1)} N`, m, [
        { x: m.x - 10, y: m.y, align: 'right' },
        { x: m.x + 10, y: m.y, align: 'left' },
      ], { leader: false, data: true }]);
    }

    if (s === 8) {
      const ring = drawPlatePositionCircle(ctx, scene, VEGA.lat, VEGA.lon, Z, {
        weight: compact ? 1.6 : 2,
        hiddenWeight: 0.5,
      });
      // radius drawn toward the globe's lower right, where it stays on the front face
      const radius = [];
      for (let i = 0; i <= 20; i++) {
        const p = destPoint(VEGA.lat, VEGA.lon, Z * i / 20, 150);
        radius.push(scene.project(p.lat, p.lon));
      }
      strokeArc(ctx, radius, thin, { head: compact ? 3 : 3.6 });
      const m = radius[11];
      reserved.push([`r = ${Z.toFixed(1)}°`, m, [
        { x: m.x + 10, y: m.y - 4, align: 'left' },
        { x: m.x - 10, y: m.y + 6, align: 'right' },
      ], { leader: false, data: true, weight: 700 }]);
      const anchor = plateRingAnchor(ring, cx, cy, { x: -0.7, y: 0.7 }) || ring[0];
      reserved.push(['RING OF POSITION', anchor, [
        { x: anchor.x - 14, y: anchor.y + 16, align: 'right' },
        { x: anchor.x + 14, y: anchor.y + 16, align: 'left' },
      ], { leader: true }]);
    }

    let vega = null;
    if (s >= 5) {
      vega = scene.project(VEGA.lat, VEGA.lon);
      starGlyph(ctx, vega.x, vega.y, compact ? 5 : 6.5, PLATE.ink);
      labels.reserve({ x: vega.x - 7, y: vega.y - 7, w: 14, h: 14 });
    }
    labels.reserve({ x: aries.x - 4, y: aries.y - 4, w: 8, h: 8 });

    // only the current step's marks are labelled on the globe; the
    // worksheet already carries every earlier value
    if (vega) {
      labels.place(s >= 7 ? 'VEGA GP' : 'VEGA', vega, [
        { x: vega.x + 11, y: vega.y - 12, align: 'left' },
        { x: vega.x - 11, y: vega.y - 12, align: 'right' },
      ], { size, weight: 600, leader: false });
    }
    for (const [text, target, candidates, opts] of reserved) {
      const options = {
        size,
        weight: opts.weight || 500,
        leader: opts.leader ?? false,
        fallback: 'hide',
      };
      if (opts.data) {
        options.font = PLATE.dataFont;
        options.uppercase = false;
        options.tracking = 0;
      }
      if (opts.raw) options.uppercase = false;
      labels.place(text, target, candidates, options);
    }
    labels.place('GREENWICH', gwLabel, [
      { x: gwLabel.x + 6, y: gwLabel.y, align: 'left' },
      { x: gwLabel.x - 6, y: gwLabel.y, align: 'right' },
    ], { size: size * 0.92, leader: false, fallback: 'hide' });
  }
})();
