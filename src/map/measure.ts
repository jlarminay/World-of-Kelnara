// Distance measuring (right-click > Measure distance, or the side menu): click to add points,
// drag a point to move it, click a point to remove it.
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl'
import { watch } from 'vue'
import { distanceKm } from '@/world/coords'
import { store } from '@/state/store'

export const pathKm = (pts: [number, number][]) => pts.slice(1).reduce((s, p, i) => s + distanceKm(pts[i], p), 0)

export function startMeasure(first?: [number, number]) {
  if (store.mobile) store.panel = 'none'
  store.measure.active = true
  store.measure.points = first ? [first] : []
  store.contextMenu = null
}

export function stopMeasure() {
  store.measure.active = false
  store.measure.points = []
}

export function setupMeasure(map: MlMap) {
  map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'measure-line-case', type: 'line', source: 'measure', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 5 } })
  map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#202124', 'line-width': 2.5 } })

  let markers: maplibregl.Marker[] = []
  const render = () => {
    const pts = store.measure.points
    ;(map.getSource('measure') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: pts.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } }] : [],
    })
    markers.forEach((m) => m.remove())
    markers = pts.map((p, i) => {
      const el = document.createElement('div')
      el.className = 'size-3 rounded-full border-2 border-[#202124] bg-white shadow cursor-pointer'
      el.title = 'Drag to move, click to remove'
      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(p).addTo(map)
      let moved = false
      marker.on('dragstart', () => (moved = true))
      marker.on('drag', () => {
        const { lng, lat } = marker.getLngLat()
        store.measure.points[i] = [lng, lat]
        const line = map.getSource('measure') as GeoJSONSource
        if (store.measure.points.length > 1)
          line.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: store.measure.points } })
      })
      marker.on('dragend', () => setTimeout(() => (moved = false)))
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!moved) store.measure.points.splice(i, 1)
      })
      return marker
    })
  }
  watch(() => store.measure.points.length, render)
  watch(() => store.measure.active, (on) => {
    map.getCanvas().style.cursor = on ? 'crosshair' : ''
    render()
  })

  map.on('click', (e) => {
    if (!store.measure.active || Date.now() - store.longPressAt < 600) return
    store.measure.points.push([e.lngLat.lng, e.lngLat.lat])
  })
}
