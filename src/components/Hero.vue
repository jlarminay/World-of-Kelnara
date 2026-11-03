<script setup lang="ts">
// Placeholder header image: a tinted band with the category icon. Swap for real art later.
import type { Category } from '@/world/categories'
import LucideIcon from './LucideIcon.vue'
import { store } from '@/state/store'

defineProps<{ category: Category }>()
</script>

<template>
  <!-- the top 60px sits under the search box (top-3 + h-12); centre the icon in the rest -->
  <div class="relative grid place-items-center overflow-hidden" :class="store.mobile ? 'h-28' : '-mt-[72px] h-[200px] pt-[60px]'" :style="{ background: `linear-gradient(135deg, ${category.color}22, ${category.color}55)` }">
    <span class="text-white/90 drop-shadow" :style="{ color: category.color }">
      <LucideIcon :icon="category.icon" :size="72" :stroke-width="1.25" />
    </span>
  </div>
</template>
