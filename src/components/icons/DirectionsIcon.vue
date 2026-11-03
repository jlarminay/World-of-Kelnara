<!-- Google-style directions sign: a rounded diamond (currentColor) with a right-turn arrow cut into it (`arrow` colour). -->
<script setup lang="ts">
defineProps<{ arrow?: string }>()
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10.6 2.6a2 2 0 0 1 2.8 0l8 8a2 2 0 0 1 0 2.8l-8 8a2 2 0 0 1-2.8 0l-8-8a2 2 0 0 1 0-2.8z" fill="currentColor" />
    <path d="M8.5 15v-3a1.5 1.5 0 0 1 1.5-1.5h5.5M13 8l2.5 2.5L13 13" fill="none" :style="{ stroke: arrow ?? '#fff' }" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
