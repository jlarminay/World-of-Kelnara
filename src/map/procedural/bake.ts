// Baking: generated geometry is saved to data/generated/<settlement-id>.json so every build of
// the map is exactly the same, even if the generator code or terrain changes later.
// Unbaked or edited settlements get a live preview that goes through the same encoding, so the
// preview is exactly what a bake would save.
//
// File format (compact; GeoJSON would be ~15 MB per city):
//   { format: 1, source: { settlement, center }, areas: Group[], lines: Group[] }
//   Group = { props, items: number[][] }, each item a flat list of integer metres east/north of
//   the centre, delta-encoded: [x0, y0, x1-x0, y1-y0, ...]
import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson'
import type { Settlement } from '@/world/types'
import { KM_PER_DEG } from '@/world/coords'
import { generateCity, type LocalCity, type Props, type V } from './city'
import { terrain } from '../terrain'

interface Group { props: Props; items: number[][] }
export interface BakedCity {
  format: 1
  /** The inputs it was generated from; used to spot a stale bake. */
  source: { settlement: Settlement; center: Position }
  areas: Group[]
  lines: Group[]
}
export interface CityGeometry {
  areas: FeatureCollection<Polygon>
  lines: FeatureCollection<LineString>
}

export const bakeKey = (s: Settlement, center: Position) => JSON.stringify({ settlement: s, center })

function encode(list: { props: Props; pts: V[] }[]): Group[] {
  const groups = new Map<string, Group>()
  for (const { props, pts } of list) {
    const key = JSON.stringify(props)
    if (!groups.has(key)) groups.set(key, { props, items: [] })
    const flat: number[] = []
    let px = 0, py = 0
    for (const [x, y] of pts) {
      const mx = Math.round(x * 1000), my = Math.round(y * 1000)
      flat.push(mx - px, my - py)
      px = mx
      py = my
    }
    groups.get(key)!.items.push(flat)
  }
  return [...groups.values()]
}

export function bake(s: Settlement, center: Position): BakedCity {
  const city: LocalCity = generateCity(s, center, terrain)
  return {
    format: 1,
    source: { settlement: s, center },
    areas: encode(city.areas.map((a) => ({ props: a.props, pts: a.ring }))),
    lines: encode(city.lines),
  }
}

export function toGeoJSON(b: BakedCity): CityGeometry {
  const [cx, cy] = b.source.center
  const decode = (flat: number[]): Position[] => {
    const out: Position[] = []
    let x = 0, y = 0
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i]
      y += flat[i + 1]
      out.push([cx + x / 1000 / KM_PER_DEG, cy + y / 1000 / KM_PER_DEG])
    }
    return out
  }
  const areas: Feature<Polygon>[] = b.areas.flatMap((g) =>
    g.items.map((it) => {
      const ring = decode(it)
      return { type: 'Feature' as const, properties: g.props, geometry: { type: 'Polygon' as const, coordinates: [[...ring, ring[0]]] } }
    }),
  )
  const lines: Feature<LineString>[] = b.lines.flatMap((g) =>
    g.items.map((it) => ({ type: 'Feature' as const, properties: g.props, geometry: { type: 'LineString' as const, coordinates: decode(it) } })),
  )
  return { areas: { type: 'FeatureCollection', features: areas }, lines: { type: 'FeatureCollection', features: lines } }
}

const files = import.meta.glob<BakedCity>('../../../data/generated/*.json', { eager: true, import: 'default' })
export const baked: Record<string, BakedCity> = Object.fromEntries(
  Object.entries(files).map(([path, city]) => [path.split('/').pop()!.replace(/\.json$/, ''), city]),
)
