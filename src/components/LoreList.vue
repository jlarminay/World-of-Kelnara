<script setup lang="ts">
// Menu → Glossary / People: every entry, under its category heading, with the start of its text.
import { computed } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { LORE_INFO, LORE_TITLE, loreGroups, type LoreKind } from '@/world/lore'
import { selectLore, store } from '@/state/store'
import LucideIcon from './LucideIcon.vue'

const props = defineProps<{ kind: LoreKind }>()
const groups = computed(() => loreGroups(props.kind))
const info = computed(() => LORE_INFO[props.kind])
</script>

<template>
  <div>
    <div class="flex items-center gap-2 px-3 pb-2">
      <button class="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Back to menu" @click="store.panel = 'menu'"><ArrowLeft class="size-5" /></button>
      <h2 class="text-xl">{{ LORE_TITLE[kind] }}</h2>
    </div>
    <section v-for="g in groups" :key="g.category" class="pb-2">
      <h3 class="px-6 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ g.category }}</h3>
      <button
        v-for="e in g.entries" :key="e.id"
        class="flex w-full items-start gap-4 px-6 py-2.5 text-left hover:bg-black/[.03]"
        @click="selectLore(e.id)"
      >
        <span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted" :style="{ color: info.color }">
          <LucideIcon :icon="info.icon" :size="16" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">{{ e.name }}</span>
          <span class="line-clamp-2 block text-xs leading-5 text-muted-foreground">{{ e.text }}</span>
        </span>
      </button>
    </section>
  </div>
</template>
