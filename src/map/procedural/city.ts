/**
 * Procedural city + farmland generator.
 *
 * Nothing here is stored: the same Settlement (seed, radii, centre) always produces the same
 * streets, blocks and fields, so a huge city costs a few numbers in data/settlements.json.
 * Hand-made content (districts, farms, landmarks) lives in places.geojson and sits on top.
 *
 * Everything is computed in local kilometres (x east, y north) around the centre and converted
 * to the world's fake lng/lat at the end.
 *
 * Layout:
 *   seeds  -> Voronoi cells ("wards" in the city, "parcels" in the farmland)
 *   ward   -> street grid at its own angle/spacing -> blocks -> (core only) building lots
 *   parcel -> parallel strips (fields) or orchard / pasture / woodlot, plus farmsteads
 *   arteries radiate from the centre through everything; a wall rings the old town.
 */
import type { Position } from 'geojson'
import type { Settlement } from '@/world/types'
import { KM_PER_DEG } from '@/world/coords'
import { rng, type Rng } from '@/world/geo'

export type V = [number, number]
type Poly = V[] // convex, counter-clockwise

export interface Terrain {
  isLand(lngLat: Position): boolean
  isLake(lngLat: Position): boolean
  isForest(lngLat: Position): boolean
}

export type Props = Record<string, string | number>
/** Generator output in local km around the centre. See bake.ts for storage and conversion to GeoJSON. */
export interface LocalCity {
  areas: { props: Props; ring: V[] }[]
  lines: { props: Props; pts: V[] }[]
}

// ---------- small vector / convex-polygon helpers ----------

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1]
const len = (a: V) => Math.hypot(a[0], a[1])

/** Keep the part of a convex polygon where n·p <= c. */
function clipHalf(poly: Poly, n: V, c: number): Poly {
  const out: Poly = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const fa = dot(n, a) - c, fb = dot(n, b) - c
    if (fa <= 0) out.push(a)
    if (fa <= 0 !== fb <= 0) {
      const t = fa / (fa - fb)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return out
}

function area(poly: Poly) {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

function centroid(poly: Poly): V {
  let x = 0, y = 0
  for (const p of poly) { x += p[0]; y += p[1] }
  return [x / poly.length, y / poly.length]
}

/** Shrink a convex CCW polygon by d km on every side. */
function inset(poly: Poly, d: number): Poly {
  let out = poly
  for (let i = 0; i < poly.length && out.length >= 3; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], e = sub(b, a), l = len(e)
    if (l < 1e-9) continue
    const n: V = [e[1] / l, -e[0] / l] // outward normal of a CCW edge
    out = clipHalf(out, n, dot(n, a) - d)
  }
  return out
}

/** Part of segment p0-p1 inside a convex CCW polygon, or null. */
function clipSegment(p0: V, p1: V, poly: Poly): [V, V] | null {
  let t0 = 0, t1 = 1
  const d = sub(p1, p0)
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], e = sub(b, a)
    const n: V = [e[1], -e[0]]
    const num = dot(n, a) - dot(n, p0), den = dot(n, d)
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue }
    const t = num / den
    if (den > 0) t1 = Math.min(t1, t)
    else t0 = Math.max(t0, t)
    if (t0 > t1) return null
  }
  return [[p0[0] + d[0] * t0, p0[1] + d[1] * t0], [p0[0] + d[0] * t1, p0[1] + d[1] * t1]]
}

/** Cut a convex polygon into a grid of cells aligned to angle `ang`, each shrunk by `gap`. */
function gridCells(poly: Poly, ang: number, su: number, sv: number, gap: number, offU = 0, offV = 0): Poly[] {
  const u: V = [Math.cos(ang), Math.sin(ang)], v: V = [-u[1], u[0]]
  const us = poly.map((p) => dot(p, u)), vs = poly.map((p) => dot(p, v))
  const out: Poly[] = []
  for (let i = Math.floor((Math.min(...us) - offU) / su); i * su + offU < Math.max(...us); i++) {
    const strip = clipHalf(clipHalf(poly, [-u[0], -u[1]], -(i * su + offU + gap)), u, (i + 1) * su + offU - gap)
    if (strip.length < 3) continue
    for (let j = Math.floor((Math.min(...vs) - offV) / sv); j * sv + offV < Math.max(...vs); j++) {
      const c = clipHalf(clipHalf(strip, [-v[0], -v[1]], -(j * sv + offV + gap)), v, (j + 1) * sv + offV - gap)
      if (c.length >= 3) out.push(c)
    }
  }
  return out
}

/** Grid street centre-lines matching gridCells. */
function gridLines(poly: Poly, ang: number, su: number, sv: number, offU = 0, offV = 0): [V, V][] {
  const u: V = [Math.cos(ang), Math.sin(ang)], v: V = [-u[1], u[0]]
  const us = poly.map((p) => dot(p, u)), vs = poly.map((p) => dot(p, v))
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)]
  const at = (a: number, b: number): V => [u[0] * a + v[0] * b, u[1] * a + v[1] * b]
  const segs: [V, V][] = []
  for (let k = Math.ceil((u0 - offU) / su); k * su + offU < u1; k++) {
    const s = clipSegment(at(k * su + offU, v0 - 1), at(k * su + offU, v1 + 1), poly)
    if (s) segs.push(s)
  }
  for (let k = Math.ceil((v0 - offV) / sv); k * sv + offV < v1; k++) {
    const s = clipSegment(at(u0 - 1, k * sv + offV), at(u1 + 1, k * sv + offV), poly)
    if (s) segs.push(s)
  }
  return segs
}

// ---------- seeds (dart throwing with a spatial hash) ----------

interface Seed { p: V; kind: 'urban' | 'rural' | 'wild' }

function scatter(r: Rng, F: number, edge: (a: number) => number): Seed[] {
  const seeds: Seed[] = []
  const cell = 0.5
  const grid = new Map<string, number[]>()
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`
  const spacing = (d: number, e: number) =>
    d < e ? 0.38 + 0.75 * (d / e) ** 1.4 : d < F ? 1.05 + 0.5 * ((d - e) / (F - e)) : 1.8
  const outer = F + 3
  const tries = Math.round(outer * outer * 60)
  for (let t = 0; t < tries; t++) {
    const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * outer
    const p: V = [Math.cos(a) * d, Math.sin(a) * d]
    const e = edge(a), s = spacing(d, e)
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), reach = Math.ceil(s / cell)
    let ok = true
    for (let i = -reach; i <= reach && ok; i++)
      for (let j = -reach; j <= reach && ok; j++)
        for (const k of grid.get(`${cx + i},${cy + j}`) ?? []) if (len(sub(seeds[k].p, p)) < s) { ok = false; break }
    if (!ok) continue
    grid.set(key(p[0], p[1]), [...(grid.get(key(p[0], p[1])) ?? []), seeds.length])
    seeds.push({ p, kind: d < e ? 'urban' : d < F ? 'rural' : 'wild' })
  }
  return seeds
}

function voronoi(seeds: Seed[], reach: number): Poly[] {
  return seeds.map((s) => {
    let poly: Poly = [
      [s.p[0] - reach, s.p[1] - reach], [s.p[0] + reach, s.p[1] - reach],
      [s.p[0] + reach, s.p[1] + reach], [s.p[0] - reach, s.p[1] + reach],
    ]
    for (const q of seeds) {
      if (q === s) continue
      const n = sub(q.p, s.p)
      if (Math.abs(n[0]) > reach * 2 || Math.abs(n[1]) > reach * 2) continue
      const m: V = [(s.p[0] + q.p[0]) / 2, (s.p[1] + q.p[1]) / 2]
      poly = clipHalf(poly, n, dot(n, m))
      if (poly.length < 3) break
    }
    return poly
  })
}

// ---------- the generator ----------

const ARTERY_SUFFIX = ['Road', 'Way', 'Street', 'Gate Road', 'Lane', 'Highway']
const ARTERY_PREFIX = ['North', 'East', 'South', 'West', 'Old', 'Kings', 'Queens', 'Mill', 'Market', 'River', 'Harvest', 'Iron']

export function generateCity(s: Settlement, center: Position, terrain: Terrain): LocalCity {
  const r = rng(s.seed)
  const R = s.radiusKm, F = Math.max(s.farmlandKm, R + 1)
  const toLL = (p: V): Position => [center[0] + p[0] / KM_PER_DEG, center[1] + p[1] / KM_PER_DEG]
  const water = (p: V) => !terrain.isLand(toLL(p)) || terrain.isLake(toLL(p))
  const areas: LocalCity['areas'] = []
  const lines: LocalCity['lines'] = []
  const addPoly = (ring: Poly, props: Props) => void (ring.length >= 3 && areas.push({ props, ring }))
  const addLine = (pts: V[], props: Props) => void (pts.length >= 2 && lines.push({ props, pts }))

  // Arteries: wobbly radial roads, cut short where they hit water.
  const bearings = Array.from({ length: s.arteries }, (_, i) => (i / s.arteries) * Math.PI * 2 + r.range(-0.25, 0.25))
  bearings.forEach((b, i) => {
    const ph1 = r.range(0, 6), ph2 = r.range(0, 6)
    const pts: V[] = []
    for (let d = 0; d <= F * 1.15; d += 0.4) {
      const w = 0.04 * d * Math.sin(d * 0.35 + ph1) + 0.015 * d * Math.sin(d * 0.9 + ph2)
      const a = Math.PI / 2 - b + w / Math.max(d, 1)
      const p: V = [Math.cos(a) * d, Math.sin(a) * d]
      if (d > 0.5 && water(p)) break
      pts.push(p)
    }
    const name = s.arteryNames?.[i] ?? `${r.pick(ARTERY_PREFIX)} ${r.pick(ARTERY_SUFFIX)}`
    addLine(pts, { class: 'artery', name })
  })

  // Built-up edge: lumpy circle that reaches further out along the arteries (ribbon sprawl).
  const ph = [r.range(0, 6), r.range(0, 6), r.range(0, 6)]
  const artAngles = bearings.map((b) => Math.PI / 2 - b)
  const edge = (a: number) => {
    let e = 1 + 0.16 * Math.sin(3 * a + ph[0]) + 0.09 * Math.sin(5 * a + ph[1]) + 0.05 * Math.sin(11 * a + ph[2])
    for (const aa of artAngles) {
      const d = Math.atan2(Math.sin(a - aa), Math.cos(a - aa))
      e += 0.28 * Math.exp(-((d / 0.1) ** 2))
    }
    return R * e
  }

  const seeds = scatter(r, F, edge)
  const cells = voronoi(seeds, 3)
  const oldR = s.oldTownKm

  seeds.forEach((seed, i) => {
    const poly = cells[i]
    if (seed.kind === 'wild' || poly.length < 3) return
    // Cells may overhang a lake (the lake layer is drawn on top) but never the sea.
    const c = centroid(poly)
    if (water(c) || poly.some((p) => !terrain.isLand(toLL(p)))) return
    const dist = len(c)
    if (seed.kind === 'urban') ward(poly, dist)
    else if (!terrain.isForest(toLL(c))) parcel(poly)
  })

  function ward(poly: Poly, dist: number) {
    const inOld = oldR > 0 && dist < oldR
    addPoly(poly, { class: 'urban' })
    addLine([...poly, poly[0]], { class: 'street' })
    const t = Math.min(dist / R, 1.3)
    const roll = r.next()
    const inner = inset(poly, 0.018)
    if (!inOld && roll < 0.05) return addPoly(inner, { class: 'park' })
    // Old town: tight, twisting lanes. Newer wards: grids aligned to (or across) the centre.
    const radial = Math.atan2(centroid(poly)[1], centroid(poly)[0])
    const ang = inOld ? r.range(0, Math.PI) : radial + (r.chance(0.5) ? 0 : Math.PI / 2) + r.range(-0.3, 0.3)
    const su = inOld ? r.range(0.05, 0.08) : 0.08 + 0.12 * t + r.range(-0.015, 0.03)
    const sv = su * (inOld ? r.range(1, 1.5) : r.range(1.4, 2.3))
    const offU = r.range(0, su), offV = r.range(0, sv)
    for (const [a, b] of gridLines(inner, ang, su, sv, offU, offV)) addLine([a, b], { class: 'minor' })
    const withBuildings = dist < R * 0.4 || r.chance(0.08)
    for (const block of gridCells(inner, ang, su, sv, 0.007, offU, offV)) {
      const ar = area(block)
      if (ar < 0.0004) continue
      if (r.chance(inOld ? 0.01 : 0.03)) { addPoly(block, { class: r.chance(0.6) ? 'park' : 'plaza' }); continue }
      addPoly(block, { class: 'block' })
      if (withBuildings) buildings(block, ang, inOld)
    }
  }

  // Building lots: split a block along its long side, two rows back to back.
  function buildings(block: Poly, ang: number, dense: boolean) {
    const lot = dense ? r.range(0.012, 0.02) : r.range(0.018, 0.03)
    const depth = dense ? 0.022 : 0.03
    for (const b of gridCells(block, ang, lot, depth, 0.0018)) {
      if (area(b) < 0.00008 || r.chance(dense ? 0.04 : 0.18)) continue
      addPoly(b, { class: 'building' })
    }
  }

  function parcel(poly: Poly) {
    const inner = inset(poly, 0.012)
    if (r.chance(0.65)) addLine([...poly, poly[0]], { class: 'track' })
    const roll = r.next()
    if (roll < 0.08) return addPoly(inner, { class: 'woodlot' })
    if (roll < 0.2) return addPoly(inner, { class: 'orchard' })
    if (roll < 0.32) return addPoly(inner, { class: 'pasture' })
    const ang = r.range(0, Math.PI)
    const w = r.range(0.12, 0.35)
    for (const strip of gridCells(inner, ang, w, 50, 0.006)) addPoly(strip, { class: 'field', crop: r.int(0, 3) })
    if (r.chance(0.3)) farmstead(centroid(inner), ang)
  }

  function farmstead(at: V, ang: number) {
    const u: V = [Math.cos(ang), Math.sin(ang)], v: V = [-u[1], u[0]]
    const rect = (cx: number, cy: number, w: number, h: number): Poly => {
      const c: V = [at[0] + u[0] * cx + v[0] * cy, at[1] + u[1] * cx + v[1] * cy]
      return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([a, b]) => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b] as V)
    }
    addPoly(rect(0, 0, 0.06, 0.045), { class: 'farmyard' })
    const n = r.int(2, 4)
    for (let k = 0; k < n; k++) addPoly(rect(r.range(-0.035, 0.035), r.range(-0.025, 0.025), r.range(0.006, 0.014), r.range(0.005, 0.01)), { class: 'building' })
  }

  // Walls around the old town, and the citadel itself at the centre.
  if (oldR > 0) {
    const wp = [r.range(0, 6), r.range(0, 6)]
    const wall: V[] = []
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2
      const rr = oldR * (1 + 0.08 * Math.sin(3 * a + wp[0]) + 0.05 * Math.sin(7 * a + wp[1]))
      wall.push([Math.cos(a) * rr, Math.sin(a) * rr])
    }
    addLine(wall, { class: 'wall' })
    const ca = r.range(0, Math.PI / 2)
    const keep: Poly = [[-0.14, -0.11], [0.14, -0.11], [0.14, 0.11], [-0.14, 0.11]].map(
      ([x, y]) => [x * Math.cos(ca) - y * Math.sin(ca), x * Math.sin(ca) + y * Math.cos(ca)] as V,
    )
    addPoly(keep, { class: 'landmark' })
  }

  // Parks, plazas and the urban base must sit under blocks and buildings.
  const order = ['urban', 'farmyard', 'field', 'pasture', 'orchard', 'woodlot', 'park', 'plaza', 'block', 'building', 'landmark']
  areas.sort((a, b) => order.indexOf(a.props.class as string) - order.indexOf(b.props.class as string))
  return { areas, lines }
}

/** Rough extent of a settlement in degrees, for deciding when to generate it. */
export const settlementRadiusDeg = (s: Settlement) => (Math.max(s.farmlandKm, s.radiusKm) * 1.2) / KM_PER_DEG
