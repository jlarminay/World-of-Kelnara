<script setup lang="ts">
import { ScrollArea } from '@/components/ui/scroll-area'
import { store } from '@/state/store'
import ResultsList from './ResultsList.vue'
import PlaceDetails from './PlaceDetails.vue'
import FeatureDetails from './FeatureDetails.vue'
import DirectionsPanel from './DirectionsPanel.vue'
</script>

<template>
  <Transition
    enter-from-class="-translate-x-full" leave-to-class="-translate-x-full"
    enter-active-class="transition-transform duration-200" leave-active-class="transition-transform duration-200"
  >
    <aside v-if="store.panel !== 'none'" class="absolute inset-y-0 left-0 z-10 w-[408px] bg-white shadow-[0_0_20px_rgba(0,0,0,.2)]">
      <ScrollArea class="h-full">
        <div :class="store.panel === 'directions' ? '' : 'pt-[72px]'">
          <DirectionsPanel v-if="store.panel === 'directions'" />
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
