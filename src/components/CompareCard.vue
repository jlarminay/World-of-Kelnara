<script setup lang="ts">
// Bottom card for the real-world size comparison: each pill shows or hides an outline on the map, with its size below.
// Moving and turning happen on the map itself (src/map/compare.ts).
import { X } from 'lucide-vue-next'
import { store } from '@/state/store'
import { KELNARA_KM2, OUTLINES, closeCompare, outlineById, toggleOutline } from '@/map/compare'
import { formatKm } from '@/world/coords'

const on = (id: string) => store.compare.items.some((it) => it.id === id)
const fraction = (km2: number) => {
  const r = KELNARA_KM2 / km2
  return r >= 1.5 ? `about 1/${Math.round(r).toLocaleString()} of Kelnara` : `${Math.round((km2 / KELNARA_KM2) * 100)}% of Kelnara`
}
</script>

<template>
  <div
    v-if="store.compare.open"
    class="absolute left-1/2 z-30 w-[360px] max-sm:w-[calc(100vw-24px)] -translate-x-1/2 rounded-xl bg-white p-4 shadow-gm transition-[margin,bottom]"
    :class="[
      store.panel !== 'none' && !store.mobile ? 'ml-[204px]' : '',
      store.measure.active ? 'bottom-[200px]' : 'bottom-8 max-sm:bottom-6',
    ]"
  >
    <div class="flex items-start justify-between">
      <div>
        <h3 class="text-sm font-medium">Real-world size</h3>
        <p class="mt-1 text-sm text-muted-foreground">Drag a place to move it. Click it, then drag the rotate handle to turn it.</p>
      </div>
      <button class="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-black/5" title="Close" @click="closeCompare">
        <X class="size-4" />
      </button>
    </div>
    <div class="mt-3 flex flex-wrap gap-1">
      <button
        v-for="o in OUTLINES" :key="o.id"
        class="rounded-full border px-3 py-1 text-xs"
        :class="on(o.id) ? 'border-accent bg-accent text-accent-foreground' : 'hover:bg-black/5'"
        @click="toggleOutline(o.id)"
      >
        {{ o.name }}
      </button>
    </div>
    <div v-for="it in store.compare.items" :key="it.id" class="mt-3 border-t pt-3">
      <p class="text-sm font-medium">{{ outlineById.get(it.id)!.name }}</p>
      <p class="mt-0.5 text-xs text-muted-foreground">
        {{ outlineById.get(it.id)!.areaKm2.toLocaleString() }} km² · {{ formatKm(outlineById.get(it.id)!.spanKm) }} end to end ·
        {{ fraction(outlineById.get(it.id)!.areaKm2) }}
      </p>
    </div>
    <p class="mt-3 text-[10px] text-muted-foreground">Outlines: Natural Earth, © OpenStreetMap contributors</p>
  </div>
</template>
