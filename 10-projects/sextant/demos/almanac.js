'use strict';
/* §06: why the almanac stays small. It tabulates one racing number
   (GHA Aries); each star keeps a nearly fixed catalog offset (SHA), so a
   star's GHA is one addition. Declination stays separate as the GP's
   latitude. Hour angles run westward from Greenwich. */

(function demoAlmanac() {
  const d = createDemo('demo-almanac', {
    aspect: 1.6,
    maxH: 400,
    compactAspect: 0.86,
    compactMaxH: 420,
    draw,
  });
  const STORY_SOURCE = 'demo-almanac';
  const WORKED = SIGHT_STORY.state;
  const DATE_LABEL = (() => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const [year, month, day] = WORKED.date.split('-').map(Number);
    return `${day} ${months[month - 1]} ${year}`;
  })();
  const WORKED_UTC = WORKED.utcHours;
  const VEGA_SHA = WORKED.sha;
  const VEGA_DEC = WORKED.dec;
  const STELLAR_RATE = SIGHT_STORY.constants.stellarRate;
  let gmt = SIGHT_STORY.state.utcHours;
  const gmtSlider = addSlider(d, {
    // Stop one second before midnight: showing the next 00:00 without changing
    // the displayed date would make its sidereal advance look stale.
    label: 'UTC', min: 0, max: 24 - 1 / 3600, step: 1 / 3600, value: gmt,
    fmt: utcText,
    onchange: v => {
      gmt = v;
      if (Math.abs(SIGHT_STORY.state.utcHours - v) > 1e-10) {
        SIGHT_STORY.set({ utcHours: v }, { source: STORY_SOURCE });
      }
    },
  });

  const STARS = [
    { name: 'Vega', sha: VEGA_SHA, dec: `${fmtDM(VEGA_DEC, 1)} N`, main: true },
    { name: 'Sirius', sha: 258.5, dec: '16° 44′ S' },
    { name: 'Capella', sha: 280.5, dec: '46° 01′ N' },
  ];
  const wrap360 = a => ((a % 360) + 360) % 360;
  const ghaAt = t => wrap360(
    WORKED.ghaAries + (t - WORKED.utcHours) * STELLAR_RATE
  );
  function utcText(t) {
    const raw = Math.round(t * 3600);
    const total = ((raw % 86400) + 86400) % 86400;
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  d.addPreset('worked', () => {
    gmtSlider.set(WORKED_UTC, { emit: true });
  });

  SIGHT_STORY.subscribe((state, source) => {
    if (source === STORY_SOURCE) return;
    gmt = state.utcHours;
    gmtSlider.set(gmt, { emit: false });
  });

  function almanacState() {
    const ghaAries = ghaAt(gmt);
    const stars = STARS.map(st => ({ ...st, gha: wrap360(ghaAries + st.sha) }));
    return {
      ghaAries,
      stars,
      ghaVega: stars[0].gha,
      wrapped: ghaAries + STARS[0].sha >= 360,
    };
  }

  // GHA runs 0–360° west of Greenwich; as a longitude it is west up to
  // 180° and east beyond
  const lonText = gha => gha <= 180
    ? `${fmtDM(gha, 1)} W`
    : `${fmtDM(360 - gha, 1)} E`;
  const DATA = { font: PLATE.dataFont, tracking: 0, uppercase: false };
  function fitSize(ctx, text, width, size, opts = DATA) {
    let fitted = size;
    while (fitted > size * 0.72
      && plateTextWidth(ctx, text, { ...opts, size: fitted }) > width) fitted -= 0.25;
    return fitted;
  }

  function draw(ctx, w, h) {
    const s = almanacState();
    drawAlmanacPage(ctx, w, h, s);
  }

  // A boxed table: caps title, rule, header row, data rows, caps footnote.
  // Columns are [{x, align}] relative to the box; returns the box height.
  function drawTable(ctx, x, y, width, { title, columns, header, rows, note, size, row }) {
    const pad = 8;
    const titleH = row + 4;
    const height = pad * 2 + titleH + row * (rows.length + 1) + (note ? row : 0);
    ctx.save();
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
    plateText(ctx, title, x + pad, y + pad + row * 0.45, { size, weight: 600 });
    plateLine(ctx, { x: x + pad, y: y + pad + titleH - 3 },
      { x: x + width - pad, y: y + pad + titleH - 3 }, { weight: 0.55 });
    const cellY = i => y + pad + titleH + row * (i + 0.5);
    header.forEach((text, c) => {
      plateText(ctx, text, x + columns[c].x, cellY(0), {
        size: size * 0.92, align: columns[c].align,
      });
    });
    rows.forEach((cells, r) => {
      const strong = cells.strong;
      if (cells.marker) {
        plateText(ctx, '▸', x + pad * 0.45, cellY(r + 1), { size, uppercase: false });
      }
      cells.forEach((text, c) => {
        plateDataText(ctx, text, x + columns[c].x, cellY(r + 1), {
          size, align: columns[c].align, weight: strong ? 700 : 500,
        });
      });
    });
    if (note) {
      plateText(ctx, note, x + pad, cellY(rows.length + 1), { size: size * 0.9 });
    }
    return height;
  }

  function drawAlmanacPage(ctx, w, h, s) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500;
    const size = compact ? 7.6 : 9.2;
    const row = size * PLATE_TEXT_SCALE * 1.55;
    const pad = 14;

    // the figure's title is set in its caption, so the tables start at the top
    const titleRule = compact ? 2 : 4;

    // the two tables an almanac page actually prints: Aries hour by hour,
    // and a short star list whose offsets barely change all year
    const hour = Math.floor(gmt);
    const ariesRows = [-1, 0, 1].map(k => {
      const hh = ((hour + k) % 24 + 24) % 24;
      const cells = [`${String(hh).padStart(2, '0')}h`, fmtDM(ghaAt(hour + k), 1)];
      if (k === 0) { cells.strong = true; cells.marker = true; }
      return cells;
    });
    const starRows = STARS.map(st => {
      const cells = [st.name, fmtDM(st.sha, 1), st.dec];
      if (st.main) { cells.strong = true; cells.marker = true; }
      return cells;
    });

    const tablesY = titleRule + (compact ? 9 : 14);
    let y;
    if (compact) {
      const tw = w - pad * 2;
      const hA = drawTable(ctx, pad, tablesY, tw, {
        title: `Aries · ${DATE_LABEL}`,
        columns: [{ x: 18, align: 'left' }, { x: tw - 10, align: 'right' }],
        header: ['UT', 'GHA ARIES'],
        rows: ariesRows, note: 'Changes every hour', size, row,
      });
      const starsY = tablesY + hA + 8;
      const hS = drawTable(ctx, pad, starsY, tw, {
        title: 'Stars · offset from Aries',
        columns: [{ x: 18, align: 'left' }, { x: tw * 0.6, align: 'right' }, { x: tw - 10, align: 'right' }],
        header: ['STAR', 'SHA', 'DEC'],
        rows: starRows, note: 'Nearly fixed all year', size, row,
      });
      y = starsY + hS;
    } else {
      const gap = 12;
      const aw = (w - pad * 2 - gap) * 0.4;
      const sw = w - pad * 2 - gap - aw;
      const hA = drawTable(ctx, pad, tablesY, aw, {
        title: `Aries · ${DATE_LABEL}`,
        columns: [{ x: 20, align: 'left' }, { x: aw - 10, align: 'right' }],
        header: ['UT', 'GHA ARIES'],
        rows: ariesRows, note: 'Changes every hour', size, row,
      });
      const hS = drawTable(ctx, pad + aw + gap, tablesY, sw, {
        title: 'Stars · offset from Aries',
        columns: [{ x: 20, align: 'left' }, { x: sw * 0.58, align: 'right' }, { x: sw - 10, align: 'right' }],
        header: ['STAR', 'SHA', 'DEC'],
        rows: starRows, note: 'Nearly fixed all year', size, row,
      });
      y = tablesY + Math.max(hA, hS);
    }

    // the worked addition at the slider's instant
    const workRule = y + (compact ? 9 : 16);
    plateRule(ctx, workRule, pad, w - pad);
    const increment = s.ghaAries - ghaAt(hour);
    const lines = [
      { name: `GHA Aries ${String(hour).padStart(2, '0')}h`, value: fmtDM(ghaAt(hour), 1) },
      { name: `+ ${utcText(gmt).slice(3, 5)}m ${utcText(gmt).slice(6)}s of turning`, value: fmtDM(((increment % 360) + 360) % 360, 1) },
      { name: '+ Vega SHA', value: fmtDM(VEGA_SHA, 1) },
      ...(s.wrapped ? [{ name: '− one full turn', value: '360°' }] : []),
      { name: '= GHA Vega', value: fmtDM(s.ghaVega, 1), strong: true },
    ];
    const work = {
      x0: compact ? pad + 6 : w * 0.18,
      x1: compact ? w - pad - 6 : w * 0.82,
    };
    let ly = workRule + (compact ? 6 : 10) + row * 0.5;
    plateText(ctx, `At ${utcText(gmt)} UTC`, work.x0, ly, { size, weight: 600 });
    ly += row * 1.1;
    for (const item of lines) {
      plateText(ctx, item.name, work.x0, ly, {
        size, weight: item.strong ? 700 : 500,
        uppercase: true,
      });
      plateDataText(ctx, item.value, work.x1, ly, {
        size, align: 'right', weight: item.strong ? 700 : 500,
      });
      ly += row;
    }

    const gpY = ly + (compact ? 6 : 10);
    plateLine(ctx, { x: work.x0, y: gpY - row * 0.55 }, { x: work.x1, y: gpY - row * 0.55 }, { weight: 0.55 });
    const gpLine = `Vega GP  ${fmtDM(VEGA_DEC, 1)} N · ${lonText(s.ghaVega)}`;
    plateDataText(ctx, gpLine, (work.x0 + work.x1) / 2, gpY + row * 0.3, {
      size: fitSize(ctx, gpLine, work.x1 - work.x0, size + 0.6), weight: 700, align: 'center',
    });
  }
})();
