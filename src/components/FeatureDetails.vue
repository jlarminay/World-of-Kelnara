<script setup lang="ts">
import { computed } from 'vue'
import type { Feature } from 'geojson'
import { Ruler } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { layers, type LayerName } from '@/world/data'
import { FEATURE_INFO } from '@/world/categories'
import Hero from './Hero.vue'

const props = defineProps<{ layer: LayerName; id: string }>()
const f = computed(() => (layers[props.layer].features as Feature[]).find((f) => f.properties?.id === props.id))
const p = computed(() => f.value?.properties ?? {})
const details = computed(() => String(p.value.details ?? '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean))
const cat = computed(() => FEATURE_INFO[p.value.kind] ?? FEATURE_INFO.region)
</script>

<template>
  <div v-if="f">
    <Hero :category="cat" />
    <div class="px-6 pt-5 pb-4">
      <h1 class="text-[22px] leading-7">{{ p.name ?? `Unnamed ${cat.label.toLowerCase()}` }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ cat.label }}</p>
    </div>
    <Separator />
    <ul class="py-2 text-sm">
      <li v-if="p.area_km2" class="flex items-center gap-6 px-6 py-3"><Ruler class="size-5 text-primary" />{{ Math.round(p.area_km2).toLocaleString() }} km²</li>
      <li v-if="p.length_km" class="flex items-center gap-6 px-6 py-3"><Ruler class="size-5 text-primary" />{{ Math.round(p.length_km).toLocaleString() }} km long</li>
    </ul>
    <p v-if="p.description" class="px-6 py-2 text-sm leading-6">{{ p.description }}</p>
    <template v-if="details.length">
      <Separator />
      <section class="px-6 py-4">
        <h2 class="mb-2 text-base font-medium">Details</h2>
        <p v-for="(para, i) in details" :key="i" class="mb-3 text-sm leading-6 text-muted-foreground last:mb-0">{{ para }}</p>
      </section>
    </template>
  </div>
</template>
