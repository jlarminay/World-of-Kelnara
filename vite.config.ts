import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { bakeSettlements } from './tools/bake-core.ts'

const root = fileURLToPath(new URL('.', import.meta.url))
const dataDir = path.join(root, 'data')

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

/**
 * Dev-server only: the editor POSTs whole files here and they are written into data/.
 * This plugin is never part of `vite build`, so the deployed app is read-only.
 */
function editorApi(): Plugin {
  return {
    name: 'kelnara:editor-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__editor/bake', async (req, res) => {
        if (req.method !== 'POST') return void ((res.statusCode = 405), res.end())
        const id = new URL(req.url ?? '', 'http://x').searchParams.get('id')
        try {
          const done = await bakeSettlements(server, id ? [id] : [], (f, t) => writeFile(f, t))
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: true, done }))
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
      server.middlewares.use('/__editor/save', (req, res) => {
        const url = new URL(req.url ?? '', 'http://x')
        const file = url.searchParams.get('file') ?? ''
        const target = path.join(dataDir, file)
        if (req.method !== 'POST' || !/^[a-z0-9-]+\.(geo)?json$/.test(file) || !existsSync(target)) {
          res.statusCode = 400
          res.end('bad request')
          return
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          try {
            const json = JSON.parse(body)
            await writeFile(target, JSON.stringify(json, null, 1) + '\n')
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, file }))
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
      })
    },
    // Saving from the editor must not reload the page. Drop the stale module so the
    // next manual refresh (or an external edit + refresh) picks up the new file.
    handleHotUpdate({ file, modules, server }) {
      if (!file.startsWith(dataDir)) return
      for (const m of modules) server.moduleGraph.invalidateModule(m)
      return []
    },
  }
}

export default defineConfig({
  plugins: [geojson(), editorApi(), vue(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  build: { chunkSizeWarningLimit: 10_000 },
})
