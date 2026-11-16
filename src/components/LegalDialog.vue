<script setup lang="ts">
// Menu → Legal: who made the world, the D&D fan-content notice, other media, and the tools the app is built with.
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { X } from "lucide-vue-next";

const open = defineModel<boolean>("open", { required: true });

/** Who made Kelnara. TODO: add Dave's last name. */
const CREATOR = "Dave";
const YEAR = 2026;

const TOOLS: { name: string; what: string; license: string; url: string }[] = [
  {
    name: "Vue",
    what: "app framework",
    license: "MIT",
    url: "https://vuejs.org",
  },
  {
    name: "MapLibre GL JS",
    what: "map rendering",
    license: "BSD-3-Clause",
    url: "https://maplibre.org",
  },
  { name: "Lucide", what: "icons", license: "ISC", url: "https://lucide.dev" },
  {
    name: "Tailwind CSS",
    what: "styling",
    license: "MIT",
    url: "https://tailwindcss.com",
  },
  {
    name: "shadcn-vue and Reka UI",
    what: "interface components",
    license: "MIT",
    url: "https://reka-ui.com",
  },
  {
    name: "Fuse.js",
    what: "search",
    license: "Apache-2.0",
    url: "https://www.fusejs.io",
  },
  {
    name: "markdown-it",
    what: "session notes",
    license: "MIT",
    url: "https://github.com/markdown-it/markdown-it",
  },
  {
    name: "VueUse",
    what: "utilities",
    license: "MIT",
    url: "https://vueuse.org",
  },
  {
    name: "Vite and Vite PWA",
    what: "build and offline app",
    license: "MIT",
    url: "https://vite.dev",
  },
  {
    name: "Roboto and Noto Sans",
    what: "fonts",
    license: "OFL-1.1",
    url: "https://fonts.google.com",
  },
];
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-gm outline-none"
      >
        <div class="flex items-center justify-between border-b py-3 pr-3 pl-6">
          <DialogTitle class="text-lg font-medium">Legal</DialogTitle>
          <DialogClose
            class="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-black/5"
            aria-label="Close"
            ><X class="size-5"
          /></DialogClose>
        </div>
        <DialogDescription class="sr-only"
          >Credits, copyright and trademark notices for Kelnara
          Maps.</DialogDescription
        >

        <div
          class="overflow-y-auto px-6 py-4 text-sm leading-6 text-muted-foreground"
        >
          <h3 class="font-medium text-foreground">Kelnara</h3>
          <p class="mb-2">
            The world of Kelnara, including this map, its places, history and
            characters, was created by {{ CREATOR }}. <br />© {{ YEAR }}
            {{ CREATOR }}. All rights reserved.
          </p>
          <p class="mb-4">
            This is a work of fiction. Any resemblance to real people, living or
            dead, to real places, or to other works of fiction is purely
            coincidental.
          </p>

          <h3 class="font-medium text-foreground">Dungeons &amp; Dragons</h3>
          <p class="mb-4">
            Kelnara Maps is unofficial Fan Content permitted under the Fan
            Content Policy. Not approved/endorsed by Wizards. Portions of the
            materials used are property of Wizards of the Coast.
            <br />©Wizards of the Coast LLC. Dungeons &amp; Dragons and D&amp;D
            are trademarks of Wizards of the Coast LLC.
          </p>

          <h3 class="font-medium text-foreground">Other media</h3>
          <p class="mb-2">
            Character portraits, and any other images of or references to other
            games, books, films, music or media, belong to their respective
            owners. They are used in a private, non-commercial fan project and
            imply no affiliation with, or endorsement by, those owners.
          </p>
          <p class="mb-4">
            The look of this app is inspired by Google Maps. Kelnara Maps is not
            affiliated with Google; Google Maps is a trademark of Google LLC.
          </p>

          <h3 class="mb-1 font-medium text-foreground">Built with</h3>
          <ul class="divide-y">
            <li
              v-for="t in TOOLS"
              :key="t.name"
              class="flex items-baseline justify-between gap-3 py-1.5"
            >
              <span class="min-w-0">
                <a
                  :href="t.url"
                  target="_blank"
                  rel="noopener"
                  class="text-foreground hover:underline"
                  >{{ t.name }}</a
                >
                <span class="text-xs"> · {{ t.what }}</span>
              </span>
              <span class="shrink-0 text-xs">{{ t.license }}</span>
            </li>
          </ul>
          <p class="mt-2 text-xs">
            Each is used under its own open-source licence.
          </p>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
