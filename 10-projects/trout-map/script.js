mapboxgl.accessToken = "pk.eyJ1IjoiY2xrcnVzZSIsImEiOiJjaXIxY2M2dGcwMnNiZnZtZzN0Znk3MXRuIn0.MyKHSjxjG-ZcI2BkRUSGJA";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/outdoors-v12",
  center: [-120.0, 44.0],
  zoom: 4,
});

map.addControl(new mapboxgl.NavigationControl(), "top-right");

// Detect touch devices and adjust interactions
const isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
if (isTouchDevice && map && map.doubleClickZoom) {
  map.doubleClickZoom.disable();
}

// Mark body with device class for CSS targeting
try {
  const cls = isTouchDevice ? 'is-touch' : 'is-not-touch';
  if (document && document.body && !document.body.classList.contains(cls)) {
    document.body.classList.add(cls);
  }
} catch (_) {}

// UI/Legend state
let groupMode = "generic"; // "generic" (grouped) or "full" (full species)
let currentGeoJSON = null; // keep reference to re-render legend on control changes

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function colorForName(name) {
  if (!name) return "#e53e3e";
  const idx = Math.abs(hashCode(name)) % COLOR_PALETTE.length;
  return COLOR_PALETTE[idx];
}

// Exact name to color mapping for known generic_name categories
const EXACT_NAME_COLORS = {
  "rainbow trout": "#e53e3e",
  "redband trout": "#e53e3e",
  "brook trout": "#2e7d32",
  "unspecified": "#9ca3af",
  "brown trout": "#8b4513",
  "golden trout": "#ffce00",
  "cutthroat trout": "#177cff",
  "golden × rainbow hybrid": "#f59e0b",
  "lake trout": "#1f77b4",
  "salmon": "#fa8072",
  "tiger trout": "#d97706",
  "cutbow hybrid": "#9671f5",
};

// Distinct fallback palette for hashing unknown/other names
const COLOR_PALETTE = [
  "#e53e3e", // red
  "#2e7d32", // green
  "#1f77b4", // blue
  "#8b4513", // brown
  "#ff7f0e", // orange
  "#9671f5", // purple
  "#2ca02c", // emerald
  "#d62728", // crimson
  "#17becf", // teal
  "#9467bd", // violet
  "#bcbd22", // olive
  "#7f7f7f", // gray
  "#f59e0b", // amber
  "#fa8072", // salmon
  "#d97706", // dark amber
  "#ffce00", // gold
];

// Substring-based mapping to ensure consistent colors for common groupings
const FIXED_COLORS_LOOKUP = {
  rainbow: EXACT_NAME_COLORS["rainbow trout"],
  redband: EXACT_NAME_COLORS["redband trout"],
  brook: EXACT_NAME_COLORS["brook trout"],
  brown: EXACT_NAME_COLORS["brown trout"],
  golden: EXACT_NAME_COLORS["golden trout"],
  cutthroat: EXACT_NAME_COLORS["cutthroat trout"],
  cutbow: EXACT_NAME_COLORS["cutbow hybrid"],
  tiger: EXACT_NAME_COLORS["tiger trout"],
  lake: EXACT_NAME_COLORS["lake trout"],
  salmon: EXACT_NAME_COLORS["salmon"],
  salmonid: EXACT_NAME_COLORS["Unspecified"],
};

function colorForGenericName(genericName) {
  if (!genericName) return colorForName("Unknown");
  const n = String(genericName).toLowerCase().trim();
  if (EXACT_NAME_COLORS[n]) return EXACT_NAME_COLORS[n];
  for (const key in FIXED_COLORS_LOOKUP) {
    if (Object.prototype.hasOwnProperty.call(FIXED_COLORS_LOOKUP, key)) {
      if (n.includes(key)) return FIXED_COLORS_LOOKUP[key];
    }
  }
  return colorForName(n);
}

// Track which legend entries are hidden via legend toggles (per current mode)
const hiddenGenericNames = new Set();

function applyPointsFilter() {
  const sourceLayerId = "points";
  if (!map.getLayer(sourceLayerId)) return;
  const propertyKey = groupMode === "generic" ? "given_name" : "full_name";
  if (hiddenGenericNames.size === 0) {
    map.setFilter(sourceLayerId, null);
  } else {
    const hidden = Array.from(hiddenGenericNames);
    map.setFilter(sourceLayerId, ["!", ["in", ["get", propertyKey], ["literal", hidden]]]);
  }
}

function buildHoverHTML(props, maxImageWidthPx, maxImageHeightPx) {
  const common = props.common_name || props.species_guess || props.scientific_name || "Unknown";
  const date = props.observed_on ? new Date(props.observed_on).toLocaleDateString() : "";
  const img = props.image_url
    ? `<img class="popup-img" src="${props.image_url}" alt="${common.replace(/\"/g, "'")}" style="max-width:${maxImageWidthPx}px; max-height:${maxImageHeightPx}px; width:auto; height:auto; display:block; border-radius:4px; margin-top:6px;"/>`
    : "";
  const inner = `
    <div class="popup-card" style="font-size:13px; line-height:1.3">
      <div class="popup-meta" style="font-weight:600">${common}</div>
      ${date ? `<div class="popup-date">${date}</div>` : ""}
      ${img}
    </div>
  `;
  const url = props && props.url ? String(props.url) : "";
  if (url) {
    return `
      <a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; color:inherit; display:block;">
        ${inner}
      </a>
    `;
  }
  return inner;
}

function renderLegend(geojson) {
  const container = document.getElementById("legend");
  if (!container) return;
  // Build counts and a color mapping depending on grouping mode
  const counts = new Map();
  const fullToGeneric = new Map();
  for (const f of geojson.features) {
    const props = f.properties || {};
    if (groupMode === "generic") {
      const name = props.given_name || props.generic_name || props.common_name || props.species_guess || props.scientific_name || "Unknown";
      counts.set(name, (counts.get(name) || 0) + 1);
    } else {
      const full = props.common_name || props.species_guess || props.scientific_name || "Unknown";
      const generic = props.generic_name || props.given_name || full;
      counts.set(full, (counts.get(full) || 0) + 1);
      if (!fullToGeneric.has(full)) fullToGeneric.set(full, generic);
    }
  }
  let items = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (groupMode === 'generic') {
    items = items.slice(0, 15);
  } // in full mode, show all
  const displayedNames = items.map((entry) => entry[0]);
  const allShown = displayedNames.length > 0 && displayedNames.every((n) => !hiddenGenericNames.has(n));
  const allHidden = displayedNames.length > 0 && displayedNames.every((n) => hiddenGenericNames.has(n));
  const rows = items
    .map(([name, count]) => {
      const color = groupMode === "generic" ? colorForGenericName(name) : colorForGenericName(fullToGeneric.get(name) || name);
      const disabledClass = hiddenGenericNames.has(name) ? " disabled" : "";
      return `<div class="row${disabledClass}" data-name="${name.replace(/"/g, '&quot;')}"><span class="swatch" style="background:${color}"></span><span>${name} (${count})</span></div>`;
    })
    .join("");
  const modeControls = `
    <div style=\"display:flex; flex-direction:column; gap:6px; margin-bottom:6px;\">
      <div style=\"display:flex; align-items:center; gap:8px;\">
        <div style=\"font-weight:600;\">Select:</div>
        <span data-action=\"all\" style=\"text-decoration:${allShown ? 'underline' : 'none'}; cursor:pointer; margin-right:4px;\">All</span>
        <span data-action=\"none\" style=\"text-decoration:${allHidden ? 'underline' : 'none'}; cursor:pointer;\">None</span>
      </div>
      <div style=\"display:flex; align-items:center; gap:8px;\">
        <div style=\"font-weight:600;\">Show:</div>
        <span data-mode=\"generic\" style=\"text-decoration:${groupMode === 'generic' ? 'underline' : 'none'}; cursor:pointer; margin-right:4px;\">Groups</span>
        <span data-mode=\"full\" style=\"text-decoration:${groupMode === 'full' ? 'underline' : 'none'}; cursor:pointer;\">All</span>
      </div>
    </div>`;
  container.innerHTML = modeControls + rows;

  // Wire click handlers for toggling
  const rowEls = container.querySelectorAll('.row');
  rowEls.forEach((el) => {
    el.addEventListener('click', () => {
      const name = el.getAttribute('data-name');
      if (!name) return;
      if (hiddenGenericNames.has(name)) {
        hiddenGenericNames.delete(name);
        el.classList.remove('disabled');
      } else {
        hiddenGenericNames.add(name);
        el.classList.add('disabled');
      }
      applyPointsFilter();
      renderLegend(currentGeoJSON || geojson);
    });
  });

  // Controls: Select All / None
  const allBtn = container.querySelector('[data-action="all"]');
  const noneBtn = container.querySelector('[data-action="none"]');
  if (allBtn) {
    allBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hiddenGenericNames.clear();
      container.querySelectorAll('.row').forEach((el) => el.classList.remove('disabled'));
      applyPointsFilter();
      renderLegend(currentGeoJSON || geojson);
    });
  }
  if (noneBtn) {
    noneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hiddenGenericNames.clear();
      // Hide ALL categories in the current mode, not just visible rows
      const namesToHide = new Set();
      if (groupMode === 'generic') {
        // hide each unique given_name
        for (const f of (currentGeoJSON || geojson).features) {
          const props = f.properties || {};
          const n = props.given_name || props.generic_name || props.common_name || props.species_guess || props.scientific_name || 'Unknown';
          namesToHide.add(n);
        }
      } else {
        // hide each unique full_name
        for (const f of (currentGeoJSON || geojson).features) {
          const props = f.properties || {};
          const n = props.full_name || props.common_name || props.species_guess || props.scientific_name || 'Unknown';
          namesToHide.add(n);
        }
      }
      namesToHide.forEach((n) => hiddenGenericNames.add(n));
      applyPointsFilter();
      renderLegend(currentGeoJSON || geojson);
    });
  }

  // Mode change handlers (Show: Groups | All)
  const modeLinks = container.querySelectorAll('[data-mode]');
  modeLinks.forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = el.getAttribute('data-mode');
      groupMode = val === 'full' ? 'full' : 'generic';
      hiddenGenericNames.clear();
      renderLegend(currentGeoJSON || geojson);
      applyPointsFilter();
    });
  });
  // no Max items component
}

// Utility: convert CSV rows to GeoJSON FeatureCollection
function csvToGeoJSON(rows) {
  const features = [];
  for (const row of rows) {
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    if (!isFinite(lat) || !isFinite(lng)) continue;

    const genericName = row.generic_name || row.common_name || row.species_guess || row.scientific_name || "Unknown";
    const givenName = row.given_name || genericName;
    const fullName = row.common_name || row.species_guess || row.scientific_name || "Unknown";
    const pointColor = colorForGenericName(genericName);

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        id: row.id,
        observed_on: row.observed_on,
        url: row.url,
        image_url: row.image_url,
        species_guess: row.species_guess,
        scientific_name: row.scientific_name,
        common_name: row.common_name,
        full_name: fullName,
        generic_name: genericName,
        given_name: givenName,
        color: pointColor,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function addSourcesAndLayers(geojson) {
  if (map.getSource("observations")) return;

  map.addSource("observations", {
    type: "geojson",
    data: geojson,
  });

  map.addLayer({
    id: "points",
    type: "circle",
    source: "observations",
    paint: {
      "circle-color": ["coalesce", ["get", "color"], "#e53e3e"],
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 3,
        8, 5,
        12, 7,
        14, 8
      ],
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 0.8,
        8, 1,
        12, 1.2
      ],
      "circle-stroke-color": "#ffffff",
    },
  });

  let hoverPopup = null;
  let currentPopupAnchor = null;
  let lastTappedFeatureKey = null;
  let pendingPopupSeq = 0;

  function resolvePopupAnchor(coordinates, approxWidth, approxHeight) {
    const canvas = map.getCanvas();
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const p = map.project(coordinates);
    const padding = 20;

    const nearLeft = p.x < padding + approxWidth * 0.5;
    const nearRight = p.x > cw - padding - approxWidth * 0.5;
    const nearTop = p.y < padding + Math.min(approxHeight * 0.4, 140);
    const nearBottom = p.y > ch - padding - Math.min(approxHeight * 0.4, 160);

    if (nearTop && nearLeft) return "top-left";
    if (nearTop && nearRight) return "top-right";
    if (nearBottom && nearLeft) return "bottom-left";
    if (nearBottom && nearRight) return "bottom-right";
    if (nearTop) return "top";
    if (nearBottom) return "bottom";
    if (nearLeft) return "left";
    if (nearRight) return "right";
    return "bottom";
  }

  function showHoverPopup(coordinates, html, maxW, maxH) {
    if (isTouchDevice) return; // never show mapbox popup on touch
    const seq = ++pendingPopupSeq;

    // Build DOM but do not display until media is ready
    const contentEl = document.createElement('div');
    contentEl.innerHTML = html;

    const configureImages = () => {
      const imgs = contentEl.querySelectorAll('img');
      imgs.forEach((img) => {
        // Constrain images; on touch, use container width
        const viewportW = Math.max(0, Math.min(window.innerWidth || 0, document.documentElement ? document.documentElement.clientWidth : 0));
        const viewportH = Math.max(0, Math.min(window.innerHeight || 0, document.documentElement ? document.documentElement.clientHeight : 0));
        const canvas = map.getCanvas();
        const effectiveMaxW = isTouchDevice
          ? Math.max(220, Math.min(maxW, (viewportW || canvas.clientWidth) - 24))
          : maxW;
        const effectiveMaxH = isTouchDevice
          ? Math.max(160, Math.min(maxH, (viewportH || canvas.clientHeight) - 24))
          : maxH;
        img.style.maxWidth = `${effectiveMaxW}px`;
        img.style.maxHeight = `${effectiveMaxH}px`;
        img.style.width = isTouchDevice ? '100%' : 'auto';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.borderRadius = '4px';
        img.style.marginTop = '6px';
      });
    };

    const showNow = () => {
      if (seq !== pendingPopupSeq) return; // stale
      // Compute viewport-constrained dimensions
      const canvas = map.getCanvas();
      const vw = Math.max(0, Math.min(window.innerWidth || 0, document.documentElement ? document.documentElement.clientWidth : 0)) || canvas.clientWidth;
      const vh = Math.max(0, Math.min(window.innerHeight || 0, document.documentElement ? document.documentElement.clientHeight : 0)) || canvas.clientHeight;
      const padding = isTouchDevice ? 16 : 20;
      const effectiveMaxW = Math.floor(Math.min(maxW + 20, vw - padding));
      const effectiveMaxH = Math.floor(Math.min(maxH + 20, vh - padding));
      configureImages();
      const anchor = resolvePopupAnchor(coordinates, effectiveMaxW, effectiveMaxH);

      if (hoverPopup && isTouchDevice) {
        // Recreate popup on touch to refresh anchor and sizing to avoid overflow
        try { hoverPopup.remove(); } catch (_) {}
        hoverPopup = null;
      }

      if (!hoverPopup) {
        hoverPopup = new mapboxgl.Popup({
          closeButton: isTouchDevice,
          closeOnClick: false,
          offset: 12,
          maxWidth: `${effectiveMaxW}px`,
          anchor: anchor,
          className: 'obs-popup'
        });
        hoverPopup.setLngLat(coordinates).setDOMContent(contentEl).addTo(map);
      } else {
        if (hoverPopup.setMaxWidth) hoverPopup.setMaxWidth(`${effectiveMaxW}px`);
        hoverPopup.setDOMContent(contentEl);
        hoverPopup.setLngLat(coordinates);
      }
    };

    const firstImg = contentEl.querySelector('img');
    if (firstImg && !firstImg.complete) {
      firstImg.addEventListener('load', showNow, { once: true });
      firstImg.addEventListener('error', showNow, { once: true });
    } else {
      showNow();
    }
  }

  function getFeatureKey(feature) {
    const props = feature && feature.properties ? feature.properties : {};
    if (props && props.id) return String(props.id);
    if (props && props.url) return String(props.url);
    const coords = feature && feature.geometry && feature.geometry.coordinates;
    const observed = props && props.observed_on ? String(props.observed_on) : "";
    return coords ? `${coords[0]},${coords[1]},${observed}` : observed;
  }

  function clearSelection() {
    lastTappedFeatureKey = null;
    pendingPopupSeq++; // cancel any pending show
    if (hoverPopup) {
      hoverPopup.remove();
      hoverPopup = null;
      currentPopupAnchor = null;
    }
  }

  map.on("mouseenter", "points", (e) => {
    if (isTouchDevice) return;
    map.getCanvas().style.cursor = "pointer";
    const feature = e.features && e.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const coordinates = feature.geometry.coordinates.slice();
    const canvas = map.getCanvas();
    const padding = 32;
    const maxW = Math.max(260, Math.min(640, canvas.clientWidth - 2 * padding));
    const maxH = Math.max(200, Math.min(480, canvas.clientHeight - 2 * padding));
    const html = buildHoverHTML(props, maxW, maxH);
    showHoverPopup(coordinates, html, maxW, maxH);
  });

  map.on("mousemove", "points", (e) => {
    if (isTouchDevice) return;
    const feature = e.features && e.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const coordinates = feature.geometry.coordinates.slice();
    const canvas = map.getCanvas();
    const padding = 32;
    const maxW = Math.max(260, Math.min(640, canvas.clientWidth - 2 * padding));
    const maxH = Math.max(200, Math.min(480, canvas.clientHeight - 2 * padding));
    const html = buildHoverHTML(props, maxW, maxH);
    showHoverPopup(coordinates, html, maxW, maxH);
  });

  map.on("mouseleave", "points", () => {
    if (isTouchDevice) return;
    map.getCanvas().style.cursor = "";
    pendingPopupSeq++; // cancel any pending show
    if (hoverPopup) hoverPopup.remove();
    hoverPopup = null;
    currentPopupAnchor = null;
  });

  map.on("click", "points", (e) => {
    const feature = e.features && e.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const url = props && props.url;

    if (isTouchDevice) {
      // Route to bottom sheet instead of popup
      clearSelection();
      const sheet = document.getElementById('sheet');
      const content = document.getElementById('sheet-content');
      if (sheet && content) {
        const canvas = map.getCanvas();
        const padding = 16;
        const maxW = Math.max(260, Math.min(640, canvas.clientWidth - 2 * padding));
        const maxH = Math.max(200, Math.min(480, canvas.clientHeight - 2 * padding));
        content.innerHTML = buildHoverHTML(props, maxW, maxH);
        sheet.hidden = false;
        document.body.classList.add('sheet-open');
      }
    } else {
      if (url) {
        const win = window.open(url, "_blank", "noopener");
        if (win) {
          try { win.opener = null; } catch (_) {}
        }
      }
    }
  });

  // Clear selection on background tap on touch devices
  map.on("click", (e) => {
    if (!isTouchDevice) return;
    const features = map.queryRenderedFeatures(e.point, { layers: ["points"] });
    if (!features || features.length === 0) {
      clearSelection();
      const sheet = document.getElementById('sheet');
      if (sheet) {
        document.body.classList.remove('sheet-open');
        sheet.hidden = true;
      }
    }
  });
}

// Promise wrapper for Papa.parse
function parseCsv(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      header: true,
      download: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = Array.isArray(results.data) ? results.data : [];
          resolve(rows);
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}

function loadCsvAndRender() {
  const paths = [
    "data/observations-co-09-07-25-clean.csv",
    "data/observations-ca-09-07-25-clean.csv",
    "data/observations-nv-09-07-25-clean.csv",
    "data/observations-ut-09-07-25-clean.csv",
    "data/observations-wy-09-07-25-clean.csv"
  ];

  Promise.allSettled(paths.map(parseCsv))
    .then((results) => {
      const allRows = [];
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value) && r.value.length > 0) {
          allRows.push(...r.value);
        }
      }
      if (allRows.length === 0) {
        console.error("No rows loaded from clean CSVs", paths);
        return;
      }
      // Dedupe by a stable key
      const seen = new Set();
      const deduped = [];
      for (const row of allRows) {
        const key = row.id || row.url || `${row.latitude},${row.longitude},${row.observed_on}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(row);
        }
      }
      const geojson = csvToGeoJSON(deduped);
      currentGeoJSON = geojson;
      addSourcesAndLayers(geojson);
      renderLegend(geojson);
      if (geojson.features.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const f of geojson.features) {
          bounds.extend(f.geometry.coordinates);
        }
        map.fitBounds(bounds, { padding: 40, maxZoom: 10 });
      }
    })
    .catch((err) => {
      console.error("Error loading clean CSVs:", err);
    });
}

map.on("load", loadCsvAndRender);


