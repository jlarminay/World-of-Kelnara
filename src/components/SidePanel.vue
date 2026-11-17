<script setup lang="ts">
// Desktop: a panel on the left, under the search box. Phones: a bottom sheet (like Google Maps on mobile) that
// rests at one of three heights: lowered (a strip with the page's header, to look at the map), about half the
// screen, or full. Drag it by its handle, or by its content (down when scrolled to the top, up until it is full).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { appHeightPx, clearSelection, closeDirections, SHEET_MIN_PX, sheetPx, store, type Sheet } from '@/state/store'
import ResultsList from './ResultsList.vue'
import PlaceDetails from './PlaceDetails.vue'
import FeatureDetails from './FeatureDetails.vue'
import DirectionsPanel from './DirectionsPanel.vue'
import SideMenu from './SideMenu.vue'
import SessionList from './SessionList.vue'
import SessionDetails from './SessionDetails.vue'
import PartyList from './PartyList.vue'
import CharacterDetails from './CharacterDetails.vue'
import LoreList from './LoreList.vue'
import LoreDetails from './LoreDetails.vue'

// re-read on resize (rotation, the on-screen keyboard), so the heights follow the screen
const vh = ref(appHeightPx())
const onResize = () => (vh.value = appHeightPx())
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const SHEETS: Sheet[] = ['min', 'peek', 'full']
const heightOf = (s: Sheet) => (vh.value, sheetPx(s))
const dragPx = ref<number | null>(null)
const heightPx = computed(() => dragPx.value ?? heightOf(store.sheet))

// every newly opened page starts scrolled to the top (the sheet's height is set in store.ts)
const sheetBody = ref<HTMLElement | null>(null)
const desktopAside = ref<HTMLElement | null>(null)
watch(() => [store.panel, store.selection], async () => {
  await nextTick()
  if (sheetBody.value) sheetBody.value.scrollTop = 0
  const viewport = desktopAside.value?.querySelector<HTMLElement>('[data-reka-scroll-area-viewport]')
  if (viewport) viewport.scrollTop = 0
})

// below full height the content doesn't scroll (dragging it moves the sheet), so show it from the top
watch(() => store.sheet, (s) => { if (s !== 'full' && sheetBody.value) sheetBody.value.scrollTop = 0 })

/** Where a drag ends: closed when pulled well below the lowest height, else the nearest of the three. */
function settle(h: number) {
  if (h < SHEET_MIN_PX * 0.6) return close()
  store.sheet = SHEETS.reduce((a, b) => (Math.abs(heightOf(b) - h) < Math.abs(heightOf(a) - h) ? b : a))
}
const clampH = (h: number) => Math.max(40, Math.min(heightOf('full'), h))

// ---- dragging by the handle (a tap on it steps the height up, or down from full) ----
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
  if (moved) dragPx.value = clampH(startH - dy)
}
function up() {
  const h = dragPx.value
  dragPx.value = null
  if (!moved) return void (store.sheet = store.sheet === 'min' ? 'peek' : store.sheet === 'peek' ? 'full' : 'peek')
  if (h !== null) settle(h)
}

// ---- dragging by the content: down when it is scrolled to the top, up while the sheet is not full ----
let touchY = 0
let touchH = 0
let mode: 'sheet' | 'scroll' | null = null
function touchStart(e: TouchEvent) {
  mode = e.touches.length === 1 ? null : 'scroll'
  touchY = e.touches[0].clientY
  touchH = heightPx.value
}
function touchMove(e: TouchEvent) {
  if (mode === 'scroll') return
  const dy = e.touches[0].clientY - touchY
  if (mode === null) {
    if (Math.abs(dy) < 6) return
    const atTop = (sheetBody.value?.scrollTop ?? 0) <= 0
    mode = (dy > 0 && atTop) || (dy < 0 && store.sheet !== 'full') ? 'sheet' : 'scroll'
    if (mode === 'scroll') return
    touchY = e.touches[0].clientY // start from here, so the sheet doesn't jump by the dead zone
  }
  e.preventDefault()
  dragPx.value = clampH(touchH - (e.touches[0].clientY - touchY))
}
function touchEnd() {
  if (mode !== 'sheet') return void (mode = null)
  mode = null
  const h = dragPx.value
  dragPx.value = null
  if (h !== null) settle(h)
}
onMounted(() => window.addEventListener('touchmove', guardMove, { passive: false }))
onBeforeUnmount(() => window.removeEventListener('touchmove', guardMove))
/** Vue can't add a non-passive touchmove listener in the template; this one forwards the sheet body's moves. */
function guardMove(e: TouchEvent) {
  if (sheetBody.value?.contains(e.target as Node)) touchMove(e)
}

function close() {
  if (store.panel === 'directions') closeDirections() // otherwise the route would stay drawn with no way to clear it
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
      <div
        ref="sheetBody" class="min-h-0 flex-1 overscroll-contain"
        :class="store.sheet === 'full' && dragPx === null ? 'overflow-y-auto' : 'overflow-hidden'"
        @touchstart.passive="touchStart" @touchend="touchEnd" @touchcancel="touchEnd"
      >
        <DirectionsPanel v-if="store.panel === 'directions'" />
        <SideMenu v-else-if="store.panel === 'menu'" />
        <SessionList v-else-if="store.panel === 'sessions'" />
        <PartyList v-else-if="store.panel === 'party'" />
        <LoreList v-else-if="store.panel === 'glossary' || store.panel === 'people'" :kind="store.panel" />
        <template v-else-if="store.panel === 'details' && store.selection">
          <PlaceDetails v-if="store.selection.type === 'place'" :id="store.selection.id" />
          <SessionDetails v-else-if="store.selection.type === 'session'" :n="store.selection.n" />
          <CharacterDetails v-else-if="store.selection.type === 'member'" :id="store.selection.id" />
          <LoreDetails v-else-if="store.selection.type === 'lore'" :id="store.selection.id" />
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
    <aside v-if="!store.mobile && store.panel !== 'none'" ref="desktopAside" class="absolute inset-y-0 left-0 z-10 w-[440px] bg-white shadow-[0_0_20px_rgba(0,0,0,.2)]">
      <ScrollArea class="h-full">
        <div :class="store.panel === 'directions' ? '' : 'pt-[72px]'">
          <DirectionsPanel v-if="store.panel === 'directions'" />
          <SideMenu v-else-if="store.panel === 'menu'" />
          <SessionList v-else-if="store.panel === 'sessions'" />
        <PartyList v-else-if="store.panel === 'party'" />
        <LoreList v-else-if="store.panel === 'glossary' || store.panel === 'people'" :kind="store.panel" />
          <template v-else-if="store.panel === 'details' && store.selection">
            <PlaceDetails v-if="store.selection.type === 'place'" :id="store.selection.id" />
            <SessionDetails v-else-if="store.selection.type === 'session'" :n="store.selection.n" />
          <CharacterDetails v-else-if="store.selection.type === 'member'" :id="store.selection.id" />
          <LoreDetails v-else-if="store.selection.type === 'lore'" :id="store.selection.id" />
            <FeatureDetails v-else :layer="store.selection.layer" :id="store.selection.id" />
          </template>
          <ResultsList v-else />
        </div>
      </ScrollArea>
    </aside>
  </Transition>
</template>
