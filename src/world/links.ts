// Names in text become links to their pages: places, glossary words, people, party members and named map features
// (lakes, forests, provinces, …). Used by the session notes and by every page's descriptions (LinkedText.vue).
import { computed } from 'vue'
import type { Feature } from 'geojson'
import { store } from '@/state/store'
import { layers, type LayerName } from './data'
import { lore } from './lore'
import { members } from './party'

/** What a name links to. For features the id is "layer:id". */
export type Target = { attr: 'data-place' | 'data-lore' | 'data-member' | 'data-feature'; id: string }

/** Feature layers whose names link, in the order search lists them (provinces before their labels). */
const FEATURE_LAYERS: LayerName[] = ['provinces', 'forests', 'mountains', 'lakes', 'rivers', 'labels', 'areas']

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Every linkable name (with aliases), longest first, as one regex, and what each points to.
 * When two things share a name: places win, then glossary and people, then party members, then map features. */
export const namePattern = computed(() => {
  const byName = new Map<string, Target>()
  const add = (name: string | null | undefined, t: Target) => { if (name && !byName.has(name)) byName.set(name, t) }
  for (const f of store.places.features) {
    const p = f.properties
    for (const name of [p.name, ...(p.aliases ?? [])]) if (name.length >= 4) add(name, { attr: 'data-place', id: p.id })
  }
  for (const e of [...lore.glossary, ...lore.people]) for (const name of [e.name, ...(e.aliases ?? [])]) add(name, { attr: 'data-lore', id: e.id })
  for (const m of members) {
    if (m.surname) add(`${m.name} ${m.surname}`, { attr: 'data-member', id: m.id })
    add(m.name, { attr: 'data-member', id: m.id })
  }
  for (const layer of FEATURE_LAYERS)
    for (const f of layers[layer].features as Feature[]) {
      const p = f.properties ?? {}
      if (layer === 'areas' && p.kind !== 'water_wall') continue // city areas link as their place
      if (typeof p.name === 'string' && p.name.length >= 4) add(p.name, { attr: 'data-feature', id: `${layer}:${p.id}` })
    }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length)
  return { re: new RegExp(`(?<![\\w'])(${names.map(escapeRe).join('|')})(?![\\w])`, 'g'), byName }
})

/** Links names in plain text that is already HTML-escaped (e.g. text between tags of rendered Markdown).
 * Only the first mention of each target is linked (shared through `linked`), and never `skip` (the page itself). */
export function linkEscaped(text: string, linked: Set<string>, skip?: string): string {
  const { re, byName } = namePattern.value
  return text.replace(re, (name) => {
    const t = byName.get(name)
    if (!t || t.id === skip || linked.has(t.id)) return name
    linked.add(t.id)
    return `<a href="#" ${t.attr}="${escapeHtml(t.id)}">${name}</a>`
  })
}

/** Plain text as HTML, with names linked (first mention of each, not `skip`). */
export function linkText(text: string, skip?: string, linked = new Set<string>()): string {
  const { re, byName } = namePattern.value
  let out = ''
  let last = 0
  for (const m of text.matchAll(re)) {
    const t = byName.get(m[1])
    out += escapeHtml(text.slice(last, m.index))
    last = m.index! + m[1].length
    if (!t || t.id === skip || linked.has(t.id)) out += escapeHtml(m[1])
    else {
      linked.add(t.id)
      out += `<a href="#" ${t.attr}="${escapeHtml(t.id)}">${escapeHtml(m[1])}</a>`
    }
  }
  return out + escapeHtml(text.slice(last))
}

/** Targets named in a text, in order of first mention. */
export function targetsIn(text: string): Target[] {
  const { re, byName } = namePattern.value
  const seen = new Map<string, Target>()
  for (const m of text.matchAll(re)) {
    const t = byName.get(m[1])
    if (t && !seen.has(t.id)) seen.set(t.id, t)
  }
  return [...seen.values()]
}
