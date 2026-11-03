// Journey planner, ported from the original viewer.
//  roads: Dijkstra over the place-to-place road graph (edge weight = length_km)
//  cross: A* over data/terrain.png, with roads burned in as cheap cells
import type { Feature, LineString, Position } from 'geojson'
import { layers, world } from '@/world/data'
import terrainUrl from '../../data/terrain.png?url'
import terrainMeta from '../../data/terrain.json'

export interface RouteResult {
  coords: Position[]
  km: number
  /** km weighted by terrain difficulty; divide by km/day for travel time */
  effKm: number
  via?: string[]
  breakdown?: Record<string, number>
}

const DEG = world.coordinate_system.deg_per_px
const [W0, H0] = world.coordinate_system.source_image_px
const toPx = ([lng, lat]: Position) => [lng / DEG + W0 / 2, H0 / 2 - lat / DEG]
const toLL = (x: number, y: number): Position => [(x - W0 / 2) * DEG, (H0 / 2 - y) * DEG]

export const KM_PER_DAY = world.travel.km_per_day

export function routeRoads(from: string, to: string): RouteResult | null {
  type Edge = [string, number, Position[]]
  const adj: Record<string, Edge[]> = {}
  for (const f of layers.roads.features as Feature<LineString>[]) {
    const p = f.properties as { from: string; to: string; length_km: number }
    const g = f.geometry.coordinates
    ;(adj[p.from] ||= []).push([p.to, p.length_km, g])
    ;(adj[p.to] ||= []).push([p.from, p.length_km, [...g].reverse()])
  }
  const dist: Record<string, number> = { [from]: 0 }
  const prev: Record<string, [string, Position[]]> = {}
  const done = new Set<string>()
  for (;;) {
    let u: string | null = null
    for (const k in dist) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k
    if (u === null) return null
    if (u === to) break
    done.add(u)
    for (const [v, km, g] of adj[u] ?? []) if (!(v in dist) || dist[u] + km < dist[v]) { dist[v] = dist[u] + km; prev[v] = [u, g] }
  }
  const segs: Position[][] = [], via: string[] = []
  for (let cur = to; cur !== from;) {
    const [u, g] = prev[cur]
    segs.unshift(g)
    if (u !== from) via.unshift(u)
    cur = u
  }
  return { coords: segs.flat(), km: dist[to], effKm: dist[to], via }
}

interface Grid { w: number; h: number; cls: Uint8Array; cost: Float32Array; road: Uint8Array; cell: number; kmCell: number }
let gridPromise: Promise<Grid> | null = null

export const loadTerrain = () => (gridPromise ??= buildGrid())

async function buildGrid(): Promise<Grid> {
  const meta = terrainMeta
  const img = await new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = terrainUrl })
  const { width: w, height: h } = meta
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const px = ctx.getImageData(0, 0, w, h).data, cls = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) cls[i] = px[i * 4]
  const rc = document.createElement('canvas'); rc.width = w; rc.height = h
  const r2 = rc.getContext('2d', { willReadFrequently: true })!
  r2.strokeStyle = '#fff'; r2.lineWidth = 1.5
  for (const f of layers.roads.features as Feature<LineString>[]) {
    r2.beginPath()
    f.geometry.coordinates.forEach((c, i) => { const [x, y] = toPx(c); if (i) r2.lineTo(x / meta.cell_px, y / meta.cell_px); else r2.moveTo(x / meta.cell_px, y / meta.cell_px) })
    r2.stroke()
  }
  const rd = r2.getImageData(0, 0, w, h).data, road = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) road[i] = rd[i * 4 + 3] > 60 ? 1 : 0
  const tc = world.travel.terrain_cost_multiplier
  const cost = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const c = cls[i]
    cost[i] = c === 0 || c === 4 ? Infinity : road[i] ? tc.road : c === 2 ? tc.forest : c === 3 ? tc.mountains : c === 5 ? tc.river_ford : tc.plains
  }
  return { w, h, cls, cost, road, cell: meta.cell_px, kmCell: meta.km_per_cell }
}

export async function routeTerrain(a: Position, b: Position): Promise<RouteResult | null> {
  const G = await loadTerrain()
  const snap = (ll: Position) => {
    const [x, y] = toPx(ll)
    const c = Math.floor(x / G.cell), r = Math.floor(y / G.cell)
    for (let d = 0; d < 15; d++)
      for (let dr = -d; dr <= d; dr++)
        for (let dc = -d; dc <= d; dc++) { const i = (r + dr) * G.w + c + dc; if (isFinite(G.cost[i])) return i }
    return null
  }
  const s = snap(a), t = snap(b)
  if (s == null || t == null) return null
  const tx = t % G.w, ty = (t / G.w) | 0, minC = 0.8
  const g = new Float64Array(G.w * G.h).fill(Infinity), came = new Int32Array(G.w * G.h).fill(-1), closed = new Uint8Array(G.w * G.h)
  const heap: [number, number][] = [[0, s]]
  g[s] = 0
  const push = (f: number, i: number) => {
    heap.push([f, i])
    for (let k = heap.length - 1; k;) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p }
  }
  const pop = () => {
    const top = heap[0], last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      for (let k = 0; ;) {
        const l = 2 * k + 1, r = l + 1; let m = k
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === k) break
        ;[heap[m], heap[k]] = [heap[k], heap[m]]; k = m
      }
    }
    return top
  }
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
  while (heap.length) {
    const [, u] = pop()
    if (closed[u]) continue
    closed[u] = 1
    if (u === t) break
    const ux = u % G.w, uy = (u / G.w) | 0
    for (const [dx, dy, l] of D) {
      const vx = ux + dx, vy = uy + dy
      if (vx < 0 || vy < 0 || vx >= G.w || vy >= G.h) continue
      const v = vy * G.w + vx, c = G.cost[v]
      if (!isFinite(c) || closed[v]) continue
      const ng = g[u] + (l * (c + G.cost[u])) / 2
      if (ng < g[v]) { g[v] = ng; came[v] = u; push(ng + Math.hypot(vx - tx, vy - ty) * minC, v) }
    }
  }
  if (came[t] === -1) return null
  const cells: number[] = []
  for (let c = t; c !== -1; c = came[c]) cells.unshift(c)
  const kinds = ['sea', 'plains', 'forest', 'mountains', 'lake', 'river crossings']
  const breakdown: Record<string, number> = { 'on road': 0, plains: 0, forest: 0, mountains: 0, 'river crossings': 0 }
  let km = 0
  for (let i = 1; i < cells.length; i++) {
    const p = cells[i - 1], q = cells[i]
    const step = Math.hypot((p % G.w) - (q % G.w), ((p / G.w) | 0) - ((q / G.w) | 0)) * G.kmCell
    km += step
    const k = G.road[q] ? 'on road' : kinds[G.cls[q]]
    breakdown[k] = (breakdown[k] || 0) + step
  }
  const coords = cells.filter((_, i) => i % 2 === 0 || i === cells.length - 1).map((c) => toLL(((c % G.w) + 0.5) * G.cell, (((c / G.w) | 0) + 0.5) * G.cell))
  coords[0] = a
  coords[coords.length - 1] = b
  return { coords, km, effKm: g[t] * G.kmCell, breakdown }
}
