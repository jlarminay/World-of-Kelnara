<script setup lang="ts">
// Start/destination field for directions: type to filter places (same fuzzy search as the search box), then pick one.
// Shows the chosen place's name (or "Dropped pin") when not being edited.
import { computed, ref } from 'vue'
import { MapPin } from 'lucide-vue-next'
import { entries, search } from '@/search'
import { waypointLabel } from '@/routing'
import { store } from '@/state/store'
import LucideIcon from './LucideIcon.vue'

const model = defineModel<string>({ required: true })
defineProps<{ placeholder: string }>()

const text = ref('')
const editing = ref(false)
const active = ref(0)

const options = computed(() => {
  if (!editing.value) return []
  const pin = model.value.startsWith('pt:') ? [{ key: model.value, name: waypointLabel(model.value), subtitle: 'Point on the map', category: null }] : []
  // nothing typed yet: every place, A–Z (scrolls); otherwise the best matches
  const places = text.value.trim()
    ? search(text.value, 40).filter((e) => e.selection.type === 'place').slice(0, 8)
    : entries.value.filter((e) => e.selection.type === 'place').sort((a, b) => a.name.localeCompare(b.name))
  return [...(text.value ? [] : pin), ...places]
})

function focus(e: FocusEvent) {
  editing.value = true
  if (store.mobile) store.sheet = 'full' // room for the list above the keyboard
  text.value = ''
  active.value = 0
  ;(e.target as HTMLInputElement).select()
}
function pick(key: string) {
  model.value = key
  editing.value = false
  ;(document.activeElement as HTMLElement | null)?.blur()
}
function key(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') active.value = Math.min(active.value + 1, options.value.length - 1)
  else if (e.key === 'ArrowUp') active.value = Math.max(active.value - 1, 0)
  else if (e.key === 'Enter' && options.value[active.value]) pick(options.value[active.value].key)
  else if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="relative">
    <input
      :value="editing ? text : waypointLabel(model)" :placeholder="placeholder"
      class="h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-primary max-sm:text-base"
      @focus="focus" @blur="editing = false" @keydown="key"
      @input="text = ($event.target as HTMLInputElement).value; active = 0"
    />
    <ul v-if="options.length" class="absolute inset-x-0 top-11 z-20 max-h-80 overflow-auto rounded-lg bg-white py-1.5 shadow-gm">
      <li
        v-for="(o, i) in options" :key="o.key"
        class="flex cursor-pointer items-center gap-3 px-3 py-2" :class="i === active ? 'bg-black/5' : 'hover:bg-black/5'"
        @mousedown.prevent="pick(o.key)" @mouseenter="active = i"
      >
        <span class="grid size-7 shrink-0 place-items-center rounded-full bg-muted" :style="{ color: o.category?.color }">
          <LucideIcon v-if="o.category" :icon="o.category.icon" :size="14" />
          <MapPin v-else class="size-3.5 text-[#ea4335]" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm">{{ o.name }}</span>
          <span class="block truncate text-xs text-muted-foreground">{{ o.subtitle }}</span>
        </span>
      </li>
    </ul>
    <p v-if="editing && text && !options.length" class="absolute inset-x-0 top-11 z-20 rounded-lg bg-white px-3 py-2.5 text-sm text-muted-foreground shadow-gm">
      No places match "{{ text }}"
    </p>
  </div>
</template>
