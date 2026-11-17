<script setup lang="ts">
// Text with the names in it linked to their pages (places, glossary, people, party, map features). See src/world/links.ts.
import { computed } from 'vue'
import { linkText } from '@/world/links'
import { onLinkClick } from './open'

const props = defineProps<{
  text: string
  /** Id of the page this text is on, so it doesn't link to itself (features: "layer:id"). */
  skip?: string
}>()
const html = computed(() => linkText(props.text, props.skip))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html: our own data, escaped in linkText -->
  <span class="linked-text" @click="onLinkClick" v-html="html" />
</template>

<style scoped>
.linked-text :deep(a) { color: var(--primary); }
.linked-text :deep(a:hover) { text-decoration: underline; }
</style>
