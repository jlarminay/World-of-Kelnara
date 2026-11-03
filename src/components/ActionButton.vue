<script setup lang="ts">
defineProps<{ label: string; primary?: boolean }>()
</script>

<template>
  <button class="group flex w-16 flex-col items-center gap-1.5 text-xs font-medium text-primary">
    <span
      class="grid size-10 place-items-center rounded-full border transition-colors [&_svg]:size-[18px]"
      :class="primary ? 'border-primary bg-primary text-white group-hover:bg-[#1765cc]' : 'border-border group-hover:bg-accent'"
    >
      <slot />
    </span>
    {{ label }}
  </button>
</template>
