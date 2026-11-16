<script setup lang="ts">
// One session: where the party went (the trail's stops and legs) and the full notes.
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays, Hourglass } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { sessionByN, sessionHtml } from '@/world/sessions'
import { legsOf, stopsOf } from '@/world/journey'
import { SESSION_INFO } from '@/world/categories'
import { formatKm, formatTravel } from '@/world/coords'
import { selectMember, selectPlace, selectSession, store } from '@/state/store'
import { flyToPlace } from '@/map/controller'
import { fitSession } from '@/map/journey'
import Hero from './Hero.vue'
import Avatar from './Avatar.vue'

const props = defineProps<{ n: number }>()
const s = computed(() => sessionByN.get(props.n))
const html = computed(() => sessionHtml(props.n))
const prev = computed(() => sessionByN.get(props.n - 1))
const next = computed(() => sessionByN.get(props.n + 1))

/** The route as rows: each stop, with the leg that led to it. Stops that only steer the route are folded into their leg. */
const route = computed(() => {
  const stops = stopsOf(props.n)
  const legs = legsOf(props.n)
  const rows: { name: string; place?: string; note?: string; approx: boolean; km: number; days: number; guess: boolean; dashed: boolean }[] = []
  let km = 0, days = 0, guess = false, dashed = false
  let via: string | undefined // notes of steering stops, shown on the stop they lead to
  stops.forEach((stop, i) => {
    const leg = i > 0 ? legs[i - 1] : undefined
    if (leg) { km += leg.km; days += leg.days; guess ||= leg.guess; dashed ||= leg.approx }
    if (stop.pass) {
      via = [via, stop.note].filter(Boolean).join(' ') || undefined
      return
    }
    rows.push({ name: stop.label, place: stop.place, note: [via, stop.note].filter(Boolean).join(' ') || undefined, approx: stop.approx, km, days, guess, dashed })
    km = days = 0
    guess = dashed = false
    via = undefined
  })
  return rows
})

watch(() => props.n, (n) => fitSession(n), { immediate: true })

// a new session starts at the top of the panel, not where the last one was scrolled to
const root = ref<HTMLElement | null>(null)
watch(() => props.n, () => nextTick(() => {
  for (let el = root.value?.parentElement; el; el = el.parentElement) if (el.scrollTop) el.scrollTop = 0
}))

function openPlace(id: string) {
  selectPlace(id)
  flyToPlace(id)
}
/** Place names in the notes are links (sessions.ts). */
function click(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a[data-place]')
  if (!a) return
  e.preventDefault()
  openPlace(a.getAttribute('data-place')!)
}
</script>

<template>
  <div v-if="s" ref="root">
    <Hero :category="SESSION_INFO" />
    <div class="px-6 pt-4 pb-4">
      <button class="-ml-2 mb-1 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-primary hover:bg-black/5" @click="store.selection = null; store.panel = 'sessions'">
        <ArrowLeft class="size-4" />All sessions
      </button>
      <p class="text-sm text-muted-foreground">Session {{ s.n }}</p>
      <h1 class="text-[22px] leading-7">{{ s.title }}</h1>
      <p v-if="s.summary" class="mt-1 text-sm text-muted-foreground">{{ s.summary }}</p>
      <p v-if="s.date" class="mt-2 flex items-center gap-2 text-sm"><CalendarDays class="size-4 text-primary" />{{ s.date }}</p>
      <p v-if="s.when" class="mt-1 flex items-center gap-2 text-sm"><Hourglass class="size-4 text-primary" />{{ s.when }}</p>
      <nav v-if="prev || next" class="-mx-2 mt-2 flex justify-between gap-2 text-sm">
        <button v-if="prev" class="flex min-w-0 items-center gap-1 rounded-full px-2 py-1.5 text-primary hover:bg-black/5" @click="selectSession(prev.n)">
          <ChevronLeft class="size-4 shrink-0" /><span class="truncate">Session {{ prev.n }}</span>
        </button>
        <span v-else />
        <button v-if="next" class="flex min-w-0 items-center gap-1 rounded-full px-2 py-1.5 text-primary hover:bg-black/5" @click="selectSession(next.n)">
          <span class="truncate">Session {{ next.n }}</span><ChevronRight class="size-4 shrink-0" />
        </button>
      </nav>
    </div>

    <template v-if="s.party.length">
      <Separator />
      <section class="px-6 py-4">
        <h2 class="mb-3 text-base font-medium">Who was there <span class="font-normal text-muted-foreground">({{ s.party.length }})</span></h2>
        <ul class="grid grid-cols-2 gap-x-4 gap-y-3">
          <li v-for="m in s.party" :key="m.id">
            <button class="flex w-full min-w-0 items-center gap-3 rounded-lg text-left hover:bg-black/[.03]" @click="selectMember(m.id)">
              <Avatar :member="m" :size="32" />
              <span class="min-w-0 truncate text-sm">{{ m.name }}</span>
            </button>
          </li>
        </ul>
      </section>
    </template>

    <template v-if="route.length">
      <Separator />
      <section class="px-6 py-4">
        <h2 class="mb-3 text-base font-medium">Where we went</h2>
        <ol>
          <li v-for="(r, i) in route" :key="i" class="relative flex gap-4 pb-4 last:pb-0">
            <!-- the line down to the next stop -->
            <span v-if="i < route.length - 1" class="absolute top-4 bottom-0 left-1.5 border-l-2" :class="route[i + 1].dashed ? 'border-dashed' : ''" style="border-color: #b39ddb" />
            <span class="relative mt-1 size-3.5 shrink-0 rounded-full border-2 bg-white" style="border-color: #5e35b1" />
            <div class="min-w-0 flex-1">
              <p v-if="i > 0" class="mb-1 text-xs text-muted-foreground">
                {{ r.guess ? 'About ' : '' }}{{ formatKm(r.km) }} · {{ formatTravel(r.days) }} on foot
              </p>
              <button v-if="r.place" class="text-left text-sm font-medium hover:underline" @click="openPlace(r.place)">{{ r.name }}</button>
              <p v-else class="text-sm font-medium">{{ r.name }}<span v-if="r.approx" class="font-normal text-muted-foreground"> (rough location)</span></p>
              <p v-if="r.note" class="text-sm text-muted-foreground">{{ r.note }}</p>
            </div>
          </li>
        </ol>
      </section>
    </template>

    <Separator />
    <!-- eslint-disable-next-line vue/no-v-html: our own notes, rendered with raw HTML switched off -->
    <article class="session-notes px-6 py-4 text-sm leading-6" @click="click" v-html="html" />

    <Separator />
    <nav class="flex justify-between gap-2 px-4 py-3 text-sm">
      <button v-if="prev" class="flex min-w-0 items-center gap-1 rounded-full px-2 py-1.5 text-primary hover:bg-black/5" @click="selectSession(prev.n)">
        <ChevronLeft class="size-4 shrink-0" /><span class="truncate">Session {{ prev.n }}</span>
      </button>
      <span v-else />
      <button v-if="next" class="flex min-w-0 items-center gap-1 rounded-full px-2 py-1.5 text-primary hover:bg-black/5" @click="selectSession(next.n)">
        <span class="truncate">Session {{ next.n }}</span><ChevronRight class="size-4 shrink-0" />
      </button>
    </nav>
  </div>
</template>

<style scoped>
.session-notes :deep(h2) { margin: 1.25rem 0 0.5rem; font-size: 1rem; font-weight: 500; }
.session-notes :deep(h2:first-child) { margin-top: 0; }
.session-notes :deep(h3) { margin: 1rem 0 0.25rem; font-weight: 500; }
.session-notes :deep(p) { margin: 0.5rem 0; }
.session-notes :deep(ul) { list-style: disc; padding-left: 1.25rem; color: var(--muted-foreground); }
.session-notes :deep(ul ul) { list-style: circle; margin-top: 0.125rem; }
.session-notes :deep(li) { margin: 0.25rem 0; }
.session-notes :deep(strong) { font-weight: 600; color: var(--foreground); }
.session-notes :deep(a) { color: var(--primary); }
.session-notes :deep(a:hover) { text-decoration: underline; }
.session-notes :deep(table) { margin: 0.5rem 0; border-collapse: collapse; }
.session-notes :deep(th), .session-notes :deep(td) { border-bottom: 1px solid var(--border); padding: 0.25rem 1rem 0.25rem 0; text-align: left; }
.session-notes :deep(th) { font-weight: 500; }
</style>
