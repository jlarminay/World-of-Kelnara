import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
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
  plugins: [geojson(), vue(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  build: { chunkSizeWarningLimit: 10_000 },
})
