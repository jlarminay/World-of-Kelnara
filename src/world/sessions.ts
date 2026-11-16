// Session pages: the notes in reference/sessions/<n>.md, bundled as they are and rendered as Markdown.
// Each file starts with a small header block (--- title / summary / party ---). Optional header fields: date, when.
// party: the characters who were there, comma-separated, as spelled in reference/players/PARTY.md.
import MarkdownIt from 'markdown-it'
import { computed } from 'vue'
import { store } from '@/state/store'
import { memberByName, type Member } from './party'

const files = import.meta.glob('../../reference/sessions/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface Session {
  n: number
  title: string
  summary: string
  /** Real-world date it was played, if noted. */
  date?: string
  /** In-game time, if noted ("three years later"). */
  when?: string
  /** Characters who were there. */
  party: Member[]
  /** The notes, without the header block and the "# Session N" heading. */
  markdown: string
}

function parse(path: string, raw: string): Session {
  const n = Number(path.match(/(\d+)\.md$/)?.[1])
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const head: Record<string, string> = {}
  for (const line of (m?.[1] ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) head[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  const markdown = raw.slice(m?.[0].length ?? 0).replace(/^\s*#\s+Session\s+\d+[^\n]*\n/i, '')
  const party: Member[] = []
  for (const name of (head.party ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const member = memberByName.get(name.toLowerCase())
    if (member) party.push(member)
    else console.warn(`Session ${n}: "${name}" in party: is not in data/party.json`)
  }
  return { n, title: head.title ?? `Session ${n}`, summary: head.summary ?? '', date: head.date, when: head.when, party, markdown }
}

export const sessions: Session[] = Object.entries(files)
  .map(([path, raw]) => parse(path, raw))
  .filter((s) => s.n > 0)
  .sort((a, b) => a.n - b.n)

export const sessionByN = new Map(sessions.map((s) => [s.n, s]))

const md = new MarkdownIt({ html: false, linkify: false, typographer: false })

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Place names and aliases as one regex (longest first), with what each name points to. */
const namePattern = computed(() => {
  const byName = new Map<string, string>()
  for (const f of store.places.features) {
    const p = f.properties
    for (const name of [p.name, ...(p.aliases ?? [])]) if (name.length >= 4 && !byName.has(name)) byName.set(name, p.id)
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length)
  return { re: new RegExp(`(?<![\\w'])(${names.map(escapeRe).join('|')})(?![\\w])`, 'g'), byName }
})

/** Ids of the places named in a session's notes, in order of first mention. */
export function placesMentioned(n: number): string[] {
  const s = sessionByN.get(n)
  if (!s) return []
  const { re, byName } = namePattern.value
  const ids = [...s.markdown.matchAll(re)].map((m) => byName.get(m[1])!)
  return [...new Set(ids)]
}

/** The notes as HTML. The first mention of each place becomes a link (`data-place`), outside headings. */
export function sessionHtml(n: number): string {
  const s = sessionByN.get(n)
  if (!s) return ''
  const { re, byName } = namePattern.value
  const linked = new Set<string>()
  let inHeading = false
  // only touch text between tags, never the tags themselves
  return md.render(s.markdown).split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) {
      if (/^<h\d/.test(part)) inHeading = true
      else if (/^<\/h\d/.test(part)) inHeading = false
      return part
    }
    if (inHeading) return part
    return part.replace(re, (name) => {
      const id = byName.get(name)!
      if (linked.has(id)) return name
      linked.add(id)
      return `<a href="#" data-place="${id}">${name}</a>`
    })
  }).join('')
}

/** Sessions whose notes name the place. */
export const sessionsMentioning = (id: string) => sessions.filter((s) => placesMentioned(s.n).includes(id)).map((s) => s.n)
