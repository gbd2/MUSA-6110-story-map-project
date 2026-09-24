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
    fetch('data/harris-boundary.json').then((r) => r.json()),
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

// ## Interface Elements
const container = document.querySelector('.slide-section');
const slides = document.querySelectorAll('.slide');

const slideOptions = {
  'second-slide': {
    style: (feature) => {
      return {
        color: 'red',
        fillColor: 'green',
        fillOpacity: 0.5,
      };
    },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.label);
    },
  },
  'third-slide': {
    style: (feature) => {
      return {
        color: 'blue',
        fillColor: 'yellow',
        fillOpacity: 0.5,
      };
    },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.label);
    },
  },
};

// ## The SlideDeck object
const deck = new SlideDeck(container, slides, map, slideOptions);

document.addEventListener('scroll', () => deck.calcCurrentSlideIndex());

deck.preloadFeatureCollections();
deck.syncMapToCurrentSlide();
