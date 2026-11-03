import Fuse from 'fuse.js'
import { computed, type Component } from 'vue'
import { Building2, Flag, Wheat, Landmark, Pickaxe, Trees, CircleAlert } from 'lucide-vue-next'
import type { Feature } from 'geojson'
import { layers, type LayerName } from '@/world/data'
import { categoryOf, FEATURE_INFO, type Category } from '@/world/categories'
import { store, type Selection } from '@/state/store'

export interface SearchEntry {
  key: string
  name: string
  aliases: string[]
  kind: string
  subtitle: string
  /** Short description shown under the name in results */
  summary: string
  /** All searchable text (description, history, details, tags) */
  text: string
  category: Category
  selection: Selection
}

const SEARCHABLE: LayerName[] = ['provinces', 'forests', 'mountains', 'lakes', 'rivers', 'labels', 'areas']

function featureEntries(): SearchEntry[] {
  const seen = new Set<string>()
  const out: SearchEntry[] = []
  for (const layer of SEARCHABLE) {
    for (const f of layers[layer].features as Feature[]) {
      const p = f.properties ?? {}
      if (!p.name || seen.has(p.name)) continue // provinces also have labels: list once
      if (layer === 'areas' && p.kind !== 'water_wall') continue // city areas are listed as their place
      seen.add(p.name)
      const cat = FEATURE_INFO[p.kind] ?? FEATURE_INFO.region
      out.push({
        key: `${layer}:${p.id}`, name: p.name, aliases: [], kind: cat.label, subtitle: cat.label, summary: p.description ?? '',
        text: [p.description, p.details].filter(Boolean).join(' '), category: cat, selection: { type: 'feature', layer, id: p.id },
      })
    }
  }
  return out
}

const staticEntries = featureEntries()

export const entries = computed<SearchEntry[]>(() => [
  ...store.places.features.map((f) => {
    const p = f.properties
    const cat = categoryOf(p)
    return {
      key: p.id, name: p.name, aliases: p.aliases ?? [], kind: p.rank === 'poi' || p.rank === 'farm' ? p.kind : p.rank,
      subtitle: [cat.label, p.province].filter(Boolean).join(' · '),
      summary: p.description ?? '',
      text: [p.description, p.history, p.details, ...(p.tags ?? [])].filter(Boolean).join(' '),
      category: cat, selection: { type: 'place', id: p.id } as Selection,
    }
  }),
  ...staticEntries,
])

const fuse = computed(
  () => new Fuse(entries.value, {
    keys: [{ name: 'name', weight: 3 }, { name: 'aliases', weight: 2 }, { name: 'kind', weight: 1 }, { name: 'subtitle', weight: 0.6 }, { name: 'text', weight: 0.4 }],
    threshold: 0.35, ignoreLocation: true, includeScore: true,
  }),
)

export function search(q: string, limit = 50): SearchEntry[] {
  const s = q.trim()
  if (!s) return []
  return fuse.value.search(s, { limit }).map((r) => r.item)
}

/** Quick filters shown as chips next to the search box. */
export const CHIPS: { label: string; icon: Component; match: (e: SearchEntry) => boolean }[] = [
  { label: 'Cities', icon: Building2, match: (e) => ['capital', 'city', 'town', 'village'].includes(e.kind) },
  { label: 'Districts', icon: Flag, match: (e) => e.kind === 'district' },
  { label: 'Farms', icon: Wheat, match: (e) => ['farm', 'orchard', 'mill'].includes(e.kind) },
  { label: 'Landmarks', icon: Landmark, match: (e) => ['landmark', 'castle', 'watchtower', 'outpost', 'shrine', 'temple'].includes(e.kind) },
  { label: 'Mines', icon: Pickaxe, match: (e) => ['mine', 'quarry'].includes(e.kind) },
  { label: 'Events', icon: CircleAlert, match: (e) => e.kind === 'event' },
  { label: 'Nature', icon: Trees, match: (e) => e.selection.type === 'feature' },
]
