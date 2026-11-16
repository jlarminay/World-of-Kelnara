// The party's current location (data/party.json): the blue dot, and the "Current location" directions waypoint.
import party from '../../data/party.json'

/** Waypoint key for the current location (see src/routing). */
export const HERE = 'here'
export const HERE_LABEL = 'Current location'

const loc = party.current_location
export const hereAt = loc.at as [number, number]
/** How rough the position is: drawn as the pale blue circle around the dot. */
export const hereRadiusKm = loc.radius_km
export const hereNote = loc.note
