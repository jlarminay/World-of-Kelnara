<script setup lang="ts">
// Menu → Party: every character.
import { ArrowLeft } from 'lucide-vue-next'
import { members } from '@/world/party'
import { selectMember, store } from '@/state/store'
import Avatar from './Avatar.vue'
</script>

<template>
  <div>
    <div class="flex items-center gap-2 px-3 pb-2">
      <button class="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Back to menu" @click="store.panel = 'menu'"><ArrowLeft class="size-5" /></button>
      <h2 class="text-xl">Party</h2>
    </div>
    <button
      v-for="m in members" :key="m.id"
      class="flex w-full items-center gap-4 border-b px-6 py-3 text-left hover:bg-black/[.03]"
      @click="selectMember(m.id)"
    >
      <Avatar :member="m" :size="40" />
      <span class="min-w-0 flex-1">
        <span class="block text-base font-medium">{{ m.name }}</span>
        <span class="block text-sm text-muted-foreground">{{ m.race }} {{ m.class }}</span>
      </span>
      <span class="shrink-0 text-xs text-muted-foreground">{{ m.player }}</span>
    </button>
  </div>
</template>
