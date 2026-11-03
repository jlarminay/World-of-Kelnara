// npm run bake [settlement-id ...]
// Regenerates and saves data/generated/<id>.json for every (or the given) settlement.
import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
import { bakeSettlements } from './bake-core.ts'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  for (const { file, bytes } of await bakeSettlements(server, process.argv.slice(2), writeFile)) console.log(`baked ${file} (${(bytes / 1e6).toFixed(1)} MB)`)
} finally {
  await server.close()
}
