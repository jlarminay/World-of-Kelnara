// The party's trail (data/journey.json): stops per session, joined by legs that follow the roads like Directions.
import type { Position } from 'geojson'
import journeyData from '../../data/journey.json'
import { planJourney, pointWaypoint, speedOn, type Ground } from '@/routing'
import { placeById } from '@/state/store'
import { distanceKm } from './coords'
import { hereAt, hereRadiusKm } from './party'

type StopData = string | { place?: string; at?: [number, number]; label?: string; approx?: boolean; cross?: boolean; pass?: boolean; note?: string }

export interface Stop {
  session: number
  at: Position
  /** The place, when the stop is one. */
  place?: string
  label: string
  approx: boolean
  cross: boolean
  /** Only steers the route onto a road; not shown. */
  pass: boolean
  note?: string
}

export interface Leg {
  session: number
  from: Stop
  to: Stop
  coords: Position[]
  km: number
  /** Days on foot. */
  days: number
  /** A straight cross-country line rather than a road route (drawn dashed). */
  approx: boolean
  /** Either end is a rough location, so the distance is a guess. */
  guess: boolean
}

function toStop(session: number, s: StopData): Stop | null {
  const o = typeof s === 'string' ? { place: s } : s
  const place = o.place ? placeById.value.get(o.place) : undefined
  const at = o.at ?? place?.geometry.coordinates
  if (!at) {
    console.warn(`journey.json: session ${session}: unknown stop`, s)
    return null
  }
  return {
    session, at, place: place?.properties.id, label: o.label ?? place?.properties.name ?? '',
    approx: !!o.approx, cross: !!o.cross, pass: !!o.pass, note: o.note,
  }
}

const waypoint = (s: Stop) => s.place ?? pointWaypoint(s.at as [number, number])

function buildLeg(session: number, from: Stop, to: Stop): Leg {
  const guess = from.approx || to.approx
  const straight = () => {
    const km = distanceKm(from.at, to.at)
    return { session, from, to, coords: [from.at, to.at], km, days: km / speedOn('foot', 'open'), approx: true, guess }
  }
  if (to.cross) return straight()
  const r = planJourney([waypoint(from), waypoint(to)])
  if (!r) return straight()
  const days = Object.entries(r.breakdown ?? {}).reduce((d, [g, km]) => d + km / speedOn('foot', g as Ground), 0)
  return { session, from, to, coords: r.coords, km: r.km, days, approx: false, guess }
}

function build() {
  const stops: Stop[] = []
  const legs: Leg[] = []
  let prev: Stop | null = null
  for (const { session, stops: raw } of journeyData.sessions) {
    for (const s of raw as StopData[]) {
      const stop = toStop(session, s)
      if (!stop) continue
      if (prev) legs.push(buildLeg(session, prev, stop))
      stops.push(stop)
      prev = stop
    }
  }
  if (import.meta.env.DEV && prev && distanceKm(prev.at, hereAt) > hereRadiusKm)
    console.warn(`journey.json ends at "${prev.label}", ${Math.round(distanceKm(prev.at, hereAt))} km from current_location in party.json`)
  return { stops, legs }
}

let built: ReturnType<typeof build> | null = null
/** Worked out on first use (routing needs the places loaded). */
export const journey = () => (built ??= build())

export const legsOf = (n: number) => journey().legs.filter((l) => l.session === n)
/** Stops reached in a session, in order. The first is where the session started (the previous session's last stop). */
export function stopsOf(n: number): Stop[] {
  const { stops } = journey()
  const i = stops.findIndex((s) => s.session === n)
  if (i < 0) return []
  const own = stops.filter((s) => s.session === n)
  return i > 0 ? [stops[i - 1], ...own] : own
}
/** Sessions that start at the place or stop there. */
export const sessionsVisiting = (id: string) =>
  [...new Set(journey().stops.map((s) => s.session))].filter((n) => stopsOf(n).some((s) => s.place === id))
