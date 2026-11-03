<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Minus, Layers } from 'lucide-vue-next'
import { mapRef, store } from '@/state/store'
import { kmPerPixel, zoomToLevel } from '@/world/coords'
import { world } from '@/world/data'

const foot = world.travel.on_foot_km_per_day

// Google-style scale bar: pick a round distance that is at most ~80 px wide.
const scale = computed(() => {
  const kmPx = kmPerPixel(store.zoom)
  const max = kmPx * 80
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]
  const km = [...steps].reverse().find((s) => s <= max) ?? steps[0]
  return { label: km < 1 ? `${km * 1000} m` : `${km} km`, px: km / kmPx }
})
const zoomBy = (d: number) => mapRef.value?.easeTo({ zoom: mapRef.value.getZoom() + d, duration: 250 })
const toggle = () => (store.baseLayer = store.baseLayer === 'map' ? 'original' : 'map')
</script>

<template>
  <!-- layer switcher, bottom left (moves right of the side panel) -->
  <button
    class="absolute bottom-6 z-10 flex size-[74px] flex-col items-center justify-end overflow-hidden rounded-lg border-2 border-white bg-cover pb-1 text-xs font-medium text-white shadow-gm transition-[left]"
    :class="store.panel === 'none' ? 'left-6' : 'left-[432px]'"
    :style="{ background: store.baseLayer === 'map' ? 'linear-gradient(160deg,#f3f2ee 30%,#cbe6c3 55%,#aadaff 75%)' : 'linear-gradient(160deg,#fff 40%,#2b4a9b 60%,#fff 70%)' }"
    @click="toggle"
  >
    <span class="flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5"><Layers class="size-3.5" />{{ store.baseLayer === 'map' ? 'Drawing' : 'Map' }}</span>
  </button>

  <!-- zoom, bottom right -->
  <div class="absolute right-3 bottom-9 z-10 flex flex-col overflow-hidden rounded-lg bg-white shadow-gm">
    <button class="grid size-10 place-items-center text-muted-foreground hover:text-foreground" title="Zoom in" @click="zoomBy(1)"><Plus class="size-5" /></button>
    <span class="mx-2 h-px bg-border" />
    <button class="grid size-10 place-items-center text-muted-foreground hover:text-foreground" title="Zoom out" @click="zoomBy(-1)"><Minus class="size-5" /></button>
  </div>

  <!-- footer strip with scale, like Google's -->
  <div class="absolute right-0 bottom-0 z-10 flex items-center gap-3 bg-white/80 px-2 py-0.5 text-[11px] text-[#3c4043]">
    <span>Kelnara of Thera</span>
    <span class="text-muted-foreground" title="Walking speed by ground. Distances from a city start outside its gate.">
      On foot: road {{ foot.road }} · path {{ foot.path }} · open {{ foot.open }} km/day
    </span>
    <span class="text-muted-foreground">z{{ store.zoom.toFixed(1) }} · level {{ zoomToLevel(store.zoom) }}</span>
    <span class="flex items-center gap-1.5">
      {{ scale.label }}
      <span class="h-1.5 border-x border-b border-[#3c4043]" :style="{ width: scale.px + 'px' }" />
    </span>
  </div>
</template>
