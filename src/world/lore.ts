// The Glossary (data/glossary.json) and People (data/people.json): words and characters that aren't places on the map.
import glossaryData from '../../data/glossary.json'
import peopleData from '../../data/people.json'
import { GLOSSARY_INFO, PEOPLE_INFO, type Category } from './categories'

export type LoreKind = 'glossary' | 'people'

export interface LoreEntry {
  kind: LoreKind
  id: string
  name: string
  /** Heading it is listed under. */
  category: string
  /** Other spellings, found and linked in the session notes. */
  aliases?: string[]
  text: string
  /** Related glossary ids, people ids or place ids. */
  see?: string[]
  /** Places that matter to them (people). */
  places?: string[]
  /** Session it first comes up in. */
  first?: number
}

const load = (kind: LoreKind, data: { entries: Omit<LoreEntry, 'kind'>[] }): LoreEntry[] => data.entries.map((e) => ({ ...e, kind }))

export const lore: Record<LoreKind, LoreEntry[]> = {
  glossary: load('glossary', glossaryData),
  people: load('people', peopleData),
}
export const LORE_INFO: Record<LoreKind, Category> = { glossary: GLOSSARY_INFO, people: PEOPLE_INFO }
export const LORE_TITLE: Record<LoreKind, string> = { glossary: 'Glossary', people: 'People' }

const byId = new Map([...lore.glossary, ...lore.people].map((e) => [e.id, e]))
export const loreById = (id: string) => byId.get(id)

/** Entries grouped by category, in the order the categories first appear in the file. */
export function loreGroups(kind: LoreKind) {
  const groups = new Map<string, LoreEntry[]>()
  for (const e of lore[kind]) groups.set(e.category, [...(groups.get(e.category) ?? []), e])
  return [...groups].map(([category, entries]) => ({ category, entries }))
}

/** People linked to a place. */
export const peopleAt = (placeId: string) => lore.people.filter((e) => e.places?.includes(placeId))
