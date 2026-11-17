// Session pages: the notes in reference/sessions/<n>.md, bundled as they are and rendered as Markdown.
// Each file starts with a small header block (--- title / summary / party ---). Optional header fields: date, when.
// party: the characters who were there, comma-separated, as spelled in reference/players/PARTY.md.
import MarkdownIt from 'markdown-it'
import { memberByName, type Member } from './party'
import { linkEscaped, targetsIn, type Target } from './links'

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

/** Ids of the places, glossary words, people, characters and map features named in a session's notes, in order of first mention. */
function mentioned(n: number): Target[] {
  const s = sessionByN.get(n)
  return s ? targetsIn(s.markdown) : []
}
export const placesMentioned = (n: number) => mentioned(n).filter((t) => t.attr === 'data-place').map((t) => t.id)

/** The notes as HTML. The first mention of each name becomes a link (src/world/links.ts), outside headings. */
export function sessionHtml(n: number): string {
  const s = sessionByN.get(n)
  if (!s) return ''
  const linked = new Set<string>()
  let inHeading = false
  // only touch text between tags, never the tags themselves
  return md.render(s.markdown).split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) {
      if (/^<h\d/.test(part)) inHeading = true
      else if (/^<\/h\d/.test(part)) inHeading = false
      return part
    }
    return inHeading ? part : linkEscaped(part, linked)
  }).join('')
}

/** Sessions whose notes name the place, glossary word, person, character or feature ("layer:id"). */
export const sessionsMentioning = (id: string) => sessions.filter((s) => mentioned(s.n).some((t) => t.id === id)).map((s) => s.n)
