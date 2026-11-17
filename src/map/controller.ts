// Creates the MapLibre map and keeps it in sync with the store.
import * as maplibregl from 'maplibre-gl'
import { type GeoJSONSource, type LngLatBoundsLike, type MapGeoJSONFeature } from 'maplibre-gl'
import { nextTick, watch } from 'vue'
import type { Feature, FeatureCollection, Position } from 'geojson'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import glyphRegular from '@/assets/glyphs/noto-sans-regular-0-255.pbf?url'
import glyphBold from '@/assets/glyphs/noto-sans-bold-0-255.pbf?url'
import glyphItalic from '@/assets/glyphs/noto-sans-italic-0-255.pbf?url'
import drawingUrl from '@/assets/kelnara-drawing.webp?url'
import { buildStyle } from './style'
import { buildImages } from './icons'
import { setupMeasure } from './measure'
import { setupRouteEdit } from './routeEdit'
import { setupCompare } from './compare'
import { setupJourney } from './journey'
import { settlementRadiusDeg } from './procedural/city'
import { bake, baked, bakeKey, toGeoJSON, type CityGeometry } from './procedural/bake'
import { layers, type LayerName } from '@/world/data'
import { BASE_ZOOM, MAX_ZOOM, levelToZoom } from '@/world/coords'
import { bboxOf } from '@/world/geo'
import { categoryOf, isPinned, pinImageId } from '@/world/categories'
import { RANKS } from '@/world/types'
import { hereAt } from '@/world/party'
import { clearSelection, mapRef, placeById, selectPlace, selectSession, sheetPx, store } from '@/state/store'
import { applyRoute, routeOf } from '@/state/route'

// The site must be served over http(s): browsers block workers on file:// pages.
maplibregl.setWorkerUrl(workerUrl)

const GLYPHS: Record<string, string> = {
  'Noto Sans Regular': glyphRegular,
  'Noto Sans Bold': glyphBold,
  'Noto Sans Italic': glyphItalic,
}
maplibregl.addProtocol('glyphs', async (params) => {
  const [, stack, range] = decodeURIComponent(params.url).match(/^glyphs:\/\/([^/]+)\/(.+)$/) ?? []
  const url = GLYPHS[stack?.split(',')[0]]
  // Only Latin (0-255) is bundled; other ranges come back empty.
  if (!url || range !== '0-255') return { data: new ArrayBuffer(0) }
  return { data: await (await fetch(url)).arrayBuffer() }
})

export const CLICKABLE_PLACES = ['place-poi', 'place-settlement', 'place-district']
const CLICKABLE_FEATURES: [string, LayerName][] = [['heimdall', 'areas'], ['lakes', 'lakes'], ['forests', 'forests'], ['mountains', 'mountains']]

/** Adds the per-feature styling props the map style reads (`_icon`, `_color`, `_sort`, `_pinned`). */
function decoratePlaces(): FeatureCollection {
  const generated = new Set(store.settlements.map((s) => s.placeId))
  return {
    type: 'FeatureCollection',
    features: store.places.features.map((f) => {
      const p = f.properties
      const pinned = isPinned(p)
      const rankIcon = p.rank === 'capital' ? 'dot-capital' : p.rank === 'city' ? 'dot-city' : 'dot-town'
      return {
        ...f,
        properties: { ...p, _generated: generated.has(p.id), _pinned: pinned, _icon: pinned ? pinImageId(p.kind) : rankIcon, _color: categoryOf(p).color, _sort: RANKS.indexOf(p.rank) },
      }
    }),
  }
}

export async function createMap(container: HTMLElement) {
  const { images, pixelRatio } = await buildImages()
  const initial = parseHash()
  const map = new maplibregl.Map({
    container,
    style: buildStyle(),
    center: initial?.center ?? [0, 0],
    zoom: initial?.zoom ?? BASE_ZOOM,
    minZoom: BASE_ZOOM - 1,
    maxZoom: MAX_ZOOM,
    maxBounds: [[-1.6, -1.8], [1.6, 1.8]],
    renderWorldCopies: false,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
  })
  map.touchZoomRotate.disableRotation()
  await new Promise<void>((res) => map.once('load', () => res()))
  for (const [id, img] of Object.entries(images)) map.addImage(id, img, { pixelRatio })
  mapRef.value = map

  if (!initial) {
    const b = bboxOf(layers.land.features[0].geometry)
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 0 })
  }

  // Keep the camera's padding in step with the panel, without moving what is on screen: otherwise the padding of
  // the last flyTo stays after the panel closes, and the map zooms out off-centre.
  // A flight that is under way already has the new padding (it was started after the panel changed); jumping
  // here would cancel it, and the map would not move to what was just opened.
  const syncPadding = () => {
    if (map.isMoving()) return
    const pad = cameraPadding()
    const c = map.getContainer()
    const at: [number, number] = [pad.left + (c.clientWidth - pad.left - pad.right) / 2, pad.top + (c.clientHeight - pad.top - pad.bottom) / 2]
    map.jumpTo({ center: map.unproject(at), padding: pad })
  }
  syncPadding()
  // a change made during a flight was skipped above; catch up once the map stops
  map.on('moveend', () => {
    const pad = cameraPadding(), has = map.getPadding()
    if (pad.top !== has.top || pad.bottom !== has.bottom || pad.left !== has.left || pad.right !== has.right) syncPadding()
  })
  watch(() => [store.panel === 'none', store.mobile, store.mobile && store.sheet], syncPadding)

  // ---- places ----
  const placesSource = map.getSource('places') as GeoJSONSource
  watch(() => store.places, () => placesSource.setData(decoratePlaces()), { deep: true, immediate: true })

  // ---- generated cities: baked files from data/generated, or a live preview of unbaked changes ----
  const cache = new Map<string, CityGeometry>()
  const cityKey = () => JSON.stringify(store.settlements.map((s) => [s, placeById.value.get(s.placeId)?.geometry.coordinates]))
  const refreshCities = () => {
    if (map.getZoom() < 9.5) return
    const bounds = map.getBounds()
    let changed = false
    for (const s of store.settlements) {
      const center = placeById.value.get(s.placeId)?.geometry.coordinates
      if (!center || cache.has(s.id)) continue
      const rad = settlementRadiusDeg(s)
      if (center[0] + rad < bounds.getWest() || center[0] - rad > bounds.getEast() || center[1] + rad < bounds.getSouth() || center[1] - rad > bounds.getNorth()) continue
      const b = baked[s.id]
      // A deployed build always uses the baked file, so the map never changes under players.
      cache.set(s.id, toGeoJSON(b && (!import.meta.env.DEV || bakeStatus(s.id) === 'baked') ? b : bake(s, center)))
      changed = true
    }
    if (!changed) return
    const all = [...cache.values()]
    const fc = (k: keyof CityGeometry): FeatureCollection => ({ type: 'FeatureCollection', features: all.flatMap((c) => c[k].features as Feature[]) })
    ;(map.getSource('city-areas') as GeoJSONSource).setData(fc('areas'))
    ;(map.getSource('city-lines') as GeoJSONSource).setData(fc('lines'))
  }
  map.on('moveend', refreshCities)
  watch(cityKey, () => { cache.clear(); refreshCities() })
  refreshCities()

  // ---- interaction ----
  setupMeasure(map)
  setupRouteEdit(map)
  setupCompare(map)
  setupJourney(map)
  // right-click menu
  map.on('contextmenu', (e) => {
    e.preventDefault()
    store.contextMenu = { x: e.point.x, y: e.point.y, lngLat: [e.lngLat.lng, e.lngLat.lat] }
  })
  for (const ev of ['movestart', 'zoomstart'] as const) map.on(ev, () => (store.contextMenu = null))
  // touch: a long press opens the same menu
  let press = 0
  let pressAt: maplibregl.Point | null = null
  const cancelPress = () => { clearTimeout(press); pressAt = null }
  map.on('touchstart', (e) => {
    cancelPress()
    if (e.points.length !== 1) return
    pressAt = e.point
    press = window.setTimeout(() => {
      store.longPressAt = Date.now()
      store.contextMenu = { x: e.point.x, y: e.point.y, lngLat: [e.lngLat.lng, e.lngLat.lat] }
    }, 550)
  })
  map.on('touchmove', (e) => { if (pressAt && e.point.dist(pressAt) > 8) cancelPress() })
  map.on('touchend', cancelPress)
  map.on('touchcancel', cancelPress)

  map.on('click', (e) => {
    if (Date.now() - store.longPressAt < 600) return // the tap that ends a long press
    if (store.contextMenu) return void (store.contextMenu = null)
    if (store.measure.active) return // handled by measure.ts
    if (map.queryRenderedFeatures(e.point, { layers: ['compare-fill'] }).length) return // handled by compare.ts
    const hit = map.queryRenderedFeatures(e.point, { layers: CLICKABLE_PLACES })[0]
    if (hit) {
      selectPlace(hit.properties.id)
      return void nextTick(() => keepInView(e.lngLat.toArray()))
    }
    // the trail is only drawn while sessions are open (journey.ts); hidden layers never match
    const leg = map.queryRenderedFeatures(e.point, { layers: ['journey-hit', 'journey-stops'] })[0]
    if (leg) return selectSession(leg.properties.session)
    const area = map.queryRenderedFeatures(e.point, { layers: CLICKABLE_FEATURES.map(([l]) => l) }).find((f) => f.properties.name)
    if (area) {
      const layer = CLICKABLE_FEATURES.find(([l]) => l === area.layer.id)![1]
      store.selection = { type: 'feature', layer, id: area.properties.id }
      store.panel = 'details'
      return
    }
    clearSelection()
  })
  for (const id of [...CLICKABLE_PLACES, ...CLICKABLE_FEATURES.map(([l]) => l)]) {
    map.on('mouseenter', id, (e) => {
      const f = e.features?.[0] as MapGeoJSONFeature | undefined
      if (CLICKABLE_PLACES.includes(id) || f?.properties.name) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
  }

  // ---- selected place: red Google-style pin ----
  const pinEl = document.createElement('div')
  pinEl.innerHTML = `<svg width="27" height="43" viewBox="0 0 27 43"><path d="M13.5 0C6 0 0 6 0 13.5 0 23.6 13.5 43 13.5 43S27 23.6 27 13.5C27 6 21 0 13.5 0z" fill="#ea4335"/><path d="M13.5 1C6.6 1 1 6.6 1 13.5 1 22.8 13.5 41.2 13.5 41.2S26 22.8 26 13.5C26 6.6 20.4 1 13.5 1z" fill="#ea4335" stroke="#b31412" stroke-width="1"/><circle cx="13.5" cy="13.5" r="5" fill="#b31412"/></svg>`
  const pin = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
  watch(
    () => [store.selection, store.selection?.type === 'place' && placeById.value.get(store.selection.id)?.geometry.coordinates] as const,
    () => {
      const sel = store.selection
      const place = sel?.type === 'place' ? placeById.value.get(sel.id) : null
      if (!place) return void pin.remove()
      pin.setLngLat(place.geometry.coordinates as [number, number]).addTo(map)
    },
    { immediate: true },
  )

  // ---- selected city/district: dashed boundary outline ----
  watch(
    () => (store.selection?.type === 'place' ? placeById.value.get(store.selection.id)?.properties.area : undefined) ?? '',
    (area) => map.setFilter('area-selected', ['==', ['get', 'id'], area]),
    { immediate: true },
  )

  // ---- route: drawn only while directions are open (they keep the route for Back/Forward) ----
  watch(() => store.panel === 'directions', (on) => {
    for (const id of ['route-case', 'route', 'route-hit', 'route-hover', 'route-ends']) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }, { immediate: true })
  // re-fit the view when the start or destination changes, not while the route is being dragged
  let fitPending = false
  watch(() => [store.directions.from, store.directions.to], () => (fitPending = true))
  watch(() => store.directions.result, (r) => {
    const ends = r ? ([['from', r.coords[0]], ['to', r.coords[r.coords.length - 1]]] as const) : []
    ;(map.getSource('route') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: r
        ? [
            { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: r.coords } },
            ...ends.map(([end, at]) => ({ type: 'Feature' as const, properties: { end }, geometry: { type: 'Point' as const, coordinates: at } })),
          ]
        : [],
    })
    if (r && fitPending) fitCoords(r.coords, 80)
    if (r) fitPending = false
  })

  // ---- base layer toggle ----
  // the original drawing is only downloaded the first time someone turns it on
  const showDrawing = (on: boolean) => {
    if (on && !map.getSource('original')) {
      map.addSource('original', { type: 'image', url: drawingUrl, coordinates: [[-0.8, 1.185], [0.8, 1.185], [0.8, -1.185], [-0.8, -1.185]] })
      map.addLayer({ id: 'original', type: 'raster', source: 'original', paint: { 'raster-fade-duration': 0, 'raster-opacity': store.drawingOpacity } }, 'borders')
    }
    if (map.getLayer('original')) map.setLayoutProperty('original', 'visibility', on ? 'visible' : 'none')
  }
  watch(() => store.baseLayer, (b) => showDrawing(b === 'original'), { immediate: true })
  watch(() => store.drawingOpacity, (o) => map.getLayer('original') && map.setPaintProperty('original', 'raster-opacity', o))

  // ---- URL hash: #lng,lat,zoomz[/route] (src/state/route.ts) ----
  // Opening a page pushes a history entry, so Back and Forward step through pages; moving the map only
  // updates the current entry.
  let current = ''
  const url = (route: string) => {
    const c = map.getCenter()
    return `#${c.lng.toFixed(5)},${c.lat.toFixed(5)},${map.getZoom().toFixed(2)}z${route ? '/' + route : ''}`
  }
  map.on('moveend', () => history.replaceState(history.state, '', url(current)))
  watch(routeOf, (route) => {
    if (route === current) return
    current = route
    history.pushState(null, '', url(route))
  })
  // Back/Forward: reopen that page, and return the map to where it was when the page was left (the camera in its URL)
  window.addEventListener('popstate', async () => {
    const h = parseHash()
    applyRoute(h?.place ?? '')
    current = routeOf()
    if (!h) return
    await nextTick() // after the padding follows the panel (syncPadding), which would cut the flight short
    map.flyTo({ center: h.center, zoom: h.zoom, padding: cameraPadding(), duration: 1000 })
  })
  map.on('zoom', () => (store.zoom = map.getZoom()))
  store.zoom = map.getZoom()
  applyRoute(initial?.place ?? '')
  current = routeOf()
  history.replaceState(history.state, '', url(current))

  return map
}

/** 'baked' = data/generated matches the current settlement + centre; 'stale' = it was edited since; 'none' = never baked. */
export function bakeStatus(id: string): 'baked' | 'stale' | 'none' {
  const s = store.settlements.find((s) => s.id === id)
  const b = baked[id]
  const center = s && placeById.value.get(s.placeId)?.geometry.coordinates
  if (!b || !s || !center) return 'none'
  return bakeKey(b.source.settlement, b.source.center) === bakeKey(s, center) ? 'baked' : 'stale'
}

function parseHash() {
  const m = location.hash.match(/^#(-?[\d.]+),(-?[\d.]+),([\d.]+)z(?:\/(.+))?$/)
  return m ? { center: [+m[1], +m[2]] as [number, number], zoom: +m[3], place: m[4] } : null
}

// ---- camera helpers used by the UI ----

export function fitCoords(coords: Position[], padding = 60, maxZoom = MAX_ZOOM - 2) {
  const map = mapRef.value
  if (!map || !coords.length) return
  const b = coords.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity])
  const inset = panelInset()
  const want = { top: padding + 60, bottom: padding + inset.bottom, right: padding, left: padding + inset.left }
  // MapLibre adds the map's own padding (the panel, see cameraPadding) to the padding given here, so only the rest
  // is passed: counting the panel twice pushed the route off-centre, and on phones left no room, so nothing moved.
  const p = map.getPadding()
  const has = { top: p.top ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0, right: p.right ?? 0 }
  const fit = { top: Math.max(0, want.top - has.top), bottom: Math.max(0, want.bottom - has.bottom), left: Math.max(0, want.left - has.left), right: Math.max(0, want.right - has.right) }
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]] as LngLatBoundsLike, { padding: fit, maxZoom })
}

/** Room taken by the panel: on the left on desktop, the bottom sheet on phones. */
const panelInset = () => {
  if (store.panel === 'none') return { left: 0, bottom: 0 }
  // at full height the sheet covers the map; things are placed for when it comes back down to half
  return store.mobile ? { left: 0, bottom: sheetPx(store.sheet === 'full' ? 'peek' : store.sheet) } : { left: 440, bottom: 0 }
}
/** The camera's padding: the part of the screen the panel (and on phones, the search box) leaves visible.
 * MapLibre keeps the padding of the last flyTo, so it is also kept in step with the panel (see createMap). */
const cameraPadding = () => {
  const inset = panelInset()
  return { left: inset.left, top: store.mobile && store.panel !== 'none' ? 60 : 0, right: 0, bottom: inset.bottom }
}

/** Phones: when something tapped on the map ends up under the bottom sheet or the search box, slide it into view. */
function keepInView(at: [number, number]) {
  const map = mapRef.value
  if (!map || !store.mobile || store.panel === 'none') return
  const pad = cameraPadding()
  const y = map.project(at).y
  if (y > pad.top + 40 && y < map.getContainer().clientHeight - pad.bottom - 20) return
  map.easeTo({ center: at, padding: pad, duration: 400 })
}

export function flyToPlace(id: string) {
  const map = mapRef.value
  const place = placeById.value.get(id)
  if (!map || !place) return
  const p = place.properties
  // Settlements with a generated city zoom to show the whole built-up area.
  const settlement = store.settlements.find((s) => s.placeId === id)
  const target = settlement ? 12.2 : levelToZoom(p.minzoom) + 1.5
  map.flyTo({ center: place.geometry.coordinates as [number, number], zoom: Math.max(map.getZoom(), target), padding: cameraPadding(), duration: 1200 })
}

/** The "your location" button: centre on the current location, close enough to see its circle. */
export function flyToHere() {
  const map = mapRef.value
  if (!map) return
  map.flyTo({ center: hereAt, zoom: Math.max(map.getZoom(), levelToZoom(4)), padding: cameraPadding(), duration: 1200 })
}

export function flyToFeature(layer: LayerName, id: string) {
  const f = (layers[layer].features as Feature[]).find((f) => f.properties?.id === id)
  if (!f) return
  if (f.geometry.type === 'Point') {
    mapRef.value?.flyTo({ center: f.geometry.coordinates as [number, number], zoom: Math.max(mapRef.value.getZoom(), levelToZoom(1)), padding: cameraPadding() })
    return
  }
  const b = bboxOf(f.geometry)
  fitCoords([[b[0], b[1]], [b[2], b[3]]], 80)
}
