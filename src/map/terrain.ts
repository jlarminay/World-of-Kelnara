import type { Feature, Position } from 'geojson'
import { layers } from '@/world/data'
import { bboxOf, pointInGeometry, type BBox } from '@/world/geo'
import type { Terrain } from './procedural/city'

function index(features: Feature[]) {
  const items = features.map((f) => ({ f, b: bboxOf(f.geometry) as BBox }))
  return (p: Position) => items.some(({ f, b }) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3] && pointInGeometry(p, f.geometry))
}

/** Point lookups against the world layers, used by the procedural generator. */
export const terrain: Terrain = {
  isLand: index(layers.land.features),
  isLake: index(layers.lakes.features),
  isForest: index(layers.forests.features),
}
