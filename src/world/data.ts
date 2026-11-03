// All map data is bundled at build time, so the deployed app is a single read-only HTML file.
import type { FeatureCollection } from 'geojson'
import type { Places, Settlement } from './types'
import world from '../../data/world.json'
import settlements from '../../data/settlements.json'
import land from '../../data/land.geojson'
import provinces from '../../data/provinces.geojson'
import forests from '../../data/forests.geojson'
import mountains from '../../data/mountains.geojson'
import ridges from '../../data/ridges.geojson'
import lakes from '../../data/lakes.geojson'
import rivers from '../../data/rivers.geojson'
import borders from '../../data/borders.geojson'
import roads from '../../data/roads.geojson'
import places from '../../data/places.geojson'
import labels from '../../data/labels.geojson'
import areas from '../../data/areas.geojson'

export { world }
export const settlementData = settlements as Settlement[]
export const placesData = places as unknown as Places

export const layers = { land, provinces, forests, mountains, ridges, lakes, rivers, borders, roads, labels, areas } satisfies Record<
  string,
  FeatureCollection
>
export type LayerName = keyof typeof layers
