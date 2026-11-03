<script setup lang="ts">
// Right-click menu on the map (Google-style): measure from here, copy the point, clear a measurement.
import { onBeforeUnmount, onMounted } from 'vue'
import { Ruler, Copy, X } from 'lucide-vue-next'
import { store } from '@/state/store'
import { startMeasure, stopMeasure } from '@/map/measure'

const close = () => (store.contextMenu = null)
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
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    v-if="store.contextMenu"
    class="absolute z-40 min-w-56 overflow-hidden rounded-lg bg-white py-1.5 text-sm shadow-gm"
    :style="{ left: store.contextMenu.x + 'px', top: store.contextMenu.y + 'px' }"
    @contextmenu.prevent
  >
    <p class="px-4 pt-1 pb-2 text-xs text-muted-foreground tabular-nums">
      {{ store.contextMenu.lngLat[1].toFixed(5) }}, {{ store.contextMenu.lngLat[0].toFixed(5) }}
    </p>
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
