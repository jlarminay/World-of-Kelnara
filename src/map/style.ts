// Google-Maps-like light style. Zooms: z8 = whole world, ~z15 = a city, z18+ = buildings.
import type {
  DataDrivenPropertyValueSpecification, ExpressionSpecification, FilterSpecification, LayerSpecification, StyleSpecification,
} from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { layers } from '@/world/data'
import { BASE_ZOOM } from '@/world/coords'

export const C = {
  sea: '#aadaff',
  land: '#f3f2ee',
  arid: '#f6ecd6',
  forest: '#cbe6c3',
  mountain: '#e6e1d4',
  ridge: '#cfc8b8',
  lake: '#aadaff',
  river: '#aadaff',
  border: '#c4615a', // muted red, like the drawing's dashed province lines (paths stay grey)
  urban: '#ebe9e4',
  block: '#e3e1dc',
  building: '#dddad4',
  buildingLine: '#d2cec7',
  landmark: '#f1e3c6',
  park: '#c5e8c5',
  plaza: '#f5f4f1',
  fields: ['#e6efd4', '#edf0d3', '#e1ecd1', '#f0ecd6'],
  pasture: '#e0eed4',
  orchard: '#d3eac8',
  farmyard: '#ebe6dc',
  road: '#ffffff',
  roadCase: '#d6d4cf',
  highway: '#fde293',
  highwayCase: '#e3b64e',
  trail: '#b9b4aa',
  wall: '#b5a58e',
  selected: '#db4437', // outline of the selected city or district, like Google's boundary highlight
  route: '#1a73e8',
  routeCase: '#1557b0',
  text: '#202124',
  textMuted: '#5f6368',
  textFaint: '#80868b',
  waterText: '#4a7fb5',
  halo: '#ffffff',
}

export const FONT = { regular: ['Noto Sans Regular'], bold: ['Noto Sans Bold'], italic: ['Noto Sans Italic'] }

const z = (level: number) => BASE_ZOOM + level
type Num = DataDrivenPropertyValueSpecification<number>
/** Linear zoom ramp: lerp([[zoom, value], ...]) */
const ramp = (...stops: [number, number][]): Num =>
  ['interpolate', ['linear'], ['zoom'], ...stops.flat()] as unknown as Num
/** Exponential ramp, for line widths that should roughly double per zoom like Google's. */
const ramp2 = (...stops: [number, number][]): Num =>
  ['interpolate', ['exponential', 1.6], ['zoom'], ...stops.flat()] as unknown as Num
const cls = (...c: string[]): FilterSpecification => ['match', ['get', 'class'], c, true, false]
/** Show a feature once the map reaches its detail level (`minzoom` property). */
const atLevel: ExpressionSpecification = ['>=', ['zoom'], ['+', BASE_ZOOM, ['coalesce', ['get', 'minzoom'], 0]]]

/** Screen px per drawing px (0.001°) at zoom 8; doubles every zoom level. */
const PX8 = (512 * 2 ** 8 / 360) * 0.001

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function buildStyle(): StyleSpecification {
  const geo = (data: FeatureCollection, extra = {}) => ({ type: 'geojson' as const, data, ...extra })
  const L: LayerSpecification[] = [
    { id: 'sea', type: 'background', paint: { 'background-color': C.sea } },

    // ---- natural world ----
    { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': C.land, 'fill-antialias': true } },
    { id: 'arid', type: 'fill', source: 'provinces', filter: ['==', ['get', 'name'], 'Scorched Lands'], paint: { 'fill-color': C.arid } },
    { id: 'mountains', type: 'fill', source: 'mountains', paint: { 'fill-color': C.mountain } },
    { id: 'ridges', type: 'line', source: 'ridges', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.ridge, 'line-width': ramp2([z(0), 1], [z(4), 4], [z(8), 10]) } },
    { id: 'forests', type: 'fill', source: 'forests', paint: { 'fill-color': C.forest } },

    // ---- hand-drawn city areas, walls and farmland (data/areas.geojson) ----
    { id: 'area-farmland', type: 'fill', source: 'areas', minzoom: z(1.5), filter: ['==', ['get', 'kind'], 'farmland'],
      paint: { 'fill-color': C.fields[0], 'fill-opacity': ramp([z(1.5), 0], [z(2.5), 1]) } },
    { id: 'area-urban', type: 'fill', source: 'areas', minzoom: z(1), filter: ['==', ['get', 'kind'], 'urban'],
      paint: { 'fill-color': C.urban, 'fill-opacity': ramp([z(1), 0], [z(2), 1]) } },
    { id: 'area-wall', type: 'line', source: 'areas', minzoom: z(2.5), filter: ['==', ['get', 'kind'], 'wall'], layout: { 'line-cap': 'round' },
      paint: { 'line-color': C.wall, 'line-width': ramp2([z(2.5), 1.5], [z(6), 5], [z(8), 10]) } },

    // ---- generated city + farmland (see procedural/city.ts) ----
    { id: 'city-urban', type: 'fill', source: 'city-areas', minzoom: 9.5, filter: cls('urban'),
      paint: { 'fill-color': C.urban, 'fill-opacity': ramp([9.5, 0], [10.5, 1]), 'fill-antialias': false } },
    { id: 'city-farmland', type: 'fill', source: 'city-areas', minzoom: 12.5, filter: cls('field', 'pasture', 'orchard', 'farmyard'),
      paint: {
        'fill-color': ['match', ['get', 'class'], 'pasture', C.pasture, 'orchard', C.orchard, 'farmyard', C.farmyard,
          ['match', ['get', 'crop'], 0, C.fields[0], 1, C.fields[1], 2, C.fields[2], C.fields[3]]],
        'fill-opacity': ramp([12.5, 0], [14.5, 1]),
      } },
    { id: 'city-green', type: 'fill', source: 'city-areas', minzoom: 11.5, filter: cls('park', 'woodlot'),
      paint: { 'fill-color': ['match', ['get', 'class'], 'woodlot', C.forest, C.park], 'fill-opacity': ramp([11.5, 0], [13, 1]) } },
    { id: 'city-plaza', type: 'fill', source: 'city-areas', minzoom: 14, filter: cls('plaza'), paint: { 'fill-color': C.plaza } },
    { id: 'city-blocks', type: 'fill', source: 'city-areas', minzoom: 14.5, filter: cls('block'),
      paint: { 'fill-color': C.block, 'fill-opacity': ramp([14.5, 0], [15.5, 1]) } },
    { id: 'city-buildings', type: 'fill', source: 'city-areas', minzoom: 16, filter: cls('building'),
      paint: { 'fill-color': C.building, 'fill-outline-color': C.buildingLine, 'fill-opacity': ramp([16, 0], [17, 1]) } },
    { id: 'city-landmark', type: 'fill', source: 'city-areas', minzoom: 13, filter: cls('landmark'),
      paint: { 'fill-color': C.landmark, 'fill-outline-color': '#d9c7a3' } },

    // ---- generated streets ----
    { id: 'city-track', type: 'line', source: 'city-lines', minzoom: 14.5, filter: cls('track'),
      paint: { 'line-color': '#d9d4c7', 'line-width': ramp2([14.5, 0.5], [16, 1.5], [19, 4]), 'line-opacity': ramp([14.5, 0], [15.5, 1]) } },
    { id: 'city-minor', type: 'line', source: 'city-lines', minzoom: 15, filter: cls('minor'), layout: { 'line-cap': 'round' },
      paint: { 'line-color': C.road, 'line-width': ramp2([15, 0.5], [17, 2.5], [20, 12]), 'line-opacity': ramp([15, 0], [16, 1]) } },
    { id: 'city-street-case', type: 'line', source: 'city-lines', minzoom: 14, filter: cls('street'), layout: { 'line-join': 'round' },
      paint: { 'line-color': C.roadCase, 'line-width': ramp2([14, 1], [17, 6], [20, 24]), 'line-opacity': ramp([14, 0], [15, 1]) } },
    { id: 'city-street', type: 'line', source: 'city-lines', minzoom: 14, filter: cls('street'), layout: { 'line-join': 'round' },
      paint: { 'line-color': C.road, 'line-width': ramp2([14, 0.5], [17, 4.5], [20, 20]), 'line-opacity': ramp([14, 0], [15, 1]) } },
    { id: 'city-wall', type: 'line', source: 'city-lines', minzoom: 13, filter: cls('wall'), layout: { 'line-join': 'round' },
      paint: { 'line-color': C.wall, 'line-width': ramp2([13, 1], [17, 4], [20, 12]) } },
    { id: 'city-artery-case', type: 'line', source: 'city-lines', minzoom: 11.5, filter: cls('artery'), layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.highwayCase, 'line-width': ramp2([11.5, 1], [14, 4], [17, 10], [20, 34]) } },
    { id: 'city-artery', type: 'line', source: 'city-lines', minzoom: 11.5, filter: cls('artery'), layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.highway, 'line-width': ramp2([11.5, 0.5], [14, 2.8], [17, 8], [20, 30]) } },

    // ---- water, drawn over any generated city that overhangs a shore ----
    { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': C.lake } },
    { id: 'rivers', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.river, 'line-width': ramp2([z(0), 1], [z(2), 2.5], [z(6), 14], [z(10), 60]) } },

    // Heimdall: a wall of water drawn as a band true to its width at every zoom; the ends fade out
    // because it carries on beyond the known map
    { id: 'heimdall', type: 'line', source: 'areas', filter: ['==', ['get', 'kind'], 'water_wall'],
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-width': ['interpolate', ['exponential', 2], ['zoom'], 8, PX8 * 120, 16, PX8 * 120 * 256] as unknown as Num,
        'line-gradient': ['interpolate', ['linear'], ['line-progress'],
          0, 'rgba(66, 125, 196, 0)', 0.2, 'rgba(66, 125, 196, 0.9)', 0.8, 'rgba(66, 125, 196, 0.9)', 1, 'rgba(66, 125, 196, 0)'],
      } },
    { id: 'heimdall-crest', type: 'line', source: 'areas', filter: ['==', ['get', 'kind'], 'water_wall'],
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-width': ['interpolate', ['exponential', 2], ['zoom'], 8, PX8 * 28, 16, PX8 * 28 * 256] as unknown as Num,
        'line-gradient': ['interpolate', ['linear'], ['line-progress'],
          0, 'rgba(255, 255, 255, 0)', 0.25, 'rgba(255, 255, 255, 0.35)', 0.75, 'rgba(255, 255, 255, 0.35)', 1, 'rgba(255, 255, 255, 0)'],
      } },
    // the original drawing (raster) is added here on demand by controller.ts, before 'borders'

    { id: 'borders', type: 'line', source: 'borders',
      paint: { 'line-color': C.border, 'line-width': ramp([z(0), 1], [z(4), 2]), 'line-dasharray': [3, 2], 'line-opacity': ramp([z(3), 1], [z(5), 0]) } },

    // ---- world roads (drafts from the trace) ----
    { id: 'road-trail', type: 'line', source: 'roads', minzoom: z(2), filter: ['==', ['get', 'rank'], 'trail'],
      paint: { 'line-color': C.trail, 'line-width': ramp([z(2), 1], [z(6), 2]), 'line-dasharray': [2, 2] } },
    ...(['road', 'highway'] as const).flatMap((rank): LayerSpecification[] => {
      const hw = rank === 'highway'
      const w = hw ? ramp2([z(0), 1.2], [z(3), 3], [z(6), 8]) : ramp2([z(1), 0.8], [z(3), 2.2], [z(6), 6])
      const wc = hw ? ramp2([z(0), 2.2], [z(3), 4.5], [z(6), 10]) : ramp2([z(1), 1.6], [z(3), 3.4], [z(6), 8])
      const minzoom = hw ? 0 : z(1)
      const filter: FilterSpecification = ['==', ['get', 'rank'], rank]
      return [
        { id: `road-${rank}-case`, type: 'line', source: 'roads', minzoom, filter, layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': hw ? C.highwayCase : C.roadCase, 'line-width': wc } },
        { id: `road-${rank}`, type: 'line', source: 'roads', minzoom, filter, layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': hw ? C.highway : C.road, 'line-width': w } },
      ]
    }),

    // ---- boundary of the selected city/district (place.area); the filter is set by controller.ts ----
    { id: 'area-selected', type: 'line', source: 'areas', filter: ['==', ['get', 'id'], ''], layout: { 'line-join': 'round' },
      paint: { 'line-color': C.selected, 'line-width': ramp([z(0), 1.5], [z(6), 2.5]), 'line-dasharray': [3, 1.5] } },

    // ---- journey route ----
    { id: 'route-case', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.routeCase, 'line-width': ramp2([z(0), 6], [z(6), 12], [z(10), 16]) } },
    { id: 'route', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.route, 'line-width': ramp2([z(0), 4], [z(6), 9], [z(10), 12]) } },
    // invisible, wider copy of the line: what you grab to drag the route (src/map/routeEdit.ts)
    { id: 'route-hit', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 22 } },
    { id: 'route-hover', type: 'circle', source: 'route-hover',
      paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': C.routeCase, 'circle-stroke-width': 2 } },
    { id: 'route-ends', type: 'circle', source: 'route', filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 6, 'circle-color': ['match', ['get', 'end'], 'to', '#ea4335', '#ffffff'],
        'circle-stroke-color': ['match', ['get', 'end'], 'to', '#b31412', '#202124'], 'circle-stroke-width': 2.5 } },

    // ---- labels ----
    { id: 'label-water', type: 'symbol', source: 'labels', maxzoom: z(4), filter: ['all', ['==', ['get', 'kind'], 'water'], atLevel],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT.italic, 'text-size': ramp([z(0), 13], [z(3), 18]), 'text-letter-spacing': 0.1,
        'text-max-width': 8 },
      paint: { 'text-color': C.waterText, 'text-halo-color': 'rgba(255,255,255,.4)', 'text-halo-width': 1 } },
    // lakes: shown from their own detail level all the way in (hidden while a city name needs the space)
    { id: 'label-lake', type: 'symbol', source: 'labels', filter: ['all', ['==', ['get', 'kind'], 'lake'], atLevel],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT.italic, 'text-size': ramp([z(2), 12], [z(6), 16]), 'text-letter-spacing': 0.08,
        'text-max-width': 8 },
      paint: { 'text-color': C.waterText, 'text-halo-color': 'rgba(255,255,255,.4)', 'text-halo-width': 1 } },
    { id: 'label-province', type: 'symbol', source: 'labels', maxzoom: z(3), filter: ['all', ['==', ['get', 'kind'], 'province'], atLevel],
      layout: { 'text-field': ['upcase', ['get', 'name']], 'text-font': FONT.regular, 'text-size': ramp([z(0), 12], [z(3), 16]),
        'text-letter-spacing': 0.25 },
      paint: { 'text-color': C.textFaint, 'text-halo-color': C.halo, 'text-halo-width': 1.5 } },
    { id: 'label-region', type: 'symbol', source: 'labels', minzoom: z(0.5), maxzoom: z(5), filter: ['all', ['==', ['get', 'kind'], 'region'], atLevel],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT.italic, 'text-size': ramp([z(1), 12], [z(4), 15]), 'text-letter-spacing': 0.08 },
      paint: { 'text-color': ['match', ['get', 'name'], 'Emerald Woods', '#2d7a3a', 'Steel Spine Mountains', '#8d6e63', 'Snow Capped Mountains', '#8d6e63', C.textMuted],
        'text-halo-color': C.halo, 'text-halo-width': 1.5 } },
    { id: 'label-river', type: 'symbol', source: 'rivers', minzoom: z(2), filter: ['has', 'name'],
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': FONT.italic, 'text-size': ramp([z(2), 11], [z(6), 14]),
        'symbol-spacing': 300, 'text-letter-spacing': 0.05 },
      paint: { 'text-color': C.waterText, 'text-halo-color': C.halo, 'text-halo-width': 1.5 } },
    { id: 'label-heimdall', type: 'symbol', source: 'areas', filter: ['==', ['get', 'kind'], 'water_wall'],
      layout: { 'symbol-placement': 'line', 'text-field': ['upcase', ['get', 'name']], 'text-font': FONT.bold, 'symbol-spacing': 600,
        'text-size': ramp([z(0), 12], [z(4), 18]), 'text-letter-spacing': 0.4, 'text-keep-upright': true },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(40, 90, 150, 0.6)', 'text-halo-width': 1.5 } },
    { id: 'label-artery', type: 'symbol', source: 'city-lines', minzoom: 13.5, filter: cls('artery'),
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': FONT.regular, 'text-size': ramp([13.5, 10], [18, 13]),
        'symbol-spacing': 400 },
      paint: { 'text-color': C.textMuted, 'text-halo-color': C.halo, 'text-halo-width': 1.5 } },

    // places: districts (text only), settlements (dot + label), POIs (pin + coloured label)
    { id: 'place-district', type: 'symbol', source: 'places', filter: ['all', ['==', ['get', 'rank'], 'district'], atLevel],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT.regular, 'text-size': ramp([14, 12], [17, 15]),
        'text-letter-spacing': 0.05, 'text-max-width': 7 },
      paint: { 'text-color': C.textMuted, 'text-halo-color': C.halo, 'text-halo-width': 1.5 } },
    { id: 'place-poi', type: 'symbol', source: 'places', filter: ['all', ['==', ['get', '_pinned'], true], atLevel],
      layout: { 'icon-image': ['get', '_icon'], 'icon-size': ramp([z(2), 0.85], [z(8), 1]),
        'text-field': ['get', 'name'], 'text-font': FONT.bold, 'text-size': 11.5, 'text-max-width': 8,
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 1.1, 'text-justify': 'auto',
        'text-optional': true, 'symbol-sort-key': ['get', '_sort'] },
      paint: { 'text-color': ['get', '_color'], 'text-halo-color': C.halo, 'text-halo-width': 1.5 } },
    { id: 'place-settlement', type: 'symbol', source: 'places',
      // Cities with generated streets drop their name once you are inside them, like Google.
      filter: ['all', ['match', ['get', 'rank'], ['capital', 'city', 'town', 'village'], true, false], atLevel,
        ['any', ['!', ['to-boolean', ['get', '_generated']]], ['<', ['zoom'], 15]]],
      layout: {
        'icon-image': ['get', '_icon'],
        'text-field': ['get', 'name'],
        'text-font': ['match', ['get', 'rank'], ['capital', 'city'], ['literal', FONT.bold], ['literal', FONT.regular]],
        'text-size': ['interpolate', ['linear'], ['zoom'], z(0), ['match', ['get', 'rank'], 'capital', 14, 'city', 12, 11], z(6),
          ['match', ['get', 'rank'], 'capital', 22, 'city', 18, 15]],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.7, 'text-justify': 'auto',
        'text-max-width': 9, 'symbol-sort-key': ['get', '_sort'],
      },
      paint: { 'text-color': ['match', ['get', 'rank'], ['capital', 'city'], C.text, C.textMuted], 'text-halo-color': C.halo, 'text-halo-width': 2 } },
  ]

  return {
    version: 8,
    glyphs: 'glyphs://{fontstack}/{range}',
    sources: {
      // low simplification tolerance keeps coastlines and lakes round at low zoom instead of angular
      ...Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, geo(v, { tolerance: 0.08, ...(k === 'areas' ? { lineMetrics: true } : {}) })])),
      places: geo(empty),
      route: geo(empty),
      'route-hover': geo(empty),
      'city-areas': geo(empty, { maxzoom: 18, tolerance: 0.2 }),
      'city-lines': geo(empty, { maxzoom: 18, tolerance: 0.2 }),
    },
    layers: L,
  }
}
