import { computed, reactive, shallowRef } from 'vue'
import type { Map as MlMap } from 'maplibre-gl'
import type { Place, Places, Settlement } from '@/world/types'
import { layers, placesData, settlementData, type LayerName } from '@/world/data'
import type { RouteResult } from '@/routing'

export type Selection = { type: 'place'; id: string } | { type: 'feature'; layer: LayerName; id: string }
export type Panel = 'none' | 'menu' | 'results' | 'details' | 'directions'

export const store = reactive({
  /** Copies of the bundled data (the city generator watches these). */
  places: structuredClone(placesData) as Places,
  settlements: structuredClone(settlementData) as Settlement[],
  selection: null as Selection | null,
  panel: 'none' as Panel,
  query: '',
  baseLayer: 'map' as 'map' | 'original',
  /** Opacity of the original drawing when shown. */
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
  /** Right-click menu: screen position and the map point under it. */
  contextMenu: null as null | { x: number; y: number; lngLat: [number, number] },
  /** Distance measuring: points of the path, and the kind of ground for the time estimate. */
  measure: { active: false, points: [] as [number, number][], ground: 'open' as Ground },
  /** Phone-sized screen: panels become a bottom sheet (like Google Maps on mobile). */
  mobile: false,
  /** Bottom sheet height on phones. */
  sheet: 'peek' as 'peek' | 'full',
  /** Time of the last long-press (touch "right-click"), so the tap that ends it is ignored. */
  longPressAt: 0,
})

const phone = window.matchMedia('(max-width: 640px)')
store.mobile = phone.matches
phone.addEventListener('change', (e) => (store.mobile = e.matches))

/** Height of the bottom sheet when peeking (phones). */
export const sheetPeekPx = () => Math.round(window.innerHeight * 0.45)

export type Ground = 'road' | 'path' | 'open'

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
