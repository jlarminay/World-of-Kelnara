// The party (data/party.json): the characters, and their current location (the blue dot, and "Current location" in Directions).
import party from '../../data/party.json'

/** Waypoint key for the current location (see src/routing). */
export const HERE = 'here'
export const HERE_LABEL = 'Current location'

const loc = party.current_location
export const hereAt = loc.at as [number, number]
/** How rough the position is: drawn as the pale blue circle around the dot. */
export const hereRadiusKm = loc.radius_km
export const hereNote = loc.note

export interface Member {
  id: string
  name: string
  player: string
  race: string
  class: string
  /** Avatar colour. */
  color: string
  /** An image in public/ (e.g. "party/golgamutt.webp"), or null for the coloured initial. */
  portrait: string | null
  /** A sentence or two: what sets this character apart. */
  summary: string
  /** What they did, one line each, with the session it happened in. */
  story: { session: number; text: string }[]
  /** Places that matter to them, and why. */
  places: { id: string; why: string }[]
}
/** The characters, in the order of reference/players/PARTY.md. */
export const members = party.members as Member[]
export const memberByName = new Map(members.map((m) => [m.name.toLowerCase(), m]))
export const memberById = new Map(members.map((m) => [m.id, m]))
/** Characters linked to a place (members[].places). */
export const membersAt = (placeId: string) => members.filter((m) => m.places.some((p) => p.id === placeId))
