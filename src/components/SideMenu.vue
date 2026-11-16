<script setup lang="ts">
// Menu shown in the side panel (below the search bar) when the menu button is pressed.
import { ref } from 'vue'
import { ChevronDown, Ruler, Layers, Footprints, Download, Share, Earth, ScrollText, UsersRound, Scale, Github, BookA, UserRound } from 'lucide-vue-next'
import { canInstall, install, promptInstall } from '@/state/install'
import { CHIPS } from '@/search'
import { store } from '@/state/store'
import { startMeasure } from '@/map/measure'
import { openCompare } from '@/map/compare'
import { world } from '@/world/data'
import LegalDialog from './LegalDialog.vue'

const foot = world.travel.on_foot_km_per_day
const open = ref<Record<string, boolean>>({ explore: true, tools: true, map: false, travel: false })
const toggle = (k: string) => (open.value[k] = !open.value[k])

const showIosSteps = ref(false)
const legal = ref(false)
const GITHUB = 'https://github.com/jlarminay/World-of-Kelnara'
async function installApp() {
  if (!(await promptInstall())) showIosSteps.value = !showIosSteps.value
}

function browse(label: string) {
  store.query = label
  store.selection = null
  store.panel = 'results'
}
function measure() {
  store.panel = 'none'
  startMeasure()
}
function compare() {
  store.panel = 'none'
  openCompare()
}
</script>

<template>
  <!-- tall enough to fill the panel: the footer sits at its bottom when the menu is short, and after the menu (scrolling with it) when it is long -->
  <div class="flex min-h-full flex-col sm:min-h-[calc(100dvh-72px)]">
    <section class="border-b py-2">
      <button class="flex w-full items-center gap-4 px-6 py-2.5 text-left text-sm hover:bg-black/5" @click="store.panel = 'sessions'">
        <ScrollText class="size-5 text-muted-foreground" />Sessions
      </button>
      <button class="flex w-full items-center gap-4 px-6 py-2.5 text-left text-sm hover:bg-black/5" @click="store.panel = 'party'">
        <UsersRound class="size-5 text-muted-foreground" />Party
      </button>
      <button class="flex w-full items-center gap-4 px-6 py-2.5 text-left text-sm hover:bg-black/5" @click="store.panel = 'people'">
        <UserRound class="size-5 text-muted-foreground" />People
      </button>
      <button class="flex w-full items-center gap-4 px-6 py-2.5 text-left text-sm hover:bg-black/5" @click="store.panel = 'glossary'">
        <BookA class="size-5 text-muted-foreground" />Glossary
      </button>
    </section>

    <section class="border-b py-2">
      <button class="flex w-full items-center justify-between px-6 py-2 text-sm font-medium" @click="toggle('explore')">
        Explore <ChevronDown class="size-4 text-muted-foreground transition-transform" :class="open.explore ? 'rotate-180' : ''" />
      </button>
      <template v-if="open.explore">
        <button v-for="c in CHIPS" :key="c.label" class="flex w-full items-center gap-4 px-6 py-2.5 text-left text-sm hover:bg-black/5" @click="browse(c.label)">
          <component :is="c.icon" class="size-5 text-muted-foreground" />{{ c.label }}
        </button>
      </template>
    </section>

    <section class="border-b py-2">
      <button class="flex w-full items-center justify-between px-6 py-2 text-sm font-medium" @click="toggle('tools')">
        Tools <ChevronDown class="size-4 text-muted-foreground transition-transform" :class="open.tools ? 'rotate-180' : ''" />
      </button>
      <template v-if="open.tools && canInstall">
        <button class="flex w-full items-center gap-4 px-6 py-2.5 text-left text-sm hover:bg-black/5" @click="installApp">
          <Download class="size-5 text-muted-foreground" />Install app
        </button>
        <p v-if="showIosSteps && !install.prompt" class="pr-6 pb-2 pl-[60px] text-xs text-muted-foreground">
          Tap <Share class="inline size-3.5 -translate-y-px" /> Share, then <span class="font-medium">Add to Home Screen</span>
        </p>
      </template>
      <button v-if="open.tools" class="flex w-full items-center gap-4 px-6 py-2.5 text-left text-sm hover:bg-black/5" @click="measure">
        <Ruler class="size-5 text-muted-foreground" />Measure distance
      </button>
      <button v-if="open.tools" class="flex w-full items-center gap-4 px-6 py-2.5 text-left text-sm hover:bg-black/5" @click="compare">
        <Earth class="size-5 text-muted-foreground" />Compare real-world size
      </button>
    </section>

    <section class="border-b py-2">
      <button class="flex w-full items-center justify-between px-6 py-2 text-sm font-medium" @click="toggle('map')">
        Map <ChevronDown class="size-4 text-muted-foreground transition-transform" :class="open.map ? 'rotate-180' : ''" />
      </button>
      <label v-if="open.map" class="flex cursor-pointer items-center gap-4 px-6 py-2.5 text-sm hover:bg-black/5">
        <Layers class="size-5 text-muted-foreground" />
        <span class="flex-1">Show original drawing</span>
        <input type="checkbox" class="accent-primary" :checked="store.baseLayer === 'original'" @change="store.baseLayer = ($event.target as HTMLInputElement).checked ? 'original' : 'map'">
      </label>
    </section>

    <section class="py-2">
      <button class="flex w-full items-center justify-between px-6 py-2 text-sm font-medium" @click="toggle('travel')">
        Travel <ChevronDown class="size-4 text-muted-foreground transition-transform" :class="open.travel ? 'rotate-180' : ''" />
      </button>
      <div v-if="open.travel" class="px-6 py-2 text-sm text-muted-foreground">
        <p class="mb-2 flex items-center gap-4 text-foreground"><Footprints class="size-5 text-muted-foreground" />On foot, per day</p>
        <ul class="ml-9 space-y-1">
          <li>Road: {{ foot.road }} km</li>
          <li>Path: {{ foot.path }} km</li>
          <li>Open country: {{ foot.open }} km</li>
        </ul>
        <p class="mt-2 ml-9 text-xs">Distances from a city are measured from outside its gate.</p>
      </div>
    </section>

    <footer class="mt-auto grid grid-cols-2 gap-2 border-t bg-white px-4 py-3">
      <button class="flex items-center justify-center gap-2 rounded-full border py-1.5 text-xs text-muted-foreground hover:bg-black/5 hover:text-foreground" @click="legal = true">
        <Scale class="size-3.5" />Legal
      </button>
      <a :href="GITHUB" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 rounded-full border py-1.5 text-xs text-muted-foreground hover:bg-black/5 hover:text-foreground">
        <Github class="size-3.5" />GitHub
      </a>
    </footer>
    <LegalDialog v-model:open="legal" />
  </div>
</template>
