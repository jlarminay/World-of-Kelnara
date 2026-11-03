<script setup lang="ts">
import MapView from '@/components/MapView.vue'
import SearchBox from '@/components/SearchBox.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import MeasureCard from '@/components/MeasureCard.vue'
import SidePanel from '@/components/SidePanel.vue'
import MapControls from '@/components/MapControls.vue'
import { store } from '@/state/store'
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
  </div>
</template>
