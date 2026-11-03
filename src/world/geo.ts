import type { Geometry, Position } from 'geojson'

type Ring = Position[]

export function pointInRing([x, y]: Position, ring: Ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Point in Polygon/MultiPolygon, respecting holes. */
export function pointInGeometry(p: Position, g: Geometry): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  return polys.some((rings) => pointInRing(p, rings[0]) && !rings.slice(1).some((h) => pointInRing(p, h)))
}

export type BBox = [number, number, number, number]

export function bboxOf(g: Geometry): BBox {
  const b: BBox = [Infinity, Infinity, -Infinity, -Infinity]
  const visit = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') {
      const [x, y] = c as number[]
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y)
    } else (c as unknown[]).forEach(visit)
  }
  if (g.type !== 'GeometryCollection') visit(g.coordinates)
  return b
}

export const bboxCenter = (b: BBox): [number, number] => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]

/** Small deterministic PRNG (mulberry32): same seed, same city. */
export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  }
}
export type Rng = ReturnType<typeof rng>
