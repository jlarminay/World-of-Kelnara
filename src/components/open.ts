import type { SearchEntry } from '@/search'
import { flyToFeature, flyToPlace } from '@/map/controller'
import { store } from '@/state/store'

/** Select a search result: open its details and move the camera to it. */
export function openEntry(e: SearchEntry) {
  store.selection = e.selection
  store.panel = 'details'
  if (e.selection.type === 'place') flyToPlace(e.selection.id)
  else if (e.selection.type === 'feature') flyToFeature(e.selection.layer, e.selection.id)
  // sessions move the map themselves (SessionDetails.vue); characters don't move it
}
