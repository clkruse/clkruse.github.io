'use strict';
/* §06: why the almanac stays small. It tabulates one racing number
   (GHA Aries); each star keeps a nearly fixed catalog offset (SHA), so a
   star's GHA is one addition. Declination stays separate as the GP's
   latitude. Hour angles run westward from Greenwich. */

(function demoAlmanac() {
  const d = createDemo('demo-almanac', {
    aspect: 1.31,
    maxH: 500,
    compactAspect: 1.22,
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
  const ariesStat = addStat(d, 'GHA Aries');
  const sumStat = addStat(d, 'GHA Vega = Aries + SHA', true);
  const decStat = addStat(d, 'Vega declination');

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

  function setReadouts(s) {
    ariesStat.set(fmtDM(s.ghaAries, 1));
    sumStat.set(s.wrapped
      ? `${fmtDM(s.ghaAries, 1)} + ${fmtDM(VEGA_SHA, 1)} − 360° = ${fmtDM(s.ghaVega, 1)}`
      : `${fmtDM(s.ghaAries, 1)} + ${fmtDM(VEGA_SHA, 1)} = ${fmtDM(s.ghaVega, 1)}`);
    decStat.set(`${fmtDM(VEGA_DEC, 1)} N`);
  }

  function draw(ctx, w, h) {
    const s = almanacState();
    drawCatalogCompressor(ctx, w, h, s);
    setReadouts(s);
  }

  function drawCatalogCompressor(ctx, w, h, s) {
    ctx.fillStyle = PLATE.paper;
    ctx.fillRect(0, 0, w, h);

    const compact = w < 500 || h < 350;
    const titleSize = compact ? 8.5 : 11;
    const bodySize = compact ? 8 : 9.2;
    const dataSize = compact ? 8 : 9.5;
    const pad = compact ? 8 : 14;
    const definitionsY = compact ? 30 : 50;
    const definitionsH = compact ? 62 : 84;
    const lookupY = definitionsY + definitionsH + (compact ? 7 : 25);
    const workY = lookupY + (compact ? 11 : 30);
    const workH = compact ? 65 : 140;
    const declinationY = workY + workH + (compact ? 6 : 24);
    const summaryRuleY = compact ? declinationY + 18 : declinationY + 30;

    plateText(ctx, 'One Aries lookup, then add Vega’s SHA', w / 2,
      compact ? 11 : 15, {
        size: titleSize, weight: 600, tracking: titleSize * 0.12, align: 'center',
      });
    plateRule(ctx, compact ? 25 : 32, 14, w - 14);

    plateBox(ctx, pad, definitionsY, w - pad * 2, [
      {
        text: 'GHA: ANGLE WEST FROM GREENWICH.',
        font: PLATE.dataFont,
        tracking: 0,
      },
      {
        text: 'GHA ARIES: ONE CHANGING VALUE FOR EVERY STAR.',
        font: PLATE.dataFont,
        tracking: 0,
      },
      {
        text: 'SHA: EACH STAR’S OWN OFFSET FROM ARIES.',
        font: PLATE.dataFont,
        tracking: 0,
      },
      {
        text: 'DECLINATION: THE GP’S LATITUDE.',
        font: PLATE.dataFont,
        tracking: 0,
      },
    ], {
      title: 'WHY ONE LOOKUP WORKS',
      size: bodySize,
      lineHeight: compact ? 9 : 12.5,
      padding: compact ? 6 : 7,
      height: definitionsH,
    });

    plateDataText(ctx, compact
      ? `${utcText(gmt)} UTC · look up GHA Aries ${fmtDM(s.ghaAries, 1)}`
      : `${DATE_LABEL} · ${utcText(gmt)} UTC · look up GHA Aries ${fmtDM(s.ghaAries, 1)}`,
    w / 2, lookupY, {
      size: compact ? 8 : 10, weight: 600, align: 'center',
    });

    const workLines = [
      {
        text: `GHA ARIES     ${fmtDM(s.ghaAries, 1)}`,
        font: PLATE.dataFont, tracking: 0,
      },
      {
        text: `+ VEGA SHA    ${fmtDM(VEGA_SHA, 1)}`,
        font: PLATE.dataFont, tracking: 0,
      },
      ...(s.wrapped ? [{
        text: '− FULL TURN   360°',
        font: PLATE.dataFont, tracking: 0,
      }] : []),
      {
        text: `= GHA VEGA    ${fmtDM(s.ghaVega, 1)}`,
        weight: 600, font: PLATE.dataFont, tracking: 0,
      },
    ];
    const workW = compact ? w - pad * 2 : w * 0.66;
    const workX = (w - workW) / 2;
    plateBox(ctx, workX, workY, workW, workLines, {
      title: 'WORKED VEGA ADDITION',
      size: compact ? 8 : 10.5,
      lineHeight: compact ? 9 : 24,
      padding: compact ? 6 : 7,
      height: workH,
      font: PLATE.dataFont,
    });

    if (compact) {
      plateDataText(ctx, `Vega declination ${fmtDM(VEGA_DEC, 1)} N`,
        w / 2, declinationY, {
          size: dataSize, align: 'center',
        });
      plateDataText(ctx, `gives GP latitude ${fmtDM(VEGA_DEC, 1)} N`,
        w / 2, declinationY + 10, {
          size: dataSize, align: 'center',
        });
    } else {
      plateDataText(ctx,
        `Vega declination ${fmtDM(VEGA_DEC, 1)} N → GP latitude ${fmtDM(VEGA_DEC, 1)} N`,
        w / 2, declinationY, {
          size: 10, align: 'center',
        });
    }

    plateRule(ctx, summaryRuleY, 14, w - 14);
    if (compact) {
      plateDataText(ctx,
        `Sirius SHA ${fmtDM(s.stars[1].sha, 1)} → GHA ${fmtDM(s.stars[1].gha, 1)}`,
        w / 2, summaryRuleY + 10, {
          size: dataSize, align: 'center',
        });
      plateDataText(ctx,
        `Capella SHA ${fmtDM(s.stars[2].sha, 1)} → GHA ${fmtDM(s.stars[2].gha, 1)}`,
        w / 2, summaryRuleY + 22, {
          size: dataSize, align: 'center',
        });
    } else {
      plateText(ctx, 'TWO MORE STARS AT THIS UTC',
        w / 2, summaryRuleY + 18, {
          size: bodySize, weight: 600, align: 'center',
        });
      plateDataText(ctx,
        `Sirius: SHA ${fmtDM(s.stars[1].sha, 1)} → GHA ${fmtDM(s.stars[1].gha, 1)}`,
        w / 2, summaryRuleY + 42, {
          size: dataSize, align: 'center',
        });
      plateDataText(ctx,
        `Capella: SHA ${fmtDM(s.stars[2].sha, 1)} → GHA ${fmtDM(s.stars[2].gha, 1)}`,
        w / 2, summaryRuleY + 66, {
          size: dataSize, align: 'center',
        });
    }
  }
})();
