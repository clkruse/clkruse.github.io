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
  let isScrubbing = false;

  let islands = [];
  let currentIdx = -1;
  const detailCache = new Map();
  let currentDetailToken = 0;

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
    lbTicks.replaceChildren();
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");

    loadDetail(island.slug)
      .then((detail) => {
        if (token !== currentDetailToken) return;
        const [start, end] = detail.date_range;
        renderTicks(start, end);
        renderPlot(detail.land_series);
        const mapsUrl = `https://www.google.com/maps/@${detail.lat},${detail.lon},15z/data=!3m1!1e3`;
        const link = document.createElement("a");
        link.href = mapsUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = `${formatCoord(detail.lat, detail.lon)} ↗`;
        lbCaption.replaceChildren(
          document.createTextNode(`${island.name}  ·  `),
          link,
          document.createTextNode(`  ·  ${start} — ${end}  ·  ${detail.frame_count} frames`),
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

  const setScrubberProgress = (pct) => {
    lbScrubber.value = pct;
    lbScrubber.style.setProperty("--progress", `${pct}%`);
    if (!lbPlot.hidden) {
      lbPlotCursor.setAttribute("x1", pct.toFixed(2));
      lbPlotCursor.setAttribute("x2", pct.toFixed(2));
    }
  };

  const monthsSinceEpoch = (s) => {
    const [y, m] = s.split("-").map(Number);
    return y * 12 + (m - 1);
  };

  const renderPlot = (series) => {
    if (!series || series.length < 2) {
      lbPlot.hidden = true;
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
      return;
    }
    lbPlot.hidden = false;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 100;
      const y = 38 - ((series[i] - min) / rng) * 34;
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    const line = pts.join(" ");
    lbPlotLine.setAttribute("points", line);
    lbPlotFill.setAttribute("points", `0,40 ${line} 100,40`);
    lbPlotCursor.setAttribute("x1", "0");
    lbPlotCursor.setAttribute("x2", "0");
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

  lbVideo.addEventListener("timeupdate", () => {
    if (isScrubbing || !lbVideo.duration) return;
    setScrubberProgress((lbVideo.currentTime / lbVideo.duration) * 100);
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
