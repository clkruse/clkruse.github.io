(() => {
  const grid = document.getElementById("grid");
  const status = document.getElementById("status");
  const lightbox = document.getElementById("lightbox");
  const lbVideo = document.getElementById("lb-video");
  const lbCaption = document.getElementById("lb-caption");
  const lbClose = document.getElementById("lb-close");
  const lbPrev = document.getElementById("lb-prev");
  const lbNext = document.getElementById("lb-next");
  const lbScrubber = document.getElementById("lb-scrubber");
  const lbTicks = document.getElementById("lb-ticks");
  const lbPlot = document.getElementById("lb-plot");
  const lbPlotLine = document.getElementById("lb-plot-line");
  const lbPlotFill = document.getElementById("lb-plot-fill");
  const lbPlotCursor = document.getElementById("lb-plot-cursor");
  const lbGlints = document.getElementById("lb-glints");
  const lbLegend = document.getElementById("lb-legend");
  const lbPlotLegend = document.getElementById("lb-plot-legend");
  const lbPlotVessels = document.getElementById("lb-plot-vessels");
  const lbVesselPlot = document.getElementById("lb-vessel-plot");
  const lbVesselCursor = document.getElementById("lb-vessel-cursor");
  const lbPlotVesselLegendItem = document.getElementById("lb-plot-vessel-legend-item");
  let isScrubbing = false;

  let islands = [];
  let currentIdx = -1;
  const detailCache = new Map();
  const vesselCache = new Map();
  let currentDetailToken = 0;
  let currentVessels = null;
  let currentDateRange = null;
  // Toggle state for the glint overlay. Persists across islands within a
  // session — once you click "View vessels" on one island, it stays on for
  // every subsequent island until you click again.
  let glintsVisible = false;
  const LEGEND_TEXT_ON = "vessels detected this month — AIS broadcasts + VIIRS night light";
  const LEGEND_TEXT_OFF = "View vessels";
  // GLINT_MAX caps how many glints we render at once. SCS imagery can produce
  // hundreds of detections per month — past ~80 the SVG starts to feel noisy.
  const GLINT_MAX = 80;

  const EAGER_TILES = 8;

  const formatCoord = (lat, lon) => {
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`;
  };

  const configureVideo = (v) => {
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.controls = false;
    v.disablePictureInPicture = true;
  };

  const loadDetail = (slug) => {
    const cached = detailCache.get(slug);
    if (cached) return cached;
    const p = fetch(`series/${slug}.json`).then((r) => {
      if (!r.ok) throw new Error(`series ${slug} ${r.status}`);
      return r.json();
    });
    detailCache.set(slug, p);
    return p;
  };

  const loadVessels = (slug) => {
    if (vesselCache.has(slug)) return vesselCache.get(slug);
    // Ship-detection data is opt-in per island (only present when SAR
    // detection has been run). 404 means "no glints for this island,
    // silently skip" — not a failure to surface.
    const p = fetch(`series/${slug}-vessels.json`).then((r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`vessels ${slug} ${r.status}`);
      return r.json();
    }).catch(() => null);
    vesselCache.set(slug, p);
    return p;
  };

  const monthLabelFor = () => {
    if (!currentVessels || !currentDateRange || !lbVideo.duration) return null;
    const [start, end] = currentDateRange;
    const startM = monthsSinceEpoch(start);
    const endM = monthsSinceEpoch(end);
    const span = endM - startM;
    if (span <= 0) return null;
    const pct = Math.min(Math.max(lbVideo.currentTime / lbVideo.duration, 0), 1);
    const idx = startM + Math.round(pct * span);
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  };

  const sizeGlintsToVideo = () => {
    // Match the SVG to the video's rendered (not intrinsic) box. Percentage
    // sizing on an absolute SVG inside an inline-block parent gives 0 in
    // some Chrome layout passes; explicit width/height attributes are
    // boring but reliable.
    const r = lbVideo.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      lbGlints.setAttribute("width", String(Math.round(r.width)));
      lbGlints.setAttribute("height", String(Math.round(r.height)));
    }
  };

  // Glints appear only for the frame their detection was in.
  const FADE_FRAMES = 0;
  // Opacity per age (in frames since detection): index 0 = current month.
  const FADE_OPACITY = [0.5];
  // Jitter (in viewBox 0-100 units) to break up the regular grid pattern of
  // VIIRS detections and to spread out AIS detections that landed at the
  // same coarse cell. Deterministic per (cx, cy) so a glint stays put across
  // re-renders.
  const JITTER = 4.0;

  const monthOffset = (label, delta) => {
    // label = "YYYY-MM"; returns label shifted by `delta` months (negative = older).
    const [ys, ms] = label.split("-").map(Number);
    let idx = ys * 12 + (ms - 1) + delta;
    const y = Math.floor(idx / 12);
    const m = (idx % 12 + 12) % 12 + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  };

  const updateLegendText = () => {
    const span = lbLegend.querySelector("span");
    if (span) span.textContent = glintsVisible ? LEGEND_TEXT_ON : LEGEND_TEXT_OFF;
    lbLegend.setAttribute("aria-pressed", glintsVisible ? "true" : "false");
  };

  const updateGlints = () => {
    if (!currentVessels || !glintsVisible) {
      lbGlints.replaceChildren();
      return;
    }
    sizeGlintsToVideo();
    const label = monthLabelFor();
    if (!label) {
      lbGlints.replaceChildren();
      return;
    }
    const { west, east, north, south } = currentVessels.bbox;
    const dx = east - west;
    const dy = north - south;
    const ns = "http://www.w3.org/2000/svg";
    const frag = document.createDocumentFragment();
    // Older first so the freshest glints stack on top.
    for (let age = FADE_FRAMES; age >= 0; age--) {
      const monthLabel = monthOffset(label, -age);
      const monthData = currentVessels.months.find((mo) => mo.month === monthLabel);
      if (!monthData) continue;
      const opacity = FADE_OPACITY[age];
      // Per-month seed so jitter varies across months even when the same
      // (lat, lon) recurs — conveys "this boat activity is sporadic and the
      // location isn't precise". Plus per-detection-index seed so two glints
      // at the same coordinates within one month don't pile up.
      const monthSeed = monthsSinceEpoch(monthLabel) * 7919;
      let detIdx = 0;
      for (const [lon, lat] of monthData.detections.slice(0, GLINT_MAX)) {
        detIdx++;
        const cx = ((lon - west) / dx) * 100;
        const cy = ((north - lat) / dy) * 100;
        if (cx < -2 || cx > 102 || cy < -2 || cy > 102) continue;
        const seedX = cx * 17.31 + cy * 91.7 + monthSeed * 0.123 + detIdx * 0.789;
        const seedY = cx * 53.9 + cy * 23.1 + monthSeed * 0.456 + detIdx * 1.234 + 7.0;
        const sx = Math.sin(seedX) * 10000;
        const sy = Math.sin(seedY) * 10000;
        const jx = ((sx - Math.floor(sx)) - 0.5) * 2 * JITTER;
        const jy = ((sy - Math.floor(sy)) - 0.5) * 2 * JITTER;
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("cx", (cx + jx).toFixed(2));
        c.setAttribute("cy", (cy + jy).toFixed(2));
        c.setAttribute("r", "0.35");
        c.setAttribute("class", "glint");
        c.setAttribute("opacity", opacity.toFixed(2));
        frag.appendChild(c);
      }
    }
    lbGlints.replaceChildren(frag);
  };

  const render = () => {
    grid.innerHTML = "";
    islands.forEach((island, i) => {
      const tile = document.createElement("figure");
      tile.className = "tile";
      tile.tabIndex = 0;
      tile.setAttribute("role", "button");
      tile.setAttribute("aria-label", `Open ${island.name}`);
      tile.dataset.index = String(i);

      const video = document.createElement("video");
      configureVideo(video);
      video.preload = "none";
      video.poster = island.poster;
      video.dataset.src = island.video_thumb;
      if (i < EAGER_TILES) video.setAttribute("fetchpriority", "high");

      const cap = document.createElement("figcaption");
      cap.textContent = island.name;

      tile.appendChild(video);
      tile.appendChild(cap);
      grid.appendChild(tile);
    });

    // Two-observer strategy keeps decoder/memory use bounded on long scrolls:
    // outer (wide margin) attaches/detaches the src; inner (narrow margin)
    // plays/pauses. Without teardown, 123 tiles worth of decoded buffers
    // accumulate as the user scrolls.
    const outer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target.querySelector("video");
          if (!v) return;
          if (entry.isIntersecting) {
            if (!v.src) v.src = v.dataset.src;
          } else if (v.src) {
            v.pause();
            v.removeAttribute("src");
            v.load();
          }
        });
      },
      { rootMargin: "1500px" },
    );
    const inner = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target.querySelector("video");
          if (!v) return;
          if (entry.isIntersecting) {
            if (!v.src) v.src = v.dataset.src;
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { rootMargin: "200px" },
    );
    grid.querySelectorAll(".tile").forEach((el) => {
      outer.observe(el);
      inner.observe(el);
    });
  };

  const openAt = (idx) => {
    if (idx < 0 || idx >= islands.length) return;
    currentIdx = idx;
    const island = islands[idx];
    const token = ++currentDetailToken;

    lbVideo.src = island.video;
    lbVideo.poster = island.poster;
    setScrubberProgress(0);
    lbVideo.play().catch(() => {});
    lbCaption.replaceChildren(document.createTextNode(island.name));
    lbPlot.hidden = true;
    lbPlotLegend.hidden = true;
    lbPlotVessels.replaceChildren();
    lbVesselPlot.setAttribute("hidden", "");
    lbPlotVesselLegendItem.hidden = true;
    lbTicks.replaceChildren();
    lbGlints.replaceChildren();
    lbLegend.hidden = true;
    currentVessels = null;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");

    loadVessels(island.slug).then((data) => {
      if (token !== currentDetailToken) return;
      currentVessels = data;
      lbLegend.hidden = !data;
      updateLegendText();
      updateGlints();
      renderPlotVessels();
    });

    loadDetail(island.slug)
      .then((detail) => {
        if (token !== currentDetailToken) return;
        const [start, end] = detail.date_range;
        currentDateRange = [start, end];
        renderTicks(start, end);
        renderPlot(detail.land_series);
        renderPlotVessels();
        const mapsUrl = `https://www.google.com/maps/@${detail.lat},${detail.lon},15z/data=!3m1!1e3`;
        const link = document.createElement("a");
        link.href = mapsUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = `${formatCoord(detail.lat, detail.lon)} ↗`;
        const occupier = detail.occupier || "Disputed";
        const claimants = detail.claimants || [];
        let label;
        if (occupier === "Disputed") {
          label = claimants.length
            ? `Claimed by ${claimants.join(", ")}`
            : "Disputed";
        } else {
          const others = claimants.filter((c) => c !== occupier);
          label = others.length
            ? `Occupied by ${occupier}  ·  Also claimed by ${others.join(", ")}`
            : `Occupied by ${occupier}`;
        }
        lbCaption.replaceChildren(
          document.createTextNode(`${island.name}  ·  `),
          link,
          document.createTextNode(`  ·  ${label}`),
        );
      })
      .catch(() => {
        if (token !== currentDetailToken) return;
        lbCaption.replaceChildren(document.createTextNode(island.name));
      });

    // Prefetch neighbors so arrow-key navigation doesn't wait on a fetch.
    const n = islands.length;
    loadDetail(islands[(idx + 1) % n].slug).catch(() => {});
    loadDetail(islands[(idx - 1 + n) % n].slug).catch(() => {});
  };

  const close = () => {
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    lbVideo.pause();
    lbVideo.removeAttribute("src");
    lbVideo.load();
    lbGlints.replaceChildren();
    lbLegend.hidden = true;
    currentVessels = null;
    currentDateRange = null;
    currentIdx = -1;
    currentDetailToken++;
  };

  const step = (delta) => {
    if (currentIdx < 0) return;
    const next = (currentIdx + delta + islands.length) % islands.length;
    openAt(next);
  };

  grid.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile) return;
    openAt(Number(tile.dataset.index));
  });

  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tile = e.target.closest(".tile");
    if (!tile) return;
    e.preventDefault();
    openAt(Number(tile.dataset.index));
  });

  lbClose.addEventListener("click", close);
  lbPrev.addEventListener("click", () => step(-1));
  lbNext.addEventListener("click", () => step(1));
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") close();
    else if (e.target === lbScrubber) return;
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  // The scrubber thumb's center can't reach the track's left/right edges —
  // browsers inset it by the thumb's radius at each end. The plot cursor
  // (drawn at exactly pct% across the plot SVG) doesn't have that inset, so
  // the two get visually staggered at the extremes. This maps pct into the
  // same inset range so they always line up.
  const SCRUBBER_THUMB_RADIUS_PX = 7;
  const cursorXForPct = (pct) => {
    const w = lbPlot.getBoundingClientRect().width;
    if (w <= 0) return pct;
    const insetPct = (SCRUBBER_THUMB_RADIUS_PX / w) * 100;
    return insetPct + pct * (1 - (2 * insetPct) / 100);
  };

  const setScrubberProgress = (pct) => {
    lbScrubber.value = pct;
    lbScrubber.style.setProperty("--progress", `${pct}%`);
    const x = cursorXForPct(pct).toFixed(2);
    if (!lbPlot.hidden) {
      lbPlotCursor.setAttribute("x1", x);
      lbPlotCursor.setAttribute("x2", x);
    }
    if (!lbVesselPlot.hasAttribute("hidden")) {
      lbVesselCursor.setAttribute("x1", x);
      lbVesselCursor.setAttribute("x2", x);
    }
  };

  const monthsSinceEpoch = (s) => {
    const [y, m] = s.split("-").map(Number);
    return y * 12 + (m - 1);
  };

  const renderPlot = (series) => {
    if (!series || series.length < 2) {
      lbPlot.hidden = true;
      lbPlotLegend.hidden = true;
      return;
    }
    const n = series.length;
    let min = Infinity;
    let max = -Infinity;
    for (const v of series) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const rng = Math.max(max - min, 1e-6);
    // Tiny range → flat line would just be noise; skip the plot.
    if (rng < 0.003) {
      lbPlot.hidden = true;
      lbPlotLegend.hidden = true;
      return;
    }
    lbPlot.hidden = false;
    lbPlotLegend.hidden = false;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 100;
      const y = 38 - ((series[i] - min) / rng) * 34;
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    const line = pts.join(" ");
    lbPlotLine.setAttribute("points", line);
    lbPlotFill.setAttribute("points", `0,38 ${line} 100,38`);
    lbPlotCursor.setAttribute("x1", "0");
    lbPlotCursor.setAttribute("x2", "0");
  };

  // Vessel-count bars in their own sparkline (lb-vessel-plot SVG, viewBox
  // 0 0 100 14). Heights normalise to the island's own peak month so quiet
  // and busy islands are equally readable; absolute counts vary 100-fold.
  const VESSEL_BAR_BASE_Y = 14;
  const VESSEL_BAR_MAX_H = 12;

  const renderPlotVessels = () => {
    lbPlotVessels.replaceChildren();
    // SVG elements aren't HTMLElements, so .hidden = ... is a no-op on them.
    // Toggle the attribute directly.
    lbVesselPlot.setAttribute("hidden", "");
    lbPlotVesselLegendItem.hidden = true;
    if (!glintsVisible) return;
    if (!currentVessels || !currentDateRange) return;
    const [start, end] = currentDateRange;
    const startM = monthsSinceEpoch(start);
    const endM = monthsSinceEpoch(end);
    const span = endM - startM;
    if (span <= 0) return;

    let maxCount = 0;
    for (const m of currentVessels.months) {
      const c = m.detections.length;
      if (c > maxCount) maxCount = c;
    }
    if (maxCount === 0) return;

    const ns = "http://www.w3.org/2000/svg";
    const frag = document.createDocumentFragment();
    for (const m of currentVessels.months) {
      const c = m.detections.length;
      if (c === 0) continue;
      const idx = monthsSinceEpoch(m.month) - startM;
      if (idx < 0 || idx > span) continue;
      const x = (idx / span) * 100;
      const h = (c / maxCount) * VESSEL_BAR_MAX_H;
      const ln = document.createElementNS(ns, "line");
      ln.setAttribute("x1", x.toFixed(2));
      ln.setAttribute("x2", x.toFixed(2));
      ln.setAttribute("y1", String(VESSEL_BAR_BASE_Y));
      ln.setAttribute("y2", (VESSEL_BAR_BASE_Y - h).toFixed(2));
      ln.setAttribute("class", "lb-plot-vessel-tick");
      frag.appendChild(ln);
    }
    lbPlotVessels.replaceChildren(frag);
    lbVesselPlot.removeAttribute("hidden");
    lbPlotVesselLegendItem.hidden = false;
  };

  const renderTicks = (startStr, endStr) => {
    const start = monthsSinceEpoch(startStr);
    const end = monthsSinceEpoch(endStr);
    const span = end - start;
    if (span <= 0) {
      lbTicks.replaceChildren();
      return;
    }
    const startYear = Math.ceil(start / 12);
    const endYear = Math.floor(end / 12);
    const nodes = [];
    for (let y = startYear; y <= endYear; y++) {
      const pos = ((y * 12 - start) / span) * 100;
      if (pos < 2 || pos > 98) continue;
      const el = document.createElement("span");
      el.style.left = `${pos}%`;
      el.textContent = String(y);
      nodes.push(el);
    }
    lbTicks.replaceChildren(...nodes);
  };

  // Track the month index we last rendered glints for; only re-render when
  // the index actually changes, not on every fine-grained timeupdate tick.
  let lastGlintMonth = null;
  const maybeUpdateGlints = () => {
    const label = monthLabelFor();
    if (label === lastGlintMonth) return;
    lastGlintMonth = label;
    updateGlints();
  };

  lbVideo.addEventListener("timeupdate", () => {
    if (!isScrubbing && lbVideo.duration) {
      setScrubberProgress((lbVideo.currentTime / lbVideo.duration) * 100);
    }
    maybeUpdateGlints();
  });
  lbVideo.addEventListener("loadedmetadata", sizeGlintsToVideo);
  window.addEventListener("resize", sizeGlintsToVideo);

  lbLegend.addEventListener("click", () => {
    if (!currentVessels) return;
    glintsVisible = !glintsVisible;
    updateLegendText();
    lastGlintMonth = null;  // force re-render with new visibility
    updateGlints();
    renderPlotVessels();
  });

  lbScrubber.addEventListener("pointerdown", () => {
    isScrubbing = true;
    lbVideo.pause();
  });
  const endScrub = () => {
    if (!isScrubbing) return;
    isScrubbing = false;
    lbVideo.play().catch(() => {});
  };
  lbScrubber.addEventListener("pointerup", endScrub);
  lbScrubber.addEventListener("pointercancel", endScrub);
  lbScrubber.addEventListener("input", () => {
    if (!lbVideo.duration) return;
    const pct = Number(lbScrubber.value);
    lbVideo.currentTime = (pct / 100) * lbVideo.duration;
    lbScrubber.style.setProperty("--progress", `${pct}%`);
    maybeUpdateGlints();
  });

  fetch("manifest.json")
    .then((r) => {
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      return r.json();
    })
    .then((data) => {
      islands = data.islands || [];
      if (!islands.length) {
        status.textContent = "No islands yet — run the pipeline to generate the manifest.";
        return;
      }
      status.hidden = true;
      configureVideo(lbVideo);
      render();
    })
    .catch((err) => {
      status.textContent = `Failed to load manifest: ${err.message}`;
    });
})();
