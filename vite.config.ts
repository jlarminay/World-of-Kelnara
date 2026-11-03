import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))

/** Lets `import x from '../data/foo.geojson'` work like a .json import. */
function geojson(): Plugin {
  return {
    name: 'kelnara:geojson',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.geojson')) return null
      // minified: the files in data/ stay pretty-printed for diffs, the bundle doesn't pay for it
      return { code: `export default ${JSON.stringify(JSON.parse(code))};`, map: null }
    },
  }
}

export default defineConfig({
  // relative paths, so the site works from any folder (e.g. GitHub Pages' /World-of-Kelnara/)
  base: './',
  plugins: [
    geojson(),
    vue(),
    tailwindcss(),
    // Offline app: a service worker caches the whole site; new versions are picked up automatically
    // (see src/components/AutoUpdate.vue). The manifest is the hand-written public/manifest.webmanifest.
    VitePWA({
      registerType: 'autoUpdate', // new versions take over immediately and open pages reload
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{html,js,mjs,css,woff2,pbf,png,svg,webp,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true, // a new version takes over as soon as it is downloaded
        clientsClaim: true, // including pages that are already open
      },
    }),
  ],
  resolve: { alias: { '@': path.join(root, 'src') } },
  build: {
    chunkSizeWarningLimit: 2_000,
    rollupOptions: {
      output: {
        // separate files so browsers keep the big, rarely-changing parts cached when places/lore change
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
          if (id.endsWith('places.geojson')) return 'places'
          if (id.includes('/data/')) return 'world'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
