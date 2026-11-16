<script setup lang="ts">
// Menu → Sessions: every session, newest first.
import { ArrowLeft, ScrollText } from 'lucide-vue-next'
import { sessions } from '@/world/sessions'
import { selectSession, store } from '@/state/store'

const newestFirst = [...sessions].reverse()
</script>

<template>
  <div>
    <div class="flex items-center gap-2 px-3 pb-2">
      <button class="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Back to menu" @click="store.panel = 'menu'"><ArrowLeft class="size-5" /></button>
      <h2 class="text-xl">Sessions</h2>
    </div>
    <p v-if="!sessions.length" class="px-6 py-4 text-sm text-muted-foreground">No session notes yet.</p>
    <button
      v-for="s in newestFirst" :key="s.n"
      class="flex w-full items-start gap-4 border-b px-6 py-4 text-left hover:bg-black/[.03]"
      @click="selectSession(s.n)"
    >
      <span class="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-[#5e35b1]"><ScrollText class="size-5" /></span>
      <span class="min-w-0 flex-1">
        <span class="block text-xs text-muted-foreground">Session {{ s.n }}<template v-if="s.date"> · {{ s.date }}</template></span>
        <span class="block text-base font-medium">{{ s.title }}</span>
        <span class="block text-sm text-muted-foreground">{{ s.summary }}</span>
      </span>
    </button>
  </div>
</template>
