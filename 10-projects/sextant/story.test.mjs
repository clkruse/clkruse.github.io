import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./story.js', import.meta.url), 'utf8');
const document = {
  body: { appendChild() {} },
  addEventListener() {},
  dispatchEvent() {},
  querySelectorAll() { return []; },
  createElement() {
    return {
      className: '',
      id: '',
      dataset: {},
      setAttribute() {},
    };
  },
};
const context = vm.createContext({
  console,
  document,
  CustomEvent: class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  },
  Element: class Element {},
  CSS: { escape: value => value },
  fmtDM: value => String(value),
});
vm.runInContext(source, context, { filename: 'story.js' });

const story = context.SIGHT_STORY;
const sight = story.state;
const close = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`);

// Raw sight to corrected altitude.
close(
  sight.hs + (sight.indexCorrectionMin - sight.dipMin - sight.refractionMin) / 60,
  sight.ho,
  1e-12,
  'Hs → Ho'
);

// Corrected altitude to zenith distance and navigation-sphere radius.
close(90 - sight.ho, sight.z, 1e-12, 'Ho → z');
close(sight.z * 60, sight.radiusNm, 1e-12, 'z → nautical miles');

// Dated Aries increment plus Vega catalog entry.
const elapsed = sight.utcHours - sight.baseUtcHours;
close(
  sight.ghaAriesAtBase + elapsed * sight.stellarRate,
  sight.ghaAries,
  1e-12,
  'UTC → GHA Aries'
);
close((sight.ghaAries + sight.sha) % 360, sight.gha, 1e-12, 'Aries + SHA → GHA Vega');

// Independent spherical sight reduction at the assumed position.
const toRad = value => value * Math.PI / 180;
const toDeg = value => value * 180 / Math.PI;
const lat = toRad(sight.assumed.lat);
const dec = toRad(sight.dec);
const lha = toRad((sight.gha + sight.assumed.lon + 360) % 360);
const hc = toDeg(Math.asin(
  Math.sin(lat) * Math.sin(dec)
  + Math.cos(lat) * Math.cos(dec) * Math.cos(lha)
));
close(hc, sight.hc, 1e-12, 'spherical Hc');
const dLon = toRad(sight.gp.lon - sight.assumed.lon);
const zn = (toDeg(Math.atan2(
  Math.sin(dLon) * Math.cos(dec),
  Math.cos(lat) * Math.sin(dec)
    - Math.sin(lat) * Math.cos(dec) * Math.cos(dLon)
)) + 360) % 360;
close(zn, sight.zn, 1e-12, 'spherical Zn');

// Independent USNO Celestial Navigation API result for this exact time/AP.
// The model begins with printed 0.1′ almanac values, so allow 0.12′ here.
const usno = {
  ghaAries: 46.67868414249825,
  gha: 127.212405,
  dec: 38.811686,
  hc: 42.44984,
  zn: 18.820552,
};
for (const key of Object.keys(usno)) {
  close(sight[key], usno[key], 0.002, `USNO ${key}`);
}

// Intercept sign and displayed tenth-minute values.
close(60 * (sight.ho - sight.hc), sight.interceptMin, 1e-12, '60 × (Ho − Hc)');
assert.equal(sight.direction, 'toward');
assert.equal(sight.ho.toFixed(3), '42.501');
assert.equal(sight.z.toFixed(3), '47.499');
assert.equal(sight.gha.toFixed(3), '127.213');
assert.equal(sight.hc.toFixed(3), '42.452');
assert.equal(sight.interceptMin.toFixed(1), '3.0');

// Reset is deterministic after arbitrary exploration.
story.set({ hs: 20, utcHours: 12 }, { source: 'test' });
story.reset({ source: 'test-reset' });
assert.deepEqual(
  JSON.parse(JSON.stringify(story.state)),
  JSON.parse(JSON.stringify(sight))
);

console.log('worked sight numerical assertions passed');
