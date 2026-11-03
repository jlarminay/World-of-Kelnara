import type { Feature, FeatureCollection, Point } from 'geojson'

/** How important a place is; drives icon, label weight and default detail level. */
/** 'event' marks where something happened rather than a place. */
export type Rank = 'capital' | 'city' | 'town' | 'village' | 'district' | 'farm' | 'poi' | 'event'

export const RANKS: Rank[] = ['event', 'capital', 'city', 'town', 'village', 'district', 'farm', 'poi']
export const SETTLEMENT_RANKS: Rank[] = ['capital', 'city', 'town', 'village']

export interface PlaceProps {
  id: string
  name: string
  rank: Rank
  /** Free-form sub-type: mine, shrine, watchtower, farm, inn, ... (picks the POI icon). */
  kind: string
  province?: string | null
  /** Detail level (map zoom = base_zoom + minzoom). 0 = whole world, ~7 = city streets. */
  minzoom: number
  description?: string
  history?: string
  /** Long-form notes (several paragraphs, blank line between them). Shown above "Nearby". */
  details?: string
  /** When an event happened, in the campaign's own terms ("Session 4, three days past Green Rock Farm"). */
  when?: string
  /** Other names the place is searchable by ("The Emerald City"). */
  aliases?: string[]
  tags?: string[]
  /** id of the place this one belongs to (a district of a city, a POI in a district). Can chain: POI → district → city. */
  parent?: string
  /** id of this place's boundary polygon in areas.geojson (a city's urban area, a district). Outlined when selected. */
  area?: string
  /** Where roads cross a city's boundary. Distances between cities are measured gate to gate. */
  gates?: Gate[]
  /** Data caveat from the original trace. */
  note?: string
}

export interface Gate {
  id: string
  name?: string
  at: [number, number]
  /** id of the gate's own place in places.geojson, if it has one. */
  place?: string
  /** id of the road in roads.geojson that leaves the city here. */
  road?: string
}

export type Place = Feature<Point, PlaceProps>
export type Places = FeatureCollection<Point, PlaceProps>

/** Parameters for a procedurally generated city + farmland ring (data/settlements.json). */
export interface Settlement {
  id: string
  placeId: string
  /** Change it and the streets and fields get re-rolled. Keep it fixed once you like the layout. */
  seed: number
  /** Radius of the built-up area. */
  radiusKm: number
  /** Outer radius of the farmland ring. 0 = no farms. */
  farmlandKm: number
  /** Walled old town radius. 0 = no walls. */
  oldTownKm: number
  /** Number of main roads radiating from the centre. */
  arteries: number
  /** Names given to the arteries, clockwise from north. Missing ones are generated. */
  arteryNames?: string[]
}
