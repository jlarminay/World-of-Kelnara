// Draws the party's trail (src/world/journey.ts), only while sessions are being looked at:
// the whole trail on the Sessions list, one session's part of it on that session's page, and none otherwise.
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { watch } from 'vue'
import { journey, legsOf, stopsOf } from '@/world/journey'
import { sessions } from '@/world/sessions'
import { store } from '@/state/store'
import { fitCoords, flyToPlace } from './controller'

const LAYERS = ['journey-line', 'journey-approx', 'journey-hit', 'journey-stops', 'journey-label']

export function setupJourney(map: MlMap) {
  const { legs, stops } = journey()
  const last = Math.max(1, ...sessions.map((s) => s.n), ...legs.map((l) => l.session))
  const shade = (n: number) => (last > 1 ? (n - 1) / (last - 1) : 1)
  const data: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      ...legs.map((l) => ({
        type: 'Feature' as const,
        properties: { session: l.session, shade: shade(l.session), approx: l.approx },
        geometry: { type: 'LineString' as const, coordinates: l.coords },
      })),
      ...stops.map((s, i) => ({ s, starts: stops[i + 1] && stops[i + 1].session !== s.session ? stops[i + 1].session : 0 })).filter(({ s }) => !s.pass).map(({ s, starts }) => ({
        type: 'Feature' as const,
        // `starts`: the next session begins here, so the stop shows on that session's page too
        properties: { session: s.session, starts, shade: shade(s.session), label: s.label, ...(s.place ? { place: s.place } : {}) },
        geometry: { type: 'Point' as const, coordinates: s.at },
      })),
    ],
  }
  ;(map.getSource('journey') as GeoJSONSource).setData(data)

  // which part to show: 'all' on the Sessions list, a session number on its page, or nothing
  const base = Object.fromEntries(LAYERS.map((id) => [id, map.getFilter(id)]))
  watch(
    () => (store.panel === 'sessions' ? 'all' : store.panel === 'details' && store.selection?.type === 'session' ? store.selection.n : null),
    (show) => {
      for (const id of LAYERS) {
        map.setLayoutProperty(id, 'visibility', show === null ? 'none' : 'visible')
        const own: unknown = show === 'all' || show === null ? true
          : ['any', ['==', ['get', 'session'], show], ['==', ['coalesce', ['get', 'starts'], 0], show]]
        map.setFilter(id, (base[id] ? ['all', base[id], own] : own) as never)
      }
      if (show === 'all') fitCoords(legs.flatMap((l) => l.coords), 60)
    },
    { immediate: true },
  )

  // clicks on the trail open its session (controller.ts)
  map.on('mouseenter', 'journey-hit', () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', 'journey-hit', () => (map.getCanvas().style.cursor = ''))
}

/** Moves the map to show where the party went in a session. */
export function fitSession(n: number) {
  const coords = legsOf(n).flatMap((l) => l.coords)
  if (coords.length) return fitCoords(coords, 60)
  const only = stopsOf(n)[0]
  if (only?.place) flyToPlace(only.place)
}
