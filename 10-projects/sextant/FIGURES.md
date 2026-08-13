# Figure spec: technical diagrams for the sextant explainer

How to build an interactive canvas figure that matches the rest of this page. The Dieter Rams
page spec governs everything around the canvas (type, rules, page color); this spec governs
everything inside it. The reference implementation is `demoAltitude` in `app.js`: read it first,
match its standard.

## 1. Architecture

* one figure per file in `demos/`, loaded by its own `<script defer>` tag after `app.js`
* all files are classic scripts sharing global scope; helpers, palette, and scaffolding come
  from `app.js`
* register the figure in three places: a `<figure class="demo" id="demo-name">` block in
  `index.html` (canvas + empty `.demo-controls` + figcaption), a script tag, and the `figIds`
  list in `app.js`'s layout controller so the scroll-spy panel knows it
* `createDemo(id, {aspect, maxH, draw})` handles sizing, DPR, theme, and the render loop; the
  draw callback runs every frame while visible
* `demos/world.js` holds shared coastline data for globe figures: `const LAND`, simplified
  Natural Earth 110m land as flat `[lon,lat,lon,lat,...]` polylines in degrees, with the
  super-continents split at Suez and Panama (stroke draws the stored polylines as-is, so the
  cut edges never get a drawn coastline; fill closes them implicitly). The renderer is the
  shared `globeView` + `drawGlobeBase` in `app.js` (used by demo-gp, demo-circle and
  demo-twostar): orthographic projection, fold-out fill (hidden points at `r = 2 - sin c`
  inside a circular clip – naive limb-clamping smears giant false fills), a spherical
  ray-cast per ring to detect the view antipode inside it (which would invert the fill;
  corrected with an opposite-orientation outer loop), and great-circle subdivision with an
  outer arc-walk for edges that pass hard by the antipode. Verify any globe change with a
  scripted all-azimuth sweep at several tilts measuring white-pixel jumps (see the
  `canvas._spin` QA hook in demo-gp)
* controls: `addSlider`, `addStat` (values in ink; red is reserved for slider numerals),
  `addButton`, `addCheck`; dragging via `addDrag`
* the canvas must paint its own `P.paper` ground: the panel behind it is paper and figures must
  invert cleanly with the theme
* figures live in a sticky side panel on desktop; `createDemo` caps canvas height against the
  viewport, so design for variable aspect, not a fixed frame

## 2. Line system

Semantic weights, never decorative:

| line | use |
|---|---|
| 2px `P.ink` | the object: a planet's limb, an instrument frame, a plotted curve |
| 1px `P.ink` / `P.inkSoft` | construction: horizons, zeniths, axes |
| 0.9px | dimensions, extension ticks, leaders |
| dash-dot via `centerline()` | axes of symmetry and collinearity |
| plain dash `[5,4]` | reference lines that carry no light or material |

Flat fills only. No gradients, glows, shadows, or rounded decoration anywhere. Solids are
`P.paperDeep` with an ink edge. Shaded regions (a night side) use 45° hatching with a boundary
line, not a dark wash.

## 3. Dimensioning and annotation

* angles: `angleDim(ctx, cx, cy, r, a1, a2, color)`; distances: extension ticks + an offset
  dimension line/arc with `dimHead` arrowheads; right angles: `rightAngleMark`
* every named part gets `leaderNote` (thin leader, dot on target, horizontal text) or sits at
  the end of its own line; no floating labels
* points are `pointMark`; text 10.5 to 11.5px via `label`, always with a `halo` matching the
  local ground
* letters on the drawing, values in the readout bar; a full `x = value` label only where there
  is clearly room
* one quantity, one color, everywhere it appears; repetition in the same color IS the pedagogy

## 4. Color

Read live from CSS variables; both themes must be verified.

| role | token |
|---|---|
| structure | `P.ink`, `P.inkSoft`, `P.line`, `P.paper`, `P.paperDeep` |
| the measured quantity | `P.s2` ink blue |
| its derived counterpart | `P.s1` crimson |
| the sun and its family | `P.s3` signal orange, always |
| success states | `P.green` |
| page wayfinding (slider numerals, sparing error marks) | `P.red` |

Grounds are paper in every figure; only the hero banner is a night scene. The sun is routinely
the single colored element in an otherwise grayscale drawing, and that is correct.

## 5. Degradation rules

Figures are interactive, so every mark must survive its worst slider value:

* `angleDim` scales its arrowheads down with the arc and degrades to a bare arc below 14px;
  nothing ever draws outside the span. The classic flip-arrows-outside convention is BANNED for
  angles: an angle's rays are not extension lines, so protruding marks read as a wider angle
  (owner ruling, 2026-08)
* when geometry collapses (observer near GP, mirror at zero), drop redundant marks, shorten
  lines, collapse value labels to letters; see the `tiny`/`crowded` handling in `demoAltitude`
* labels that can collide at extremes get placement rules (side-stepping, align flips, leader
  mirroring), found by testing extremes, not by guessing

## 6. Rulings, with reasons

Case law from owner review; follow it before rediscovering it:

* a body at infinity has a direction, not a position. Either run its direction lines off the
  canvas unmarked, or pin the glyph to ONE line that points at it – the observer's own sight
  line reads best, since that is the line being measured (owner's call, 2026-08). Never place
  the glyph where a second line would visibly fail to point at it; if two parallel lines both
  point at the star, label them both ("to the North Star" / "to the North Star, too") so the
  parallelism is stated, not left to confuse
* the angle between two nearly parallel lines is dimensioned as the linear gap between their far
  ends (see refraction's R), never as an arc floating mid-span
* interactive arrows keep a fixed length; a length that varies with state reads as meaning
* instruments must read as solid joined objects: closed outlines with capped ends, members
  meeting at hubs and landing flush, never floating strokes (see the sextant frame)
* the same entity keeps the same name across panes and figures ("you", "GP")
* draggable things say so: "you – drag", "star – drag"

## 7. Pedagogy, which is part of the spec

Before building, answer three questions (owner's criteria):

1. does the figure clearly make its one point to someone who knows nothing about navigation?
2. is it vitally expository, not gratuitous? If the text alone carries the claim, cut the figure
3. would the section be clearer with another figure? A formula asserted in prose usually wants
   its geometry drawn (see the noon cross-section)

Practices that follow: put the reader's first-person experience before the outside view when
both exist (the §1 dual pane); make a punchline visible, not just stated in a readout (the clock's
false GP); exaggerations are allowed but must be labeled on the drawing ("shown ×100").

The established dual-view pattern (owner's sketch, 2026-08): measurement figures split into a
left "from the deck" pane and a right "from outside – the same moment" pane, sharing one state
that either side can drag. The left pane is a vertical height gauge – a graduated 0–90° scale
with an arrowhead, the horizon with sea hatching at zero, the star riding the scale, and the
altitude drawn as a linear dimension. See `demoAltitude` (app.js) and `demos/polaris.js`.

## 8. Verification, non-negotiable

* `node --check` the file; zero page errors in the browser
* screenshot both color schemes AND the interaction extremes (slider ends, aligned states,
  degenerate geometry); look at the screenshots critically for collisions before calling it done
* serve with `python3 -m http.server 8123` from the repo root; drive with playwright-core plus
  local Chrome. Figures hide in the desktop side panel until active, so scroll the text column
  to the figure's anchor first:

```js
await page.evaluate(() => {
  const ls = document.querySelector('.left-scroll');
  const el = document.querySelector('.fig-anchor[data-fig=demo-name]');
  ls.scrollTop += el.getBoundingClientRect().top - ls.getBoundingClientRect().top - ls.clientHeight * 0.7;
});
```

* copy rule from the page spec applies to canvas strings too: no em dash U+2014, en dash allowed
