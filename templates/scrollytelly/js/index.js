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

// color helpers from claude

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
  ? 'car-free n/a' : `${Math.round(v * 100)}% car-free`);

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
        ? 'no modeled transit' : `${Math.round(p.jobs_transit_45).toLocaleString()} jobs in 45 min`;
      layer.bindTooltip(`${carFree(p.pct_zero_car)}, ${jobs}`);
    },
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
};


const legendEl = document.querySelector('#legend');

let lastLegendId = null;
const updateLegend = () => {
  const id = deck.slides[deck.currentSlideIndex] && deck.slides[deck.currentSlideIndex].id;
  if (id === lastLegendId) { return; }
  lastLegendId = id;
  const html = legendHTML[id];
  if (html) { legendEl.innerHTML = html; legendEl.hidden = false; } else { legendEl.hidden = true; }
  // May need to adjust legend position for certain slides, e.g. if the map is zoomed in and the legend would cover important features
  legendEl.classList.toggle('legend-right', id === 'intro');
};

document.addEventListener('scroll', () => { deck.calcCurrentSlideIndex(); updateLegend(); });

deck.preloadFeatureCollections();
deck.syncMapToCurrentSlide();
updateLegend();