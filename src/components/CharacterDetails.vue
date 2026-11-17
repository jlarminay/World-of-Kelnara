<script setup lang="ts">
// A character's profile: who they are, then their story session by session, then the places that matter to them.
import { computed, ref, watch } from 'vue'
import LinkedText from './LinkedText.vue'
import { ArrowLeft, ScrollText, Gamepad2, ChevronDown } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { memberById } from '@/world/party'
import { sessions, sessionByN } from '@/world/sessions'
import { categoryOf } from '@/world/categories'
import { placeById, selectPlace, selectSession, store } from '@/state/store'
import { flyToPlace } from '@/map/controller'
import Avatar from './Avatar.vue'
import LucideIcon from './LucideIcon.vue'

const props = defineProps<{ id: string }>()
const m = computed(() => memberById.get(props.id))
/** The first session they were at (the `party:` line of each session's notes). */
const first = computed(() => sessions.find((s) => s.party.some((p) => p.id === props.id)))
/** The story grouped by session, in order. */
const chapters = computed(() => {
  const by = new Map<number, string[]>()
  for (const e of m.value?.story ?? []) by.set(e.session, [...(by.get(e.session) ?? []), e.text])
  return [...by].sort(([a], [b]) => a - b).map(([n, lines]) => ({ n, title: sessionByN.get(n)?.title, lines }))
})
/** Story sections that are open (all closed to start with, and again for each character). */
const open = ref(new Set<number>())
watch(() => props.id, () => (open.value = new Set()))
function toggle(n: number) {
  const s = new Set(open.value)
  if (!s.delete(n)) s.add(n)
  open.value = s
}
const places = computed(() => (m.value?.places ?? []).map((p) => ({ ...p, place: placeById.value.get(p.id) })).filter((p) => p.place))

function openPlace(id: string) {
  selectPlace(id)
  flyToPlace(id)
}
</script>

<template>
  <div v-if="m">
    <!-- header: their colour, with the avatar; the top 60px sits under the search box on desktop -->
    <div
      class="grid place-items-center" :class="store.mobile ? 'h-32' : '-mt-[72px] h-[200px] pt-[60px]'"
      :style="{ background: `linear-gradient(135deg, ${m.color}22, ${m.color}66)` }"
    >
      <Avatar :member="m" :size="store.mobile ? 80 : 104" />
    </div>
    <div class="px-6 pt-4 pb-4">
      <button class="-ml-2 mb-1 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-primary hover:bg-black/5" @click="store.selection = null; store.panel = 'party'">
        <ArrowLeft class="size-4" />Party
      </button>
      <h1 class="text-[22px] leading-7">{{ m.surname ? `${m.name} ${m.surname}` : m.name }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ m.race }} {{ m.class }}</p>
      <p v-if="m.summary" class="mt-3 text-sm leading-6"><LinkedText :text="m.summary" :skip="id" /></p>
    </div>
    <Separator />

    <ul class="py-2 text-sm">
      <li class="flex items-center gap-6 px-6 py-3"><Gamepad2 class="size-5 shrink-0 text-primary" />Played by {{ m.player }}</li>
      <li v-if="first" class="flex items-center gap-6 px-6 py-3">
        <ScrollText class="size-5 shrink-0 text-primary" />
        <span>First session:
          <button class="text-primary hover:underline" @click="selectSession(first.n)">Session {{ first.n }} · {{ first.title }}</button>
        </span>
      </li>
    </ul>

    <Separator />
    <section class="px-6 py-4">
      <h2 class="text-base font-medium">Story</h2>
      <p class="mb-3 text-xs text-muted-foreground">Moments that were {{ m.name }}'s own, not the whole party's.</p>
      <p v-if="!chapters.length" class="text-sm text-muted-foreground">No notes yet.</p>
      <!-- a rounded card of rows, so the dividers between sessions don't read as section breaks -->
      <div v-if="chapters.length" class="overflow-hidden rounded-xl border">
        <div v-for="c in chapters" :key="c.n" class="border-t first:border-t-0">
          <button class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[.03]" :class="open.has(c.n) ? 'bg-black/[.02]' : ''" :aria-expanded="open.has(c.n)" @click="toggle(c.n)">
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium">Session {{ c.n }}</span>
              <span v-if="c.title" class="block truncate text-xs text-muted-foreground">{{ c.title }}</span>
            </span>
            <span class="text-xs text-muted-foreground">{{ c.lines.length }}</span>
            <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform" :class="open.has(c.n) ? 'rotate-180' : ''" />
          </button>
          <div v-if="open.has(c.n)" class="bg-black/[.02] px-4 pb-4">
            <ul class="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
              <li v-for="(line, i) in c.lines" :key="i"><LinkedText :text="line" :skip="id" /></li>
            </ul>
            <button class="mt-2 text-xs font-medium text-primary hover:underline" @click="selectSession(c.n)">Open session {{ c.n }}</button>
          </div>
        </div>
      </div>
    </section>

    <template v-if="places.length">
      <Separator />
      <section class="py-4">
        <h2 class="mb-1 px-6 text-base font-medium">Places</h2>
        <button
          v-for="p in places" :key="p.id"
          class="flex w-full items-center gap-4 px-6 py-2.5 text-left hover:bg-black/[.03]" @click="openPlace(p.id)"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted" :style="{ color: categoryOf(p.place!.properties).color }">
            <LucideIcon :icon="categoryOf(p.place!.properties).icon" :size="16" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm">{{ p.place!.properties.name }}</span>
            <span class="block text-xs text-muted-foreground">{{ p.why }}</span>
          </span>
        </button>
      </section>
    </template>
  </div>
</template>
