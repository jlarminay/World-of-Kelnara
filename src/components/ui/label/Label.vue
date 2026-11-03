<script setup lang="ts">
import type { LabelProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { Label } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<LabelProps & { class?: HTMLAttributes['class'] }>()
const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <Label data-slot="label" v-bind="delegatedProps" :class="cn('flex items-center gap-2 text-xs leading-none font-medium text-muted-foreground select-none', props.class)">
    <slot />
  </Label>
</template>
