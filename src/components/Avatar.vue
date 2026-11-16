<script setup lang="ts">
// A character's picture: their portrait if they have one, otherwise their initial on their colour.
// A small class badge sits in the corner (it tells the four orcs and the two rangers apart).
import { computed, type Component } from 'vue'
import { Axe, Sun, Guitar, Leaf, Eye, BowArrow, WandSparkles } from 'lucide-vue-next'
import type { Member } from '@/world/party'

const props = withDefaults(defineProps<{ member: Member; size?: number; badge?: boolean }>(), { size: 32, badge: true })

const CLASS_ICON: Record<string, Component> = {
  Barbarian: Axe, Cleric: Sun, Bard: Guitar, Druid: Leaf, Warlock: Eye, Ranger: BowArrow, Wizard: WandSparkles,
}
const icon = computed(() => CLASS_ICON[props.member.class])
const src = computed(() => props.member.portrait && `${import.meta.env.BASE_URL}${props.member.portrait}`)
const badgePx = computed(() => Math.max(14, Math.round(props.size * 0.42)))
</script>

<template>
  <span class="relative inline-block shrink-0" :style="{ width: size + 'px', height: size + 'px' }">
    <img v-if="src" :src="src" :alt="member.name" class="size-full rounded-full object-cover" />
    <span
      v-else class="grid size-full place-items-center rounded-full font-medium text-white select-none"
      :style="{ background: member.color, fontSize: Math.round(size * 0.44) + 'px' }"
    >{{ member.name[0] }}</span>
    <span
      v-if="badge && icon" class="absolute -right-0.5 -bottom-0.5 grid place-items-center rounded-full bg-white shadow-sm"
      :style="{ width: badgePx + 'px', height: badgePx + 'px', color: member.color }" :title="member.class"
    >
      <component :is="icon" :style="{ width: badgePx * 0.62 + 'px', height: badgePx * 0.62 + 'px' }" :stroke-width="2.25" />
    </span>
  </span>
</template>
