<script setup lang="ts">
// Desktop: a panel on the left, under the search box. Phones: a bottom sheet (like Google Maps on mobile)
// that peeks at about half the screen; drag its handle up to expand, down to shrink or close.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { appHeightPx, clearSelection, sheetPeekPx, store } from '@/state/store'
import ResultsList from './ResultsList.vue'
import PlaceDetails from './PlaceDetails.vue'
import FeatureDetails from './FeatureDetails.vue'
import DirectionsPanel from './DirectionsPanel.vue'
import SideMenu from './SideMenu.vue'

const vh = ref(appHeightPx())
const onResize = () => (vh.value = appHeightPx())
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const fullPx = computed(() => vh.value - 72) // leaves the search box visible above the sheet
const dragPx = ref<number | null>(null)
const heightPx = computed(() => dragPx.value ?? (store.sheet === 'full' ? fullPx.value : sheetPeekPx()))

// every newly opened panel starts at the peek height
watch(() => [store.panel, store.selection], () => (store.sheet = 'peek'))

let startY = 0
let startH = 0
let moved = false
function down(e: PointerEvent) {
  startY = e.clientY
  startH = heightPx.value
  moved = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return
  const dy = e.clientY - startY
  if (Math.abs(dy) > 4) moved = true
  if (moved) dragPx.value = Math.max(60, Math.min(fullPx.value, startH - dy))
}
function up() {
  const h = dragPx.value
  dragPx.value = null
  if (!moved) {
    store.sheet = store.sheet === 'full' ? 'peek' : 'full' // a tap on the handle toggles
    return
  }
  if (h === null) return
  if (h < sheetPeekPx() * 0.55) return close()
  store.sheet = h > (sheetPeekPx() + fullPx.value) / 2 ? 'full' : 'peek'
}
function close() {
  store.sheet = 'peek'
  clearSelection()
  store.panel = 'none'
}
</script>

<template>
  <!-- phones: bottom sheet -->
  <Transition
    enter-from-class="translate-y-full" leave-to-class="translate-y-full"
    enter-active-class="transition-transform duration-200" leave-active-class="transition-transform duration-200"
  >
    <aside
      v-if="store.mobile && store.panel !== 'none'"
      class="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-white shadow-[0_-2px_16px_rgba(0,0,0,.2)]"
      :class="dragPx === null ? 'transition-[height] duration-200' : ''"
      :style="{ height: heightPx + 'px' }"
    >
      <div
        class="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center"
        title="Drag to resize"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"
      >
        <span class="h-1 w-9 rounded-full bg-black/20" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <DirectionsPanel v-if="store.panel === 'directions'" />
        <SideMenu v-else-if="store.panel === 'menu'" />
        <template v-else-if="store.panel === 'details' && store.selection">
          <PlaceDetails v-if="store.selection.type === 'place'" :id="store.selection.id" />
          <FeatureDetails v-else :layer="store.selection.layer" :id="store.selection.id" />
        </template>
        <ResultsList v-else />
      </div>
    </aside>
  </Transition>

  <!-- desktop: left panel -->
  <Transition
    enter-from-class="-translate-x-full" leave-to-class="-translate-x-full"
    enter-active-class="transition-transform duration-200" leave-active-class="transition-transform duration-200"
  >
    <aside v-if="!store.mobile && store.panel !== 'none'" class="absolute inset-y-0 left-0 z-10 w-[408px] bg-white shadow-[0_0_20px_rgba(0,0,0,.2)]">
      <ScrollArea class="h-full">
        <div :class="store.panel === 'directions' ? '' : 'pt-[72px]'">
          <DirectionsPanel v-if="store.panel === 'directions'" />
          <SideMenu v-else-if="store.panel === 'menu'" />
          <template v-else-if="store.panel === 'details' && store.selection">
            <PlaceDetails v-if="store.selection.type === 'place'" :id="store.selection.id" />
            <FeatureDetails v-else :layer="store.selection.layer" :id="store.selection.id" />
          </template>
          <ResultsList v-else />
        </div>
      </ScrollArea>
    </aside>
  </Transition>
</template>
