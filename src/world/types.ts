import type { Feature, FeatureCollection, Point } from 'geojson'

/** How important a place is; drives icon, label weight and default detail level. */
export type Rank = 'capital' | 'city' | 'town' | 'village' | 'district' | 'farm' | 'poi'

export const RANKS: Rank[] = ['capital', 'city', 'town', 'village', 'district', 'farm', 'poi']
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
  /** Other names the place is searchable by ("The Emerald City"). */
  aliases?: string[]
  tags?: string[]
  /** id of the place this one belongs to (a farm or district of a city). */
  parent?: string
  /** Data caveat from the original trace. */
  note?: string
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
