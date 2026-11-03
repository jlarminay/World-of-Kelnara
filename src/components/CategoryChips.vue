<script setup lang="ts">
import { CHIPS } from '@/search'
import { store } from '@/state/store'

function choose(label: string) {
  store.query = label
  store.panel = 'results'
}
</script>

<template>
  <div class="flex gap-2 pt-1.5">
    <button
      v-for="c in CHIPS" :key="c.label"
      class="h-9 rounded-full bg-white px-4 text-sm font-medium text-foreground shadow-gm hover:bg-[#f1f3f4]"
      @click="choose(c.label)"
    >
      {{ c.label }}
    </button>
  </div>
</template>
