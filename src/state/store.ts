import { computed, reactive, shallowRef } from 'vue'
import type { Map as MlMap } from 'maplibre-gl'
import type { Place, Places, Settlement } from '@/world/types'
import { layers, placesData, settlementData, type LayerName } from '@/world/data'
import type { RouteResult } from '@/routing'

export type Selection = { type: 'place'; id: string } | { type: 'feature'; layer: LayerName; id: string }
export type Panel = 'none' | 'results' | 'details' | 'directions'

export const store = reactive({
  /** Editable copies; the editor mutates these and saves them back to data/. */
  places: structuredClone(placesData) as Places,
  settlements: structuredClone(settlementData) as Settlement[],
  selection: null as Selection | null,
  panel: 'none' as Panel,
  query: '',
  baseLayer: 'map' as 'map' | 'original',
  /** Opacity of the original drawing when shown (the editor uses < 1 to compare the trace with it). */
  drawingOpacity: 1,
  zoom: 8,
  directions: {
    from: '' as string,
    to: '' as string,
    mode: 'foot' as 'foot' | 'horse' | 'cart',
    how: (layers.roads.features.length ? 'roads' : 'cross') as 'roads' | 'cross',
    result: null as RouteResult | null,
    error: '',
  },
  editor: { enabled: false, tool: 'select' as 'select' | 'add', dirty: false, status: '' },
})

export const mapRef = shallowRef<MlMap | null>(null)

export const placeById = computed(() => new Map(store.places.features.map((f) => [f.properties.id, f])))
export const childrenOf = (id: string): Place[] => store.places.features.filter((f) => f.properties.parent === id)

export function selectPlace(id: string) {
  store.selection = { type: 'place', id }
  store.panel = 'details'
}

export function clearSelection() {
  store.selection = null
  if (store.panel === 'details') store.panel = store.query ? 'results' : 'none'
}
