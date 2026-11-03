<script setup lang="ts">
import { computed, watch } from 'vue'
import { ArrowLeft, ArrowUpDown, Footprints, CircleDot, MapPin, Ruler, X } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { store } from '@/state/store'
import { MAX_OFF_ROAD_KM, planJourney, speedOn, waypointCoord, waypointLabel, type Ground, type Mode } from '@/routing'
import { startMeasure } from '@/map/measure'
import { distanceKm, formatKm } from '@/world/coords'
import HorseIcon from './icons/HorseIcon.vue'
import CartIcon from './icons/CartIcon.vue'
import WaypointInput from './WaypointInput.vue'

const d = store.directions
const modes = [
  { id: 'foot', label: 'Walking', icon: Footprints },
  { id: 'horse', label: 'Horse', icon: HorseIcon },
  { id: 'cart', label: 'Cart', icon: CartIcon },
] as const
const modeLabel = computed(() => ({ foot: 'on foot', horse: 'on horseback', cart: 'by cart' })[d.mode])
const GROUNDS: { id: Ground; label: string }[] = [
  { id: 'road', label: 'Roads' },
  { id: 'path', label: 'Trails' },
  { id: 'open', label: 'Off road' },
]
const speed = (g: Ground, m: Mode = d.mode) => Math.round(speedOn(m, g))

function plan() {
  d.error = ''
  if (!d.from || !d.to || d.from === d.to) return void (d.result = null)
  const r = planJourney([d.from, ...d.via, d.to])
  d.result = r
  if (!r) d.error = 'No path was found between these two locations.'
}
watch(() => [d.from, d.to, ...d.via], plan, { immediate: true })

const days = (km: number, g: Ground) => km / speedOn(d.mode, g)
const fmtDays = (n: number) => (n < 1 ? `${Math.max(1, Math.round(n * 24))} hr` : `${n.toFixed(1)} days`)
/** Rows of the "how it's worked out" table: km, speed and time on each kind of ground. */
const rows = computed(() =>
  GROUNDS.map((g) => ({ ...g, km: d.result?.breakdown?.[g.id] ?? 0 }))
    .filter((r) => r.km >= 0.05)
    .map((r) => ({ ...r, speed: speed(r.id), days: days(r.km, r.id) })),
)
const total = computed(() => rows.value.reduce((s, r) => s + r.days, 0))

/** With no road route: the straight line between the two points, as a rough estimate. */
const straight = computed(() => {
  const a = waypointCoord(d.from), b = waypointCoord(d.to)
  return a && b ? { a, b, km: distanceKm(a, b) } : null
})
function measureStraight() {
  const s = straight.value!
  close()
  startMeasure(s.a as [number, number])
  store.measure.points.push(s.b as [number, number])
}

function swap() {
  ;[d.from, d.to] = [d.to, d.from]
  d.via.reverse()
}
function close() {
  d.from = ''
  d.to = ''
  d.via = []
  d.result = null
  d.error = ''
  store.panel = store.selection ? 'details' : 'none'
}
</script>

<template>
  <div>
    <div class="bg-white px-4 pt-3 pb-4 shadow-[0_1px_4px_rgba(0,0,0,.15)]">
      <div class="mb-3 flex items-center gap-2">
        <button class="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Close directions" @click="close"><ArrowLeft class="size-5" /></button>
        <div class="flex flex-1 justify-center gap-1">
          <button
            v-for="m in modes" :key="m.id"
            :title="`${m.label}: ${speed('road', m.id)} km/day on roads, ${speed('path', m.id)} on trails, ${speed('open', m.id)} off road`"
            class="flex w-16 flex-col items-center gap-0.5 rounded-2xl py-1"
            :class="d.mode === m.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-black/5'"
            @click="d.mode = m.id"
          >
            <component :is="m.icon" class="size-5" />
            <span class="text-[11px] leading-none">{{ m.label }}</span>
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex flex-col items-center gap-1 text-muted-foreground">
          <CircleDot class="size-4" />
          <span class="h-5 border-l-2 border-dotted" />
          <MapPin class="size-4 text-[#ea4335]" />
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <WaypointInput v-model="d.from" placeholder="Choose starting point" />
          <div v-for="(v, i) in d.via" :key="i" class="flex h-8 items-center gap-2 rounded-md bg-muted/60 pr-1 pl-3 text-sm">
            <span class="size-2.5 shrink-0 rounded-full border-2 border-[#202124] bg-white" />
            <span class="min-w-0 flex-1 truncate">Stop {{ i + 1 }} · {{ waypointLabel(v).replace('Dropped pin ', '') }}</span>
            <button class="grid size-6 place-items-center rounded-full hover:bg-black/5" title="Remove stop" @click="d.via.splice(i, 1)"><X class="size-4" /></button>
          </div>
          <WaypointInput v-model="d.to" placeholder="Choose destination" />
        </div>
        <button class="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Swap" @click="swap"><ArrowUpDown class="size-5" /></button>
      </div>
    </div>

    <div v-if="d.result" class="px-6 py-5">
      <p class="text-[22px] text-[#188038]">{{ fmtDays(total) }} <span class="text-base text-muted-foreground">({{ formatKm(d.result.km) }})</span></p>
      <p class="mt-1 text-sm text-muted-foreground">By road, {{ modeLabel }}</p>
      <p class="mt-1 text-xs text-muted-foreground">Drag the blue line to take a different road. Drag a stop to move it, click it to remove it.</p>

      <template v-if="d.result.steps?.length">
        <Separator class="my-4" />
        <ol class="space-y-3 text-sm">
          <li v-for="(s, i) in d.result.steps" :key="i" class="flex justify-between gap-4">
            <span>{{ s.text }}</span><span class="shrink-0 text-muted-foreground">{{ formatKm(s.km) }}</span>
          </li>
        </ol>
      </template>

      <Separator class="my-4" />
      <h3 class="mb-2 text-sm font-medium">Travel time {{ modeLabel }}</h3>
      <table class="w-full text-sm tabular-nums">
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="py-0.5">{{ r.label }}</td>
            <td class="py-0.5 text-right text-muted-foreground">{{ formatKm(r.km) }}</td>
            <td class="py-0.5 text-right text-muted-foreground">at {{ r.speed }} km/day</td>
            <td class="py-0.5 text-right">{{ fmtDays(r.days) }}</td>
          </tr>
          <tr v-if="rows.length > 1" class="border-t font-medium">
            <td class="pt-1.5">Total</td>
            <td class="pt-1.5 text-right">{{ formatKm(d.result.km) }}</td>
            <td />
            <td class="pt-1.5 text-right">{{ fmtDays(total) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="mt-3 text-xs leading-5 text-muted-foreground">
        Time on each kind of ground is its distance ÷ the speed there. Walking covers {{ speed('road', 'foot') }} km a day on roads,
        {{ speed('path', 'foot') }} on trails and {{ speed('open', 'foot') }} off road (the map legend's "1 day = 39 km").
        A horse ({{ speed('open', 'horse') }} km/day off road) and a cart ({{ speed('open', 'cart') }}) are faster or slower in the same proportion.
      </p>
    </div>

    <div v-else-if="d.error" class="px-6 py-5 text-sm">
      <p>{{ d.error }}</p>
      <p class="mt-1 text-muted-foreground">One end is more than {{ MAX_OFF_ROAD_KM }} km from the nearest road.</p>
      <template v-if="straight">
        <Separator class="my-4" />
        <p class="text-muted-foreground">
          In a straight line it is {{ formatKm(straight.km) }}, about {{ fmtDays(straight.km / speedOn(d.mode, 'open')) }} {{ modeLabel }} off road.
          That ignores water, mountains and forests, so treat it as a rough guess.
        </p>
        <button class="mt-3 flex items-center gap-2 rounded-full border px-3 py-1.5 text-primary hover:bg-black/5" @click="measureStraight">
          <Ruler class="size-4" />Measure it on the map
        </button>
      </template>
    </div>
    <p v-else class="px-6 py-5 text-sm text-muted-foreground">Choose two places, or right-click the map for directions from or to a point.</p>
  </div>
</template>
