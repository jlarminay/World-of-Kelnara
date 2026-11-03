<script setup lang="ts">
// Small banner offering to install the map as an app (logic in state/install.ts).
// The ✕ hides it for good on this device; the menu's "Install app" item still works after that.
import { computed, ref } from 'vue'
import { Share, X } from 'lucide-vue-next'
import { canInstall, install, promptInstall } from '@/state/install'

const KEY = 'kelnara:install-banner-dismissed'
const iconUrl = import.meta.env.BASE_URL + 'icon-192.png'
const dismissed = ref(localStorage.getItem(KEY) === '1')
const show = computed(() => canInstall.value && !dismissed.value)

function dismiss() {
  localStorage.setItem(KEY, '1')
  dismissed.value = true
}
</script>

<template>
  <div
    v-if="show"
    class="absolute top-3 right-3 z-30 flex w-[360px] items-center gap-3 rounded-xl bg-white py-2.5 pr-2 pl-3 shadow-gm max-sm:top-[68px] max-sm:left-3 max-sm:w-auto"
  >
    <img :src="iconUrl" alt="" class="size-9 shrink-0 rounded-lg">
    <div class="min-w-0 flex-1 text-sm leading-5">
      <p class="font-medium">Get Kelnara Maps as an app</p>
      <p v-if="install.prompt" class="text-xs text-muted-foreground">Works offline and updates itself</p>
      <p v-else class="text-xs text-muted-foreground">
        Tap <Share class="inline size-3.5 -translate-y-px" /> Share, then <span class="font-medium">Add to Home Screen</span>
      </p>
    </div>
    <button v-if="install.prompt" class="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90" @click="promptInstall">Install</button>
    <button class="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-black/5" title="Dismiss" @click="dismiss">
      <X class="size-4" />
    </button>
  </div>
</template>
