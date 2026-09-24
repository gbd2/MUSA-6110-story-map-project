import { SlideDeck } from './slidedeck.js';

const map = L.map('map', {
  scrollWheelZoom: false,
  maxBounds: [[28.4, -97.3], [31.3, -93.5]],
  maxBoundsViscosity: 1.0,
  minZoom: 8,
}).setView([29.76, -95.37], 10);

// ## The Base Tile Layer
const baseTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_3qz0_1_61b592490d6544930f37ac06', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>&copy; <a href="https://carto.com/attributions">CARTO</a>',
});
baseTileLayer.addTo(map);

// Dim basemap tiles outside the Harris County boundary to make county the focus
map.createPane('dimPane');
map.getPane('dimPane').style.zIndex = 350;
map.getPane('dimPane').style.pointerEvents = 'none';

const dimRenderer = L.svg({ padding: 3, pane: 'dimPane' });
const loadDim = async () => {
  const [m, bounds] = await Promise.all([
    fetch('data/harris-mask.geojson').then((r) => r.json()),
    fetch('data/harris-boundary.geojson').then((r) => r.json()),
  ]);
  const maskLayer = L.geoJSON(m, {
    pane: 'dimPane',
    renderer: dimRenderer,
    interactive: false,
    style: { stroke: false, fillColor: '#e7e9ec', fillOpacity: 1 },
  });
  const lineLayer = L.geoJSON(bounds, {
    pane: 'dimPane',
    renderer: dimRenderer,
    interactive: false,
    style: { color: 'rgb(20 28 38 / 30%)', weight: 1, fill: false },
  });
  L.layerGroup([maskLayer, lineLayer]).addTo(map);
};
loadDim();

const NODATA = '#bcc3ca';

const hexMix = (c0, c1, t) => {
  const a = [1, 3, 5].map((i) => parseInt(c0.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(c1.slice(i, i + 2), 16));
  const ch = a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0'));
  return `#${ch.join('')}`;
};

const clamp = (v) => Math.max(0, Math.min(1, v));

const seq = (value, max, c0, c1, ease = 1) => {
  if (value == null || value === undefined || Number.isNaN(value)) { return NODATA; }
  return hexMix(c0, c1, clamp(value / max) ** ease);
};

const polyBase = (fillColor, fillOpacity = 0.82) => ({
  color: 'rgba(20,28,38,0.22)',
  weight: 0.4,
  fillColor,
  fillOpacity,
});

const divJobs = (v) => {
  if (v === null || v === undefined) { return NODATA; }
  const mid = 204000;
  if (v <= mid) { return hexMix('#e6521f', '#f2d49a', v / mid); }
  return hexMix('#f2d49a', '#0f8f83', Math.min(1, (v - mid) / 300000));
};

const carFree = (v) => ((v === null || v === undefined)
  ? 'car-free n/a'
  : `${Math.round(v * 100)}% car-free`);

const lilaShare = (v) => ((v === null || v === undefined)
  ? 'access share n/a'
  : `${Math.round(v)}% low-income and over 0.5 mi from a store`);

// ## Interface Elements
const container = document.querySelector('.slide-section');
const slides = document.querySelectorAll('.slide');

const slideOptions = {
  'intro': {
    style: (feature) => {
      const isRail = feature.properties.route_type === 0;
      return {
        color: feature.properties.route_color || (isRail ? '#ff5a45' : '#5f7284'),
        weight: isRail ? 4 : 1.5,
        opacity: isRail ? 0.95 : 0.6,
      };
    },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip((`${feature.properties.route_short_name || ''} ${feature.properties.route_long_name || ''}`.trim()));
    },
  },
  'methods': {
    style: () => ({ color: 'rgb(20 28 38 / 24%)', weight: 0.4, fill: false }),
    onEachFeature: () => {},
  },
  'need': {
    style: (feature) => polyBase(seq(feature.properties.pct_zero_car, 0.6, '#f6d3e3', '#c81e6f', 0.8)),
    onEachFeature: (feature, layer) => {
      const pct = feature.properties.pct_zero_car;
      layer.bindTooltip((pct === null || pct === undefined) ? 'No data' : `${Math.round(pct * 100)}% zero-car households`);
    },
  },
  'jobs': {
    style: (feature) => polyBase(divJobs(feature.properties.jobs_transit_45)),
    onEachFeature: (feature, layer) => {
      const v = feature.properties.jobs_transit_45;
      layer.bindTooltip((v === null || v === undefined) ? 'No data' : `${Math.round(v).toLocaleString()} jobs in 45 min`);
    },
  },
  'gap': {
    style: (feature) => {
      const p = feature.properties;
      if (p.gap_flag) { return { color: '#ffd27a', weight: 1, fillColor: '#ffb020', fillOpacity: 0.92 }; }
      const t = p.access_tertile ? (p.access_tertile - 1) / 2 : 0;
      return { color: 'rgb(20 28 38 / 12%)', weight: 0.3, fillColor: hexMix('#dbe0e5', '#a9b3bc', t), fillOpacity: 0.6 };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const jobs = (p.jobs_transit_45 === null || p.jobs_transit_45 === undefined)
        ? 'no modeled transit'
        : `${Math.round(p.jobs_transit_45).toLocaleString()} jobs in 45 min`;
      layer.bindTooltip(`${carFree(p.pct_zero_car)}, ${jobs}`);
    },
  },
  'stranded': {
    style: (feature) => polyBase(seq(feature.properties.pct_zero_car, 0.35, '#fbe6c2', '#e08a00', 0.7), 0.9),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const parts = [carFree(p.pct_zero_car)];
      if (p.median_hh_income) { parts.push(`$${Math.round(p.median_hh_income).toLocaleString()}`); }
      parts.push(`${p.stop_mi} mi to nearest stop`);
      layer.bindTooltip(parts.join(', '));
    },
  },
  'deserts-food': {
    style: (feature) => {
      const desert = feature.properties.LILATracts_halfAnd10 === 1 || feature.properties.LILATracts_1And10 === 1;
      return polyBase(desert ? '#d98a1f' : '#cbd2d8', desert ? 0.82 : 0.55);
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const desert = p.LILATracts_halfAnd10 === 1 || p.LILATracts_1And10 === 1;
      if (!desert) { layer.bindTooltip('Not a grocery desert'); return; }
      layer.bindTooltip(`${lilaShare(p.lowincome_lowaccess_share)}, ${carFree(p.pct_zero_car)}`);
    },
  },
  'food-carless': {
    style: (feature) => {
      if (feature.properties.both) {
        return { color: '#c01050', weight: 1, fillColor: '#e11d5e', fillOpacity: 0.85 };
      }
      return { color: 'rgb(217 138 31 / 45%)', weight: 0.4, fillColor: '#d98a1f', fillOpacity: 0.3 };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindTooltip(`${lilaShare(p.lila_share)}, ${carFree(p.pct_zero_car)}`);
    },
  },
  'deserts-childcare': {
    style: (feature) => {
      const desert = feature.properties.childcare_desert === true || feature.properties.childcare_desert === 1;
      return polyBase(desert ? '#8b5cf6' : '#cbd2d8', desert ? 0.82 : 0.55);
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const desert = p.childcare_desert === true || p.childcare_desert === 1;
      if (!desert) { layer.bindTooltip('Not a childcare desert'); return; }
      const slots = (p.children_per_slot === null || p.children_per_slot === undefined)
        ? 'no licensed slots'
        : `${p.children_per_slot} kids per slot`;
      layer.bindTooltip(`${slots}, ${carFree(p.pct_zero_car)}`);
    },
  },
  'triple-risk': {
    style: (feature) => polyBase(seq(feature.properties.pct_zero_car, 0.3, '#f7d0d6', '#e11d38', 0.7), 0.9),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const parts = [carFree(p.pct_zero_car)];
      if (p.median_hh_income) { parts.push(`$${Math.round(p.median_hh_income).toLocaleString()}`); }
      parts.push(lilaShare(p.lila_share));
      layer.bindTooltip(parts.join(', '));
    },
  },
  'redlining': {
    style: (feature) => polyBase(seq(feature.properties.pct_zero_car, 0.3, '#f7d0d6', '#e11d38', 0.7), 0.9),
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(carFree(feature.properties.pct_zero_car));
    },
  },
  'action': {
    style: (feature) => {
      const k = feature.properties.kind;
      if (k === 'gap') { return polyBase('#f2b134', 0.6); }
      if (k === 'stranded') { return polyBase('#7c3aed', 0.65); }
      return { color: '#14303c', weight: 2.5, opacity: 0.9 };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      if (p.kind === 'gap') {
        const jobs = (p.jobs_transit_45 === null || p.jobs_transit_45 === undefined)
          ? 'no modeled transit'
          : `${Math.round(p.jobs_transit_45).toLocaleString()} jobs in 45 min`;
        layer.bindTooltip(`Run buses more often here. ${carFree(p.pct_zero_car)}, ${jobs}`);
        return;
      }
      if (p.kind === 'stranded') {
        layer.bindTooltip(`Extend service here. ${carFree(p.pct_zero_car)}, ${p.stop_mi} mi to nearest stop`);
        return;
      }
      layer.bindTooltip(`Frequent route: ${p.route_short_name || ''} ${p.route_long_name || ''}`.trim());
    },
  },
  'citations': {
    style: () => ({ color: 'rgb(20 28 38 / 30%)', weight: 1, fill: false }),
    onEachFeature: () => {},
  },
};

// ## The SlideDeck object
const deck = new SlideDeck(container, slides, map, slideOptions);

// Per-slide legend
const legendRows = (title, rows) =>
  (title ? `<span class="lg-title">${title}</span>` : '')
  + rows.map((r) => `<span class="lg-row"><span class="lg-sw" style="background:${r.c}"></span>${r.t}</span>`).join('');

const legendGrad = (title, c0, c1, lo, hi) =>
  (title ? `<span class="lg-title">${title}</span>` : '')
  + `<span class="lg-bar" style="background:linear-gradient(90deg, ${c0}, ${c1})"></span>`
  + `<span class="lg-ends"><span>${lo}</span><span>${hi}</span></span>`;

const legendHTML = {
  'intro': legendRows('Transit network', [
    { c: '#004080', t: 'Bus route' },
    { c: '#EF0000', t: 'METRORAIL Red Line' },
    { c: '#3E7E00', t: 'Green Line' },
    { c: '#40007E', t: 'Purple Line' },
  ]),
  'need': legendGrad('Car-free households', '#f6d3e3', '#c81e6f', '0%', '60%+'),
  'jobs': legendGrad('Jobs reachable in 45 min by transit', '#e6521f', '#0f8f83', 'fewer', 'more')
    + legendRows('', [{ c: NODATA, t: 'No modeled transit' }]),
  'gap': legendRows('Job-access gap', [{ c: '#ffb020', t: 'Highest need, lowest access' }, { c: '#a9b3bc', t: 'Everywhere else' }]),
  'stranded': legendGrad('Car-free, no stop within 0.5 mi', '#fbe6c2', '#e08a00', '15%', '34%'),
  'deserts-food': legendRows('Grocery access', [{ c: '#d98a1f', t: 'Low-income, low grocery access' }, { c: '#cbd2d8', t: 'Not flagged' }]),
  'food-carless': legendRows('Grocery deserts', [{ c: '#e11d5e', t: 'Also car-free (15%+)' }, { c: '#d98a1f', t: 'Grocery desert' }]),
  'deserts-childcare': legendRows('Childcare access', [{ c: '#8b5cf6', t: 'Childcare desert' }, { c: '#cbd2d8', t: 'Adequate' }]),
  'triple-risk': legendRows('Fails all three tests', [{ c: '#e11d38', t: 'Job + grocery + childcare gap' }]),
  'redlining': legendRows('Fails all three tests, today', [{ c: '#e11d38', t: 'Job + grocery + childcare gap' }]),
  'action': legendRows('Where to improve', [{ c: '#14303c', t: 'Frequent bus routes' }, { c: '#f2b134', t: 'Run more often (181)' }, { c: '#7c3aed', t: 'Extend service (33)' }]),
};

const legendEl = document.querySelector('#legend');
const mapContainerEl = document.querySelector('.map-container');

// star + dot at Rice University, the reference point
const riceIcon = L.divIcon({
  className: 'rice-pin-icon',
  html: '<span class="pin-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const riceDot = L.marker([29.7174, -95.4018], { icon: riceIcon })
  .bindTooltip('Rice University (reference point)');

let lastLegendId = null;
const updateLegend = () => {
  const id = deck.slides[deck.currentSlideIndex] && deck.slides[deck.currentSlideIndex].id;
  if (id === lastLegendId) { return; }
  lastLegendId = id;
  const html = legendHTML[id];
  if (html) {
    legendEl.innerHTML = html;
    legendEl.hidden = false;
  } else { legendEl.hidden = true; }
  mapContainerEl.style.visibility = (id === 'citations') ? 'hidden' : '';
  // May need to adjust legend position for certain slides, e.g. if the map is zoomed in and the legend would cover important features
  legendEl.classList.toggle('legend-right', id === 'stranded' || id === 'triple-risk' || id === 'intro');
  if (id === 'redlining') { riceDot.addTo(map); } else if (map.hasLayer(riceDot)) { map.removeLayer(riceDot); }
};

document.addEventListener('scroll', () => { deck.calcCurrentSlideIndex(); updateLegend(); });

deck.preloadFeatureCollections();
deck.syncMapToCurrentSlide();
updateLegend();

// Fill a slide's scrollable table from the same GeoJSON its map uses.
const fillTable = async (selector, src, sortFn, rowFn) => {
  const body = document.querySelector(selector);
  if (!body) { return; }
  const fc = await (await fetch(src)).json();
  const rows = fc.features.map((f) => f.properties).sort(sortFn);
  body.innerHTML = rows.map(rowFn).join('');
};

fillTable(
  '#stranded-rows',
  'data/stranded.geojson',
  (a, b) => b.stop_mi - a.stop_mi,
  (p) => {
    const inc = p.median_hh_income
      ? `$${Math.round(p.median_hh_income).toLocaleString()}`
      : '';
    const zc = (p.pct_zero_car === null || p.pct_zero_car === undefined)
      ? 'n/a'
      : `${Math.round(p.pct_zero_car * 100)}%`;
    return `<tr><td class="geoid">${p.geoid}</td><td class="numeric">${zc}</td>`
      + `<td class="numeric">${inc}</td>`
      + `<td class="numeric">${p.stop_mi.toFixed(1)} mi</td></tr>`;
  },
);

fillTable(
  '#triple-rows',
  'data/triple-risk.geojson',
  (a, b) => (b.pct_zero_car || 0) - (a.pct_zero_car || 0),
  (p) => {
    const pop = p.total_pop ? Math.round(p.total_pop).toLocaleString() : 'n/a';
    const inc = p.median_hh_income
      ? `$${Math.round(p.median_hh_income).toLocaleString()}`
      : '';
    const zc = (p.pct_zero_car === null || p.pct_zero_car === undefined)
      ? 'n/a'
      : `${Math.round(p.pct_zero_car * 100)}%`;
    return `<tr><td class="geoid">${p.GEOID}</td><td class="numeric">${pop}</td>`
      + `<td class="numeric">${inc}</td><td class="numeric">${zc}</td></tr>`;
  },
);
// ## Redlining image lightbox: click to enlarge, drag to pan
const lightbox = document.querySelector('#lightbox');
const lbStage = document.querySelector('#lightbox-stage');
const lbTrigger = document.querySelector('.hist-figure img.zoomable');
const lbClose = document.querySelector('#lightbox-close');

const openLightbox = () => {
  lightbox.hidden = false;
  requestAnimationFrame(() => {
    lbStage.scrollLeft = (lbStage.scrollWidth - lbStage.clientWidth) / 2;
    lbStage.scrollTop = (lbStage.scrollHeight - lbStage.clientHeight) / 2;
  });
  lbClose.focus();
};
const closeLightbox = () => {
  lightbox.hidden = true;
  if (lbTrigger) { lbTrigger.focus(); }
};

if (lbTrigger) {
  lbTrigger.addEventListener('click', openLightbox);
  lbTrigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(); }
  });
}
lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) { closeLightbox(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.hidden) { closeLightbox(); }
});

let dragging = false;
let startX = 0;
let startY = 0;
let startLeft = 0;
let startTop = 0;
lbStage.addEventListener('pointerdown', (e) => {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  startLeft = lbStage.scrollLeft;
  startTop = lbStage.scrollTop;
  lbStage.classList.add('grabbing');
  lbStage.setPointerCapture(e.pointerId);
});
lbStage.addEventListener('pointermove', (e) => {
  if (!dragging) { return; }
  lbStage.scrollLeft = startLeft - (e.clientX - startX);
  lbStage.scrollTop = startTop - (e.clientY - startY);
});
const endDrag = () => {
  dragging = false;
  lbStage.classList.remove('grabbing');
};
lbStage.addEventListener('pointerup', endDrag);
lbStage.addEventListener('pointercancel', endDrag);
