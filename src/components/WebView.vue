<script setup lang="ts">
// Menu → Web of connections: every place, entry, character, session and map feature as a dot, and every connection
// between them as a line (src/world/web.ts). Click a dot to focus it: the camera closes in on it and its direct
// connections, things two steps away fade a little and everything else fades a lot. The slider shows the web as it
// stood after any session. Experimental.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ForceGraph from 'force-graph'
import type { IconNode } from 'lucide'
import { ArrowLeft, Check, ListFilter, MapPin, PanelLeftOpen } from 'lucide-vue-next'
import { buildWeb, lastSession, WEB_GROUPS, type WebGroup, type WebLink, type WebNode } from '@/world/web'
import { memberById } from '@/world/party'
import Avatar from './Avatar.vue'
import { store } from '@/state/store'
import { flyToFeature, flyToPlace } from '@/map/controller'
import LucideIcon from './LucideIcon.vue'

const el = ref<HTMLElement | null>(null)
const web = buildWeb()
const byId = new Map(web.nodes.map((n) => [n.id, n]))
const last = lastSession()
const session = computed({
  get: () => store.web.session ?? last,
  set: (v: number) => (store.web.session = v >= last ? null : v),
})

/** force-graph swaps a link's ends for the node objects; this reads either. */
const idOf = (x: string | WebNode) => (typeof x === 'string' ? x : x.id)
type GraphLink = Omit<WebLink, 'source' | 'target'> & { source: string | WebNode; target: string | WebNode }

// ---- filters: kinds of thing switched off (remembered on this device) ----
const FILTER_KEY = 'kelnara.web.hidden'
const UNCONNECTED_KEY = 'kelnara.web.unconnected'
try {
  const saved = JSON.parse(localStorage.getItem(FILTER_KEY) ?? '[]')
  if (Array.isArray(saved)) store.web.hidden = saved.filter((g) => WEB_GROUPS.some((x) => x.id === g))
  store.web.unconnected = localStorage.getItem(UNCONNECTED_KEY) === '1'
} catch { /* no storage: everything connected shown */ }
function toggleUnconnected() {
  store.web.unconnected = !store.web.unconnected
  try { localStorage.setItem(UNCONNECTED_KEY, store.web.unconnected ? '1' : '0') } catch { /* not remembered */ }
}
const hidden = computed(() => new Set(store.web.hidden))
function toggleGroup(id: WebGroup) {
  store.web.hidden = hidden.value.has(id) ? store.web.hidden.filter((g) => g !== id) : [...store.web.hidden, id]
  try { localStorage.setItem(FILTER_KEY, JSON.stringify(store.web.hidden)) } catch { /* not remembered */ }
}
const filtersOpen = ref(false)
const filterBox = ref<HTMLElement | null>(null)
function outside(e: PointerEvent) {
  if (filtersOpen.value && !filterBox.value?.contains(e.target as Node)) filtersOpen.value = false
}
onMounted(() => window.addEventListener('pointerdown', outside))
onBeforeUnmount(() => window.removeEventListener('pointerdown', outside))

/** The web as it stood after `n` sessions (the things known by then, and the connections made by then), without
 * the kinds of thing filtered out. Things left with no connections are shown only when "Unconnected" is on. */
function upTo(n: number) {
  const off = (id: string) => hidden.value.has(byId.get(id)?.group ?? '')
  const links = (web.links as GraphLink[]).filter((l) => l.first <= n && !off(idOf(l.source)) && !off(idOf(l.target)))
  const used = new Set(links.flatMap((l) => [idOf(l.source), idOf(l.target)]))
  return { nodes: web.nodes.filter((x) => x.first <= n && !hidden.value.has(x.group) && (used.has(x.id) || store.web.unconnected)), links }
}
let data = upTo(session.value)

/** Neighbours in what is shown now. */
const neighbours = computed(() => {
  const map = new Map<string, Set<string>>()
  void session.value // recomputed when the slider or the filters change
  void hidden.value
  void store.web.unconnected
  for (const l of data.links) {
    const a = idOf(l.source), b = idOf(l.target)
    if (!map.has(a)) map.set(a, new Set())
    if (!map.has(b)) map.set(b, new Set())
    map.get(a)!.add(b)
    map.get(b)!.add(a)
  }
  return map
})
const focus = computed(() => (store.web.focus && byId.get(store.web.focus)) || null)
const near = computed(() => {
  const f = focus.value
  if (!f) return null
  const one = new Set([f.id, ...(neighbours.value.get(f.id) ?? [])])
  const two = new Set<string>()
  for (const id of one) for (const n of neighbours.value.get(id) ?? []) if (!one.has(n)) two.add(n)
  return { one, two }
})
const focusConnections = computed(() => (focus.value ? (neighbours.value.get(focus.value.id)?.size ?? 0) : 0))

const radius = (n: WebNode) => 3 + 1.4 * Math.sqrt(n.degree)
/** How strongly a dot is drawn: everything when nothing is in focus, else by how far it is from the focus. */
function alphaOf(id: string) {
  const s = near.value
  if (!s) return 1
  return s.one.has(id) ? 1 : s.two.has(id) ? 0.35 : 0.08
}

let graph: ForceGraph<WebNode, GraphLink> | null = null

/** A Lucide icon (24×24, drawn as strokes) as one canvas path, made once per icon. */
const iconPaths = new Map<IconNode, Path2D>()
function iconPath(icon: IconNode): Path2D {
  let path = iconPaths.get(icon)
  if (path) return path
  path = new Path2D()
  for (const [tag, a] of icon as [string, Record<string, string | number>][]) {
    const n = (k: string) => Number(a[k] ?? 0)
    if (tag === 'path') path.addPath(new Path2D(String(a.d)))
    else if (tag === 'circle') { path.moveTo(n('cx') + n('r'), n('cy')); path.arc(n('cx'), n('cy'), n('r'), 0, 2 * Math.PI) }
    else if (tag === 'ellipse') { path.moveTo(n('cx') + n('rx'), n('cy')); path.ellipse(n('cx'), n('cy'), n('rx'), n('ry'), 0, 0, 2 * Math.PI) }
    else if (tag === 'rect') { const r = new Path2D(); r.roundRect(n('x'), n('y'), n('width'), n('height'), n('rx')); path.addPath(r) }
    else if (tag === 'line') { path.moveTo(n('x1'), n('y1')); path.lineTo(n('x2'), n('y2')) }
    else if (tag === 'polyline' || tag === 'polygon') {
      const pts = String(a.points).trim().split(/[\s,]+/).map(Number)
      for (let i = 0; i < pts.length; i += 2) i ? path.lineTo(pts[i], pts[i + 1]) : path.moveTo(pts[i], pts[i + 1])
      if (tag === 'polygon') path.closePath()
    }
  }
  iconPaths.set(icon, path)
  return path
}

/** Portraits, loaded once; drawn when ready (the initial is shown until then). */
const portraits = new Map<string, HTMLImageElement>()
function portrait(src: string) {
  let img = portraits.get(src)
  if (!img) {
    img = new Image()
    img.onload = () => redraw()
    img.src = `${import.meta.env.BASE_URL}${src}`
    portraits.set(src, img)
  }
  return img.complete && img.naturalWidth ? img : null
}

/** An icon centred at (x, y), `size` across, stroked in `color`. */
function drawIcon(ctx: CanvasRenderingContext2D, icon: IconNode, x: number, y: number, size: number, color: string) {
  const k = size / 24
  ctx.save()
  ctx.translate(x - 12 * k, y - 12 * k)
  ctx.scale(k, k)
  ctx.lineWidth = 2.25
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.stroke(iconPath(icon))
  ctx.restore()
}

function draw(n: WebNode, ctx: CanvasRenderingContext2D, scale: number) {
  const a = alphaOf(n.id)
  const r = radius(n)
  const color = n.category.color
  ctx.globalAlpha = a
  ctx.beginPath()
  ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI)
  ctx.fillStyle = color
  ctx.fill()
  const img = n.member?.portrait ? portrait(n.member.portrait) : null
  if (img) {
    // a portrait, cropped to the circle like object-cover
    ctx.save()
    ctx.clip()
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, n.x! - r, n.y! - r, 2 * r, 2 * r)
    ctx.restore()
  }
  ctx.lineWidth = (n.id === store.web.focus ? 3 : 1.5) / scale
  ctx.strokeStyle = n.id === store.web.focus ? '#202124' : '#ffffff'
  ctx.beginPath()
  ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI)
  ctx.stroke()
  if (n.member) {
    // like Avatar.vue: the initial in white, and a white class badge in the corner with the icon in their colour
    if (!img) {
      ctx.font = `500 ${r * 0.88}px Roboto, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(n.member.letter, n.x!, n.y! + r * 0.04)
    }
    if (n.member.badge) {
      const br = r * 0.42
      const bx = n.x! + r - br + r * 0.06, by = n.y! + r - br + r * 0.06
      ctx.beginPath()
      ctx.arc(bx, by, br, 0, 2 * Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = 2
      ctx.fill()
      ctx.shadowBlur = 0
      drawIcon(ctx, n.member.badge, bx, by, br * 2 * 0.62, color)
    }
  } else drawIcon(ctx, n.category.icon, n.x!, n.y!, r * 1.25, '#ffffff') // white icon on its colour, like the map pins
  // names: the big hubs always, the rest once zoomed in, and the focus and its neighbours
  const s = near.value
  if (scale > 2.2 || n.degree > 25 || (s && s.one.has(n.id))) {
    const size = Math.max(10 / scale, (n.degree > 25 ? 4.5 : 3.2))
    ctx.font = `${n.id === store.web.focus ? 600 : 400} ${size}px Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineWidth = 3 / scale
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.strokeText(n.name, n.x!, n.y! + r + 1.5)
    ctx.fillStyle = '#202124'
    ctx.fillText(n.name, n.x!, n.y! + r + 1.5)
  }
  ctx.globalAlpha = 1
}

function linkColor(l: GraphLink) {
  const s = near.value
  if (!s) return 'rgba(95, 99, 104, 0.18)'
  const a = idOf(l.source), b = idOf(l.target)
  if (a === store.web.focus || b === store.web.focus) return 'rgba(26, 115, 232, 0.7)'
  if (s.one.has(a) && s.one.has(b)) return 'rgba(95, 99, 104, 0.25)'
  return 'rgba(95, 99, 104, 0.04)'
}

/** Moves the camera to the focus and its direct connections, or to the whole web. */
function frame(ms = 700) {
  if (!graph) return
  const s = near.value
  graph.zoomToFit(ms, 60, s ? (n) => s.one.has(n.id) : undefined)
}
/** Redraws with the new focus (force-graph only redraws on its own changes). */
const redraw = () => graph?.nodeCanvasObject(draw).linkColor(linkColor)

let framed = false
onMounted(() => {
  graph = new ForceGraph<WebNode, GraphLink>(el.value!)
    .backgroundColor('#f8f9fa')
    .nodeId('id')
    .nodeLabel(() => '')
    .nodeCanvasObject(draw)
    .nodePointerAreaPaint((n, color, ctx) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, radius(n) + 3, 0, 2 * Math.PI)
      ctx.fill()
    })
    .linkColor(linkColor)
    .linkWidth((l) => (store.web.focus && (idOf(l.source) === store.web.focus || idOf(l.target) === store.web.focus) ? 1.6 : 0.6))
    .onNodeClick((n) => (store.web.focus = n.id))
    .onBackgroundClick(() => (store.web.focus = null))
    .warmupTicks(120) // lay out most of the web before the first frame, so it opens settled and in view
    .cooldownTicks(200)
    .onEngineStop(() => {
      if (!framed) frame(400)
      framed = true
    })
    .graphData(data)
  graph.d3Force('charge')?.strength?.(-60)
  // a gentle pull to the middle, so small groups with no link to the rest don't drift off and shrink the view
  let all: WebNode[] = []
  const gravity = Object.assign((alpha: number) => {
    for (const n of all) {
      n.vx = (n.vx ?? 0) - (n.x ?? 0) * 0.1 * alpha
      n.vy = (n.vy ?? 0) - (n.y ?? 0) * 0.1 * alpha
    }
  }, { initialize: (nodes: WebNode[]) => (all = nodes) })
  graph.d3Force('gravity', gravity)
  const fit = () => graph?.width(el.value!.clientWidth).height(el.value!.clientHeight)
  fit()
  new ResizeObserver(fit).observe(el.value!)
  setTimeout(() => frame(0), 50)
})
onBeforeUnmount(() => {
  graph?._destructor()
  graph = null
})

watch(() => store.web.focus, () => {
  redraw()
  frame()
})
watch([session, hidden, () => store.web.unconnected], ([n]) => {
  data = upTo(n)
  graph?.graphData(data)
  if (store.web.focus && !data.nodes.some((x) => x.id === store.web.focus)) store.web.focus = null
  redraw()
  framed = false // frame the new web once it settles
})

function close() {
  store.web.open = false
  store.web.focus = null
}
/** Leaves the web for the focus's own page in the side panel (and the map, for places and features). */
function openPage(onMap: boolean) {
  const f = focus.value
  if (!f) return
  close()
  store.selection = f.selection
  store.panel = 'details'
  if (onMap && f.selection.type === 'place') flyToPlace(f.selection.id)
  if (onMap && f.selection.type === 'feature') flyToFeature(f.selection.layer, f.selection.id)
}
const onMapable = computed(() => focus.value?.selection.type === 'place' || focus.value?.selection.type === 'feature')

function key(e: KeyboardEvent) {
  if (e.key === 'Escape') store.web.focus ? (store.web.focus = null) : close()
}
onMounted(() => window.addEventListener('keydown', key))
onBeforeUnmount(() => window.removeEventListener('keydown', key))

</script>

<template>
  <div class="fixed inset-0 z-40 flex flex-col bg-[#f8f9fa]">
    <header class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-white px-3 py-2 shadow-sm">
      <button class="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Back to the map" @click="close"><ArrowLeft class="size-5" /></button>
      <h1 class="text-lg">Web of connections</h1>
      <label class="ml-auto flex min-w-[220px] flex-1 items-center gap-3 text-sm sm:max-w-sm">
        <span class="shrink-0 text-muted-foreground">As of session</span>
        <input v-model.number="session" type="range" min="1" :max="last" step="1" class="flex-1 accent-[#5e35b1]" />
        <span class="w-4 shrink-0 text-right font-medium">{{ session }}</span>
      </label>
    </header>

    <div class="relative min-h-0 flex-1">
      <div ref="el" class="absolute inset-0" />

      <!-- filters: switch kinds of thing off -->
      <div ref="filterBox" class="absolute top-3 right-3">
        <button
          class="relative grid size-10 place-items-center rounded-lg bg-white text-muted-foreground shadow-gm hover:text-[#1a73e8]"
          :class="filtersOpen ? 'text-[#1a73e8]' : ''" title="Filter" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen"
        >
          <ListFilter class="size-5" />
          <span v-if="hidden.size || store.web.unconnected" class="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#1a73e8]" />
        </button>
        <div v-if="filtersOpen" class="absolute top-12 right-0 w-56 rounded-xl bg-white py-2 shadow-gm">
          <p class="px-4 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Show</p>
          <button
            v-for="g in WEB_GROUPS" :key="g.id" role="menuitemcheckbox" :aria-checked="!hidden.has(g.id)"
            class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-black/5" @click="toggleGroup(g.id)"
          >
            <span
              class="grid size-[18px] shrink-0 place-items-center rounded border-2"
              :class="hidden.has(g.id) ? 'border-muted-foreground/50' : 'border-[#1a73e8] bg-[#1a73e8] text-white'"
            ><Check v-if="!hidden.has(g.id)" class="size-3.5" :stroke-width="3" /></span>
            {{ g.label }}
          </button>
          <!-- not a kind of thing, but things of any kind with nothing linking them -->
          <hr class="my-2 border-border" />
          <button
            role="menuitemcheckbox" :aria-checked="store.web.unconnected"
            class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-black/5" @click="toggleUnconnected"
          >
            <span
              class="grid size-[18px] shrink-0 place-items-center rounded border-2"
              :class="store.web.unconnected ? 'border-[#1a73e8] bg-[#1a73e8] text-white' : 'border-muted-foreground/50'"
            ><Check v-if="store.web.unconnected" class="size-3.5" :stroke-width="3" /></span>
            Unconnected
          </button>
        </div>
      </div>

      <div v-if="focus" class="absolute right-3 bottom-3 left-3 rounded-xl bg-white p-4 shadow-gm sm:right-auto sm:w-80">
        <div class="flex items-start gap-3">
          <Avatar v-if="focus.selection.type === 'member' && memberById.get(focus.selection.id)" :member="memberById.get(focus.selection.id)!" :size="36" />
          <span v-else class="grid size-9 shrink-0 place-items-center rounded-full" :style="{ background: focus.category.color }">
            <LucideIcon :icon="focus.category.icon" :size="18" class="text-white" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-base leading-6 font-medium">{{ focus.name }}</p>
            <p class="truncate text-xs text-muted-foreground">{{ focus.sub }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ focusConnections }} connection{{ focusConnections === 1 ? '' : 's' }}<template v-if="focus.first"> · first in session {{ focus.first }}</template></p>
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm text-white hover:brightness-110" @click="openPage(false)">
            <PanelLeftOpen class="size-4" />Open page
          </button>
          <button v-if="onMapable" class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-primary hover:bg-black/5" @click="openPage(true)">
            <MapPin class="size-4" />Show on map
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
