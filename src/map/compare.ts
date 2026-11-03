// Real-world size comparison (side menu > Tools): faded outlines of real places (data/comparisons.geojson)
// drawn at true scale on the Kelnara map. Drag an outline to move it. Click it to select it: a rotate handle
// appears at its top-right corner; drag the handle to turn the outline, click it to turn it back to 0°.
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MlMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl'
import { createElement, RotateCw } from 'lucide'
import { watch } from 'vue'
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import { comparisonData, layers } from '@/world/data'
import { KM_PER_DEG } from '@/world/coords'
import { mapRef, store, type CompareItem } from '@/state/store'

const R = 6371 // Earth radius, km
const rad = Math.PI / 180

export type Outline = {
  id: string
  name: string
  areaKm2: number
  /** Longest distance across the outline, km. */
  spanKm: number
  /**
   * Polygons as km east/north of the outline's anchor: the middle of its largest island (Honshu for Japan).
   * The label sits there and the outline turns around it.
   */
  km: Position[][][]
  /** Top-right corner of the (unturned) outline's bounding box, km from the anchor: where the rotate handle goes. */
  corner: Position
}

/**
 * Projects real lng/lat to km around a centre (azimuthal equidistant), so a large place like Japan keeps
 * its true shape and distances from the middle rather than being stretched by the lat/lng grid.
 */
function project([lng, lat]: Position, [lng0, lat0]: Position): Position {
  const φ = lat * rad, φ0 = lat0 * rad, dλ = (lng - lng0) * rad
  const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(dλ)
  const c = Math.acos(Math.min(1, Math.max(-1, cosc)))
  const k = c ? c / Math.sin(c) : 1
  return [R * k * Math.cos(φ) * Math.sin(dλ), R * k * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(dλ))]
}

/** Signed area and centroid of a ring (shoelace). */
function ringCentroid(ring: Position[]): { area: number; c: Position } {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]
    const f = x1 * y2 - x2 * y1
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
  }
  return { area: Math.abs(a / 2), c: [cx / (3 * a), cy / (3 * a)] }
}

function toOutline(f: Feature): Outline {
  const g = f.geometry as Polygon | MultiPolygon
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const all = polys.flat(2)
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1])
  const centre = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  const projected = polys.map((poly) => poly.map((ring) => ring.map((p) => project(p, centre))))
  // anchor: centroid of the largest island
  const [ax, ay] = projected.map((poly) => ringCentroid(poly[0])).sort((a, b) => b.area - a.area)[0].c
  const km = projected.map((poly) => poly.map((ring) => ring.map(([x, y]) => [x - ax, y - ay])))
  const pts = km.flatMap((poly) => poly[0])
  let span = 0
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) span = Math.max(span, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]))
  const corner = [Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]
  return { id: f.properties!.id, name: f.properties!.name, areaKm2: f.properties!.area_km2, spanKm: span, km, corner }
}

/** Outlines offered in the card; `"hidden": true` in data/comparisons.geojson switches one off without deleting it. */
export const OUTLINES: Outline[] = comparisonData.features.filter((f) => !f.properties?.hidden).map(toOutline)
export const outlineById = new Map(OUTLINES.map((o) => [o.id, o]))
/** Area of the Kelnara mainland, for "about 1/40 of Kelnara". */
export const KELNARA_KM2: number = layers.land.features.find((f) => f.properties?.id === 'land-0')?.properties?.area_km2 ?? 0

/** A point given in km from an item's anchor, turned by the item's rotation and placed on the Kelnara map. */
function toMap(it: CompareItem, [x, y]: Position): [number, number] {
  const a = -it.rotation * rad // positive rotation = clockwise, like a compass bearing
  const cos = Math.cos(a), sin = Math.sin(a)
  return [it.center[0] + (x * cos - y * sin) / KM_PER_DEG, it.center[1] + (x * sin + y * cos) / KM_PER_DEG]
}

export function openCompare() {
  store.compare.open = true
  store.contextMenu = null
  if (store.mobile) store.panel = 'none'
}

export function closeCompare() {
  store.compare.open = false
  store.compare.items = []
  store.compare.selected = null
}

/** Adds an outline in the middle of the current view, or removes it if it is already on the map. */
export function toggleOutline(id: string) {
  const c = store.compare
  const i = c.items.findIndex((it) => it.id === id)
  if (i >= 0) {
    c.items.splice(i, 1)
    if (c.selected === id) c.selected = null
    return
  }
  const m = mapRef.value?.getCenter()
  c.items.push({ id, center: m ? [m.lng, m.lat] : [0, 0], rotation: 0 })
}

export function setupCompare(map: MlMap) {
  const canvas = map.getCanvas()
  const c = store.compare
  map.addSource('compare', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  // under the route and the labels, so place names stay readable through the overlay
  const sel: maplibregl.ExpressionSpecification = ['==', ['get', 'selected'], true]
  map.addLayer({ id: 'compare-fill', type: 'fill', source: 'compare', filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#8e24aa', 'fill-opacity': ['case', sel, 0.36, 0.28] } }, 'route-case')
  map.addLayer({ id: 'compare-line', type: 'line', source: 'compare', filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { 'line-join': 'round' }, paint: { 'line-color': '#6a1b9a', 'line-width': ['case', sel, 2.5, 1.5], 'line-opacity': 0.9 } }, 'route-case')
  map.addLayer({ id: 'compare-label', type: 'symbol', source: 'compare', filter: ['==', ['geometry-type'], 'Point'],
    layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': '#4a148c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } })

  // ---- rotate handle: shown at the selected outline's top-right corner ----
  const handleEl = document.createElement('div')
  handleEl.className = 'grid size-8 cursor-grab touch-none place-items-center rounded-full border border-[#6a1b9a] bg-white text-[#6a1b9a] shadow-gm'
  handleEl.title = 'Drag to rotate, click to reset'
  const svg = createElement(RotateCw)
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  handleEl.append(svg)
  const handle = new maplibregl.Marker({ element: handleEl })
  // Marker.addTo re-inserts the element, which would end a drag in progress, so only attach it once
  let handleShown = false

  const render = () => {
    ;(map.getSource('compare') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: c.items.flatMap((it, index) => {
        const o = outlineById.get(it.id)
        if (!o) return []
        const selected = c.selected === it.id
        return [
          { type: 'Feature' as const, properties: { index, selected },
            geometry: { type: 'MultiPolygon' as const, coordinates: o.km.map((poly) => poly.map((ring) => ring.map((p) => toMap(it, p)))) } },
          { type: 'Feature' as const, properties: { index, name: o.name }, geometry: { type: 'Point' as const, coordinates: it.center } },
        ]
      }),
    })
    const it = c.items.find((it) => it.id === c.selected)
    const o = it && outlineById.get(it.id)
    if (!it || !o) {
      if (handleShown) handle.remove()
      handleShown = false
      return
    }
    // the corner turns with the outline; push the handle a little further out along the same diagonal
    const a = it.rotation * rad, [x, y] = o.corner, len = Math.hypot(x, y) || 1
    const [dx, dy] = [(x * Math.cos(a) + y * Math.sin(a)) / len, (-x * Math.sin(a) + y * Math.cos(a)) / len]
    handle.setLngLat(toMap(it, o.corner)).setOffset([dx * 18, -dy * 18])
    if (!handleShown) handle.addTo(map)
    handleShown = true
  }
  watch(() => c.items, render, { deep: true })
  watch(() => c.selected, render)

  // drag the handle to turn the outline around its anchor; a click without dragging resets it
  handleEl.addEventListener('pointerdown', (e) => {
    const it = c.items.find((it) => it.id === c.selected)
    if (!it || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const rect = canvas.getBoundingClientRect()
    const pivot = map.project(it.center)
    const angle = (ev: PointerEvent) => Math.atan2(ev.clientY - rect.top - pivot.y, ev.clientX - rect.left - pivot.x) / rad
    const a0 = angle(e), r0 = it.rotation, x0 = e.clientX, y0 = e.clientY
    let moved = false
    handleEl.style.cursor = 'grabbing'
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return
      moved = true
      // screen y points down, so the screen angle already grows clockwise
      it.rotation = Math.round((((r0 + angle(ev) - a0) % 360) + 540) % 360 - 180)
    }
    // on window, so the drag keeps going when the pointer leaves the small handle
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      handleEl.style.cursor = ''
      if (!moved && ev.type === 'pointerup') it.rotation = 0
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  })
  // keep the map from treating presses on the handle as clicks or pans
  for (const ev of ['mousedown', 'touchstart', 'click', 'dblclick'] as const) handleEl.addEventListener(ev, (e) => e.stopPropagation())

  /** The outline under a point (the one added last is drawn on top, so it wins). */
  const itemAt = (point: maplibregl.Point) => {
    const hit = map.queryRenderedFeatures(point, { layers: ['compare-fill'] })
    return hit.length ? c.items[Math.max(...hit.map((f) => f.properties.index as number))] : undefined
  }

  // click an outline to select it, click anywhere else to let go of it
  map.on('click', (e) => {
    if (store.measure.active) return
    c.selected = itemAt(e.point)?.id ?? null
  })

  // ---- dragging an outline (mouse and one finger) ----
  let dragging = false
  map.on('mouseenter', 'compare-fill', () => !dragging && !store.measure.active && (canvas.style.cursor = 'move'))
  map.on('mouseleave', 'compare-fill', () => !dragging && !store.measure.active && (canvas.style.cursor = ''))

  const start = (e: MapMouseEvent | MapTouchEvent, touch: boolean) => {
    if (store.measure.active || (touch ? (e as MapTouchEvent).points.length !== 1 : (e as MapMouseEvent).originalEvent.button !== 0)) return
    const item = itemAt(e.point)
    if (!item) return
    e.preventDefault() // no map panning while dragging
    c.selected = item.id
    dragging = true
    canvas.style.cursor = 'grabbing'
    let last = e.lngLat
    const move = (ev: MapMouseEvent | MapTouchEvent) => {
      const { lng, lat } = ev.lngLat
      const [dx, dy] = [lng - last.lng, lat - last.lat]
      last = ev.lngLat
      item.center = [item.center[0] + dx, item.center[1] + dy] // redrawn by the watcher above
    }
    const moveEv = touch ? 'touchmove' : 'mousemove'
    const endEv = touch ? 'touchend' : 'mouseup'
    map.on(moveEv, move)
    map.once(endEv, () => {
      map.off(moveEv, move)
      dragging = false
      canvas.style.cursor = ''
    })
  }
  map.on('mousedown', 'compare-fill', (e) => start(e, false))
  map.on('touchstart', 'compare-fill', (e) => start(e, true))
}
