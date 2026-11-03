<script setup lang="ts">
import { computed } from 'vue'
import { CHIPS, entries, search } from '@/search'
import { store } from '@/state/store'
import { openEntry } from './open'
import LucideIcon from './LucideIcon.vue'

const results = computed(() => {
  const chip = CHIPS.find((c) => c.label === store.query)
  return chip ? entries.value.filter(chip.match).sort((a, b) => a.name.localeCompare(b.name)) : search(store.query)
})
</script>

<template>
  <div>
    <h2 class="px-6 pb-2 text-xl">Results</h2>
    <p v-if="!results.length" class="px-6 py-4 text-sm text-muted-foreground">
      No places match “{{ store.query }}”.
    </p>
    <button
      v-for="r in results" :key="r.key"
      class="flex w-full items-start gap-4 border-b px-6 py-4 text-left hover:bg-black/[.03]"
      @click="openEntry(r)"
    >
      <span class="min-w-0 flex-1">
        <span class="block text-base font-medium">{{ r.name }}</span>
        <span class="block text-sm text-muted-foreground">{{ r.subtitle }}</span>
      </span>
      <span class="grid size-10 shrink-0 place-items-center rounded-full bg-muted" :style="{ color: r.category.color }">
        <LucideIcon :icon="r.category.icon" :size="20" />
      </span>
    </button>
  </div>
</template>
