<script setup lang="ts">
import { computed, watch } from 'vue'
import { ArrowLeft, ArrowUpDown, Footprints, Rabbit, Truck, CircleDot, MapPin } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { placeById, store } from '@/state/store'
import { KM_PER_DAY, routeRoads, routeTerrain } from '@/routing'
import { formatKm } from '@/world/coords'
import { layers } from '@/world/data'

const d = store.directions
const places = computed(() => [...store.places.features].sort((a, b) => a.properties.name.localeCompare(b.properties.name)))
const modes = [
  { id: 'foot', label: 'On foot', icon: Footprints },
  { id: 'horse', label: 'Horse', icon: Rabbit },
  { id: 'cart', label: 'Cart', icon: Truck },
] as const

async function plan() {
  d.error = ''
  const a = placeById.value.get(d.from), b = placeById.value.get(d.to)
  if (!a || !b || a === b) return void (d.result = null)
  const r = d.how === 'roads' ? routeRoads(a.properties.name, b.properties.name) : await routeTerrain(a.geometry.coordinates, b.geometry.coordinates)
  d.result = r
  if (!r) d.error = d.how === 'roads' ? 'No road connects these places. Try cross country.' : 'No route found (different island?).'
}
watch(() => [d.from, d.to, d.how], plan, { immediate: true })

// "Follow roads" only makes sense once roads exist in data/roads.geojson.
const routeOptions = [
  ...(layers.roads.features.length ? [{ id: 'roads', label: 'Follow roads' } as const] : []),
  { id: 'cross', label: 'Cross country' } as const,
]
const swap = () => ([d.from, d.to] = [d.to, d.from])
const days = computed(() => (d.result ? d.result.effKm / KM_PER_DAY[d.mode] : 0))
const duration = computed(() => (days.value < 1 ? `${Math.round(days.value * 24)} hr` : `${days.value.toFixed(1)} days`))
function close() {
  d.result = null
  store.panel = store.selection ? 'details' : 'none'
}
</script>

<template>
  <div>
    <div class="bg-white px-4 pt-3 pb-4 shadow-[0_1px_4px_rgba(0,0,0,.15)]">
      <div class="mb-3 flex items-center gap-2">
        <button class="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Back" @click="close"><ArrowLeft class="size-5" /></button>
        <div class="flex flex-1 justify-center gap-1">
          <button
            v-for="m in modes" :key="m.id" :title="m.label"
            class="grid h-8 w-14 place-items-center rounded-full"
            :class="d.mode === m.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-black/5'"
            @click="d.mode = m.id"
          >
            <component :is="m.icon" class="size-5" />
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
          <select v-model="d.from" class="h-10 rounded-md border px-3 text-sm outline-none focus:border-primary">
            <option value="" disabled>Choose starting point</option>
            <option v-for="p in places" :key="p.properties.id" :value="p.properties.id">{{ p.properties.name }}</option>
          </select>
          <select v-model="d.to" class="h-10 rounded-md border px-3 text-sm outline-none focus:border-primary">
            <option value="" disabled>Choose destination</option>
            <option v-for="p in places" :key="p.properties.id" :value="p.properties.id">{{ p.properties.name }}</option>
          </select>
        </div>
        <button class="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Swap" @click="swap"><ArrowUpDown class="size-5" /></button>
      </div>
      <div class="mt-3 flex gap-2 pl-7 text-sm">
        <button
          v-for="h in routeOptions" :key="h.id"
          class="rounded-full border px-3 py-1"
          :class="d.how === h.id ? 'border-accent bg-accent text-accent-foreground' : 'hover:bg-black/5'"
          @click="d.how = h.id"
        >
          {{ h.label }}
        </button>
      </div>
    </div>

    <div v-if="d.result" class="px-6 py-5">
      <p class="text-[22px] text-[#188038]">{{ duration }} <span class="text-base text-muted-foreground">({{ formatKm(d.result.km) }})</span></p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ KM_PER_DAY[d.mode] }} km per day
        <template v-if="d.result.via?.length"> · via {{ d.result.via.join(', ') }}</template>
      </p>
      <template v-if="d.result.breakdown">
        <Separator class="my-4" />
        <ul class="space-y-1 text-sm">
          <li v-for="[k, v] in Object.entries(d.result.breakdown).filter(([, v]) => v > 1)" :key="k" class="flex justify-between">
            <span class="capitalize">{{ k }}</span><span class="text-muted-foreground">{{ formatKm(v) }}</span>
          </li>
        </ul>
      </template>
    </div>
    <p v-else-if="d.error" class="px-6 py-5 text-sm text-muted-foreground">{{ d.error }}</p>
    <p v-else class="px-6 py-5 text-sm text-muted-foreground">Choose two places to plan a journey.</p>
  </div>
</template>
