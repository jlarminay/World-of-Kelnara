// Road journeys. The graph is built from the road geometry itself (not from the from/to names):
//  - every vertex of every road is a node; a road whose end lies on another road is joined to it there
//  - the start and end are snapped to the nearest point on any road, and the gap is walked off-road
//  - the caller picks the points to start from (a walled city's gates, or the place itself)
import type { Feature, LineString, Position } from 'geojson'
import { layers, world } from '@/world/data'
import { distanceKm } from '@/world/coords'
import type { RouteResult, RouteStep } from './index'

type Rank = 'highway' | 'road' | 'trail'
interface RoadProps { id: string; name?: string | null; rank: Rank; from?: string; to?: string }
interface Line { props: RoadProps; coords: Position[] }
/** A point on a road: line index, segment index, position along the segment (0–1) and the point itself. */
interface OnRoad { line: number; seg: number; t: number; p: Position }

/** Where a journey can start or end, e.g. one of a city's gates. `step` describes the walk to/from the road. */
export interface Endpoint { at: Position; step: string }

/** A road end closer than this to another road is joined to it (≈ 1.2 km). */
const JOIN_DEG = 0.0003
/** Steps shorter than this are not listed (they still count in the totals). */
const MIN_STEP_KM = 0.5

/** Furthest a journey walks off-road to reach a road, at either end. */
const MAX_OFF_ROAD_KM = world.travel.max_off_road_km

export type Ground = keyof typeof world.travel.on_foot_km_per_day
const speeds = world.travel.on_foot_km_per_day
const GROUND: Record<Rank, Ground> = { highway: 'road', road: 'road', trail: 'path' }
/** Turns km on each kind of ground into "open-ground km", so days = effKm / km_per_day[mode]. */
const EFFORT: Record<Rank, number> = { highway: speeds.open / speeds.road, road: speeds.open / speeds.road, trail: speeds.open / speeds.path }
const RANK_LABEL: Record<Rank, string> = { highway: 'Highway', road: 'Road', trail: 'Trail' }

function nearestOn(lines: Line[], p: Position, skip = -1): (OnRoad & { d: number }) | null {
  let best: (OnRoad & { d: number }) | null = null
  lines.forEach((l, li) => {
    if (li === skip) return
    for (let s = 0; s < l.coords.length - 1; s++) {
      const a = l.coords[s], b = l.coords[s + 1]
      const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy
      const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0
      const q = t <= 0 ? a : t >= 1 ? b : [a[0] + dx * t, a[1] + dy * t]
      const d = Math.hypot(p[0] - q[0], p[1] - q[1])
      if (!best || d < best.d) best = { line: li, seg: s, t, p: q, d }
    }
  })
  return best
}

/** Copies the lines with extra vertices inserted at the given points. */
function insert(lines: Line[], pts: OnRoad[]): Line[] {
  return lines.map((l, li) => {
    const here = pts.filter((q) => q.line === li).sort((a, b) => a.seg - b.seg || a.t - b.t)
    if (!here.length) return l
    const out: Position[] = []
    l.coords.forEach((c, s) => {
      out.push(c)
      for (const q of here) if (q.seg === s && q.t > 0 && q.t < 1) out.push(q.p)
    })
    return { props: l.props, coords: out }
  })
}

/** The roads with junctions made explicit: a road end that touches another road shares a vertex with it. */
let joined: Line[] | null = null
function junctionLines(): Line[] {
  if (joined) return joined
  const lines: Line[] = (layers.roads.features as Feature<LineString>[]).map((f) => ({ props: f.properties as RoadProps, coords: [...f.geometry.coordinates] }))
  const splits: OnRoad[] = []
  lines.forEach((l, li) => {
    for (const end of [0, l.coords.length - 1]) {
      const n = nearestOn(lines, l.coords[end], li)
      if (n && n.d < JOIN_DEG) {
        l.coords[end] = n.p
        splits.push(n)
      }
    }
  })
  return (joined = insert(lines, splits))
}

const key = (p: Position) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`

/** One step along a road: `dir` is 1 when travelled in the road's drawn direction (from → to). */
interface Edge { to: string; km: number; line: number; dir: 1 | -1; p: Position }

function shortestPath(lines: Line[], a: Position, b: Position) {
  const adj = new Map<string, Edge[]>()
  const add = (u: Position, e: Edge) => {
    const k = key(u)
    if (!adj.has(k)) adj.set(k, [])
    adj.get(k)!.push(e)
  }
  lines.forEach((l, line) => {
    for (let s = 0; s < l.coords.length - 1; s++) {
      const u = l.coords[s], v = l.coords[s + 1], km = distanceKm(u, v)
      add(u, { to: key(v), km, line, dir: 1, p: v })
      add(v, { to: key(u), km, line, dir: -1, p: u })
    }
  })
  // Dijkstra on effort (a day on a highway covers more ground than a day on a trail). The graph is small, so a plain scan is fine.
  const start = key(a), goal = key(b)
  const cost = new Map([[start, 0]]), prev = new Map<string, [string, Edge]>(), done = new Set<string>()
  for (;;) {
    let u: string | null = null
    for (const [k, c] of cost) if (!done.has(k) && (u === null || c < cost.get(u)!)) u = k
    if (u === null) return null
    if (u === goal) break
    done.add(u)
    for (const e of adj.get(u) ?? []) {
      const c = cost.get(u)! + e.km * EFFORT[lines[e.line].props.rank]
      if (c < (cost.get(e.to) ?? Infinity)) { cost.set(e.to, c); prev.set(e.to, [u, e]) }
    }
  }
  const edges: Edge[] = []
  for (let cur = goal; cur !== start; ) {
    const [u, e] = prev.get(cur)!
    edges.unshift(e)
    cur = u
  }
  return { edges, effKm: cost.get(goal)! }
}

/** The nearest point on any road, and how far away it is (km). */
export function snapToRoad(p: Position): { p: Position; km: number } | null {
  const n = nearestOn(junctionLines(), p)
  return n && { p: n.p, km: distanceKm(p, n.p) }
}

/**
 * The best road journey between any of the start points and any of the end points.
 * `nameOf` turns a road's from/to reference (a place name or id) into a display name, or null.
 */
export function routeOnRoads(starts: Endpoint[], ends: Endpoint[], nameOf: (ref: string) => string | null): RouteResult | null {
  const base = junctionLines()
  let best: RouteResult | null = null
  for (const a of starts)
    for (const b of ends) {
      const sa = nearestOn(base, a.at), sb = nearestOn(base, b.at)
      if (!sa || !sb) continue
      const offA = distanceKm(a.at, sa.p), offB = distanceKm(sb.p, b.at)
      if (offA > MAX_OFF_ROAD_KM || offB > MAX_OFF_ROAD_KM) continue // too far from any road: no road route
      const lines = insert(base, [sa, sb])
      const path = shortestPath(lines, sa.p, sb.p)
      if (!path) continue

      // group consecutive edges on the same road into one step, named after where the road heads
      const runs: { line: number; dir: 1 | -1; km: number }[] = []
      for (const e of path.edges) {
        const last = runs[runs.length - 1]
        if (last && last.line === e.line && last.dir === e.dir) last.km += e.km
        else runs.push({ line: e.line, dir: e.dir, km: e.km })
      }
      const breakdown: Record<Ground, number> = { road: 0, path: 0, open: offA + offB }
      const steps: RouteStep[] = []
      if (offA > MIN_STEP_KM) steps.push({ text: a.step, km: offA })
      for (const r of runs) {
        const p = lines[r.line].props
        breakdown[GROUND[p.rank]] += r.km
        if (r.km < MIN_STEP_KM) continue // e.g. the first metres of a road that starts at the destination
        const towards = nameOf((r.dir === 1 ? p.to : p.from) ?? '')
        const text = `${p.name ?? RANK_LABEL[p.rank]}${towards ? ` towards ${towards}` : ''}`
        const last = steps[steps.length - 1]
        if (last?.text === text) last.km += r.km // e.g. a trail, then a shortcut, then the trail again
        else steps.push({ text, km: r.km })
      }
      if (offB > MIN_STEP_KM) steps.push({ text: b.step, km: offB })

      const roadKm = runs.reduce((s, r) => s + r.km, 0)
      const res: RouteResult = {
        coords: [a.at, sa.p, ...path.edges.map((e) => e.p), b.at],
        km: offA + roadKm + offB,
        effKm: path.effKm + offA + offB,
        steps,
        breakdown,
      }
      if (!best || res.effKm < best.effKm) best = res
    }
  return best
}
