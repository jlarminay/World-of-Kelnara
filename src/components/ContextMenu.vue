<script setup lang="ts">
// Right-click menu on the map (Google-style): directions from/to here, measure from here, copy the point, clear a measurement.
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { Ruler, Copy, X, CircleDot, MapPin } from 'lucide-vue-next'
import { openDirections, store } from '@/state/store'
import { pointWaypoint } from '@/routing'
import { FEATURES } from '@/features'
import { startMeasure, stopMeasure } from '@/map/measure'

const close = () => (store.contextMenu = null)
// keep the menu inside the screen (phones, or right-clicks near an edge)
const pos = computed(() => ({
  left: Math.max(8, Math.min(store.contextMenu!.x, window.innerWidth - 240)) + 'px',
  top: Math.max(8, Math.min(store.contextMenu!.y, window.innerHeight - 260)) + 'px',
}))
function copy() {
  const [lng, lat] = store.contextMenu!.lngLat
  navigator.clipboard?.writeText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  close()
}
function measure() {
  if (store.measure.active) store.measure.points.push(store.contextMenu!.lngLat)
  else startMeasure(store.contextMenu!.lngLat)
  close()
}
function clear() {
  stopMeasure()
  close()
}
const directions = (end: 'from' | 'to') => openDirections(end, pointWaypoint(store.contextMenu!.lngLat))
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    v-if="store.contextMenu"
    class="absolute z-40 min-w-56 overflow-hidden rounded-lg bg-white py-1.5 text-sm shadow-gm"
    :style="pos"
    @contextmenu.prevent
  >
    <p class="px-4 pt-1 pb-2 text-xs text-muted-foreground tabular-nums">
      {{ store.contextMenu.lngLat[1].toFixed(5) }}, {{ store.contextMenu.lngLat[0].toFixed(5) }}
    </p>
    <template v-if="FEATURES.directions">
      <button class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-black/5" @click="directions('from')">
        <CircleDot class="size-4 text-muted-foreground" />Directions from here
      </button>
      <button class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-black/5" @click="directions('to')">
        <MapPin class="size-4 text-muted-foreground" />Directions to here
      </button>
      <div class="my-1 border-t" />
    </template>
    <button class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-black/5" @click="measure">
      <Ruler class="size-4 text-muted-foreground" />{{ store.measure.active ? 'Add point to measurement' : 'Measure distance' }}
    </button>
    <button class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-black/5" @click="copy">
      <Copy class="size-4 text-muted-foreground" />Copy coordinates
    </button>
    <button v-if="store.measure.active" class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-black/5" @click="clear">
      <X class="size-4 text-muted-foreground" />Clear measurement
    </button>
  </div>
</template>
