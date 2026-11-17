// What the side panel shows, as the part of the URL after the camera: "#lng,lat,zoomz/<route>".
// Each change of route is a browser history entry, so Back and Forward step through the pages (src/map/controller.ts).
import { loreById } from '@/world/lore'
import { memberById } from '@/world/party'
import { sessionByN } from '@/world/sessions'
import { layers, type LayerName } from '@/world/data'
import { placeById, selectFeature, selectLore, selectMember, selectPlace, selectSession, store, type Panel } from './store'

/** Panels that are pages of their own (not a selection). */
const LIST_PANELS: Partial<Record<Panel, string>> = { menu: 'menu', sessions: 'sessions', party: 'party', glossary: 'glossary', people: 'people', directions: 'directions', results: 'search' }

/** The route for what is open now: '' (nothing), a place id, session/3, party/storvald, glossary/xezus, people/dion,
 * feature/lakes/lake-1, a list panel (menu, sessions, party, glossary, people, directions, search), or the web
 * of connections (web, web/<node id>). */
export function routeOf(): string {
  if (store.web.open) return store.web.focus ? `web/${store.web.focus}` : 'web'
  const s = store.selection
  if (store.panel === 'details' && s) {
    if (s.type === 'place') return s.id
    if (s.type === 'session') return `session/${s.n}`
    if (s.type === 'member') return `party/${s.id}`
    if (s.type === 'lore') return `${loreById(s.id)?.kind ?? 'glossary'}/${s.id}`
    return `feature/${s.layer}/${s.id}`
  }
  return LIST_PANELS[store.panel] ?? ''
}

/** Opens what a route names. Unknown routes close the panel. */
export function applyRoute(route: string) {
  // the web of connections: web, or web/<node id> with one in focus
  store.web.open = route === 'web' || route.startsWith('web/')
  if (store.web.open) {
    store.web.focus = route.startsWith('web/') ? route.slice(4) : null
    return
  }
  const list = Object.entries(LIST_PANELS).find(([, r]) => r === route)
  if (list) {
    if (list[0] !== 'directions') store.selection = null
    store.panel = list[0] as Panel
    return
  }
  const [head, a, b] = route.split('/')
  if (head === 'session' && sessionByN.has(Number(a))) return selectSession(Number(a))
  if (head === 'party' && a && memberById.has(a)) return selectMember(a)
  if ((head === 'glossary' || head === 'people') && a && loreById(a)) return selectLore(a)
  if (head === 'feature' && a in layers && (layers[a as LayerName].features as { properties?: { id?: string } }[]).some((f) => f.properties?.id === b))
    return selectFeature(a as LayerName, b)
  if (route && placeById.value.has(route)) return selectPlace(route)
  store.selection = null
  store.panel = 'none'
}
