'use strict';

/* One dated, internally consistent sight threads the article together.
   Almanac inputs are rounded to the printed 0.1′ precision of the 2026
   Nautical Almanac for 19 August:
     05h GHA Aries 42°34.0′, Vega SHA 80°32.1′, Dec 38°48.6′ N.
   The 16m24s increment uses the mean-solar sidereal rate. The USNO
   Celestial Navigation API independently returns, at the exact time and AP,
   GHA Aries 46.678684°, Vega GHA 127.212405°, Dec 38.811686° N,
   Hc 42.449840°, and Zn 18.820552°; printed-input reductions can differ
   from those higher-precision values by about 0.1′. */
const SIGHT_STORY = (() => {
  const SIDEREAL_DAY_HOURS = 23 + 56 / 60 + 4.1 / 3600;
  const STELLAR_RATE = 360 / SIDEREAL_DAY_HOURS;
  const wrap360 = value => ((value % 360) + 360) % 360;
  const wrap180 = value => ((value + 540) % 360) - 180;
  const rad = degrees => degrees * Math.PI / 180;
  const deg = radians => radians * 180 / Math.PI;

  const defaults = Object.freeze({
    date: '2026-08-19',
    body: 'Vega',
    baseUtcHours: 5,
    utcHours: 5 + 16 / 60 + 24 / 3600,
    ghaAriesAtBase: 42 + 34 / 60,
    sha: 80 + 32.1 / 60,
    dec: 38 + 48.6 / 60,
    hs: 42 + 34 / 60,
    indexCorrectionMin: 0.2,
    eyeHeightM: 3,
    assumedLat: -(5 + 47.406 / 60),
    assumedLon: -145,
    sightUncertaintyMin: 1,
  });

  let input = { ...defaults };
  const listeners = new Set();

  function refractionMinutes(apparentAltitude) {
    if (apparentAltitude <= -0.5) return 0;
    return 1 / Math.tan(rad(apparentAltitude + 7.31 / (apparentAltitude + 4.4)));
  }

  function derive() {
    const dipMin = 1.76 * Math.sqrt(Math.max(0, input.eyeHeightM));
    const apparentLevel = input.hs + (input.indexCorrectionMin - dipMin) / 60;
    const refractionMin = refractionMinutes(apparentLevel);
    const ho = apparentLevel - refractionMin / 60;
    const z = 90 - ho;

    const ghaAries = wrap360(
      input.ghaAriesAtBase + (input.utcHours - input.baseUtcHours) * STELLAR_RATE
    );
    const gha = wrap360(ghaAries + input.sha);
    const gp = { lat: input.dec, lon: wrap180(-gha) };

    // Longitude is signed east. With GHA measured west, LHA = GHA + λE.
    const lha = wrap360(gha + input.assumedLon);
    const latR = rad(input.assumedLat);
    const decR = rad(input.dec);
    const lhaR = rad(lha);
    const sinH = Math.sin(latR) * Math.sin(decR)
      + Math.cos(latR) * Math.cos(decR) * Math.cos(lhaR);
    const hc = deg(Math.asin(Math.max(-1, Math.min(1, sinH))));

    // Initial bearing from the assumed position to the GP, clockwise from N.
    const dLon = rad(gp.lon - input.assumedLon);
    const y = Math.sin(dLon) * Math.cos(decR);
    const x = Math.cos(latR) * Math.sin(decR)
      - Math.sin(latR) * Math.cos(decR) * Math.cos(dLon);
    const zn = wrap360(deg(Math.atan2(y, x)));
    const interceptMin = (ho - hc) * 60;

    return Object.freeze({
      ...input,
      stellarRate: STELLAR_RATE,
      dipMin,
      apparentLevel,
      refractionMin,
      ho,
      z,
      radiusNm: z * 60,
      ghaAries,
      gha,
      gp,
      lha,
      hc,
      zn,
      interceptMin,
      interceptNm: Math.abs(interceptMin),
      direction: interceptMin >= 0 ? 'toward' : 'away',
      assumed: { lat: input.assumedLat, lon: input.assumedLon },
    });
  }

  function notify(source = 'story') {
    const state = derive();
    for (const listener of listeners) listener(state, source);
    document.dispatchEvent(new CustomEvent('story:change', {
      detail: { state, source },
    }));
  }

  function set(patch, { source = 'story' } = {}) {
    input = { ...input, ...patch };
    notify(source);
  }

  function reset({ source = 'reset' } = {}) {
    input = { ...defaults };
    notify(source);
  }

  function subscribe(listener, { immediate = true } = {}) {
    listeners.add(listener);
    if (immediate) listener(derive(), 'subscribe');
    return () => listeners.delete(listener);
  }

  function validate() {
    const s = derive();
    const expected = {
      ghaAries: 46.6779,
      gha: 127.2129,
      ho: 42.5011,
      hc: 42.4515,
      interceptMin: 2.9750,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (Math.abs(s[key] - value) > 0.002) {
        throw new Error(`Worked sight check failed for ${key}: ${s[key]} vs ${value}`);
      }
    }
    return true;
  }

  validate();
  return Object.freeze({
    defaults,
    constants: Object.freeze({
      stellarDayHours: SIDEREAL_DAY_HOURS,
      stellarRate: STELLAR_RATE,
    }),
    get state() { return derive(); },
    set,
    reset,
    subscribe,
    validate,
    refractionMinutes,
  });
})();
globalThis.SIGHT_STORY = SIGHT_STORY;

function storyClock(hours, includeSeconds = false) {
  const totalSeconds = Math.round((((hours % 24) + 24) % 24) * 3600);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    + (includeSeconds ? `:${String(ss).padStart(2, '0')}` : '');
}

function storySignedPosition(value, latitude) {
  const hemi = latitude ? (value < 0 ? 'S' : 'N') : (value < 0 ? 'W' : 'E');
  return `${fmtDM(Math.abs(value), 1)} ${hemi}`;
}

function storyValue(key, state) {
  const values = {
    body: state.body,
    date: '19 Aug 2026',
    utc: `${storyClock(state.utcHours, true)} UTC`,
    hs: fmtDM(state.hs, 1),
    index: `${state.indexCorrectionMin >= 0 ? '+' : '−'}${Math.abs(state.indexCorrectionMin).toFixed(1)}′`,
    dip: `−${state.dipMin.toFixed(1)}′`,
    refraction: `−${state.refractionMin.toFixed(1)}′`,
    ho: fmtDM(state.ho, 1),
    z: fmtDM(state.z, 1),
    radius: `≈ ${Math.round(state.radiusNm).toLocaleString('en-US')} nm`,
    ghaAries: fmtDM(state.ghaAries, 1),
    sha: fmtDM(state.sha, 1),
    gha: fmtDM(state.gha, 1),
    dec: storySignedPosition(state.dec, true),
    gp: `${storySignedPosition(state.gp.lat, true)} · ${storySignedPosition(state.gp.lon, false)}`,
    ap: `${storySignedPosition(state.assumed.lat, true)} · ${storySignedPosition(state.assumed.lon, false)}`,
    hc: fmtDM(state.hc, 1),
    zn: `${String(Math.round(state.zn)).padStart(3, '0')}°`,
    intercept: `${state.interceptMin >= 0 ? '+' : '−'}${Math.abs(state.interceptMin).toFixed(1)}′`,
    plot: `${Math.abs(state.interceptMin).toFixed(1)} nm ${state.direction}`,
  };
  return values[key] || '';
}

const storyLive = (() => {
  const node = document.createElement('div');
  node.className = 'sr-only';
  node.id = 'story-live';
  node.setAttribute('aria-live', 'polite');
  document.body.appendChild(node);
  return message => { node.textContent = message; };
})();

function renderStoryValues(state) {
  document.querySelectorAll('[data-sight-value]').forEach(node => {
    node.textContent = storyValue(node.dataset.sightValue, state);
  });
}
SIGHT_STORY.subscribe(renderStoryValues);

const STORY_PREDICTIONS = Object.freeze({
  ring: {
    answer: 'smaller',
    correct: 'Yes. Higher altitude means a smaller zenith distance, so the ring contracts toward Vega’s GP.',
    incorrect: 'The ring gets smaller: higher altitude means less zenith distance to Vega’s GP.',
  },
  intercept: {
    answer: 'toward',
    correct: 'Yes. Ho is 3.0′ greater than Hc, so plot 3.0 nautical miles toward Vega’s GP.',
    incorrect: 'Positive Ho − Hc is “toward”: plot 3.0 nautical miles toward Vega’s GP.',
  },
});

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const reset = target.closest('[data-story-reset]');
  if (reset) {
    SIGHT_STORY.reset();
    storyLive('Worked sight reset to Vega at 05:16:24 UTC.');
    return;
  }

  const predictionButton = target.closest('[data-prediction][data-answer]');
  if (predictionButton) {
    const card = predictionButton.closest('.prediction');
    const prediction = STORY_PREDICTIONS[predictionButton.dataset.prediction];
    if (!card || !prediction) return;
    const correct = predictionButton.dataset.answer === prediction.answer;
    card.querySelectorAll('[data-answer]').forEach(button => {
      button.setAttribute('aria-pressed', String(button === predictionButton));
    });
    const feedback = card.querySelector('.prediction-feedback');
    if (feedback) {
      feedback.hidden = false;
      feedback.dataset.correct = String(correct);
      feedback.textContent = correct ? prediction.correct : prediction.incorrect;
    }
    card.dataset.answered = 'true';
    storyLive(correct ? 'Correct. ' + prediction.correct : prediction.incorrect);
  }

  const presetButton = target.closest('[data-demo-preset]');
  if (presetButton) {
    const figureId = presetButton.dataset.figure;
    const preset = presetButton.dataset.demoPreset;
    const demo = figureId
      ? document.querySelector(`#${CSS.escape(figureId)} canvas`)?._demo
      : null;
    if (demo?.applyPreset(preset)) {
      document.dispatchEvent(new CustomEvent('story:activate-figure', {
        detail: { id: figureId },
      }));
      storyLive(`${figureId.replace(/^demo-/, '').replaceAll('-', ' ')} figure set to ${preset}.`);
    }
  }
});

// figures can open on a preset that matches the prose around them
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('figure.demo[data-initial-preset]').forEach(figure => {
    figure.querySelector('canvas')?._demo?.applyPreset(figure.dataset.initialPreset);
  });
});
