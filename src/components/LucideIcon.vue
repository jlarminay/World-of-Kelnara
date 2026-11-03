<script setup lang="ts">
// Renders a vanilla `lucide` icon node, so map pins and UI share one icon registry.
import type { IconNode } from 'lucide'

withDefaults(defineProps<{ icon: IconNode; size?: number; strokeWidth?: number }>(), { size: 18, strokeWidth: 2 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round">
    <component :is="tag" v-for="([tag, attrs], i) in icon" :key="i" v-bind="attrs" />
  </svg>
</template>
