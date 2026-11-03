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
