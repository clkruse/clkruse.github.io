// Section model lists (based on workspace directories)
const MODELS_3D = [
  "cow",
  "eames-chair",
  "humpback-whale",
  "modern-chair",
  "Owl",
  "Owl-X",
  "Owl-Z",
  "skull"
];
const MODELS_ROT = [
  "butterfly",
  "airport",
  "checkerboard",
  "elk",
  "island",
  "leopard",
];
const MODELS_COLOR = [
  "egg",
  "wine"
];
const MODELS_SUBJ = [
  "Animals",
  "birds",
  "lilac-roller"
];

// Parse CSV headers to extract image names
// The CSV header contains image names like: ",Name1,Name2,Name3,..."
function parseSubjectNamesFromCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  // First line contains headers - split and skip first empty column
  const headers = lines[0].split(",").slice(1);
  return headers;
}

// Convert display name to filename (e.g., "Gray Parrot 2" -> "Gray Parrot 2.png")
function nameToFilename(name, dataset) {
  // For birds and lilac-roller datasets, use special naming convention
  if (dataset === "birds") {
    // Extract number from "Bird N" -> "bird-N.png"
    const match = name.match(/Bird (\d+)/i);
    if (match) return `bird-${match[1]}.png`;
  } else if (dataset === "lilac-roller") {
    // Extract number from "Photo N" or just "N" -> "N.png"
    const match = name.match(/(\d+)/);
    if (match) return `${match[1]}.png`;
  }
  // Default: name + .png
  return `${name}.png`;
}

const $ = (id) => document.getElementById(id);

// Cache for parsed CLIP/DINO CSV per category/model
const clipCache = new Map(); // key: `${cat}/${model}`
const clipLoading = new Map();
const dinoCache = new Map();
const dinoLoading = new Map();

function toFilenameAngle(value) {
  let angle = Number(value) || 0;
  if (angle === 360) angle = 0; // wrap
  const clamped = Math.max(0, Math.min(355, Math.round(angle / 5) * 5));
  const name = String(clamped).padStart(3, "0") + ".00.png";
  return { angle: clamped, name };
}

// -------- Image preloading helpers --------
const imagePreloadCache = new Map(); // url -> Promise<string>
const imageResolvedUrlCache = new Map(); // url -> resolved src (object URL or original)
const imageObjectUrlMap = new Map(); // url -> object URL
const imagePreloadGroups = new Set();

function preloadImage(url) {
  if (!url) return Promise.resolve(url);
  if (imagePreloadCache.has(url)) return imagePreloadCache.get(url);
  const p = (async () => {
    try {
      const res = await fetch(url, { cache: "force-cache", credentials: "omit" });
      if (!res.ok) throw new Error(`Failed to preload ${url}: ${res.status}`);
      const blob = await res.blob();
      let objectUrl = imageObjectUrlMap.get(url);
      if (!objectUrl) {
        objectUrl = URL.createObjectURL(blob);
        imageObjectUrlMap.set(url, objectUrl);
      }
      imageResolvedUrlCache.set(url, objectUrl);
      return objectUrl;
    } catch (err) {
      console.warn(err);
      imageResolvedUrlCache.set(url, url);
      return url;
    }
  })();
  imagePreloadCache.set(url, p);
  return p;
}

function preloadImageBatch(urls, batchSize = 6, delay = 60) {
  if (!Array.isArray(urls) || !urls.length) return;
  let index = 0;
  const loadNextBatch = () => {
    const slice = urls.slice(index, index + batchSize);
    slice.forEach((url) => preloadImage(url));
    index += batchSize;
    if (index < urls.length) {
      setTimeout(loadNextBatch, delay);
    }
  };
  loadNextBatch();
}

function schedulePreloadGroup(groupKey, urls) {
  if (!urls || !urls.length) return;
  if (imagePreloadGroups.has(groupKey)) return;
  const unique = urls.filter((url) => url && !imagePreloadCache.has(url));
  imagePreloadGroups.add(groupKey);
  if (!unique.length) return;
  preloadImageBatch(unique);
}

const ANGLE_FRAME_FILENAMES = (() => {
  const names = [];
  for (let angle = 0; angle < 360; angle += 5) {
    const { name } = toFilenameAngle(angle);
    if (!names.includes(name)) names.push(name);
  }
  return names;
})();

function scheduleAnglePreloadFor(baseViews) {
  if (!baseViews) return;
  const urls = ANGLE_FRAME_FILENAMES.map((name) => `${baseViews}/${name}`);
  schedulePreloadGroup(`angles:${baseViews}`, urls);
}

function scheduleSubjectPreloadFor(baseViews, count) {
  const total = Math.max(0, Number(count) || 0);
  if (!baseViews || !total) return;
  const urls = [];
  for (let i = 0; i < total; i++) {
    const name = `${String(i).padStart(3, "0")}.00.png`;
    urls.push(`${baseViews}/${name}`);
  }
  schedulePreloadGroup(`subject:${baseViews}:${total}`, urls);
}

function applyImageWithPreload(img, url) {
  if (!img || !url) return;
  const cachedSrc = imageResolvedUrlCache.get(url);
  if (cachedSrc) {
    if (img.dataset.currentSrc !== cachedSrc) {
      img.src = cachedSrc;
      img.dataset.currentSrc = cachedSrc;
    }
  } else if (img.dataset.currentSrc !== url) {
    img.src = url;
    img.dataset.currentSrc = url;
  }
  img.dataset.pendingOriginalSrc = url;
  preloadImage(url).then((resolvedSrc) => {
    const finalSrc = resolvedSrc || url;
    if (img.dataset.pendingOriginalSrc === url && img.dataset.currentSrc !== finalSrc) {
      img.src = finalSrc;
      img.dataset.currentSrc = finalSrc;
    }
  });
}

function parseCsvToMatrix(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return null;
  // Keep headers as strings first, then convert to numbers if valid
  const headerStrings = lines[0].split(",").slice(1);
  const header = headerStrings.map((s) => {
    const num = Number(s);
    return Number.isFinite(num) ? num : s; // Keep as string if not a valid number
  });
  const matrix = new Map(); // rowKey -> Map(colKey -> value)
  let globalMin = Infinity;
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    // Keep row key as string first, convert to number if valid
    const rowKeyStr = parts[0];
    const rowKeyNum = Number(rowKeyStr);
    const rowKey = Number.isFinite(rowKeyNum) ? rowKeyNum : rowKeyStr;
    const rowMap = new Map();
    for (let j = 1; j < parts.length; j++) {
      const colKey = header[j - 1];
      const v = Number(parts[j]);
      rowMap.set(colKey, v);
      if (typeof v === 'number' && Number.isFinite(v) && v < globalMin) globalMin = v;
    }
    matrix.set(rowKey, rowMap);
  }
  return { header, matrix, globalMin };
}

// -------- Plotting utilities --------
function computeYExtent(series) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of series) {
    for (const v of s.values) {
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < minY) minY = v;
        if (v > maxY) maxY = v;
      }
    }
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return { minY: 0, maxY: 1 };
  if (minY === maxY) {
    // pad a bit to avoid flatline on edges
    const pad = Math.max(0.01, Math.abs(minY) * 0.05);
    return { minY: minY - pad, maxY: maxY + pad };
  }
  return { minY, maxY };
}

function pathFromSeries(xVals, yVals, xDomain, yDomain, w, h, margin) {
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;
  const innerW = Math.max(10, w - margin.left - margin.right);
  const innerH = Math.max(10, h - margin.top - margin.bottom);

  let d = "";
  for (let i = 0; i < xVals.length; i++) {
    const xv = xVals[i];
    const yv = yVals[i];
    if (!(typeof yv === "number" && Number.isFinite(yv))) continue;
    const x = margin.left + ((xv - xMin) / xSpan) * innerW;
    const y = margin.top + (1 - (yv - yMin) / ySpan) * innerH;
    d += (d ? " L" : "M") + x.toFixed(2) + "," + y.toFixed(2);
  }
  return d;
}

function renderLineChart(containerId, xValues, series, options = {}) {
  const container = $(containerId);
  if (!container) return;
  let w = container.getBoundingClientRect().width || container.clientWidth || 0;
  if (!w || w < 50) {
    const pw = container.parentElement?.getBoundingClientRect().width || 0;
    w = pw > 50 ? pw : 600;
  }
  const h = options.height || 200;
  // compute margins to fit tick labels and axis titles (tighter spacing)
  // use smaller margins on mobile
  const isMobile = window.innerWidth <= 480;
  let bottom = isMobile ? 12 : 16;
  if (options.showXLabels) bottom += (isMobile ? 8 : 12);
  if (options.axisTitleX) bottom += (isMobile ? 10 : 14);
  let left = isMobile ? 22 : 36;
  if (options.showYLabels) left += (isMobile ? 14 : 24);
  if (options.axisTitleY) left += (isMobile ? 14 : 22);
  const margin = { top: (isMobile ? 14 : 20), right: (isMobile ? 8 : 16), bottom, left };
  const xMin = options.xDomain ? options.xDomain[0] : (xValues[0] ?? 0);
  const xMax = options.xDomain ? options.xDomain[1] : (xValues[xValues.length - 1] ?? 1);
  let minY, maxY;
  if (options.yDomain && Array.isArray(options.yDomain)) {
    minY = options.yDomain[0];
    maxY = options.yDomain[1];
  } else {
    const ext = computeYExtent(series);
    minY = ext.minY; maxY = ext.maxY;
  }

  const xTicks = options.xTicks || [];
  const yTicks = options.yTicks || [];

  // Build SVG
  const parts = [];
  // Use fixed pixel dimensions to avoid font scaling differences between figures
  parts.push(`<svg class="plot-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="similarity vs slider value">`);

  // Axes
  const innerW = Math.max(10, w - margin.left - margin.right);
  const innerH = Math.max(10, h - margin.top - margin.bottom);
  const x0 = margin.left, y0 = margin.top + innerH;
  parts.push(`<line class="plot-axis" x1="${x0}" y1="${y0}" x2="${x0 + innerW}" y2="${y0}"/>`);
  parts.push(`<line class="plot-axis" x1="${x0}" y1="${margin.top}" x2="${x0}" y2="${y0}"/>`);

  // Optional ticks
  const drawXTicks = (ticks) => {
    for (const t of ticks) {
      const x = margin.left + ((t - xMin) / (xMax - xMin || 1)) * innerW;
      parts.push(`<line class="plot-tick" x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + 4}"/>`);
      if (options.showXLabels) {
        parts.push(`<text class="plot-label" x="${x}" y="${y0 + 12}" text-anchor="middle">${t}</text>`);
      }
    }
  };
  const drawYTicks = (ticks) => {
    for (const t of ticks) {
      const y = margin.top + (1 - (t - minY) / (maxY - minY || 1)) * innerH;
      parts.push(`<line class="plot-tick" x1="${x0 - 4}" y1="${y}" x2="${x0}" y2="${y}"/>`);
      if (options.showYLabels) {
        parts.push(`<text class="plot-label" x="${x0 - 8}" y="${y + 4}" text-anchor="end">${t.toFixed(2)}</text>`);
      }
    }
  };
  if (xTicks.length) drawXTicks(xTicks);
  if (yTicks.length) drawYTicks(yTicks);

  // Lines
  for (const s of series) {
    const d = pathFromSeries(xValues, s.values, [xMin, xMax], [minY, maxY], w, h, margin);
    parts.push(`<path class="plot-line ${s.className || ''}" d="${d}"></path>`);
  }

  // Marker line for current x (if provided)
  if (typeof options.currentX === "number") {
    const x = margin.left + ((options.currentX - xMin) / (xMax - xMin || 1)) * innerW;
    parts.push(`<line class="plot-marker" x1="${x}" y1="${margin.top}" x2="${x}" y2="${y0}"/>`);
    // Add label at top of marker line
    const labelY = margin.top - 4;
    parts.push(`<text class="plot-marker-label" x="${x}" y="${labelY}" text-anchor="middle">${options.currentX}°</text>`);
  }

  // Axis titles
  if (options.axisTitleX) {
    const cx = margin.left + innerW / 2;
    const cy = h - 6;
    parts.push(`<text class="plot-axis-title" x="${cx}" y="${cy}" text-anchor="middle">${options.axisTitleX}</text>`);
  }
  if (options.axisTitleY) {
    const tx = 24;
    const ty = margin.top + innerH / 2;
    parts.push(`<text class="plot-axis-title" transform="translate(${tx},${ty}) rotate(-90)" text-anchor="middle">${options.axisTitleY}</text>`);
  }

  parts.push(`</svg>`);
  container.innerHTML = parts.join("");
}

// Observe a container and trigger a rerender when its width changes
function watchPlotResize(containerId, onResize) {
  const el = $(containerId);
  if (!el || typeof ResizeObserver === 'undefined') return;
  let lastW = el.getBoundingClientRect().width || 0;
  const ro = new ResizeObserver(() => {
    const w = el.getBoundingClientRect().width || 0;
    if (Math.abs(w - lastW) > 1) {
      lastW = w;
      requestAnimationFrame(onResize);
    }
  });
  ro.observe(el);
}

async function updateSimilarityPlot(cat, model, fixedAngle, currentX, containerId, useIndex = false, headerOverride = null) {
  const key = keyFor(cat, model);
  // Ensure data present
  let clipData = clipCache.get(key);
  let dinoData = dinoCache.get(key);
  if (!clipData) {
    try { clipData = await loadClipFor(cat, model); } catch (_) { /* ignore */ }
  }
  if (!dinoData) {
    try { dinoData = await loadDinoFor(cat, model); } catch (_) { /* ignore */ }
  }
  if (!clipData || !dinoData) {
    // show loading placeholder
    const c = $(containerId);
    if (c) c.textContent = "Loading plot…";
    return;
  }

  const header = headerOverride || clipData.header;
  const rowAngle = fixedAngle;
  const xValues = useIndex ? header.map((_, i) => i) : header;

  const clipRow = clipData.matrix.get(rowAngle) || new Map();
  const dinoRow = dinoData.matrix.get(rowAngle) || new Map();
  const clipVals = header.map((a) => clipRow.get(a));
  const dinoVals = header.map((a) => dinoRow.get(a));

  const xDomain = useIndex ? [0, Math.max(0, header.length - 1)] : [0, 360];
  // ticks
  const xTicks = useIndex
    ? (() => {
      const n = header.length;
      const vals = [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), Math.max(0, n - 1)];
      return Array.from(new Set(vals.filter(v => v >= 0 && v <= Math.max(0, n - 1))));
    })()
    : [0, 90, 180, 270, 360];
  // fixed Y domain: [globalMin, 1.0]
  const clipMin = clipData.globalMin;
  const dinoMin = dinoData.globalMin;
  const globalMin = Math.min(
    Number.isFinite(clipMin) ? clipMin : Infinity,
    Number.isFinite(dinoMin) ? dinoMin : Infinity
  );
  const yDomain = [Number.isFinite(globalMin) ? globalMin : 0, 1.0];
  const yTicks = [yDomain[0], (yDomain[0] + yDomain[1]) / 2, yDomain[1]];

  renderLineChart(containerId, xValues, [
    { name: "CLIP", values: clipVals, className: "line-clip" },
    { name: "DINO", values: dinoVals, className: "line-dino" },
  ], {
    xDomain,
    currentX: useIndex ? currentX : currentX,
    showXLabels: true,
    showYLabels: true,
    xTicks,
    yTicks,
    axisTitleX: useIndex ? "Index" : "Angle (°)",
    axisTitleY: "Similarity",
    yDomain,
  });
}

function keyFor(cat, model) {
  return `${cat}/${model}`;
}

function getBaseFor(cat) {
  return cat === "subj" ? "output_data/Same-Subject" : cat === "rot" ? "output_data/Rotation" : cat === "color" ? "output_data/Color" : "output_data/3D";
}

async function loadClipFor(cat, model) {
  const key = keyFor(cat, model);
  if (clipCache.has(key)) return clipCache.get(key);
  if (clipLoading.get(key)) return clipLoading.get(key);
  const base = getBaseFor(cat);
  const primary = `${base}/${model}/CLIP.csv`;
  const fallback = `${base}/${model}_CLIP_similarity_matrix.csv`;
  const p = (async () => {
    for (const url of [primary, fallback]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        const parsed = parseCsvToMatrix(text);
        if (parsed) {
          clipCache.set(key, parsed);
          return parsed;
        }
      } catch (_) {
        // ignore and try next
      }
    }
    throw new Error("CLIP data not found for: " + key);
  })();
  clipLoading.set(key, p);
  try {
    const data = await p;
    return data;
  } finally {
    clipLoading.delete(key);
  }
}

function updateMetricsForAngles(cat, model, angle1, angle2, clipElId, dinoElId) {
  const key = keyFor(cat, model);
  const clipEl = $(clipElId);
  const dinoEl = $(dinoElId);

  const clipData = clipCache.get(key);
  if (!clipData) {
    clipEl.textContent = "Loading…";
    loadClipFor(cat, model)
      .then(() => updateMetricsForAngles(cat, model, angle1, angle2, clipElId, dinoElId))
      .catch(() => { clipEl.textContent = "(no data)"; });
  } else {
    const row = clipData.matrix.get(angle1);
    const v = row ? row.get(angle2) : null;
    clipEl.textContent = (typeof v === "number" && Number.isFinite(v)) ? v.toFixed(3) : "—";
  }

  const dinoData = dinoCache.get(key);
  if (!dinoData) {
    dinoEl.textContent = "Loading…";
    loadDinoFor(cat, model)
      .then(() => updateMetricsForAngles(cat, model, angle1, angle2, clipElId, dinoElId))
      .catch(() => { dinoEl.textContent = "(no data)"; });
  } else {
    const rowD = dinoData.matrix.get(angle1);
    const vD = rowD ? rowD.get(angle2) : null;
    dinoEl.textContent = (typeof vD === "number" && Number.isFinite(vD)) ? vD.toFixed(3) : "—";
  }
}

async function loadDinoFor(cat, model) {
  const key = keyFor(cat, model);
  if (dinoCache.has(key)) return dinoCache.get(key);
  if (dinoLoading.get(key)) return dinoLoading.get(key);
  const base = getBaseFor(cat);
  const primary = `${base}/${model}/DINO.csv`;
  const fallback = `${base}/${model}_DINO_similarity_matrix.csv`;
  const p = (async () => {
    for (const url of [primary, fallback]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        const parsed = parseCsvToMatrix(text);
        if (parsed) {
          dinoCache.set(key, parsed);
          return parsed;
        }
      } catch (_) {
        // ignore and try next
      }
    }
    throw new Error("DINO data not found for: " + key);
  })();
  dinoLoading.set(key, p);
  try {
    const data = await p;
    return data;
  } finally {
    dinoLoading.delete(key);
  }
}

function setImage(srcBase, imgId, labelId, angleRaw) {
  const { name } = toFilenameAngle(angleRaw);
  const img = $(imgId);
  const nextSrc = `${srcBase}/${name}`;
  applyImageWithPreload(img, nextSrc);
  $(labelId).textContent = `${Math.round(Number(angleRaw) || 0)}°`;
}

function populateModels(selectId, models) {
  const sel = $(selectId);
  sel.innerHTML = "";
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
}

function setupSection(cfg) {
  // Populate model selector
  populateModels(cfg.selectId, cfg.models);

  // Subject mode needs header-derived angles and index-bounded sliders
  let headerAngles = [];
  const isSubject = !!cfg.isSubject;
  const startEmpty = !!cfg.startEmpty;
  const defaultSecondSlider = cfg.defaultSecondSlider ?? "180";

  const setSliderBounds = (count) => {
    if (!isSubject) return;
    cfg.sliders.forEach((id) => {
      const el = $(id);
      el.min = "0";
      el.max = String(Math.max(0, count - 1));
      el.step = "1";
      if (Number(el.value) > Number(el.max)) el.value = el.max;
    });
  };

  const indexToAngle = (idx) => headerAngles[Math.max(0, Math.min(headerAngles.length - 1, Number(idx) || 0))] ?? 0;

  // Throttle rapid input events to animation frames to reduce layout thrash
  let rafId = 0;
  const renderNow = () => {
    const model = $(cfg.selectId).value;
    const baseViews = `${cfg.viewsBase}/${model}`;

    if (isSubject) {
      scheduleSubjectPreloadFor(baseViews, headerAngles.length);
      const i1 = $(cfg.sliders[0]).value;
      const i2 = $(cfg.sliders[1]).value;
      const a1 = indexToAngle(i1);
      const a2 = indexToAngle(i2);
      // Subject images are indexed sequentially: 000.00.png, 001.00.png, ...
      const fn1 = `${String(Number(i1) || 0).padStart(3, "0")}.00.png`;
      const fn2 = `${String(Number(i2) || 0).padStart(3, "0")}.00.png`;
      const next1 = `${baseViews}/${fn1}`;
      const next2 = `${baseViews}/${fn2}`;
      applyImageWithPreload($(cfg.imgs[0]), next1);
      applyImageWithPreload($(cfg.imgs[1]), next2);
      $(cfg.labels[0]).textContent = String(i1);
      $(cfg.labels[1]).textContent = String(i2);
      // Use exact header-derived values for matrix lookups (no 5° rounding)
      updateMetricsForAngles(cfg.cat, model, a1, a2, cfg.clipId, cfg.dinoId);
      const fixed = a1;
      const currentX = Number(i2) || 0;
      updateSimilarityPlot(cfg.cat, model, fixed, currentX, cfg.plotId, true, headerAngles);
    } else {
      scheduleAnglePreloadFor(baseViews);
      const a1 = $(cfg.sliders[0]).value;
      const a2 = $(cfg.sliders[1]).value;
      setImage(baseViews, cfg.imgs[0], cfg.labels[0], a1);
      setImage(baseViews, cfg.imgs[1], cfg.labels[1], a2);
      updateMetricsForAngles(cfg.cat, model, toFilenameAngle(a1).angle, toFilenameAngle(a2).angle, cfg.clipId, cfg.dinoId);
      const fixed = toFilenameAngle(a1).angle;
      const currentX = toFilenameAngle(a2).angle;
      updateSimilarityPlot(cfg.cat, model, fixed, currentX, cfg.plotId, false);
    }
  };
  const render = () => {
    if (rafId) return; // already scheduled
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      renderNow();
    });
  };

  const onModelChange = () => {
    if (!isSubject) {
      render();
      return;
    }
    const model = $(cfg.selectId).value;
    const baseViews = `${cfg.viewsBase}/${model}`;
    loadClipFor(cfg.cat, model).then((data) => {
      headerAngles = data?.header ?? [];
      setSliderBounds(headerAngles.length);
      scheduleSubjectPreloadFor(baseViews, headerAngles.length);
      try {
        const mid = Math.max(0, Math.floor((headerAngles.length - 1) / 2));
        $(cfg.sliders[1]).value = String(mid);
      } catch (_) { }
      render();
    }).catch(() => {
      headerAngles = [];
      setSliderBounds(1);
      try { $(cfg.sliders[1]).value = "0"; } catch (_) { }
      render();
    });
  };

  // Wire up events
  $(cfg.selectId).addEventListener("change", isSubject ? onModelChange : render);
  cfg.sliders.forEach((id) => $(id).addEventListener("input", render));

  // Initial state
  if (isSubject) {
    onModelChange();
  } else {
    const selectEl = $(cfg.selectId);
    if (startEmpty) {
      const initialBase = selectEl ? `${cfg.viewsBase}/${selectEl.value}` : null;
      if (initialBase) scheduleAnglePreloadFor(initialBase);
      cfg.sliders.forEach((id, idx) => {
        const sliderEl = $(id);
        if (sliderEl) sliderEl.value = idx === 0 ? "0" : "0";
      });
      cfg.imgs.forEach((id) => {
        const img = $(id);
        if (img) {
          img.removeAttribute('src');
          img.dataset.currentSrc = "";
          img.dataset.pendingOriginalSrc = "";
        }
      });
      cfg.labels.forEach((id) => {
        const label = $(id);
        if (label) label.textContent = "—";
      });
    } else {
      try {
        const sliderEl = $(cfg.sliders[1]);
        if (sliderEl && defaultSecondSlider != null) {
          sliderEl.value = String(defaultSecondSlider);
        }
      } catch (_) { }
      render();
    }
  }

  // Keep chart responsive to container width
  watchPlotResize(cfg.plotId, render);
}

// -------- Vector Plot for Cosine Similarity --------
function initVectorPlot() {
  const container = $('vector-plot-container');
  const valueDisplay = $('cosine-similarity-value');
  if (!container || !valueDisplay) return;

  // Initial positions for the two vectors (in normalized coordinates -1 to 1)
  let vector1 = { x: 0, y: 0 };
  let vector2 = { x: 0, y: 0 };

  let dragging = null; // which point is being dragged
  let svgWidth = 800;
  let svgHeight = 450;

  function calculateCosineSimilarity(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    return dot / (mag1 * mag2);
  }

  function calculateAngle(v1, v2) {
    // Angle between two vectors in degrees
    const angle1 = Math.atan2(v1.y, v1.x);
    const angle2 = Math.atan2(v2.y, v2.x);
    let diff = (angle2 - angle1) * (180 / Math.PI);
    // Normalize to 0-180 range (we want the smaller angle)
    if (diff < 0) diff += 360;
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  function toSVGCoords(normalized) {
    // Convert normalized coords (-1 to 1) to SVG coords with origin at center
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    const scale = svgHeight * 0.42; // scale based on height to fit nicely
    return {
      x: centerX + normalized.x * scale,
      y: centerY - normalized.y * scale // flip Y axis
    };
  }

  function fromSVGCoords(svg) {
    // Convert SVG coords back to normalized
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    const scale = svgHeight * 0.42;
    return {
      x: (svg.x - centerX) / scale,
      y: -(svg.y - centerY) / scale // flip Y axis
    };
  }

  function renderPlot() {
    const rect = container.getBoundingClientRect();
    svgWidth = rect.width;
    svgHeight = rect.height;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;

    const svg1 = toSVGCoords(vector1);
    const svg2 = toSVGCoords(vector2);

    const cosineSim = calculateCosineSimilarity(vector1, vector2);
    const angle = calculateAngle(vector1, vector2);

    // Update display
    valueDisplay.textContent = cosineSim.toFixed(3);

    // Build SVG
    const parts = [];
    parts.push(`<svg class="vector-plot-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">`);

    // Grid lines
    const gridSpacingX = svgWidth / 16;
    const gridSpacingY = svgHeight / 9;
    for (let i = 0; i <= 16; i++) {
      const posX = i * gridSpacingX;
      parts.push(`<line class="grid-line" x1="${posX}" y1="0" x2="${posX}" y2="${svgHeight}"/>`);
    }
    for (let i = 0; i <= 9; i++) {
      const posY = i * gridSpacingY;
      parts.push(`<line class="grid-line" x1="0" y1="${posY}" x2="${svgWidth}" y2="${posY}"/>`);
    }

    // Axes with arrows
    parts.push(`<line class="axis-line" x1="0" y1="${centerY}" x2="${svgWidth}" y2="${centerY}"/>`);
    parts.push(`<line class="axis-line" x1="${centerX}" y1="${svgHeight}" x2="${centerX}" y2="0"/>`);
    // Arrow heads
    parts.push(`<polygon class="axis-arrow" points="${svgWidth - 5},${centerY - 4} ${svgWidth},${centerY} ${svgWidth - 5},${centerY + 4}"/>`);
    parts.push(`<polygon class="axis-arrow" points="${centerX - 4},5 ${centerX},0 ${centerX + 4},5"/>`);

    // Axis labels
    parts.push(`<text class="plot-label" x="${svgWidth - 10}" y="${centerY - 8}" text-anchor="end">x</text>`);
    parts.push(`<text class="plot-label" x="${centerX + 8}" y="12" text-anchor="start">y</text>`);

    // Vector lines
    parts.push(`<line class="vector-line vector-line-1" x1="${centerX}" y1="${centerY}" x2="${svg1.x}" y2="${svg1.y}"/>`);
    parts.push(`<line class="vector-line vector-line-2" x1="${centerX}" y1="${centerY}" x2="${svg2.x}" y2="${svg2.y}"/>`);

    // Angle arc between vectors (drawn after lines so it appears on top)
    // Only draw if both vectors have non-zero magnitude (not at origin)
    const mag1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
    const mag2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
    const bothVectorsExist = mag1 > 0.01 && mag2 > 0.01;

    if (bothVectorsExist && angle > 2) { // Only draw if both vectors exist and angle is meaningful
      const angle1 = Math.atan2(vector1.y, vector1.x);
      const angle2 = Math.atan2(vector2.y, vector2.x);
      const startAngle = Math.min(angle1, angle2);
      const endAngle = Math.max(angle1, angle2);
      const arcRadius = 40;

      const arcStartX = centerX + arcRadius * Math.cos(startAngle);
      const arcStartY = centerY - arcRadius * Math.sin(startAngle);
      const arcEndX = centerX + arcRadius * Math.cos(endAngle);
      const arcEndY = centerY - arcRadius * Math.sin(endAngle);

      const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
      parts.push(`<path class="angle-arc" d="M ${arcStartX} ${arcStartY} A ${arcRadius} ${arcRadius} 0 ${largeArc} 0 ${arcEndX} ${arcEndY}"/>`);

      // Angle label with background
      const midAngle = (angle1 + angle2) / 2;
      const labelRadius = 55;
      const labelX = centerX + labelRadius * Math.cos(midAngle);
      const labelY = centerY - labelRadius * Math.sin(midAngle);

      // Background rectangle for better visibility
      const labelText = angle.toFixed(1) + '°';
      const bgPadding = 6;
      const bgWidth = labelText.length * 10 + bgPadding * 2;
      const bgHeight = 24;
      parts.push(`<rect class="angle-label-bg" x="${labelX - bgWidth / 2}" y="${labelY - bgHeight / 2}" width="${bgWidth}" height="${bgHeight}" rx="4"/>`);
      parts.push(`<text class="angle-label-text" x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle">${labelText}</text>`);
    }

    // Draggable points
    parts.push(`<circle class="vector-point vector-point-1" cx="${svg1.x}" cy="${svg1.y}" r="8" data-vector="1"/>`);
    parts.push(`<circle class="vector-point vector-point-2" cx="${svg2.x}" cy="${svg2.y}" r="8" data-vector="2"/>`);

    parts.push('</svg>');
    container.innerHTML = parts.join('');

  }

  const DRAG_MARGIN_X = 20;
  const DRAG_MARGIN_Y = 20;
  let activePointerId = null;

  function clientToSvg(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    let svgX = ((clientX - rect.left) / rect.width) * svgWidth;
    let svgY = ((clientY - rect.top) / rect.height) * svgHeight;
    svgX = Math.max(DRAG_MARGIN_X, Math.min(svgWidth - DRAG_MARGIN_X, svgX));
    svgY = Math.max(DRAG_MARGIN_Y, Math.min(svgHeight - DRAG_MARGIN_Y, svgY));
    return { svgX, svgY };
  }

  function updateVectorFromClient(clientX, clientY) {
    if (!dragging) return;
    const { svgX, svgY } = clientToSvg(clientX, clientY);
    const normalized = fromSVGCoords({ x: svgX, y: svgY });
    if (dragging === '1') {
      vector1 = normalized;
    } else if (dragging === '2') {
      vector2 = normalized;
    }
    renderPlot();
  }

  function distanceToVector(vector, svgX, svgY) {
    const coords = toSVGCoords(vector);
    return Math.hypot(coords.x - svgX, coords.y - svgY);
  }

  function determineVectorUnderPointer(clientX, clientY) {
    const { svgX, svgY } = clientToSvg(clientX, clientY);
    const dist1 = distanceToVector(vector1, svgX, svgY);
    const dist2 = distanceToVector(vector2, svgX, svgY);
    const threshold = Math.max(32, Math.min(svgWidth, svgHeight) * 0.08);
    if (dist1 <= dist2 && dist1 <= threshold) {
      return { id: '1' };
    }
    if (dist2 < dist1 && dist2 <= threshold) {
      return { id: '2' };
    }
    return null;
  }

  const stopDragging = () => {
    if (!dragging) return;
    dragging = null;
    if (activePointerId !== null) {
      try {
        container.releasePointerCapture(activePointerId);
      } catch (_) {}
      activePointerId = null;
    }
  };

  container.addEventListener('pointerdown', (e) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || dragging) {
      return;
    }

    let vectorId = null;
    const vectorTarget = e.target.closest('[data-vector]');
    if (vectorTarget) {
      vectorId = vectorTarget.getAttribute('data-vector');
    } else {
      const hit = determineVectorUnderPointer(e.clientX, e.clientY);
      if (hit) vectorId = hit.id;
    }

    if (!vectorId) return;

    dragging = vectorId;
    activePointerId = e.pointerId;
    e.preventDefault();
    try {
      container.setPointerCapture(activePointerId);
    } catch (_) {}
    updateVectorFromClient(e.clientX, e.clientY);
  });

  container.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    e.preventDefault();
    updateVectorFromClient(e.clientX, e.clientY);
  });

  container.addEventListener('pointerup', (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    stopDragging();
  });

  container.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activePointerId) return;
    stopDragging();
  });

  container.addEventListener('lostpointercapture', stopDragging);

  // Initial render
  renderPlot();

  // Re-render on resize
  const ro = new ResizeObserver(() => {
    requestAnimationFrame(renderPlot);
  });
  ro.observe(container);

  // Expose function globally for buttons to use
  // Can set both vectors at once, or use null to keep current position
  window.setVectorPositions = (x1, y1, x2, y2) => {
    // Collect all non-null values to determine normalization scale
    const values = [];
    if (x1 !== null && y1 !== null) {
      values.push(Math.abs(x1), Math.abs(y1));
    }
    if (x2 !== null && y2 !== null) {
      values.push(Math.abs(x2), Math.abs(y2));
    }
    const maxVal = Math.max(...values, 1);

    // Update vectors (only if values provided)
    if (x1 !== null && y1 !== null) {
      vector1 = { x: x1 / maxVal, y: y1 / maxVal };
    }
    if (x2 !== null && y2 !== null) {
      vector2 = { x: x2 / maxVal, y: y2 / maxVal };
    }
    renderPlot();
  };
}

window.setRotationExample = (angleDeg, modelName) => {
  const selectEl = $('modelSelect-rot');
  const desiredModel = modelName || 'butterfly';
  const normalized = Math.max(0, Math.min(360, Number(angleDeg) || 0));
  const snapped = toFilenameAngle(normalized).angle;

  const applyValues = () => {
    const slider1 = $('slider-rot-1');
    const slider2 = $('slider-rot-2');
    if (slider1) slider1.value = '0';
    if (slider2) {
      slider2.value = String(snapped);
      slider2.dispatchEvent(new Event('input'));
    }
  };

  if (selectEl && selectEl.value !== desiredModel && Array.from(selectEl.options).some(opt => opt.value === desiredModel)) {
    selectEl.value = desiredModel;
    selectEl.dispatchEvent(new Event('change'));
    requestAnimationFrame(applyValues);
  } else {
    applyValues();
  }
};

// Track if Dewey has been rendered to prevent duplicate renders
let deweyRendered = false;
let deweyCurrentState = null; // Track current zoom state

function renderDewey() {
  const chart = d3.select("#chart-dewey");
  if (chart.empty()) return;

  // Only render once
  if (deweyRendered) return;
  deweyRendered = true;

  // Clear existing content
  chart.html("");

  d3.json("dewey-data.json", function (error, data) {
    if (error) {
      console.error("Failed to load dewey-data.json", error);
      deweyRendered = false; // Allow retry on error
      return;
    }

    var dataMap = data.reduce(function (map, node) {
      map[node.name] = node;
      return map;
    }, {});

    var data2 = [];
    data.forEach(function (node) {
      var father = dataMap[node.father];
      if (father) {
        (father.children || (father.children = []))
          .push(node);
      } else {
        data2.push(node);
      }
    });

    const root = data2[0];

    var margin = { top: 24, right: 0, bottom: 0, left: 0 },
      width = chart.node().getBoundingClientRect().width - margin.left - margin.right,
      height = chart.node().getBoundingClientRect().height - margin.top - margin.bottom,
      formatNumber = d3.format(",d"),
      transitioning;

    const labelFontSize = 13;
    const labelLineHeight = 1.4;
    const labelLineHeightPx = labelFontSize * labelLineHeight;

    var x = d3.scale.linear()
      .domain([0, width])
      .range([0, width]);

    var y = d3.scale.linear()
      .domain([0, height])
      .range([0, height]);

    var hue = d3.scale.ordinal()
      .range([
        '#f4d4d4', // soft coral/pink - 000s General Works
        '#ffd4b8', // soft peach - 100s Philosophy
        '#fff4d4', // soft cream - 200s Religion
        '#e8f4d4', // soft sage - 300s Social Sciences
        '#d4f4e8', // soft mint - 400s Language
        '#d4f0f4', // soft aqua - 500s Science
        '#d4e4f4', // soft sky blue - 600s Technology
        '#e4d4f4', // soft lavender - 700s Arts
        '#f4d4e8', // soft mauve - 800s Literature
        '#f4d4d8'  // soft blush - 900s History
      ])
      .domain(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

    var luminance = d3.scale.sqrt()
      .domain([1000, 300000])
      .clamp(true)
      .range([92, 96]);

    var treemap = d3.layout.treemap()
      .children(function (d, depth) { return depth ? null : d._children; })
      .sort(function (a, b) { return a.value - b.value; })
      .ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
      .round(false);

    var svg = chart.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.bottom + margin.top)
      .style("margin-left", -margin.left + "px")
      .style("margin.right", -margin.right + "px")
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .style("shape-rendering", "crispEdges");

    var grandparent = svg.append("g")
      .attr("class", "grandparent");

    grandparent.append("rect")
      .attr("y", -margin.top)
      .attr("width", width)
      .attr("height", margin.top);

    const grandparentText = grandparent.append("text")
      .attr("x", width / 2)
      .attr("y", 6 - margin.top)
      .attr("dy", ".75em")
      .attr('text-anchor', "middle")
      .attr("font-style", "italic")
      .style("font-size", "13")
      .text("Click a category to zoom");

    initialize(root);
    accumulate(root);
    layout(root);
    display(root);

    function initialize(root) {
      root.x = root.y = 0;
      root.dx = width;
      root.dy = height;
      root.depth = 0;
    }

    function accumulate(d) {
      d._children = d.children;
      if (d._children) {
        d.value = d._children.reduce(function (p, v) { return p + accumulate(v); }, 0);
      }
      return d.value || 0;
    }

    function layout(d) {
      if (d._children) {
        treemap.nodes({ _children: d._children });
        d._children.forEach(function (c) {
          c.x = d.x + c.x * d.dx;
          c.y = d.y + c.y * d.dy;
          c.dx *= d.dx;
          c.dy *= d.dy;
          c.depth = (d.depth || 0) + 1;
          c.parent = d;
          layout(c);
        });
      }
    }

    function getLabelText(d) {
      var namelen = d.name.length;
      var boxWidth = x(d.x + d.dx) - x(d.x);

      // For small boxes, prioritize showing the number
      if (boxWidth < 120) {
        if (namelen == 1) {
          return d.name + '00s';
        } else if (namelen == 2) {
          return d.name + '0s';
        } else {
          return d.name;
        }
      } else {
        // For larger boxes, show title and number
        if (namelen == 1) {
          return d.title + ' (' + d.name + '00s)';
        } else if (namelen == 2) {
          return d.title + ' (' + d.name + '0s)';
        } else {
          return d.title + ' (' + d.name + ')';
        }
      }
    }

    function shouldShowLabel(d) {
      const depth = typeof d.depth === "number" ? d.depth : (d.parent ? (d.parent.depth || 0) + 1 : 0);
      // Use the current x/y scales to compute actual pixel dimensions
      const widthPx = x(d.x + d.dx) - x(d.x);
      const heightPx = y(d.y + d.dy) - y(d.y);
      const minWidth = depth >= 2 ? 32 : 64;
      const minHeight = depth >= 2 ? 20 : 28;
      return widthPx >= minWidth && heightPx >= minHeight;
    }

    function display(d) {
      grandparent
        .datum(d.parent)
        .on("click", transition);

      if (d.parent) {
        grandparentText.text("Click to zoom out");
      } else {
        grandparentText.text("Click a category to zoom");
      }

      // Update the header label
      var headerLabel = document.getElementById('dewey-header-label');
      if (headerLabel) {
        if (d.parent) {
          var namelen = d.name.length;
          var numInfo = '';
          if (namelen == 1) { numInfo = d.name + '00s'; }
          else if (namelen == 2) { numInfo = d.name + '0s'; }
          else { numInfo = d.name; }
          headerLabel.textContent = d.title + ' (' + numInfo + ')';
        } else {
          headerLabel.textContent = 'Dewey Decimal System';
        }
      }

      var g1 = svg.insert("g", ".grandparent")
        .datum(d)
        .attr("class", "depth");

      var g = g1.selectAll("g")
        .data(d._children)
        .enter().append("g");

      g.filter(function (d) { return d._children; })
        .classed("children", true)
        .on("click", transition);

      g.selectAll(".child")
        .data(function (d) { return d._children || [d]; })
        .enter().append("rect")
        .attr("class", "child")
        .call(rect);

      g.append("rect")
        .attr("class", "parent")
        .call(rect)
        .append("svg:title")
        .text(function (d) {
          value_pct_1 = 100 * d.value / 4756297;
          value_pct_2 = value_pct_1.toFixed(2) + '%';
          return d.title + " (" + value_pct_2 + ")";
        });

      g.append("foreignObject")
        .call(foreignText)
        .attr("class", "foreignobj")
        .append("xhtml:div")
        .attr("dy", ".75em")
        .html(getLabelText)
        .style("font-size", labelFontSize + "px")
        .style("font-family", "Departure Mono, ui-monospace, monospace")
        .style("font-weight", "500")
        .style("letter-spacing", "0.3px")
        .style("line-height", labelLineHeight)
        .style("display", "-webkit-box")
        .style("-webkit-box-orient", "vertical")
        .style("overflow", "hidden")
        .style("text-overflow", "clip")
        .style("white-space", "normal")
        .style("word-break", "break-word")
        .style("max-height", function (d) {
          const available = Math.max(y(d.y + d.dy) - y(d.y) - 8, 0);
          return available + "px";
        })
        .style("-webkit-line-clamp", function (d) {
          const available = Math.max(y(d.y + d.dy) - y(d.y) - 8, 0);
          const maxLines = Math.max(1, Math.floor(available / labelLineHeightPx));
          return String(maxLines);
        })
        .style("opacity", function (d) {
          return shouldShowLabel(d) ? 1 : 0;
        })
        .attr("class", "textdiv");

      function transition(d) {
        if (transitioning || !d) return;
        transitioning = true;

        var g2 = display(d),
          t1 = g1.transition().duration(750),
          t2 = g2.transition().duration(750);

        x.domain([d.x, d.x + d.dx]);
        y.domain([d.y, d.y + d.dy]);

        svg.style("shape-rendering", null);

        svg.selectAll(".depth").sort(function (a, b) { return a.depth - b.depth; });

        // Update label content and visibility immediately after scale change
        svg.selectAll(".textdiv")
          .html(getLabelText)
          .style("opacity", function (d) {
            return shouldShowLabel(d) ? 1 : 0;
          });

        t1.selectAll("rect").call(rect);
        t2.selectAll("rect").call(rect);

        t1.selectAll(".foreignobj").call(foreignText);
        t2.selectAll(".foreignobj").call(foreignText);

        t1.remove().each("end", function () {
          svg.style("shape-rendering", "crispEdges");
          transitioning = false;
        });
      }

      return g;
    }

    function text(text) {
      text.attr("x", function (d) { return x(d.x) + 6; })
        .attr("y", function (d) { return y(d.y) + 6; });
    }

    function rect(rect) {
      rect.attr("x", function (d) { return x(d.x); })
        .attr("y", function (d) { return y(d.y); })
        .attr("width", function (d) { return x(d.x + d.dx) - x(d.x); })
        .attr("height", function (d) { return y(d.y + d.dy) - y(d.y); })
        .style('fill', function (d) {
          var c = d3.lab(hue(d.name.charAt(0)));
          // Only apply luminance variation to subcategories (name length > 1)
          if (d.name.length > 1) {
            c.l = luminance(d.value);
          }
          return c;
        });
    }

    function foreignText(foreign) {
      foreign.attr("x", function (d) { return x(d.x) + 6; })
        .attr("y", function (d) { return y(d.y) + 6; })
        .attr("width", function (d) {
          return Math.max(x(d.x + d.dx) - x(d.x) - 10, 0);
        })
        .attr("height", function (d) {
          return Math.max(y(d.y + d.dy) - y(d.y) - 8, 0);
        });
    }

    function name(d) {
      return d.parent
        ? name(d.parent) + ": " + d.title
        : d.title;
    }

    // Store the current zoom state
    deweyCurrentState = root;

    // Set up window resize listener (not ResizeObserver to avoid panel visibility triggers)
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Only re-render if the panel is currently visible
        const panel = document.getElementById('sec-dewey');
        if (panel && panel.style.display !== 'none') {
          deweyRendered = false;
          renderDewey();
        }
      }, 300);
    };
    window.addEventListener('resize', handleResize);
  });
}

function setupCompareFigure() {
  const datasetSelect = $('datasetSelect-compare');
  const imageSelect1 = $('imageSelect-compare-1');
  const imageSelect2 = $('imageSelect-compare-2');
  const img1 = $('img-compare-1');
  const img2 = $('img-compare-2');
  const clipValue = $('clipValue-compare');
  const dinoValue = $('dinoValue-compare');

  if (!datasetSelect || !imageSelect1 || !imageSelect2) return;

  // Populate dataset selector
  populateModels('datasetSelect-compare', MODELS_SUBJ);

  let imageNames = [];
  let displayNames = [];
  let initialLoad = true;

  const populateImageSelectors = async (dataset) => {
    // Load the raw CSV to extract image names from headers
    try {
      const base = 'output_data/Same-Subject';
      const csvUrl = `${base}/${dataset}/CLIP.csv`;
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error('Failed to load CSV');

      const csvText = await response.text();
      displayNames = parseSubjectNamesFromCSV(csvText);

      if (displayNames.length === 0) throw new Error('No headers found');

      // Also load the parsed data for matrix lookups
      const data = await loadClipFor('subj', dataset);
      if (data && data.header) {
        imageNames = data.header;

        // Clear and populate both dropdowns
        imageSelect1.innerHTML = '';
        imageSelect2.innerHTML = '';

        // Add placeholder option
        const placeholder1 = document.createElement('option');
        placeholder1.value = '';
        placeholder1.textContent = 'Select an image...';
        placeholder1.disabled = true;
        placeholder1.selected = initialLoad;
        imageSelect1.appendChild(placeholder1);

        const placeholder2 = document.createElement('option');
        placeholder2.value = '';
        placeholder2.textContent = 'Select an image...';
        placeholder2.disabled = true;
        placeholder2.selected = initialLoad;
        imageSelect2.appendChild(placeholder2);

        imageNames.forEach((angle, idx) => {
          const displayName = displayNames[idx] || `Image ${idx}`;

          const opt1 = document.createElement('option');
          opt1.value = idx;
          opt1.textContent = displayName;
          imageSelect1.appendChild(opt1);

          const opt2 = document.createElement('option');
          opt2.value = idx;
          opt2.textContent = displayName;
          imageSelect2.appendChild(opt2);
        });

        // Don't load images on initial page load
        if (!initialLoad) {
          updateComparison();
        }
      }
    } catch (err) {
      console.error('Failed to load dataset:', err);
    }
  };

  const updateComparison = () => {
    const dataset = datasetSelect.value;
    const val1 = imageSelect1.value;
    const val2 = imageSelect2.value;

    // Check if we have valid data
    if (!dataset || imageNames.length === 0 || displayNames.length === 0) {
      clipValue.textContent = '—';
      dinoValue.textContent = '—';
      img1.src = '';
      img2.src = '';
      return;
    }

    // Update image 1 if selected
    if (val1) {
      const idx1 = parseInt(val1);
      const name1 = displayNames[idx1] || '';
      const filename1 = nameToFilename(name1, dataset);
      const basePath = `output_views/Same-Subject/${dataset}`;
      img1.src = `${basePath}/${filename1}`;
    } else {
      img1.src = '';
    }

    // Update image 2 if selected
    if (val2) {
      const idx2 = parseInt(val2);
      const name2 = displayNames[idx2] || '';
      const filename2 = nameToFilename(name2, dataset);
      const basePath = `output_views/Same-Subject/${dataset}`;
      img2.src = `${basePath}/${filename2}`;
    } else {
      img2.src = '';
    }

    // Update similarity scores only if both images are selected
    if (val1 && val2) {
      const idx1 = parseInt(val1);
      const idx2 = parseInt(val2);
      const angle1 = imageNames[idx1];
      const angle2 = imageNames[idx2];
      updateMetricsForAngles('subj', dataset, angle1, angle2, 'clipValue-compare', 'dinoValue-compare');
    } else {
      clipValue.textContent = '—';
      dinoValue.textContent = '—';
    }
  };

  // Event listeners
  datasetSelect.addEventListener('change', () => {
    initialLoad = false;
    populateImageSelectors(datasetSelect.value);
  });

  imageSelect1.addEventListener('change', () => {
    initialLoad = false;
    updateComparison();
  });
  imageSelect2.addEventListener('change', () => {
    initialLoad = false;
    updateComparison();
  });

  // Initial load - use first dataset
  const initialDataset = datasetSelect.value || MODELS_SUBJ[0];
  populateImageSelectors(initialDataset);

  // Expose function globally for text buttons to use
  // Takes image names (e.g., 'Gray Parrot', 'Beagle') instead of indices
  window.setCompareImages = (dataset, name1, name2) => {
    initialLoad = false; // Mark that user has interacted
    if (datasetSelect.value !== dataset) {
      datasetSelect.value = dataset;
      populateImageSelectors(dataset).then(() => {
        // Find indices by name
        const idx1 = displayNames.findIndex(n => n === name1);
        const idx2 = displayNames.findIndex(n => n === name2);
        imageSelect1.value = idx1 >= 0 ? String(idx1) : '0';
        imageSelect2.value = idx2 >= 0 ? String(idx2) : '0';
        updateComparison();
      });
    } else {
      // Find indices by name
      const idx1 = displayNames.findIndex(n => n === name1);
      const idx2 = displayNames.findIndex(n => n === name2);
      imageSelect1.value = idx1 >= 0 ? String(idx1) : '0';
      imageSelect2.value = idx2 >= 0 ? String(idx2) : '0';
      updateComparison();
    }
  };
}

// Custom scroll position restoration for .left-scroll container
const SCROLL_STORAGE_KEY = 'leftScrollPosition';

function init() {
  // Reset scroll position to prevent layout issues on reload
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // Initialize the vector plot
  initVectorPlot();

  // Initialize the comparison figure
  setupCompareFigure();

  setupSection({
    cat: "3d",
    models: MODELS_3D,
    selectId: "modelSelect-3d",
    sliders: ["slider-3d-1", "slider-3d-2"],
    labels: ["angle-3d-1", "angle-3d-2"],
    imgs: ["img-3d-1", "img-3d-2"],
    clipId: "clipValue-3d",
    dinoId: "dinoValue-3d",
    viewsBase: "output_views/3D",
    plotId: "plot-3d",
    isSubject: false,
  });
  setupSection({
    cat: "rot",
    models: MODELS_ROT,
    selectId: "modelSelect-rot",
    sliders: ["slider-rot-1", "slider-rot-2"],
    labels: ["angle-rot-1", "angle-rot-2"],
    imgs: ["img-rot-1", "img-rot-2"],
    clipId: "clipValue-rot",
    dinoId: "dinoValue-rot",
    viewsBase: "output_views/Rotation",
    plotId: "plot-rot",
    isSubject: false,
    startEmpty: true,
  });
  setupSection({
    cat: "color",
    models: MODELS_COLOR,
    selectId: "modelSelect-color",
    sliders: ["slider-color-1", "slider-color-2"],
    labels: ["angle-color-1", "angle-color-2"],
    imgs: ["img-color-1", "img-color-2"],
    clipId: "clipValue-color",
    dinoId: "dinoValue-color",
    viewsBase: "output_views/Color",
    plotId: "plot-color",
    isSubject: true,
  });
  setupSection({
    cat: "subj",
    models: MODELS_SUBJ,
    selectId: "modelSelect-subj",
    sliders: ["slider-subj-1", "slider-subj-2"],
    labels: ["angle-subj-1", "angle-subj-2"],
    imgs: ["img-subj-1", "img-subj-2"],
    clipId: "clipValue-subj",
    dinoId: "dinoValue-subj",
    viewsBase: "output_views/Same-Subject",
    plotId: "plot-subj",
    isSubject: true,
  });

  // Observe left-side text sections and toggle the corresponding figure
  const targets = [
    { text: document.getElementById('text-cosine'), panel: document.getElementById('sec-cosine'), inline: document.getElementById('inline-fig-cosine') },
    { text: document.getElementById('text-compare'), panel: document.getElementById('sec-compare'), inline: document.getElementById('inline-fig-compare') },
    { text: document.getElementById('text-3d'), panel: document.getElementById('sec-3d'), inline: document.getElementById('inline-fig-3d') },
    { text: document.getElementById('text-rot'), panel: document.getElementById('sec-rot'), inline: document.getElementById('inline-fig-rot') },
    { text: document.getElementById('text-color'), panel: document.getElementById('sec-color'), inline: document.getElementById('inline-fig-color') },
    { text: document.getElementById('text-subj'), panel: document.getElementById('sec-subj'), inline: document.getElementById('inline-fig-subj') },
    { text: document.getElementById('text-dewey'), panel: document.getElementById('sec-dewey'), inline: document.getElementById('inline-fig-dewey') },
    { text: document.getElementById('text-embedding'), panel: document.getElementById('sec-dewey'), inline: document.getElementById('inline-fig-embedding') },
  ];
  const panels = targets.map(t => t.panel).filter(Boolean);
  const mq = window.matchMedia('(max-width: 1099px)');
  const triggerSectionRender = (panelId) => {
    const fire = (id) => { try { document.getElementById(id)?.dispatchEvent(new Event('input')); } catch (_) { } };
    if (panelId === 'sec-cosine') {
      // Re-render vector plot if needed
      const container = document.getElementById('vector-plot-container');
      if (container) {
        const event = new Event('resize');
        window.dispatchEvent(event);
      }
    } else if (panelId === 'sec-compare') {
      // Trigger compare figure update
      fire('datasetSelect-compare');
    } else if (panelId === 'sec-3d') fire('slider-3d-1');
    else if (panelId === 'sec-rot') fire('slider-rot-1');
    else if (panelId === 'sec-color') fire('slider-color-1');
    else if (panelId === 'sec-subj') fire('slider-subj-1');
    else if (panelId === 'sec-dewey') {
      renderDewey();
    }
  };
  let currentPanel = null;
  const showPanel = (id) => {
    if (mq.matches) return; // on mobile, show all
    if (currentPanel === id) return; // Already showing this panel, no need to update
    currentPanel = id;
    panels.forEach((el) => { if (el) el.style.display = (el.id === id) ? '' : 'none'; });
    // After making a panel visible, re-render its charts next frame to pick up real width
    requestAnimationFrame(() => triggerSectionRender(id));
  };
  showPanel('sec-compare');

  const ACTIVATION_RATIO = 0.2; // switch when section top is this ratio of the page from the top
  const io = new IntersectionObserver((entries) => {
    if (mq.matches) return; // no section switching on mobile
    // Activate when section top crosses an offset threshold below sticky header
    const header = document.querySelector('.pixel-header');
    const offset = (header ? header.getBoundingClientRect().height : 0) + Math.round(window.innerHeight * ACTIVATION_RATIO);
    let candidate = null;
    for (const e of entries) {
      const r = e.target.getBoundingClientRect();
      // section considered active if its top is above offset but not far above bottom
      const topPassed = r.top <= offset;
      const notPastBottom = r.bottom > offset;
      if (topPassed && notPastBottom) {
        candidate = e.target.id;
        break;
      }
    }
    if (!candidate) return;
    if (candidate === 'text-cosine') showPanel('sec-cosine');
    else if (candidate === 'text-compare') showPanel('sec-compare');
    else if (candidate === 'text-3d') showPanel('sec-3d');
    else if (candidate === 'text-rot') showPanel('sec-rot');
    else if (candidate === 'text-color') showPanel('sec-color');
    else if (candidate === 'text-subj') showPanel('sec-subj');
    else if (candidate === 'text-dewey') showPanel('sec-dewey');
    else if (candidate === 'text-embedding') showPanel('sec-dewey');
  }, { root: null, threshold: [0, 0.01, 1] });
  targets.forEach(t => { if (t.text) io.observe(t.text); });

  // Fallback/assist: compute active section on left column scroll
  const pickActive = () => {
    if (mq.matches) return; // no section switching on mobile
    const header = document.querySelector('.pixel-header');
    const offset = (header ? header.getBoundingClientRect().height : 0) + Math.round(window.innerHeight * ACTIVATION_RATIO);

    // Iterate from bottom to top so late sections can still activate near end of scroll
    for (const { text, panel } of [...targets].reverse()) {
      if (!text || !panel) continue;
      const r = text.getBoundingClientRect();
      if (r.top <= offset && r.bottom > offset) {
        showPanel(panel.id);
        return;
      }
    }

    // If no section is at the activation point, don't change anything
    // This prevents flashing when scrolling between adjacent sections
  };
  // Listen to left column scroll (page is non-scrollable on wide screens)
  const leftRoot = document.querySelector('.left-scroll');
  const scrollTarget = leftRoot || window;
  scrollTarget.addEventListener('scroll', pickActive, { passive: true });
  window.addEventListener('resize', pickActive, { passive: true });
  pickActive();

  // For small screens: move panels inline under their text sections
  const updateInline = () => {
    const right = document.getElementById('right-panel');
    if (!right) return;
    if (mq.matches) {
      // move panels under their inline containers
      targets.forEach(({ panel, inline }) => {
        if (panel && inline && panel.parentElement !== inline) {
          inline.innerHTML = '';
          inline.appendChild(panel);
          panel.style.display = '';
          // Re-render charts since width context changed
          requestAnimationFrame(() => triggerSectionRender(panel.id));
        }
      });
      // ensure all are visible on mobile
      panels.forEach((el) => { if (el) el.style.display = ''; });
    } else {
      // ensure panels are inside right-panel
      targets.forEach(({ panel }) => {
        if (panel && panel.parentElement && panel.parentElement.id !== 'right-panel') {
          right.appendChild(panel);
          requestAnimationFrame(() => triggerSectionRender(panel.id));
        }
      });
      // restore visibility based on current active
      showPanel('sec-compare');
    }
  };
  mq.addEventListener('change', updateInline);
  updateInline();

  // Defer one frame and also on window load to avoid zero-width containers
  requestAnimationFrame(() => {
    // Re-run only the chart renders by dispatching input events
    try { document.getElementById('slider-3d-1')?.dispatchEvent(new Event('input')); } catch (_) { }
    try { document.getElementById('slider-rot-1')?.dispatchEvent(new Event('input')); } catch (_) { }
    try { document.getElementById('slider-color-1')?.dispatchEvent(new Event('input')); } catch (_) { }
    try { document.getElementById('slider-subj-1')?.dispatchEvent(new Event('input')); } catch (_) { }
    try { document.getElementById('slider-dewey-1')?.dispatchEvent(new Event('input')); } catch (_) { }
  });
  window.addEventListener('load', () => {
    try { document.getElementById('slider-3d-1')?.dispatchEvent(new Event('input')); } catch (_) { }
    try { document.getElementById('slider-rot-1')?.dispatchEvent(new Event('input')); } catch (_) { }
    try { document.getElementById('slider-color-1')?.dispatchEvent(new Event('input')); } catch (_) { }
    try { document.getElementById('slider-subj-1')?.dispatchEvent(new Event('input')); } catch (_) { }
    try { document.getElementById('slider-dewey-1')?.dispatchEvent(new Event('input')); } catch (_) { }

    // Restore scroll position for .left-scroll container
    const leftScroll = document.querySelector('.left-scroll');
    const savedPosition = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (leftScroll && savedPosition) {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        leftScroll.scrollTop = parseInt(savedPosition, 10);
      });
    }
  }, { once: true });
}

// Save scroll position before page unload
window.addEventListener('beforeunload', () => {
  const leftScroll = document.querySelector('.left-scroll');
  if (leftScroll) {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, leftScroll.scrollTop.toString());
  }
});

// Prevent browser from restoring scroll position to body/html
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.addEventListener("DOMContentLoaded", init);

window.addEventListener("beforeunload", () => {
  imageObjectUrlMap.forEach((objectUrl) => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch (_) {
      // ignore revoke errors
    }
  });
  imageObjectUrlMap.clear();
});



