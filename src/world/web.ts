// The web of connections (Menu → Web): every place, glossary word, person, character, session and named map
// feature, and how they connect. A connection is anything the data says or the text mentions: "see also" and
// places on entries, characters' places, a district inside its city, who was at a session, where the party went,
// and every name mentioned in a description, a story line or a session's notes (src/world/links.ts).
// Each node and connection also knows the session it first appears in, for the "as of session N" slider
// (0 = known from the map alone).
import type { Feature } from 'geojson'
import { Axe, BowArrow, Eye, Guitar, Leaf, ShieldHalf, Sun, WandSparkles, type IconNode } from 'lucide'
import journeyData from '../../data/journey.json'
import { store, type Selection } from '@/state/store'
import { layers, type LayerName } from './data'
import { categoryOf, FEATURE_INFO, MEMBER_INFO, SESSION_INFO, type Category } from './categories'
import { lore, LORE_INFO, loreById } from './lore'
import { members } from './party'
import { sessions } from './sessions'
import { targetsIn, type Target } from './links'

export interface WebNode {
  /** "place:<id>", "lore:<id>", "member:<id>", "session:<n>" or "feature:<layer>:<id>". */
  id: string
  name: string
  /** What it is, shown under the name ("Castle", "People · The cult of Xezus", "Session"). */
  sub: string
  /** Which kind of thing it is, for the filters (WEB_GROUPS). */
  group: WebGroup
  /** Icon and colour, the same as on the map and in the app. */
  category: Category
  /** Party members are drawn like their avatar: portrait or initial, with a class badge (Avatar.vue). */
  member?: { letter: string; portrait: string | null; badge?: IconNode }
  /** What opens when it is opened in the side panel. */
  selection: Selection
  /** Session it first comes up in (0: known from the map alone). */
  first: number
  /** Number of connections (all sessions). */
  degree: number
  // position and velocity, filled in by the layout
  x?: number
  y?: number
  vx?: number
  vy?: number
}
export interface WebLink {
  source: string
  target: string
  /** Session the connection is first made in. */
  first: number
}

/** The class badge on a party member's avatar (the same icons as Avatar.vue). */
const CLASS_ICON: Record<string, IconNode> = {
  Barbarian: Axe, Cleric: Sun, Bard: Guitar, Druid: Leaf, Warlock: Eye, Ranger: BowArrow, Wizard: WandSparkles, Paladin: ShieldHalf,
}

const FEATURE_LAYERS: LayerName[] = ['provinces', 'forests', 'mountains', 'lakes', 'rivers', 'labels', 'areas']

/** The kinds of thing in the web, in the order the filters list them. */
export const WEB_GROUPS = [
  { id: 'session', label: 'Sessions' },
  { id: 'member', label: 'Party' },
  { id: 'people', label: 'People' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'place', label: 'Places' },
  { id: 'feature', label: 'Map features' },
] as const
export type WebGroup = (typeof WEB_GROUPS)[number]['id']

const fromTarget = (t: Target) =>
  t.attr === 'data-place' ? `place:${t.id}` : t.attr === 'data-lore' ? `lore:${t.id}` : t.attr === 'data-member' ? `member:${t.id}` : `feature:${t.id}`
/** A "see"/"places" id from the data: an entry or a place. */
const fromDataId = (id: string) => (loreById(id) ? `lore:${id}` : `place:${id}`)

let built: { nodes: WebNode[]; links: WebLink[] } | null = null

export function buildWeb() {
  if (built) return built
  const nodes = new Map<string, WebNode>()
  const add = (n: Omit<WebNode, 'degree' | 'first' | 'group'> & { first?: number }) => {
    const kind = n.id.split(':')[0]
    const group = (kind === 'lore' ? (n.category === LORE_INFO.people ? 'people' : 'glossary') : kind) as WebGroup
    nodes.set(n.id, { degree: 0, ...n, group, first: n.first ?? Infinity })
  }

  for (const f of store.places.features) {
    const p = f.properties
    if (/^Unnamed /.test(p.name)) continue
    const cat = categoryOf(p)
    add({ id: `place:${p.id}`, name: p.name, sub: cat.label, category: cat, selection: { type: 'place', id: p.id } })
  }
  for (const e of [...lore.glossary, ...lore.people])
    add({ id: `lore:${e.id}`, name: e.name, sub: `${LORE_INFO[e.kind].label} · ${e.category}`, category: LORE_INFO[e.kind], selection: { type: 'lore', id: e.id }, first: e.first })
  for (const m of members)
    add({ id: `member:${m.id}`, name: m.name, sub: `${m.race} ${m.class}`, category: { ...MEMBER_INFO, color: m.color }, member: { letter: m.name[0], portrait: m.portrait, badge: CLASS_ICON[m.class] }, selection: { type: 'member', id: m.id } })
  for (const s of sessions)
    add({ id: `session:${s.n}`, name: `Session ${s.n}`, sub: s.title, category: SESSION_INFO, selection: { type: 'session', n: s.n }, first: s.n })
  for (const layer of FEATURE_LAYERS)
    for (const f of layers[layer].features as Feature[]) {
      const p = f.properties ?? {}
      if (!p.name || (layer === 'areas' && p.kind !== 'water_wall')) continue
      const id = `feature:${layer}:${p.id}`
      if ([...nodes.values()].some((n) => n.id.startsWith('feature:') && n.name === p.name)) continue // a province and its label
      const cat = FEATURE_INFO[p.kind] ?? FEATURE_INFO.region
      add({ id, name: p.name, sub: cat.label, category: cat, selection: { type: 'feature', layer, id: p.id } })
    }

  // connections: the session each is made in (0 = always known), kept at the earliest
  const linkAt = new Map<string, WebLink>()
  const connect = (a: string, b: string, session = 0) => {
    if (a === b || !nodes.has(a) || !nodes.has(b)) return
    const [source, target] = a < b ? [a, b] : [b, a]
    const key = `${source}|${target}`
    const l = linkAt.get(key)
    if (!l || session < l.first) linkAt.set(key, { source, target, first: session })
  }
  const mentions = (from: string, text: string | undefined, session = 0) => {
    if (text) for (const t of targetsIn(text)) connect(from, fromTarget(t), session)
  }

  for (const s of sessions) {
    const id = `session:${s.n}`
    for (const m of s.party) connect(id, `member:${m.id}`, s.n)
    mentions(id, s.summary, s.n)
    mentions(id, s.markdown, s.n)
  }
  for (const j of journeyData.sessions)
    for (const stop of j.stops as (string | { place?: string; note?: string })[]) {
      const o = typeof stop === 'string' ? { place: stop } : stop
      if (o.place) connect(`session:${j.session}`, `place:${o.place}`, j.session)
      mentions(`session:${j.session}`, o.note, j.session)
    }
  for (const m of members) {
    const id = `member:${m.id}`
    mentions(id, m.summary)
    for (const e of m.story) mentions(id, e.text, e.session)
    for (const p of m.places) connect(id, `place:${p.id}`)
  }
  for (const e of [...lore.glossary, ...lore.people]) {
    const id = `lore:${e.id}`
    mentions(id, e.text)
    for (const x of [...(e.see ?? []), ...(e.places ?? [])]) connect(id, fromDataId(x))
  }
  for (const f of store.places.features) {
    const p = f.properties
    const id = `place:${p.id}`
    if (p.parent) connect(id, `place:${p.parent}`)
    for (const t of [p.description, p.details, p.history]) mentions(id, t)
  }
  for (const layer of FEATURE_LAYERS)
    for (const f of layers[layer].features as Feature[]) {
      const p = f.properties ?? {}
      for (const t of [p.description, p.details]) mentions(`feature:${layer}:${p.id}`, t)
    }

  // when each thing first comes up: its own first session, else the first session of any of its connections
  // made in a session (a place first mentioned in session 3's notes), else 0 (known from the map)
  const links = [...linkAt.values()]
  for (const l of links) {
    for (const [a, b] of [[l.source, l.target], [l.target, l.source]])
      if (l.first > 0 && b.startsWith('session:')) nodes.get(a)!.first = Math.min(nodes.get(a)!.first, l.first)
  }
  for (const n of nodes.values()) if (!Number.isFinite(n.first)) n.first = 0
  // a connection can't exist before both ends do
  for (const l of links) {
    l.first = Math.max(l.first, nodes.get(l.source)!.first, nodes.get(l.target)!.first)
    nodes.get(l.source)!.degree++
    nodes.get(l.target)!.degree++
  }
  // things with no connections are kept: the web shows them only when "Unconnected" is switched on
  return (built = { nodes: [...nodes.values()], links })
}

/** The last session with notes. */
export const lastSession = () => Math.max(...sessions.map((s) => s.n))
