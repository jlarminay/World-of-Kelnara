import type { ViteDevServer } from 'vite'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

const dataDir = path.resolve(import.meta.dirname, '../data')

/** Shared by `npm run bake` and the editor's Bake button (dev server). */
export async function bakeSettlements(
  server: ViteDevServer,
  ids: string[],
  write: (file: string, text: string) => Promise<void>,
) {
  const { bake } = (await server.ssrLoadModule('/src/map/procedural/bake.ts')) as typeof import('../src/map/procedural/bake')
  const settlements = JSON.parse(await readFile(path.join(dataDir, 'settlements.json'), 'utf8'))
  const places = JSON.parse(await readFile(path.join(dataDir, 'places.geojson'), 'utf8'))
  const out: { file: string; bytes: number }[] = []
  for (const s of settlements) {
    if (ids.length && !ids.includes(s.id)) continue
    const center = places.features.find((f: { properties: { id: string } }) => f.properties.id === s.placeId)?.geometry.coordinates
    if (!center) throw new Error(`${s.id}: place ${s.placeId} not found`)
    const text = JSON.stringify(bake(s, center)) + '\n'
    const file = `generated/${s.id}.json`
    await write(path.join(dataDir, file), text)
    out.push({ file, bytes: text.length })
  }
  return out
}
