# Kelnara of Thera: map

A Google-Maps-style map of the Kelnara campaign world (Vue 3 + TypeScript + Tailwind + shadcn-vue + MapLibre GL). The data was traced from the hand-drawn poster map. Big cities and their farmland are generated procedurally, then **baked** to JSON so the map is identical every time.

The roadmap, open decisions and build phases are in `.claude/PLAN.md`.

## Quick start

```bash
npm install
npm run dev        # app + local editor at http://localhost:5173
npm run bake       # regenerate data/generated/*.json from data/settlements.json
npm run build      # dist/index.html: one self-contained, read-only file
npm run preview    # serve the build (it must be served over http; file:// is blocked by Chrome)
```

The **Editor** button (top right) only exists in `npm run dev`. It edits places and settlement parameters and saves them straight into `data/`. A production build contains no editor code.

## Folder layout

```
data/                   all map content (plain JSON/GeoJSON, edit by hand, in the editor, or in geojson.io/QGIS)
  world.json            coordinate system, scale, detail levels, travel speeds  ← read this first
  places.geojson        capitals, cities, districts, farms, points of interest (Point)
  settlements.json      procedural city parameters (seed, radii, arteries) per settlement
  generated/            baked procedural geometry, one file per settlement (do not edit by hand)
  land / provinces / borders / forests / mountains / ridges / lakes / rivers / roads / labels .geojson
  terrain.png + .json   400x592 terrain-class grid for cross-country routing
reference/              the original drawing (all data is aligned to kelnara-original-straightened.png)
src/
  world/                data loading, types, coordinates, place categories (icons + colours)
  map/                  MapLibre style, controller, icons, procedural/ (city generator + baking)
  search/               Fuse.js index and category chips
  routing/              road (Dijkstra) and cross-country (A*) journey planner
  components/           Google-Maps-style UI (search, side panel, details, directions, controls)
  components/ui/        shadcn-vue components
  editor/               dev-only editor panel
tools/bake.ts           `npm run bake`
vite.config.ts          .geojson loader, dev-only save/bake endpoints, single-file build
legacy/viewer/          the original plain-JS viewer, kept for reference
```

## Procedural cities and baking

`data/settlements.json` gives a settlement a seed, a city radius, a farmland radius, an old-town (walled) radius and its main roads. `src/map/procedural/city.ts` turns that into wards, street grids, blocks, buildings, walls, fields, orchards, pasture and farmsteads, avoiding sea, lakes and forests. Generation is seeded (no `Math.random`). The output is also **baked** to `data/generated/<id>.json`, and builds always render the baked file, so later generator changes can never alter a published map. In dev, a settlement whose parameters or centre changed since its last bake shows a live preview; the editor's **Bake** button (or `npm run bake`) saves it.

Named things (districts, farms, the castle) are ordinary places in `places.geojson` with `parent` set to the city.

## Coordinate system (important)

The data uses **fake longitude/latitude**, so MapLibre, Leaflet, turf, geojson.io etc. all work unchanged:

- 1 pixel of `reference/kelnara-original-straightened.png` = **0.001°**
- `lng = (x - 800) * 0.001`, `lat = (1185 - y) * 0.001`
- The world fits within roughly ±0.8° × ±1.19° around 0,0, where map distortion is negligible.

**Distances:** the drawing's scale bar gives **3.977 km per pixel** (= 3977 km per degree). Any "real-earth" distance function (turf.length, MapLibre's scale bar) is wrong for this world: multiply its km by **35.73** (`world_km_per_real_km` in world.json). Every road already has a `length_km` in world km.

> By the drawn scale (1" = 275 km) Kelnara is about 6,400 km wide, and Olympus to Moonlit Citadel is about 4,000 km, or 100+ days on foot. If that's bigger than you intended, change `km_per_px` in world.json and all travel times follow.

## Detail levels (the "Google Maps" zoom behaviour)

Every point and road has a `minzoom` that is a **detail level 0–4**. Map zoom = `8 + level` (`base_zoom` in world.json).

| level | map zoom | shows |
|---|---|---|
| 0 | 8 | land, sea, mountains, borders, capitals, highways, province + sea names |
| 1 | 9 | forests, rivers, cities, roads, region names |
| 2 | 10 | points of interest, trails |
| 3 | 11 | towns, villages *(add your own)* |
| 4 | 12 | caves, ruins |
| 5–9 | 13–17 | city scale: arteries, districts, farms, streets, blocks, buildings |

Levels 5 and up are city scale (districts, farms, generated streets and buildings); see `world.json`. The app applies levels with a zoom filter on the place layers.

## Feature properties

**places.geojson**
```json
{ "id": "place-olympus", "name": "Olympus", "rank": "capital|city|town|village|district|farm|poi",
  "kind": "capital|city|mine|landmark|watchtower|shrine|castle|farm|orchard|mill|...", "province": "Vaelthorn",
  "minzoom": 0, "description": "", "history": "", "aliases": [], "tags": [], "parent": "place-id (optional)", "note": "optional" }
```
**roads.geojson**: `rank` (highway | road | trail), `from`, `to` (place names), `length_km`, `minzoom`, `draft: true`, `through` (cells of forest/mountain crossed).
**labels.geojson**: `name`, `kind` (province | water | region), `minzoom`. Labels are always drawn horizontally.
**provinces / land / forests / mountains / lakes / rivers**: `id`, `name` (null where the drawing doesn't name it), `kind`, plus `area_km2` or `length_km` where useful.

## Journey planner (src/routing)

Currently **disabled** (`src/features.ts`) until roads exist and `terrain.png` is regenerated from the re-traced coastline.


- **Follow roads:** Dijkstra over the road graph (place → place edges, weight = `length_km`).
- **Cross country:** A* over `terrain.png`. Roads are burned into the grid as cheap cells, so it mixes roads and open ground. Cost multipliers are in `world.json → travel.terrain_cost_multiplier`: plains 1, road 0.8, forest 1.7, mountains 6, river ford 2.5, sea/lake impassable.
- Time = effective km ÷ km/day (foot 39, horse 60, cart 30). The result shows a breakdown (km on road, forest, mountains…).

Ideas for later: mountain passes (cheap cells cut through ranges), sea routes between ports, terrain-specific speeds per travel mode, waypoints.

## Caveats / things to fix

- **There are no roads yet.** The traced draft roads were removed; `roads.geojson` is an empty collection until roads are drawn in the editor.
- **Land, lakes and rivers were re-traced** from the drawing at 1 px (inlets, the Emerald Citadel's lake peninsula, river source ponds). All rivers connect to a lake, a pond, the sea or another river.
- **The Emerald Citadel** sits at the tip of a peninsula in its lake and is a capital.
- **Nine cities are "Unnamed city N"**: the drawing had dots without readable names. Each has a `note` saying where it is.
- **Province names** are inferred from which side of the dashed border each label sat on. The south-east lands (Caldrith, eastern peninsula) have no drawn border, so they're currently part of Orrenfall. The north-west islands belong to no province.
- Lakes, rivers, forests and most mountain ranges are unnamed (`name: null`). Emerald Woods and the Steel Spine Mountains are named.
- Heimdall is only a label, because the drawing shows it as a pencil sketch with no land.
- The shapes are traced from a phone photo, so expect some small wobbles. A higher-resolution scan could be re-traced.

## Editing the data

- **geojson.io:** drag a .geojson file in, edit shapes and properties, and save. The fake coordinates sit off the coast of Africa on its basemap, which doesn't matter.
- **QGIS** (free desktop GIS) for heavier editing; load the files as vector layers.
- **In this app:** `npm run dev` → Editor (points now; polygon/line editing is planned, see `.claude/PLAN.md`).
