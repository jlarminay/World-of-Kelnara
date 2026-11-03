import Fuse from 'fuse.js'
import { computed } from 'vue'
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
  text: string
  category: Category
  selection: Selection
}

const SEARCHABLE: LayerName[] = ['provinces', 'forests', 'mountains', 'lakes', 'rivers', 'labels']

function featureEntries(): SearchEntry[] {
  const seen = new Set<string>()
  const out: SearchEntry[] = []
  for (const layer of SEARCHABLE) {
    for (const f of layers[layer].features as Feature[]) {
      const p = f.properties ?? {}
      if (!p.name || seen.has(p.name)) continue // provinces also have labels: list once
      seen.add(p.name)
      const cat = FEATURE_INFO[p.kind] ?? FEATURE_INFO.region
      out.push({
        key: `${layer}:${p.id}`, name: p.name, aliases: [], kind: cat.label, subtitle: cat.label,
        text: p.description ?? '', category: cat, selection: { type: 'feature', layer, id: p.id },
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
      text: [p.description, p.history, ...(p.tags ?? [])].filter(Boolean).join(' '),
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
export const CHIPS: { label: string; match: (e: SearchEntry) => boolean }[] = [
  { label: 'Cities', match: (e) => ['capital', 'city', 'town', 'village'].includes(e.kind) },
  { label: 'Districts', match: (e) => e.kind === 'district' },
  { label: 'Farms', match: (e) => ['farm', 'orchard', 'mill'].includes(e.kind) },
  { label: 'Landmarks', match: (e) => ['landmark', 'castle', 'watchtower', 'shrine', 'temple'].includes(e.kind) },
  { label: 'Mines', match: (e) => ['mine', 'quarry'].includes(e.kind) },
  { label: 'Nature', match: (e) => e.selection.type === 'feature' },
]
