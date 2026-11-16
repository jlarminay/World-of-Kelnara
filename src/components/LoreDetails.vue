<script setup lang="ts">
// One Glossary or People entry: its text, related entries and places, and the sessions that mention it.
import { computed } from 'vue'
import { ArrowLeft, ScrollText } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { LORE_INFO, LORE_TITLE, loreById } from '@/world/lore'
import { sessionsMentioning } from '@/world/sessions'
import { categoryOf, type Category } from '@/world/categories'
import { placeById, selectLore, selectPlace, selectSession, store } from '@/state/store'
import { flyToPlace } from '@/map/controller'
import Hero from './Hero.vue'
import LucideIcon from './LucideIcon.vue'

const props = defineProps<{ id: string }>()
const e = computed(() => loreById(props.id))
const info = computed(() => (e.value ? LORE_INFO[e.value.kind] : null))
const paragraphs = computed(() => (e.value?.text ?? '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean))
const inSessions = computed(() => sessionsMentioning(props.id))

/** A related id as a row: another entry, or a place. */
type Link = { id: string; name: string; sub: string; cat: Category; open: () => void }
function link(id: string): Link | null {
  const other = loreById(id)
  if (other) return { id, name: other.name, sub: other.category, cat: LORE_INFO[other.kind], open: () => selectLore(id) }
  const place = placeById.value.get(id)
  if (place) {
    const cat = categoryOf(place.properties)
    return { id, name: place.properties.name, sub: cat.label, cat, open: () => { selectPlace(id); flyToPlace(id) } }
  }
  return null
}
const places = computed(() => (e.value?.places ?? []).map(link).filter((l): l is Link => !!l))
const see = computed(() => (e.value?.see ?? []).filter((id) => !e.value?.places?.includes(id)).map(link).filter((l): l is Link => !!l))
</script>

<template>
  <div v-if="e && info">
    <Hero :category="info" />
    <div class="px-6 pt-4 pb-4">
      <button class="-ml-2 mb-1 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-primary hover:bg-black/5" @click="store.selection = null; store.panel = e.kind">
        <ArrowLeft class="size-4" />{{ LORE_TITLE[e.kind] }}
      </button>
      <h1 class="text-[22px] leading-7">{{ e.name }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ e.category }}</p>
    </div>
    <Separator />

    <section class="px-6 py-4">
      <p v-for="(para, i) in paragraphs" :key="i" class="mb-3 text-sm leading-6 last:mb-0">{{ para }}</p>
    </section>

    <template v-if="inSessions.length">
      <Separator />
      <ul class="py-2 text-sm">
        <li class="flex items-center gap-6 px-6 py-3">
          <ScrollText class="size-5 shrink-0 text-primary" />
          <span>In session{{ inSessions.length > 1 ? 's' : '' }}
            <template v-for="(n, i) in inSessions" :key="n"
              ><template v-if="i">, </template
              ><button class="text-primary hover:underline" @click="selectSession(n)">{{ n }}</button></template>
          </span>
        </li>
      </ul>
    </template>

    <template v-for="block in [{ title: 'Places', rows: places }, { title: 'See also', rows: see }]" :key="block.title">
      <template v-if="block.rows.length">
        <Separator />
        <section class="py-4">
          <h2 class="mb-1 px-6 text-base font-medium">{{ block.title }}</h2>
          <button v-for="l in block.rows" :key="l.id" class="flex w-full items-center gap-4 px-6 py-2.5 text-left hover:bg-black/[.03]" @click="l.open">
            <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted" :style="{ color: l.cat.color }">
              <LucideIcon :icon="l.cat.icon" :size="16" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm">{{ l.name }}</span>
              <span class="block text-xs text-muted-foreground">{{ l.sub }}</span>
            </span>
          </button>
        </section>
      </template>
    </template>
  </div>
</template>
