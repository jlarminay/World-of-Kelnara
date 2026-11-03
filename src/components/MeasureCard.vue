<script setup lang="ts">
// Bottom card while measuring: total distance and estimated travel time on foot.
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import { store, type Ground } from '@/state/store'
import { pathKm, stopMeasure } from '@/map/measure'
import { formatKm } from '@/world/coords'
import { world } from '@/world/data'

const speeds = world.travel.on_foot_km_per_day as Record<Ground, number>
const grounds: { id: Ground; label: string }[] = [
  { id: 'road', label: 'Road' },
  { id: 'path', label: 'Path' },
  { id: 'open', label: 'Open country' },
]
const km = computed(() => pathKm(store.measure.points))
const days = computed(() => km.value / speeds[store.measure.ground])
const duration = computed(() => {
  const d = days.value
  if (d < 0.1) return 'under an hour or two'
  if (d < 1) return `about ${Math.round(d * 10) / 10} of a day`
  return `about ${d < 10 ? d.toFixed(1) : Math.round(d)} days`
})
</script>

<template>
  <div
    v-if="store.measure.active"
    class="absolute bottom-8 left-1/2 z-30 w-[360px] -translate-x-1/2 rounded-xl bg-white p-4 shadow-gm transition-[margin]"
    :class="store.panel !== 'none' ? 'ml-[204px]' : ''"
  >
    <div class="flex items-start justify-between">
      <div>
        <h3 class="text-sm font-medium">Measure distance</h3>
        <p v-if="store.measure.points.length < 2" class="mt-1 text-sm text-muted-foreground">Click on the map to add to your path</p>
        <p v-else class="mt-1 text-sm">
          Total distance: <span class="font-medium">{{ formatKm(km) }}</span>
        </p>
      </div>
      <button class="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-black/5" title="Close" @click="stopMeasure">
        <X class="size-4" />
      </button>
    </div>
    <template v-if="store.measure.points.length > 1">
      <div class="mt-3 flex gap-1">
        <button
          v-for="g in grounds" :key="g.id"
          class="rounded-full border px-3 py-1 text-xs"
          :class="store.measure.ground === g.id ? 'border-accent bg-accent text-accent-foreground' : 'hover:bg-black/5'"
          @click="store.measure.ground = g.id"
        >
          {{ g.label }}
        </button>
      </div>
      <p class="mt-2 text-sm">
        On foot: <span class="font-medium text-[#188038]">{{ duration }}</span>
        <span class="text-muted-foreground"> at {{ speeds[store.measure.ground] }} km/day</span>
      </p>
      <p class="mt-1 text-xs text-muted-foreground">Drag a point to move it, click a point to remove it.</p>
    </template>
  </div>
</template>
