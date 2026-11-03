// Editing a journey on the map, like Google Maps: drag the blue route line to add a stop (the route follows the
// pointer, then the stop snaps onto the nearest road), drag a stop to move it, click a stop to remove it.
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MlMap, MapMouseEvent } from 'maplibre-gl'
import { watch } from 'vue'
import type { Position } from 'geojson'
import { store } from '@/state/store'
import { MAX_OFF_ROAD_KM, pointWaypoint, snapToRoad, waypointCoord } from '@/routing'

const d = store.directions
const empty = { type: 'FeatureCollection' as const, features: [] }

/** Which leg of the current route a point is on (so a new stop goes between the right two stops). */
function legAt(p: Position): number {
  const r = d.result
  if (!r?.legEnds?.length) return 0
  let best = 0, bestD = Infinity
  for (let i = 0; i < r.coords.length - 1; i++) {
    const a = r.coords[i], b = r.coords[i + 1]
    const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy
    const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0
    const dd = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t)
    if (dd < bestD) { bestD = dd; best = i }
  }
  const leg = r.legEnds.findIndex((end) => best < end)
  return leg < 0 ? r.legEnds.length - 1 : leg
}

/** Puts stop i onto the nearest road, or drops it if no road is close enough. */
function settle(i: number) {
  const at = waypointCoord(d.via[i])
  const s = at && snapToRoad(at)
  if (!s || s.km > MAX_OFF_ROAD_KM) d.via.splice(i, 1)
  else d.via[i] = pointWaypoint(s.p as [number, number])
}

export function setupRouteEdit(map: MlMap) {
  const canvas = map.getCanvas()
  let dragging: number | null = null

  // a white dot that follows the pointer along the route, the cue that the line can be dragged
  const hover = (p: maplibregl.LngLat | null) =>
    (map.getSource('route-hover') as GeoJSONSource).setData(
      p ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } } : empty,
    )
  map.on('mousemove', 'route-hit', (e) => {
    if (dragging !== null) return
    canvas.style.cursor = 'grab'
    hover(e.lngLat)
  })
  map.on('mouseleave', 'route-hit', () => {
    if (dragging !== null) return
    canvas.style.cursor = ''
    hover(null)
  })

  map.on('mousedown', 'route-hit', (e: MapMouseEvent) => {
    if (e.originalEvent.button !== 0 || store.measure.active) return
    e.preventDefault() // no map panning while dragging the line
    const i = legAt([e.lngLat.lng, e.lngLat.lat])
    d.via.splice(i, 0, pointWaypoint([e.lngLat.lng, e.lngLat.lat]))
    dragging = i
    canvas.style.cursor = 'grabbing'
    hover(null)
    let frame = 0
    const move = (ev: MapMouseEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => dragging !== null && (d.via[dragging] = pointWaypoint([ev.lngLat.lng, ev.lngLat.lat])))
    }
    map.on('mousemove', move)
    map.once('mouseup', () => {
      cancelAnimationFrame(frame)
      map.off('mousemove', move)
      if (dragging !== null) settle(dragging)
      dragging = null
      canvas.style.cursor = ''
    })
  })

  // ---- stop markers ----
  let markers: maplibregl.Marker[] = []
  let markerDrag: number | null = null
  const build = () => {
    markers.forEach((m) => m.remove())
    markers = d.via.map((w, i) => {
      // the dot is small, but the element around it is finger-sized for phones
      const el = document.createElement('div')
      el.className = 'grid size-7 cursor-pointer place-items-center'
      el.innerHTML = '<span class="size-3.5 rounded-full border-[2.5px] border-[#202124] bg-white shadow"></span>'
      el.title = 'Drag to move this stop, click to remove it'
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(waypointCoord(w) as [number, number]).addTo(map)
      let moved = false
      m.on('dragstart', () => { moved = true; markerDrag = i })
      m.on('drag', () => {
        const { lng, lat } = m.getLngLat()
        d.via[i] = pointWaypoint([lng, lat])
      })
      m.on('dragend', () => {
        markerDrag = null
        settle(i)
        setTimeout(() => (moved = false))
      })
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        if (!moved) d.via.splice(i, 1)
      })
      return m
    })
  }
  watch(() => d.via.length, build)
  watch(
    () => [...d.via],
    () => d.via.forEach((w, i) => i !== markerDrag && markers[i]?.setLngLat(waypointCoord(w) as [number, number])),
  )
  // no route on screen (directions closed): no stops either
  watch(() => store.panel, (p) => p !== 'directions' && d.via.length && (d.via = []))
}
