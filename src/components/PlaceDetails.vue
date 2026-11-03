<script setup lang="ts">
import { computed } from 'vue'
import { Share2, LocateFixed, Layers, MapPin, Info, Building2, CalendarDays } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { categoryOf } from '@/world/categories'
import { distanceKm, formatKm, levelToZoom } from '@/world/coords'
import { ancestorsOf, childrenOf, openDirections, placeById, selectPlace, store } from '@/state/store'
import { flyToPlace } from '@/map/controller'
import LucideIcon from './LucideIcon.vue'
import Hero from './Hero.vue'
import ActionButton from './ActionButton.vue'
import DirectionsIcon from './icons/DirectionsIcon.vue'
import { FEATURES } from '@/features'

const props = defineProps<{ id: string }>()
const place = computed(() => placeById.value.get(props.id))
const p = computed(() => place.value?.properties)
const cat = computed(() => p.value && categoryOf(p.value))
const ancestors = computed(() => ancestorsOf(props.id))
const children = computed(() => childrenOf(props.id))
const nearby = computed(() => {
  const here = place.value?.geometry.coordinates
  if (!here) return []
  return store.places.features
    .filter((f) => f.properties.id !== props.id && f.properties.parent !== props.id)
    .map((f) => ({ f, km: distanceKm(here, f.geometry.coordinates) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 5)
})
const details = computed(() => (p.value?.details ?? '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean))
const coords = computed(() => place.value?.geometry.coordinates.map((c) => c.toFixed(5)).join(', '))

const directions = () => openDirections('to', props.id)
function go(id: string) {
  selectPlace(id)
  flyToPlace(id)
}
const share = () => navigator.clipboard?.writeText(location.href)
</script>

<template>
  <div v-if="p && cat">
    <Hero :category="cat" />
    <div class="px-6 pt-5 pb-3">
      <div class="flex items-start gap-3">
        <h1 class="min-w-0 flex-1 text-[22px] leading-7">{{ p.name }}</h1>
        <button
          v-if="FEATURES.directions" title="Directions"
          class="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm hover:brightness-110"
          @click="directions"
        >
          <DirectionsIcon class="size-6" arrow="var(--primary)" />
        </button>
      </div>
      <p v-if="p.aliases?.length" class="text-sm text-muted-foreground">Also known as {{ p.aliases.join(', ') }}</p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ cat.label }}<template v-if="p.province"> · {{ p.province }}</template>
      </p>
      <div v-if="p.tags?.length" class="mt-2 flex flex-wrap gap-1">
        <Badge v-for="t in p.tags" :key="t" variant="secondary">{{ t }}</Badge>
      </div>
    </div>
    <div v-if="FEATURES.placeActions" class="flex justify-around px-4 pb-4">
      <ActionButton label="Zoom to" primary @click="flyToPlace(id)"><LocateFixed /></ActionButton>
      <ActionButton label="Share" @click="share"><Share2 /></ActionButton>
    </div>
    <Separator />

    <section v-if="p.description" class="px-6 py-4 text-sm leading-6">{{ p.description }}</section>
    <Separator v-if="p.description" />

    <ul class="py-2 text-sm">
      <li v-if="ancestors.length" class="flex items-center gap-6 px-6 py-3">
        <Building2 class="size-5 shrink-0 text-primary" />
        <span>Part of
          <template v-for="(a, i) in ancestors" :key="a.properties.id"
            ><template v-if="i">, </template
            ><button class="hover:underline" @click="go(a.properties.id)">{{ a.properties.name }}</button></template>
        </span>
      </li>
      <li class="flex items-center gap-6 px-6 py-3"><MapPin class="size-5 text-primary" />{{ coords }}</li>
      <li class="flex items-center gap-6 px-6 py-3">
        <Layers class="size-5 text-primary" />Shown from zoom {{ levelToZoom(p.minzoom) }} (detail level {{ p.minzoom }})
      </li>
      <li v-if="p.when" class="flex items-center gap-6 px-6 py-3"><CalendarDays class="size-5 shrink-0 text-primary" />{{ p.when }}</li>
      <li v-if="p.note" class="flex items-center gap-6 px-6 py-3"><Info class="size-5 text-primary" />{{ p.note }}</li>
    </ul>

    <template v-if="p.history">
      <Separator />
      <section class="px-6 py-4">
        <h2 class="mb-2 text-base font-medium">History</h2>
        <p class="text-sm leading-6 whitespace-pre-line text-muted-foreground">{{ p.history }}</p>
      </section>
    </template>

    <template v-if="children.length">
      <Separator />
      <section class="py-4">
        <h2 class="mb-1 px-6 text-base font-medium">In {{ p.name }}</h2>
        <button
          v-for="c in children" :key="c.properties.id"
          class="flex w-full items-center gap-4 px-6 py-2.5 text-left hover:bg-black/[.03]" @click="go(c.properties.id)"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted" :style="{ color: categoryOf(c.properties).color }">
            <LucideIcon :icon="categoryOf(c.properties).icon" :size="16" />
          </span>
          <span>
            <span class="block text-sm">{{ c.properties.name }}</span>
            <span class="block text-xs text-muted-foreground">{{ categoryOf(c.properties).label }}</span>
          </span>
        </button>
      </section>
    </template>

    <template v-if="details.length">
      <Separator />
      <section class="px-6 py-4">
        <h2 class="mb-2 text-base font-medium">Details</h2>
        <p v-for="(para, i) in details" :key="i" class="mb-3 text-sm leading-6 text-muted-foreground last:mb-0">{{ para }}</p>
      </section>
    </template>

    <template v-if="FEATURES.nearby">
    <Separator />
    <section class="py-4">
      <h2 class="mb-1 px-6 text-base font-medium">Nearby</h2>
      <button
        v-for="n in nearby" :key="n.f.properties.id"
        class="flex w-full items-center justify-between gap-4 px-6 py-2.5 text-left hover:bg-black/[.03]" @click="go(n.f.properties.id)"
      >
        <span>
          <span class="block text-sm">{{ n.f.properties.name }}</span>
          <span class="block text-xs text-muted-foreground">{{ categoryOf(n.f.properties).label }}</span>
        </span>
        <span class="text-xs text-muted-foreground">{{ formatKm(n.km) }}</span>
      </button>
    </section>
    </template>
  </div>
</template>
