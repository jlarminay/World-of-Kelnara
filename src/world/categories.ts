// One registry for how each kind of place looks, shared by map pins and UI.
import type { IconNode } from 'lucide'
import {
  Anchor, Apple, Beer, Castle, Church, Crown, Gem, House, Landmark, MapPin, Mountain, Pickaxe, Skull,
  Building2, TowerControl, TreeDeciduous, Warehouse, Wheat, Tent, Waves, Trees, Flag,
} from 'lucide'
import type { PlaceProps, Rank } from './types'

export interface Category {
  label: string
  color: string
  icon: IconNode
}

/** POI kinds. Unknown kinds fall back to `default`. Add a line here to get a new pin. */
export const KINDS: Record<string, Category> = {
  castle: { label: 'Castle', color: '#129eaf', icon: Castle },
  landmark: { label: 'Landmark', color: '#129eaf', icon: Landmark },
  watchtower: { label: 'Watchtower', color: '#129eaf', icon: TowerControl },
  shrine: { label: 'Shrine', color: '#8e63ce', icon: Church },
  temple: { label: 'Temple', color: '#8e63ce', icon: Church },
  mine: { label: 'Mine', color: '#8d6e63', icon: Pickaxe },
  quarry: { label: 'Quarry', color: '#8d6e63', icon: Mountain },
  farm: { label: 'Farm', color: '#34a853', icon: Wheat },
  orchard: { label: 'Orchard', color: '#34a853', icon: Apple },
  mill: { label: 'Mill', color: '#34a853', icon: Warehouse },
  grove: { label: 'Grove', color: '#34a853', icon: TreeDeciduous },
  inn: { label: 'Inn', color: '#f29900', icon: Beer },
  tavern: { label: 'Tavern', color: '#f29900', icon: Beer },
  port: { label: 'Port', color: '#1a73e8', icon: Anchor },
  camp: { label: 'Camp', color: '#e8710a', icon: Tent },
  ruin: { label: 'Ruin', color: '#5f6368', icon: Skull },
  cave: { label: 'Cave', color: '#5f6368', icon: Gem },
  default: { label: 'Point of interest', color: '#5f6368', icon: MapPin },
}

export const RANK_INFO: Record<Rank, Category> = {
  capital: { label: 'Capital city', color: '#202124', icon: Crown },
  city: { label: 'City', color: '#202124', icon: Building2 },
  town: { label: 'Town', color: '#3c4043', icon: House },
  village: { label: 'Village', color: '#3c4043', icon: House },
  district: { label: 'District', color: '#5f6368', icon: Flag },
  farm: { label: 'Farm', color: '#34a853', icon: Wheat },
  poi: KINDS.default,
}

export const FEATURE_INFO: Record<string, Category> = {
  lake: { label: 'Lake', color: '#1a73e8', icon: Waves },
  river: { label: 'River', color: '#1a73e8', icon: Waves },
  forest: { label: 'Forest', color: '#188038', icon: Trees },
  mountain_range: { label: 'Mountain range', color: '#8d6e63', icon: Mountain },
  province: { label: 'Province', color: '#5f6368', icon: Flag },
  water: { label: 'Sea', color: '#1a73e8', icon: Waves },
  region: { label: 'Region', color: '#5f6368', icon: MapPin },
}

/** Places that get a coloured pin on the map (everything except settlements and districts). */
export const isPinned = (p: PlaceProps) => p.rank === 'poi' || p.rank === 'farm'

export function categoryOf(p: PlaceProps): Category {
  if (isPinned(p)) return KINDS[p.kind] ?? (p.rank === 'farm' ? KINDS.farm : KINDS.default)
  return RANK_INFO[p.rank] ?? KINDS.default
}

export const pinImageId = (kind: string) => `pin-${KINDS[kind] ? kind : 'default'}`
