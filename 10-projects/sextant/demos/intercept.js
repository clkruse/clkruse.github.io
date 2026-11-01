'use strict';
/* §09: intercepts and the cocked hat. */

(function demoIntercept() {
  const d = createDemo('demo-intercept', {
    aspect: 1.2,
    maxH: 620,
    draw,
  });
  const workedSight = SIGHT_STORY.state;
  const STARS = [
    {
      name: 'Vega',
      zn: workedSight.zn,
      hc: workedSight.hc,
      ho: workedSight.ho,
      intercept: workedSight.interceptMin,
      worked: true,
    },
    { name: 'Regulus', zn: 158, hc: 31.7 },
    { name: 'Sirius', zn: 262, hc: 22.4 },
  ];
  const znText = value => String(value.toFixed(1)).padStart(5, '0') + '°';
  const shortAP = () => {
    const { assumed } = SIGHT_STORY.state;
    const latHemi = assumed.lat < 0 ? 'S' : 'N';
    const lonHemi = assumed.lon < 0 ? 'W' : 'E';
    return `${fmtDM(Math.abs(assumed.lat), 1)} ${latHemi} · ${fmtDM(Math.abs(assumed.lon), 1)} ${lonHemi}`;
  };
  function syncWorkedSight(s) {
    Object.assign(STARS[0], {
      zn: s.zn,
      hc: s.hc,
      ho: s.ho,
      intercept: s.interceptMin,
    });
  }
  let state = null;
  const status = addStat(d, 'plot', true);
  const hcStat = addStat(d, 'last sight', true);
  const btns = STARS.map((s, i) =>
    addButton(d, `${s.worked ? 'worked ' : 'sight '}${s.name} (Zn ${znText(s.zn)})`,
      () => takeSight(i)));
  const revealBtn = addButton(d, 'reveal the ship', () => {
    if (state.sights.every(sight => sight.taken) && !state.revealed) {
      state = { ...state, revealed: true };
      syncControls();
    }
  });
  const scenarios = [
    { alongNm: 7.5, noise: [0, -0.7, 0.5] },
    { alongNm: -5.5, noise: [0, 0.8, -0.4] },
    { alongNm: 10.5, noise: [0, -0.3, 0.9] },
  ];
  let scenarioIndex = 0;
  addButton(d, 'new position', () => {
    scenarioIndex = (scenarioIndex + 1) % scenarios.length;
    reset();
  }, 'subtle');

  function sightIntercept(index, truth, noise) {
    const star = STARS[index];
    if (star.worked) return star.intercept;
    const zn = star.zn * D2R;
    const toward = { x: Math.sin(zn), y: Math.cos(zn) };
    return truth.x * toward.x + truth.y * toward.y + noise;
  }

  function updateLastSight(index) {
    const sight = state.sights[index];
    const star = STARS[index];
    const ho = star.worked ? star.ho : star.hc + sight.a / 60;
    const toward = sight.a >= 0 ? 'toward' : 'away';
    hcStat.set(
      `${star.name}  ${star.worked ? `AP ${shortAP()}  ` : ''}`
      + `Ho ${fmtDM(ho, 1)}  Hc ${fmtDM(star.hc, 1)}  Zn ${znText(star.zn)}  →  `
      + `${Math.abs(sight.a).toFixed(1)}′ ${toward}`
    );
  }

  function updatePlotStatus() {
    const count = state.sights.filter(sight => sight.taken).length;
    if (count < 3) {
      status.set(`${3 - count} more sight${count === 2 ? '' : 's'} to go`);
      return;
    }
    if (state.revealed) {
      const points = hatPoints(collectLines());
      if (points.length === 3) {
        const center = centroid(points);
        const errNm = Math.hypot(center.x - state.truth.x, center.y - state.truth.y);
        status.set(`cocked hat center is ${errNm.toFixed(1)} nm from the revealed ship`, P.green);
        return;
      }
    }
    status.set('three noisy LOPs make a cocked hat near the ship');
  }

  function syncControls() {
    const count = state.sights.filter(sight => sight.taken).length;
    btns.forEach((button, index) => {
      button.disabled = state.sights[index].taken;
    });
    revealBtn.disabled = count !== 3 || state.revealed;
    updatePlotStatus();
  }

  function reset({ preserveProgress = false, storyState = SIGHT_STORY.state } = {}) {
    const previous = state;
    syncWorkedSight(storyState);
    const scenario = scenarios[scenarioIndex];
    const vegaAz = STARS[0].zn * D2R;
    const toward = { x: Math.sin(vegaAz), y: Math.cos(vegaAz) };
    const along = { x: -toward.y, y: toward.x };
    // Build every dependent value before replacing state. A story update can
    // therefore never expose a new Vega line beside stale synthetic sights.
    const truth = {
      x: STARS[0].intercept * toward.x + scenario.alongNm * along.x,
      y: STARS[0].intercept * toward.y + scenario.alongNm * along.y,
    };
    const taken = preserveProgress && previous
      ? previous.sights.map(sight => sight.taken)
      : STARS.map((_, index) => index === 0);
    taken[0] = true;
    const sights = STARS.map((_, index) => ({
      taken: taken[index],
      noise: scenario.noise[index],
      a: taken[index]
        ? sightIntercept(index, truth, scenario.noise[index])
        : 0,
    }));
    state = {
      truth,
      sights,
      revealed: Boolean(
        preserveProgress
        && previous?.revealed
        && sights.every(sight => sight.taken)
      ),
    };
    const lastTaken = sights.reduce((last, sight, index) => sight.taken ? index : last, 0);
    updateLastSight(lastTaken);
    syncControls();
  }
  d.addPreset('worked', () => {
    scenarioIndex = 0;
    reset();
  });
  reset();
  SIGHT_STORY.subscribe(s => {
    btns[0].textContent = `worked Vega (Zn ${znText(s.zn)})`;
    reset({ preserveProgress: true, storyState: s });
  });

  function takeSight(i) {
    const s = state.sights[i];
    if (s.taken) return;
    const sights = state.sights.map((sight, index) => index === i
      ? {
          ...sight,
          a: sightIntercept(i, state.truth, sight.noise),
          taken: true,
        }
      : sight);
    state = { ...state, sights };
    updateLastSight(i);
    syncControls();
  }

  function draw(ctx, w, h) {
    drawMonochromePlot(ctx, w, h);
  }

  function drawMonochromePlot(ctx, w, h) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);
    const compact = w < 560 || h < 420;
    const titleSize = compact ? 8 : 10.4;
    const ruleY = compact ? h - 24 : h - 76;
    const fieldBottom = ruleY - (compact ? 4 : 9);
    const ledgerY = compact ? 31 : 42;
    const headerH = compact ? 24 : 40;
    const gap = compact ? 5 : 10;
    const minLedgerH = headerH + STARS.length * (compact ? 21 : 27);
    const desiredLedgerH = Math.min(compact ? 87 : 188,
      Math.max(minLedgerH, (fieldBottom - ledgerY) * (compact ? 0.47 : 0.52)));
    const maxLedgerH = Math.max(minLedgerH,
      fieldBottom - ledgerY - gap - (compact ? 78 : 90));
    const ledger = {
      x: compact ? 8 : 14,
      y: ledgerY,
      w: w - (compact ? 16 : 28),
      h: Math.min(desiredLedgerH, maxLedgerH),
    };
    const rowH = (ledger.h - headerH) / STARS.length;
    const chart = {
      x: compact ? 8 : 14,
      y: ledger.y + ledger.h + gap,
      w: w - (compact ? 16 : 28),
      h: Math.max(compact ? 36 : 60, fieldBottom - ledger.y - ledger.h - gap),
    };

    plateText(ctx, 'From signed intercept to LOP',
      w / 2, compact ? 11 : 15, {
        size: titleSize,
        weight: 600,
        tracking: titleSize * 0.15,
        align: 'center',
      });
    plateRule(ctx, compact ? 25 : 32, 14, w - 14);

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.7 : 0.9;
    ctx.strokeRect(ledger.x, ledger.y, ledger.w, ledger.h);
    ctx.restore();
    if (compact) {
      plateText(ctx, 'SIGHT LEDGER',
        ledger.x + 6, ledger.y + 7, {
          size: 8,
          weight: 600,
        });
      plateDataText(ctx, 'a = 60(Ho − Hc) · + TOWARD / − AWAY',
        ledger.x + ledger.w - 6, ledger.y + 17, {
          size: 8,
          align: 'right',
        });
    } else {
      plateText(ctx, 'SIGHT REDUCTION VALUES',
        ledger.x + 9, ledger.y + 10, {
          size: 9,
          weight: 600,
        });
      plateDataText(ctx, 'Ho − Hc IN ARCMINUTES = NAUTICAL MILES',
        ledger.x + ledger.w - 9, ledger.y + 10, {
          size: 8,
          align: 'right',
        });
    }
    plateLine(ctx, { x: ledger.x, y: ledger.y + headerH },
      { x: ledger.x + ledger.w, y: ledger.y + headerH }, {
        weight: compact ? 0.6 : 0.75,
      });

    const lineWeight = compact ? 1.15 : 1.55;

    state.sights.forEach((s, i) => {
      const star = STARS[i];
      const top = ledger.y + headerH + i * rowH;
      const mid = top + rowH / 2;
      if (i) {
        plateLine(ctx, { x: ledger.x, y: top },
          { x: ledger.x + ledger.w, y: top }, {
            kind: s.taken ? 'solid' : 'short',
            weight: compact ? 0.45 : 0.55,
          });
      }
      if (!compact) plateLine(ctx, { x: ledger.x + 5, y: mid },
        { x: ledger.x + 37, y: mid }, {
          weight: lineWeight,
        });

      const ho = s.taken
        ? (star.worked ? star.ho : star.hc + s.a / 60)
        : null;
      const signed = s.taken
        ? `${s.a >= 0 ? '+' : '−'}${Math.abs(s.a).toFixed(1)}′`
        : 'PENDING';
      const direction = s.taken ? (s.a >= 0 ? 'TOWARD' : 'AWAY') : 'TAKE SIGHT';

      if (compact) {
        const shortDM = value => fmtDM(value, 0).replace(' ', '');
        plateText(ctx, `${i + 1} · ${star.name}`, ledger.x + 6,
          top + rowH * 0.30, {
            size: 8,
            weight: s.taken ? 600 : 500,
          });
        const rowText = s.taken
          ? `Ho ${shortDM(ho)} · Hc ${shortDM(star.hc)} · a ${signed} · Zn ${String(Math.round(star.zn)).padStart(3, '0')}°`
          : `Hc ${shortDM(star.hc)} · Zn ${String(Math.round(star.zn)).padStart(3, '0')}° · PENDING`;
        plateDataText(ctx, rowText, ledger.x + 6, top + rowH * 0.73, {
          size: 8,
          weight: s.taken ? 600 : 500,
        });
      } else {
        plateText(ctx, `${i + 1}. ${star.name}`, ledger.x + 44, mid, {
          size: 9,
          weight: 600,
        });
        plateDataText(ctx, s.taken ? fmtDM(ho, 1) : '–',
          ledger.x + ledger.w * 0.32, mid, {
            size: 8,
            align: 'center',
          });
        plateDataText(ctx, fmtDM(star.hc, 1),
          ledger.x + ledger.w * 0.46, mid, {
            size: 8,
            align: 'center',
          });
        plateDataText(ctx, signed,
          ledger.x + ledger.w * 0.61, mid, {
            size: 8,
            align: 'center',
          });
        plateDataText(ctx, direction,
          ledger.x + ledger.w * 0.75, mid, {
            size: 8,
            align: 'center',
          });
        plateDataText(ctx, `Zn ${znText(star.zn)}`,
          ledger.x + ledger.w - 9, mid, {
            size: 8,
            align: 'right',
          });
      }
    });

    if (!compact) {
      const headings = [
        ['OBSERVED', 0.32],
        ['PREDICTED', 0.46],
        ['DIFFERENCE', 0.61],
        ['PLOT DIRECTION', 0.75],
        ['BEARING', 0.93],
      ];
      for (const [text, fraction] of headings) {
        plateText(ctx, text, ledger.x + ledger.w * fraction,
          ledger.y + headerH - 9, {
            size: 8,
            align: fraction > 0.9 ? 'right' : 'center',
            underline: true,
          });
      }
    }

    const cx = chart.x + chart.w * 0.50;
    const cy = chart.y + chart.h * 0.52;
    const lines = collectLines();
    const points = hatPoints(lines);
    const fitPoints = [
      { x: 0, y: 0 },
      ...lines.map(line => line.I),
      ...points,
      ...(state.revealed ? [state.truth] : []),
    ];
    const extentX = Math.max(14,
      ...fitPoints.map(point => Math.abs(point.x) + (compact ? 6 : 8)));
    const extentY = Math.max(12,
      ...fitPoints.map(point => Math.abs(point.y) + (compact ? 6 : 8)));
    const scale = Math.max(0.25, Math.min(
      Math.max(1, chart.w - (compact ? 20 : 34)) / (extentX * 2),
      Math.max(1, chart.h - (compact ? 12 : 22)) / (extentY * 2)
    ));
    const toPx = point => ({ x: cx + point.x * scale, y: cy - point.y * scale });
    const ap = toPx({ x: 0, y: 0 });
    const detailRect = points.length === 3 ? (() => {
      const width = compact
        ? Math.min(94, Math.max(78, chart.w * 0.30))
        : Math.min(190, Math.max(150, chart.w * 0.32));
      return {
        x: chart.x + chart.w - width - 4,
        y: chart.y + 4,
        w: width,
        h: Math.min(compact ? 92 : 112, chart.h - 8),
      };
    })() : null;

    ctx.save();
    ctx.strokeStyle = PLATE.ink;
    ctx.lineWidth = compact ? 0.65 : 0.8;
    ctx.strokeRect(chart.x, chart.y, chart.w, chart.h);
    ctx.beginPath();
    ctx.rect(chart.x, chart.y, chart.w, chart.h);
    ctx.clip();
    plateLine(ctx, { x: chart.x, y: cy }, { x: chart.x + chart.w, y: cy }, {
      kind: 'short',
      weight: compact ? 0.3 : 0.4,
    });
    plateLine(ctx, { x: cx, y: chart.y }, { x: cx, y: chart.y + chart.h }, {
      kind: 'short',
      weight: compact ? 0.3 : 0.4,
    });

    for (const line of lines) {
      const half = 42;
      const first = toPx({
        x: line.I.x + line.dir.x * half,
        y: line.I.y + line.dir.y * half,
      });
      const second = toPx({
        x: line.I.x - line.dir.x * half,
        y: line.I.y - line.dir.y * half,
      });
      plateLine(ctx, first, second, {
        weight: lineWeight,
      });
      const interceptPoint = toPx(line.I);
      if (Math.hypot(interceptPoint.x - ap.x, interceptPoint.y - ap.y) > 3) {
        plateVector(ctx, ap, interceptPoint, {
          kind: 'short',
          weight: compact ? 0.45 : 0.6,
          head: compact ? 2.5 : 3.2,
        });
        rightAngleMark(ctx, interceptPoint.x, interceptPoint.y,
          Math.atan2(interceptPoint.y - ap.y, interceptPoint.x - ap.x),
          Math.atan2(second.y - first.y, second.x - first.x),
          compact ? 5 : 7, PLATE.ink);
      }
    }

    if (points.length === 3) {
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.9 : 1.15;
      ctx.setLineDash([]);
      ctx.beginPath();
      points.forEach((point, index) => {
        const projected = toPx(point);
        if (index === 0) ctx.moveTo(projected.x, projected.y);
        else ctx.lineTo(projected.x, projected.y);
      });
      ctx.closePath();
      ctx.stroke();
      const center = toPx(centroid(points));
      plateLine(ctx, { x: center.x - 4, y: center.y },
        { x: center.x + 4, y: center.y }, { weight: compact ? 0.7 : 0.9 });
      plateLine(ctx, { x: center.x, y: center.y - 4 },
        { x: center.x, y: center.y + 4 }, { weight: compact ? 0.7 : 0.9 });
    }

    if (state.revealed && lines.length === 3) {
      const truth = toPx(state.truth);
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = compact ? 0.85 : 1.1;
      ctx.beginPath();
      ctx.arc(truth.x, truth.y, compact ? 4.5 : 6.5, 0, TAU);
      ctx.stroke();
      plateLine(ctx, { x: truth.x - 4, y: truth.y - 4 },
        { x: truth.x + 4, y: truth.y + 4 }, { weight: compact ? 0.7 : 0.9 });
      plateLine(ctx, { x: truth.x + 4, y: truth.y - 4 },
        { x: truth.x - 4, y: truth.y + 4 }, { weight: compact ? 0.7 : 0.9 });
    }
    ctx.restore();

    // AP is the common origin for every signed intercept.
    plateLine(ctx, { x: ap.x - (compact ? 4 : 6), y: ap.y },
      { x: ap.x + (compact ? 4 : 6), y: ap.y }, {
        weight: compact ? 0.55 : 0.75,
      });
    plateLine(ctx, { x: ap.x, y: ap.y - (compact ? 4 : 6) },
      { x: ap.x, y: ap.y + (compact ? 4 : 6) }, {
        weight: compact ? 0.55 : 0.75,
      });

    const chartLabels = createPlateLabeler(ctx, {
      left: chart.x + 3,
      top: chart.y + 3,
      right: chart.x + chart.w - 3,
      bottom: chart.y + chart.h - 3,
      gap: compact ? 1.5 : 3,
    });
    if (detailRect) chartLabels.reserve(detailRect, compact ? 3 : 5);
    const placeAPLabel = () => chartLabels.place('AP', ap, [
      { x: ap.x + 7, y: ap.y + (compact ? 12 : 9), align: 'left' },
      { x: ap.x - 7, y: ap.y + (compact ? 12 : 9), align: 'right' },
    ], {
      size: compact ? 8 : 9,
    });
    const placeHatLabel = () => {
      if (points.length !== 3) return;
      const center = toPx(centroid(points));
      chartLabels.place(compact ? 'COCKED HAT' : 'COCKED HAT CENTER', center, [
        ...(compact ? [
          { x: chart.x + chart.w * 0.5, y: chart.y + 9, align: 'center' },
          { x: chart.x + chart.w - 7, y: chart.y + 9, align: 'right' },
        ] : []),
        { x: center.x + 8, y: center.y - (compact ? 14 : 9), align: 'left' },
        { x: center.x - 8, y: center.y - (compact ? 14 : 9), align: 'right' },
        { x: center.x, y: center.y - (compact ? 18 : 13), align: 'center' },
      ], {
        size: compact ? 8 : 9,
      });
    };
    const placeShipLabel = () => {
      if (!state.revealed || lines.length !== 3) return;
      const truth = toPx(state.truth);
      chartLabels.place(compact ? 'SHIP' : 'REVEALED SHIP', truth, [
        ...(compact ? [
          { x: chart.x + chart.w - 7, y: chart.y + chart.h - 10, align: 'right' },
          { x: chart.x + chart.w - 7, y: chart.y + 22, align: 'right' },
        ] : []),
        { x: truth.x + 8, y: truth.y + (compact ? 14 : 9), align: 'left' },
        { x: truth.x - 8, y: truth.y + (compact ? 14 : 9), align: 'right' },
        { x: truth.x, y: truth.y + (compact ? 18 : 13), align: 'center' },
      ], {
        size: compact ? 8 : 9,
      });
    };

    placeAPLabel();
    placeHatLabel();
    placeShipLabel();
    for (const line of lines) {
      const index = STARS.indexOf(line.sight);
      const interceptPoint = toPx(line.I);
      const pixelDirection = { x: line.dir.x, y: -line.dir.y };
      const reach = compact
        ? Math.max(42, chart.w * 0.30)
        : Math.max(18, Math.min(chart.w, chart.h) * 0.36);
      const endpoint = {
        x: clamp(interceptPoint.x + pixelDirection.x * reach,
          chart.x + 8, chart.x + chart.w - 8),
        y: clamp(interceptPoint.y + pixelDirection.y * reach,
          chart.y + 8, chart.y + chart.h - 8),
      };
      const normal = { x: -pixelDirection.y, y: pixelDirection.x };
      chartLabels.place(compact
        ? `${index + 1} · ${line.sight.name}`
        : `${index + 1}. ${line.sight.name} LOP`,
        endpoint, [
          {
            x: endpoint.x + normal.x * (compact ? 6 : 9),
            y: endpoint.y + normal.y * (compact ? 6 : 9),
            align: pixelDirection.x < 0 ? 'right' : 'left',
          },
          {
            x: endpoint.x - normal.x * (compact ? 6 : 9),
            y: endpoint.y - normal.y * (compact ? 6 : 9),
            align: pixelDirection.x < 0 ? 'right' : 'left',
          },
        ], {
          size: compact ? 8 : 9,
          leader: false,
        });
    }

    // A short chart scale and north reference carry actual plotted units.
    const scaleLengthNm = compact ? 20 : 10;
    const scaleX = chart.x + 8;
    const scaleY = chart.y + chart.h - 7;
    plateLine(ctx, { x: scaleX, y: scaleY },
      { x: scaleX + scaleLengthNm * scale, y: scaleY }, {
        weight: compact ? 0.55 : 0.75,
      });
    plateDataText(ctx, `${scaleLengthNm} nm`, scaleX, scaleY - (compact ? 7 : 8), {
      size: compact ? 7.5 : 8,
    });
    const northX = detailRect
      ? chart.x + (compact ? 9 : 13)
      : chart.x + chart.w - (compact ? 9 : 13);
    plateVector(ctx, { x: northX, y: chart.y + (compact ? 18 : 25) },
      { x: northX, y: chart.y + (compact ? 7 : 9) }, {
        weight: compact ? 0.55 : 0.75,
        head: compact ? 2.5 : 3.2,
      });
    plateText(ctx, 'N', northX, chart.y + (compact ? 3 : 4), {
      size: compact ? 7.5 : 8,
      align: 'center',
    });

    if (detailRect) {
      drawCockedHatDetail(ctx, lines, points, { scale, toPx }, detailRect, {
        leaderFraction: 0.24,
      });
    }

    plateRule(ctx, ruleY, 14, w - 14);
    if (compact) {
      plateDataText(ctx, 'FROM AP: MOVE a ALONG Zn · DRAW LOP ⟂ Zn',
        w / 2, ruleY + 11, {
          size: 8,
          weight: 600,
          align: 'center',
        });
    } else {
      plateText(ctx, 'HOW TO PLOT EACH SIGHT', 16, ruleY + 13, {
        size: 9,
        underline: true,
      });
      plateDataText(ctx, 'FROM AP, MOVE THE SIGNED INTERCEPT TOWARD OR AWAY ALONG Zn',
        16, ruleY + 36, {
          size: 8,
      });
      plateDataText(ctx, 'THEN DRAW THE LOP PERPENDICULAR TO Zn',
        16, ruleY + 57, {
          size: 8,
        });
    }
  }

  function collectLines() {
    const lines = [];
    state.sights.forEach((s, i) => {
      if (!s.taken) return;
      const sight = STARS[i];
      const zn = sight.zn * D2R;
      const u = { x: Math.sin(zn), y: Math.cos(zn) };
      lines.push({
        I: { x: s.a * u.x, y: s.a * u.y },
        dir: { x: -u.y, y: u.x },
        u,
        sight,
      });
    });
    return lines;
  }

  function hatPoints(lines) {
    if (lines.length !== 3) return [];
    const pts = [];
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const p = lineIntersect(lines[i], lines[j]);
        if (p) pts.push(p);
      }
    }
    return pts.length === 3 ? pts : [];
  }

  function centroid(pts) {
    return {
      x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length,
      y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length,
    };
  }

  function drawCockedHatDetail(ctx, lines, points, chart, box, options = {}) {
    if (lines.length !== 3 || points.length !== 3) return null;
    const mainScale = Math.abs(Number(chart.scale));
    if (!Number.isFinite(mainScale) || mainScale <= 0) return null;

    const accent = PLATE.ink;
    const background = PLATE.paper;
    const frame = PLATE.ink;
    const connector = PLATE.ink;
    const stackedTitle = box.w < 176;
    const titleSize = stackedTitle ? 8 : 8.5;
    const titleH = stackedTitle ? 29 : 22;
    const plot = {
      x: box.x + 6,
      y: box.y + titleH + 4,
      w: box.w - 12,
      h: box.h - titleH - 10,
    };
    if (plot.w < 16 || plot.h < 16) return null;

    const center = centroid(points);
    const halfX = Math.max(...points.map(point => Math.abs(point.x - center.x)), 1e-6);
    const halfY = Math.max(...points.map(point => Math.abs(point.y - center.y)), 1e-6);
    const fitScale = Math.min(
      plot.w * 0.29 / halfX,
      plot.h * 0.29 / halfY
    );
    const magnification = Math.max(1, Math.round(fitScale / mainScale));
    const detailScale = mainScale * magnification;
    const toDetail = point => ({
      x: plot.x + plot.w / 2 + (point.x - center.x) * detailScale,
      y: plot.y + plot.h / 2 - (point.y - center.y) * detailScale,
    });

    // The elbow begins at the true chart-scale center; only the boxed view
    // changes scale.
    const source = chart.toPx(center);
    const anchorY = box.y + box.h * (options.leaderFraction ?? 0.24);
    const anchor = { x: box.x, y: anchorY };
    const elbow = { x: box.x - 8, y: anchorY };
    ctx.save();
    ctx.strokeStyle = connector;
    ctx.fillStyle = connector;
    ctx.lineWidth = 0.65;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(anchor.x, anchor.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(source.x, source.y, 1.3, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = frame;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + titleH);
    ctx.lineTo(box.x + box.w, box.y + titleH);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y, plot.w, plot.h);
    ctx.clip();

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = accent;
    ctx.beginPath();
    points.forEach((point, index) => {
      const projected = toDetail(point);
      if (index === 0) ctx.moveTo(projected.x, projected.y);
      else ctx.lineTo(projected.x, projected.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const reach = Math.hypot(plot.w, plot.h) / detailScale;
    for (const line of lines) {
      const lengthSquared = line.dir.x * line.dir.x + line.dir.y * line.dir.y || 1;
      const along = ((center.x - line.I.x) * line.dir.x
        + (center.y - line.I.y) * line.dir.y) / lengthSquared;
      const nearCenter = {
        x: line.I.x + line.dir.x * along,
        y: line.I.y + line.dir.y * along,
      };
      const first = toDetail({
        x: nearCenter.x - line.dir.x * reach,
        y: nearCenter.y - line.dir.y * reach,
      });
      const second = toDetail({
        x: nearCenter.x + line.dir.x * reach,
        y: nearCenter.y + line.dir.y * reach,
      });
      ctx.strokeStyle = PLATE.ink;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(second.x, second.y);
      ctx.stroke();
    }

    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1.15;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((point, index) => {
      const projected = toDetail(point);
      if (index === 0) ctx.moveTo(projected.x, projected.y);
      else ctx.lineTo(projected.x, projected.y);
    });
    ctx.closePath();
    ctx.stroke();
    for (const point of points) {
      const projected = toDetail(point);
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, 1.25, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    const titleLines = stackedTitle
      ? ['COCKED HAT', `MAGNIFIED ×${magnification}`]
      : [`COCKED HAT · MAGNIFIED ×${magnification}`];
    titleLines.forEach((text, index) => {
      const y = stackedTitle ? box.y + 9 + index * 11 : box.y + titleH / 2;
      plateText(ctx, text, box.x + box.w / 2, y, {
        size: titleSize,
        weight: 600,
        tracking: stackedTitle ? 0 : titleSize * 0.035,
        align: 'center',
      });
    });

    return { magnification, plot };
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
