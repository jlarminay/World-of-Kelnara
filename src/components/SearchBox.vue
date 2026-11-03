<script setup lang="ts">
import { computed, ref } from 'vue'
import { Menu, Search, X, Navigation } from 'lucide-vue-next'
import { search, type SearchEntry } from '@/search'
import { store } from '@/state/store'
import { openEntry } from '@/components/open'
import LucideIcon from './LucideIcon.vue'
import { FEATURES } from '@/features'

const focused = ref(false)
const active = ref(0)
const suggestions = computed(() => (focused.value ? search(store.query, 8) : []))

function submit() {
  const s = suggestions.value[active.value]
  if (s && focused.value && suggestions.value.length && store.query) return pick(s)
  if (store.query.trim()) store.panel = 'results'
}
function pick(e: SearchEntry) {
  store.query = e.name
  focused.value = false
  openEntry(e)
}
function clear() {
  store.query = ''
  store.selection = null
  store.panel = 'none'
}
function key(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') active.value = Math.min(active.value + 1, suggestions.value.length - 1)
  else if (e.key === 'ArrowUp') active.value = Math.max(active.value - 1, 0)
  else if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="w-[392px] rounded-[24px] bg-white shadow-gm" :class="suggestions.length ? 'rounded-b-xl' : ''">
    <form class="flex h-12 items-center gap-1 pr-2 pl-3" @submit.prevent="submit">
      <button type="button" class="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-black/5" title="Menu" @click="store.panel = store.panel === 'menu' ? 'none' : 'menu'">
        <Menu class="size-5" />
      </button>
      <input
        v-model="store.query"
        class="h-full flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-muted-foreground"
        placeholder="Search Kelnara"
        @focus="focused = true; active = 0"
        @blur="focused = false"
        @input="active = 0"
        @keydown="key"
      >
      <button type="submit" class="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-black/5" title="Search">
        <Search class="size-5" />
      </button>
      <button
        v-if="store.query || store.panel !== 'none'" type="button"
        class="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-black/5" title="Clear" @click="clear"
      >
        <X class="size-5" />
      </button>
      <template v-else-if="FEATURES.directions">
        <div class="mx-1 h-6 w-px bg-border" />
        <button type="button" class="grid size-9 place-items-center rounded-full text-primary hover:bg-black/5" title="Directions" @click="store.panel = 'directions'">
          <Navigation class="size-5 rotate-45 fill-primary" />
        </button>
      </template>
    </form>
    <ul v-if="suggestions.length" class="border-t py-2">
      <li
        v-for="(s, i) in suggestions" :key="s.key"
        class="flex cursor-pointer items-center gap-3 px-4 py-2" :class="i === active ? 'bg-black/5' : 'hover:bg-black/5'"
        @mousedown.prevent="pick(s)" @mouseenter="active = i"
      >
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted" :style="{ color: s.category.color }">
          <LucideIcon :icon="s.category.icon" :size="16" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm">{{ s.name }}</span>
          <span class="block truncate text-xs text-muted-foreground">{{ s.subtitle }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>
