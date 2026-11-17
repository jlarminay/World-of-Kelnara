import type { SearchEntry } from '@/search'
import { flyToFeature, flyToPlace } from '@/map/controller'
import { selectFeature, selectLore, selectMember, selectPlace, store } from '@/state/store'
import type { LayerName } from '@/world/data'

/** Select a search result: open its details and move the camera to it. */
export function openEntry(e: SearchEntry) {
  store.selection = e.selection
  store.panel = 'details'
  if (e.selection.type === 'place') flyToPlace(e.selection.id)
  else if (e.selection.type === 'feature') flyToFeature(e.selection.layer, e.selection.id)
  // sessions move the map themselves (SessionDetails.vue); characters don't move it
}

/** Click handler for text with linked names (src/world/links.ts): opens the place, entry, character or feature. */
export function onLinkClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a[data-place], a[data-lore], a[data-member], a[data-feature]')
  if (!a) return
  e.preventDefault()
  e.stopPropagation()
  const place = a.getAttribute('data-place')
  const entry = a.getAttribute('data-lore')
  const member = a.getAttribute('data-member')
  const feature = a.getAttribute('data-feature')
  if (place) {
    selectPlace(place)
    flyToPlace(place)
  } else if (entry) selectLore(entry)
  else if (member) selectMember(member)
  else if (feature) {
    const i = feature.indexOf(':')
    const layer = feature.slice(0, i) as LayerName, id = feature.slice(i + 1)
    selectFeature(layer, id)
    flyToFeature(layer, id)
  }
}
