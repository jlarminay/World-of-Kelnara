import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
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
  plugins: [geojson(), vue(), tailwindcss()],
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
