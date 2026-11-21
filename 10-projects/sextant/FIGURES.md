# Figure spec: building figures for the sextant explainer

How to build, place, and check an interactive figure on this page. Two documents divide the work:

* [`DIAGRAM_STYLE.md`](DIAGRAM_STYLE.md) governs everything drawn on the canvas: line
  vocabulary, labels, canvas type, monochrome ink. When the two disagree about how a figure
  looks, it wins.
* this document governs the machinery around the drawing: file structure, controls and
  caption, placement in the article, steady numbers, presets, and verification.

The page typography outside figures (body text, headings, rules) lives in `style-original.css`;
tokens, layout, and the figure frame live in `style.css`. There is one presentation; the old
`?typography=typeset` variant was removed (2026-11). The figure frame (controls and caption) belongs to the
figure and is set in the plate faces, so a figure reads as one object.

Good small references: `demos/sightline.js` (one drag, one slider, labeler, compact layout) and
`demos/walk.js` (two linked panes). For a dense, many-state figure, read `demos/globes.js`.

The earlier color and A/B/C treatments are preserved on the git branch
`sextant-figure-variants-archive` for reference only.

## 1. Architecture

* one figure per file in `demos/`, loaded by its own `<script defer>` tag after `app.js`,
  `story.js`, and any shared data it needs (`demos/world.js` for globes)
* all files are classic scripts sharing global scope; helpers and scaffolding come from
  `app.js`
* a figure needs two things: a script tag, and a block in `index.html`:

  ```html
  <figure class="demo" id="demo-name">
    <div class="demo-panel">
      <canvas></canvas>
      <div class="demo-controls"></div>
    </div>
    <figcaption><span class="fig-title">Short title</span> One or two sentences, sentence case.</figcaption>
  </figure>
  ```

  Nothing else registers it: captions are numbered and laid out from the markup alone.
* `createDemo(id, {aspect, maxH, compactAspect, compactMaxH, draw})` handles sizing, DPR,
  theme, and the render loop; `draw(ctx, w, h)` runs every frame while visible. The compact
  sizes apply when the canvas is narrower than 500 CSS px. Height is capped so the canvas plus
  its controls fit one screen, so design for a variable aspect, not a fixed frame.
* the canvas paints its own `PLATE.paper` ground every frame
* each figure has exactly one treatment
* globes use the shared `globeView` + `drawGlobeBase` renderer in `app.js` with the coastline
  data in `demos/world.js` (Natural Earth 110m land as flat `[lon,lat,...]` polylines, split at
  Suez and Panama). The renderer already handles far-side fills, the view antipode, and edges
  that pass near it; after changing it, sweep the view through every azimuth at several tilts
  and look for fills that jump.

## 2. Placement in the article

* the owner's draft, `Celestial Navigation.md`, is the source of truth for the text.
  `index.html` mirrors it section by section. Copy stays faithful: fix typos, flag factual
  slips to the owner instead of rewriting them.
* `<Figure ...>` notes in the draft say what a figure should show. Where the draft has no note,
  place figures where the argument needs them.
* figures the draft does not use yet live in section B, "Figures not yet in the draft", each
  under a numbered `h3.sub` head (B.1, B.2 …) that states its point
* the page is one column on every screen, set like an engineering handbook (style-original.css,
  "Document layout"). A left margin column holds section numbers, term definitions and figure
  captions; paragraphs keep a reading measure; figures reach 8rem past the text on wide
  screens. Put each figure right after the paragraph that introduces it.
* section heads are `<h2 id><span class="sec-no">3.0</span><span class="sec-title">…</span></h2>`;
  part openers are `h2.part-title` with "Part one" as their `.sec-no`. (A contents list in
  the left gutter was tried and removed as too distracting; it is in commit 6960c6d.)
* a term definition is `<aside class="gloss"><span class="gloss-term">Term</span>One line.</aside>`
  placed immediately BEFORE the paragraph that introduces the term; it sits beside that
  paragraph in the margin (and above it on phones). Keep it to a line or two, and only for
  terms the reader needs again later. The definitions are not in the draft: the owner reviews them.
* a takeaway is a `div.note` with a `span.note-label` ("Note") and a paragraph, a ruled box
  like a checklist caution
* every figure's title is the `span.fig-title` that opens its caption, set bold under the
  "Figure 1-2" number (inline after it on phones), the way a NASA technical report sets
  "Figure 2-4. Title". Do not draw a figure-level title on the canvas; headings for panes or stages inside
  a figure are fine.
* captions are numbered automatically, NASA style: `app.js` sets `data-no` to the section
  number and the figure's count within that section ("1-2", "B-3"), and CSS prints
  "Figure 1-2". Part openers don't count as sections. Do not type numbers into captions.

## 3. Controls and readouts

Everything below the canvas is part of the figure and follows the plate: monochrome ink and
the plate face, Jost (`--font-plate`), in tracked caps for labels and with tabular figures for
values (`--font-plate-data`, the same face). `createDemo` makes three groups inside `.demo-controls`, always in this order:

| group | filled by | holds |
|---|---|---|
| `.ctl-rows` | `addSlider` | one row per slider: label, range, value |
| `.ctl-actions` | `addButton`, `addCheck` | buttons and toggles on one line |
| `.ctl-readouts` | `addStat(d, label, wide)` | a strip of label-over-value cells; `wide` for sentences |

Rules:

* a readout must earn its place: never repeat a value the canvas already labels, or a slider
  value. If the drawing shows it, delete the readout.
* `stat.set(text, color)` ignores the hue. Passing any color marks the readout as flagged
  (bold value), for a warning or a completed state. There is no red, green, or orange in the
  figure frame.
* slider labels name the quantity in plain words ("line of sight", "distance from the GP"),
  not a symbol alone
* `addSlider(...).set(value, {emit: true})` is the explicit programmatic-change contract.
  Omit `emit` when synchronizing a control from shared state; emit only when the change should
  behave like user input. This prevents update loops.
* dragging on the canvas uses `addDrag`; a draggable canvas says so in a short plate line
  ("DRAG THE LINE OF SIGHT") on desktop

## 4. Steady numbers and labels

A figure under interaction should look like an instrument, not like a page re-flowing. Every
change a reader sees should be the thing they moved.

* **fixed precision per quantity.** Choose one number of decimal places for each value and
  keep it at every state. Never let `toFixed` or `fmtDM` drop or add decimals as the value
  changes. Match the slider `step` to the displayed precision: a slider showing whole degrees
  steps by 1.
* **tabular digits.** `plateText` and `plateDataText` draw every digit on the width of a `0`,
  so a changing number keeps its width and centered text does not wobble. Keep text that
  contains a live number in those helpers.
* **labels hold their seat.** `createPlateLabeler` remembers which candidate each label used on
  the previous frame (keyed by its text, with numbers ignored) and keeps it while it is still
  collision-free. A label moves only when its seat becomes blocked, and then it moves in one
  step. Do not animate or ease labels between positions; gliding reads as imprecise.
* **give the same label the same text.** If a label's wording changes with state, the labeler
  treats it as a new label and its seat resets. Pass `opts.key` when the wording must change
  but the label is the same thing.
* **hand-placed labels that flip sides at a threshold** (left of a point below some value,
  right above it) flip once, cleanly; do not add intermediate positions

## 5. Presets and starting state

* register curated states with `d.addPreset(name, apply)`. A preset restores one meaningful,
  fully explained state, not a slider position for its own sake.
* `data-initial-preset="name"` on the `<figure>` applies that preset on load (story.js), so a
  figure can open on the state its paragraph describes
* prose buttons with `data-demo-preset="name"` can still drive a preset (story.js handles the
  click). The current article does not use them.
* a figure never opens on an empty or degenerate state. A staged exercise seeds one completed
  construction or a restrained preview.

## 6. Shared sight state

`story.js` defines `SIGHT_STORY`, one dated Vega sight (19 August 2026, 05h UTC) with almanac
inputs, corrections, and an assumed position. Many bench figures and several article figures
subscribe to it. Subscribe only for quantities the figure actually represents, and keep every
subscription loop-safe.

The §10 worked example (`demos/worked.js`) follows the owner's draft and carries its own
numbers (GHA Aries 309° 10.0′ at the draft's hour). It does not read `SIGHT_STORY`. If the
article later wants one sight to thread every figure, reconcile the two first.

## 7. Rulings, with reasons

Case law from owner review; follow it before rediscovering it:

* a body at infinity has a direction, not a position. Either run its direction lines off the
  canvas unmarked, or pin the glyph to ONE line that points at it; the observer's own sight
  line reads best, since that is the line being measured. If two parallel lines both point at
  the star, label them both ("to the North Star" / "to the North Star, too").
* the angle between two nearly parallel lines is dimensioned as the linear gap between their
  far ends (see refraction's R), never as an arc floating mid-span
* angle dimensions never draw outside their span; `angleDim` shrinks its heads and degrades to
  a bare arc below 14 px. Flipping arrows outside the angle is banned: it reads as a wider angle.
* interactive arrows keep a fixed length; a length that varies with state reads as meaning
* instruments read as solid joined objects: closed outlines with capped ends, members meeting
  at hubs and landing flush, never floating strokes (see the sextant frame)
* the same entity keeps the same name across panes and figures ("you", "GP")
* label gliding was tried and rejected (owner, 2026-11): it felt slippery against the
  precision of the drawings. Labels hold still or move in one step.

## 8. Pedagogy, which is part of the spec

Before building, answer three questions (owner's criteria):

1. does the figure clearly make its one point to someone who knows nothing about navigation?
2. is it vitally expository, not gratuitous? If the text alone carries the claim, cut the figure.
3. would the section be clearer with another figure? A formula asserted in prose usually wants
   its geometry drawn (see the noon cross-section).

Practices that follow:

* put the reader's first-person view before the outside view when both exist
  (`demos/walk.js`: "what you see" beside the globe section)
* make a punchline visible on the drawing, not just stated in a readout
* exaggerations are allowed but are labeled on the drawing ("shown ×100")
* interaction can reveal evidence or permit exploration, but it never gates the next paragraph;
  the article must read completely without clicking
* measurement figures may pair a first-person pane (what the observer sees, or a deck height
  gauge) with an outside pane showing the same moment, driven by one shared state that either
  side can change. See `demos/walk.js` and `demos/polaris.js`; `deckGaugeLayout` in `app.js`
  lays out the gauge.

## 9. Verification, non-negotiable

Scale the check to the change. A small visual tweak (a line weight, a label's wording, a size)
needs only `node --check`; the owner judges it on reload. The full routine below is for new
figures and for changes to layout or label placement.

* `node --check` the file; zero page errors in the browser
* screenshot both color schemes, desktop (1440) and phone (390 and 320), and the interaction
  extremes: slider ends, aligned states, degenerate geometry. Look at the screenshots
  critically for collisions before calling it done.
* sweep every slider end to end, one step at a time, and watch for flicker: a label that hops
  back and forth between seats on neighboring steps, or a number whose decimal count changes.
  Either is a bug. One clean move when a label's seat becomes blocked is expected.
* a figure is incomplete if it loses its interaction or relies on the caption to explain its
  punchline
* serve with the launch config in `.claude/launch.json` (a no-cache server on port 8123 from the
  repo root; a normal reload always picks up edits). Drive with playwright-core plus local
  Chrome; the page scrolls normally, so `element.scrollIntoViewIfNeeded()` reaches any figure.
  Check figures at the widths they actually take: about 718px (1440 window), 584px (900
  window) and 353px (390 phone).

* the copy rule applies to canvas strings, captions, and readouts too: no em dash (U+2014)
