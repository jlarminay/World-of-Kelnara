<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import MapView from '@/components/MapView.vue'
import SearchBox from '@/components/SearchBox.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import MeasureCard from '@/components/MeasureCard.vue'
import SidePanel from '@/components/SidePanel.vue'
import MapControls from '@/components/MapControls.vue'
import { store } from '@/state/store'

// The editor only exists in `npm run dev`; `import.meta.env.DEV` is false in builds so it is dropped entirely.
const EditorPanel = import.meta.env.DEV ? defineAsyncComponent(() => import('@/editor/EditorPanel.vue')) : null
</script>

<template>
  <div class="relative h-full w-full">
    <MapView class="absolute inset-0" />
    <SidePanel />
    <div class="pointer-events-none absolute top-3 left-3 z-20 flex items-start gap-2">
      <SearchBox v-if="store.panel !== 'directions'" class="pointer-events-auto" />
    </div>
    <MapControls />
    <MeasureCard />
    <ContextMenu />
    <component :is="EditorPanel" v-if="EditorPanel" />
  </div>
</template>
