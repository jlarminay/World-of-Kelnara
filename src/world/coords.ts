import { world } from './data'

export const BASE_ZOOM = world.detail_levels.base_zoom
export const KM_PER_DEG = world.scale.km_per_degree
/** Deepest zoom allowed: detail level 8. */
export const MAX_ZOOM = BASE_ZOOM + 8

export const levelToZoom = (level: number) => BASE_ZOOM + level
export const zoomToLevel = (zoom: number) => Math.max(0, Math.floor(zoom - BASE_ZOOM + 0.25))

/** Offset a lng/lat by km east/north. The world sits on the equator so this is linear. */
export const offsetKm = ([lng, lat]: [number, number], dx: number, dy: number): [number, number] => [
  lng + dx / KM_PER_DEG,
  lat + dy / KM_PER_DEG,
]

export const distanceKm = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) * KM_PER_DEG

/** Width of the whole world view and similar; used for the scale bar. */
export const kmPerPixel = (zoom: number) => KM_PER_DEG * (360 / (512 * 2 ** zoom))

export const formatKm = (km: number) => (km >= 100 ? `${Math.round(km).toLocaleString()} km` : km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`)

/** Hours on the move in a travel day (data/world.json), for showing trips under a day. */
export const HOURS_PER_DAY = world.travel.hours_per_day

/** Travel time like Google: "20 min", "2 hr 15 min", "3.5 days". A day is HOURS_PER_DAY of walking, not 24 hours. */
export function formatTravel(days: number) {
  if (days >= 1) return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`
  const min = Math.max(5, Math.round((days * HOURS_PER_DAY * 60) / 5) * 5)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}
