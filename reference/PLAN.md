# Kelnara Maps: plan

A Google-Maps-style map of the Kelnara D&D world. The world grows over time: a few areas get hand-written detail, and procedural generation can make the rest feel huge (sprawling cities, miles of farmland). All content is edited by hand in `data/`. The deployed site is a read-only static build on GitHub Pages that also installs as an offline app.

Campaign reference: the players are in [PARTY.md](PARTY.md) and the session notes in [sessions/](sessions/).

---

## 1. Principles (the rules everything else follows)

1. **Data is plain JSON/GeoJSON in `data/`, versioned in git.** No database and no in-app editor. Edit the files directly, or in geojson.io / QGIS.
2. **Every map is identical.** Nothing random reaches a player. Procedural content uses a seeded PRNG *and* is **baked** to `data/generated/*.json`. Builds render the baked file, never a fresh generation. Re-rolling something is a deliberate edit (change the seed, bake, commit).
3. **Hand-made beats generated.** Generated geometry is backdrop: streets, blocks, fields. Anything with a name, history or game meaning is a hand-placed feature in `places.geojson` / `areas.geojson` that sits on top.
4. **Read-only in production.** The site only shows data; nothing in it writes files.
5. **It looks like Google Maps, light mode only.** The palette, label hierarchy, panel layout, pins, chips and controls all copy Google's conventions. When in doubt, open Google Maps and match it.
6. **Lore matches the session notes.** Distances and travel times are tuned to what happened at the table (see §2, "Travel times"). Names use the official spellings in `PARTY.md`.

---

## 2. What exists now

| Area | State |
|---|---|
| Stack | Vite 8 + Vue 3 + TS + Tailwind v4 + shadcn-vue (hand-added: button, input, textarea, label, badge, separator, scroll-area) + MapLibre GL 6 |
| Build & deploy | `npm run build` gives a small static site in `dist/` (~0.8 MB compressed first load), split into cacheable chunks (MapLibre, vendor, world data, places) so editing lore only changes the small places file. Every push to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`). **PWA:** installs as an app and works offline; copies update themselves (`vite-plugin-pwa`, `AutoUpdate.vue`, install banner) |
| Map style | Google-like palette and road hierarchy; labels via bundled Noto Sans glyph PBFs through a custom `glyphs://` protocol; canvas-drawn POI pins from `lucide` icons |
| World data | Land, lakes, rivers and ponds re-traced from the drawing at 1 px; forests, mountains and ridges clipped to the coast; provinces rebuilt; outlines Chaikin-smoothed. Emerald Woods was extended up the Cerulean Lake's east shore to the Emerald Citadel's fields (to match the sessions) |
| Roads | Hand-placed: the highway from the Emerald Citadel's Main Gate to the Northern Outpost (649 km), the farm road through the city's fields to the woods, the commune trail along the lake shore, the guides' shortcut through the woods, and trails to the Gnoll Cave and Roslow's farm. The in-city street from the centre to the gate is tagged `city` |
| Places | `places.geojson` with `rank`, `kind`, `minzoom` (detail level), `description`, `history`, `details`, `when`, `aliases`, `tags`, `parent` (chains: POI → district → city), `area` (boundary polygon in `areas.geojson`) and `gates` |
| Emerald Citadel | An area, not just a point: urban boundary, wall, farmland, **two districts** (The Heights, Lower City, each with a polygon), the **Main Gate** (where distances are measured from), the Grand Citadel and Golgamutt's House. Other cities are still plain points until their layout is known |
| Procedural city | **Dormant:** `data/settlements.json` is empty, so no generated streets are shown. The code (`src/map/procedural/city.ts`) is kept for the city phase: Voronoi wards, street grids, blocks, buildings, walled old town, named arteries, farmland ring. Avoids sea, lakes and forests |
| Baking | `npm run bake` writes `data/generated/<settlement>.json` (compact delta-encoded integer metres). In dev, unbaked or changed settlements show a live preview |
| UI | Search with suggestions (Fuse.js over places, aliases, lore, named features), category chips, results list, place panel (Directions button by the name, "Part of" chain, "In …" children list, details), feature panel (lakes, forests…), dashed outline of the selected city/district, right-click / long-press menu, distance measuring, zoom buttons, scale bar, "Drawing" toggle (the original map), URL hash `#lng,lat,zoomz/place-id`. Phones get a Google-style bottom sheet |
| Directions | Always by road (`src/routing/roads.ts`): a graph built from road geometry with junctions, off-road walks of at most 40 km at each end, walled cities left/entered by their gates, places inside a city start from their own spot. Walking / horse / cart, a step list, and a time table per ground type. Type-to-filter start/destination fields; "Directions from/to here" on the map. **Drag the route line** to add a stop and take a different road; drag/click stops to move/remove them. No road within 40 km → "No path found" plus a straight-line estimate that opens in the measure tool |
| Legacy | The original plain-JS viewer is kept at `legacy/viewer/` |

### Travel times (calibrated to the sessions)

Speeds: walking 46 km/day on roads, 33 on trails, 39 off road (the legend's "1 day = 39 km", which is D&D's normal pace of 24 miles). Horse (60 off road) and cart (30) scale by the same ratios; they are house rules, since D&D gives no faster daily pace for mounts.

| Trip | Map | Sessions |
|---|---|---|
| Main Gate → Northern Outpost | 649 km, 14.1 days | "2 weeks to get there" |
| Green Rock Farm → black-robed caravan | 138 km, 3.0 days | "three days later" |
| Main Gate → Roslow's Radish Farm | 111 km, 2.5 days | "a few days" |
| Commune → edge of Emerald Woods (shore trail) | 231 km, 7.0 days | 7 days out of the forest, then about a day to the city |
| Main Gate → Commune (guides' shortcut) | 283 km, 7.9 days | "we travel 7 days back" with guides |

### Zoom and detail levels

Map zoom = 8 + detail level. The world is large (~3,977 km per degree; the continent is ~6,400 km across), and the Emerald Citadel is ~60 km across. The map currently stops at level 8 / z16 (`MAX_ZOOM` in `src/world/coords.ts`).

| level | zoom | shows |
|---|---|---|
| 0 | 8 | continent, capitals, highways, province and sea names |
| 1–2 | 9–10 | cities, roads, rivers, POIs, trails |
| 3–4 | 11–12 | towns, villages, caves, ruins, districts, city landmarks; city footprints appear |
| 5 | 13 | city arteries, walls (generated cities) |
| 6 | 14 | major in-city POIs, ward streets |
| 7 | 15 | farms, mills, named buildings; fields, tracks, minor streets |
| 8 | 16 | blocks, buildings |

---

## 3. Decisions

### Settled

- **World scale:** kept (`km_per_px` 3.977). Travel times are tuned to the sessions by moving places, not by rescaling.
- **Hosting:** GitHub Pages, deployed by CI. Must be served over http(s) (`file://` blocks MapLibre's worker).
- **Single file vs split:** split static files plus a PWA cache, so lore edits are a small download.
- **Roads:** hand-placed in `roads.geojson`; the traced drafts were removed.
- **Editor:** dropped (Nov 2026). Edit `data/` directly.
- **Cities as areas:** a city is a place plus an `area` boundary, districts are child places with their own polygons, and `gates` mark where roads leave. Only the Emerald Citadel has this so far.
- **Emerald Citadel naming:** name "Emerald Citadel", alias "The Emerald City"; the castle at the tip is "The Grand Citadel".

### Open (recommendation first)

1. **Capital of what?** The Emerald Citadel, Olympus and the Moonlit Citadel are all drawn as capitals. Capital of Eldravane only, or of a wider realm?
2. **Player vs DM visibility.** Anything in the bundle is readable via devtools. **Rec:** `visibility: 'public' | 'dm'` and `dmNotes` fields, and two builds (`build:players` strips DM-only content). Fog of war ("discovered") is a separate flag (Phase 5).
3. **Horse and cart speeds** (60 / 30 km/day off road) are house rules. Keep, or make a horse walk at the party's pace?
4. **Rich text for lore.** **Rec:** Markdown in the JSON, rendered with `markdown-it` (sanitised), with `[[place-id]]` links between places.
5. **Images per place** (hero art). **Rec:** `data/images/`, converted to small WebP at build.
6. **Label font.** Labels use Noto Sans; the UI uses Roboto. **Rec:** generate Roboto PBFs once with `@maplibre/font-maker`.
7. **Coordinates.** The fake lng/lat (1 px of the drawing = 0.001°) works with every GIS tool. **Rec: keep it.** Never use real-earth distance helpers without the `world_km_per_real_km` factor.

---

## 4. Build phases

### Phase 1: Data foundation

- [x] Git repository and baseline commit.
- [x] Hand-placed roads; Directions turned back on (road-only).
- [ ] **Schema + validation.** Zod schemas for every file plus `npm run validate`: ids unique, `parent` and `area` exist, gate `road`s exist, `minzoom` in range, points on land, kinds known. Run it in CI.
- [ ] **Tests** (vitest): routing (the calibrated trips in §2 stay within ±0.2 days), and bake determinism (bake each settlement in memory and compare with `data/generated/*.json`).
- [ ] Fix the nine "Unnamed city N" entries (names, ranks).
- [ ] Regenerate `data/terrain.png` from the re-traced land/lakes/forests/mountains, if a cross-country mode is wanted again (`routeTerrain` is kept but unused).
- [ ] Optional: `schemaVersion` per file with a small migration runner; rename `minzoom` to `level`.

### Phase 2: In-app editor: DROPPED

Removed in Nov 2026; all edits are made directly in `data/`. A future "dev overlay" could still show detail-level badges or generator outlines.

### Phase 3: Cities

- [x] Emerald Citadel as an area: boundary, districts, gate, landmarks, outlined on selection.
- [ ] Areas, districts and gates for other cities once their layout is known in the campaign.
- [ ] **Districts drive the generator** when procedural cities return: district style (`grid`, `organic`, `docks`, `noble`, `market`, `temple`) sets block size, density and parks.
- [ ] Generated arteries join the world roads at the gates; a market square at the centre.
- [ ] Seeded street names, building variety, ribbon villages along roads, footprints for towns and villages.
- [ ] Generator in a Web Worker; gzip the baked payload.

### Phase 4: Google Maps polish

- [x] Right-click / long-press menu: Directions from/to here, Measure distance, Copy coordinates.
- [x] Distance measuring in world km, with time by ground type.
- [x] Mobile bottom sheet.
- [x] Directions: stops by dragging the route; type-to-filter fields; step list and time table.
- [ ] **Alternative routes** (grey lines you can click to switch, e.g. shore trail vs guides' shortcut).
- [ ] Add stops by dragging the route on touch screens (markers can already be moved on phones).
- [ ] "What's here?" in the right-click menu.
- [ ] Hover card on pins; pin highlight for category chips.
- [ ] Search: recent searches, "near the map view" ranking, keyboard navigation in the results list.
- [ ] Sea routes between ports; a travel calendar ("arrive on day 23 of Harvestmoon").
- [ ] Terrain hillshade; Roboto glyphs; curved province labels.
- [ ] Hero images in the details panel.
- [ ] Accessibility: focus rings, aria labels, keyboard map panning.

### Phase 5: Campaign features

- [ ] DM/player builds (open decision 2).
- [ ] Fog of war: a `discovered` flag on places and areas.
- [ ] **Party travel log**: a timeline of where the party was each session, drawn from `reference/sessions/` (commune → citadel → cave → citadel → north road).
- [ ] Per-session "what's new" highlights.
- [ ] Heimdall and other new lands as the world expands (widen `maxBounds` in `controller.ts`).
- [ ] Places still to add from the notes: the Green Rock ruins next to Jimothy's farm (a `ruin` pin), and optionally the temple of Freya, the grand library and the barracks as named spots in the Emerald Citadel.

### Phase 6: Deploy

- [x] GitHub Actions build and deploy to GitHub Pages.
- [x] Favicon and app icons; PWA / offline mode with automatic updates.
- [ ] Run `validate` and tests in CI once they exist.
- [ ] Social preview image (`og:` meta tags).

---

## 5. Tools and libraries

| Purpose | Choice | Notes |
|---|---|---|
| Map rendering | **maplibre-gl 6** | Worker loaded via `?url` and `setWorkerUrl` |
| UI | Vue 3, Tailwind v4, **shadcn-vue** (reka-ui), lucide | `lucide` icon nodes are shared by map pins and UI; horse, cart and directions icons are hand-drawn in `src/components/icons/` |
| Search | **fuse.js** | Fine to a few thousand entries |
| Offline / install | **vite-plugin-pwa** | Workbox precache of the whole site |
| Routing | hand-rolled (`src/routing/`) | Dijkstra over road geometry; A* over `terrain.png` kept for later |
| Validation | **zod** (planned) | For `npm run validate` |
| Tests | **vitest** (planned) | Routing calibration, bake determinism, schema |
| Markdown | **markdown-it** + DOMPurify (planned) | Lore text |
| Geo helpers | hand-rolled in `src/world/geo.ts` | Turf's distances are wrong for this world unless scaled |
| Glyphs | openmaptiles Noto Sans PBFs (bundled) | Could generate Roboto with `@maplibre/font-maker` |
| External editing | geojson.io, QGIS | Files stay standard GeoJSON |

---

## 6. Known issues and risks

- **`file://` doesn't work** (browsers block workers). Use `npm run preview`, `npx serve dist`, or the deployed site.
- **No automated checks yet.** Moving a place or road can silently change the calibrated travel times; re-check the table in §2 after data edits until the routing tests exist.
- **Road ends join other roads only within ~1 km** (`JOIN_DEG` in `src/routing/roads.ts`). A road drawn ending further from its junction becomes a separate, unreachable piece.
- **`terrain.png` predates the re-traced coastline**, so cross-country routing is not offered.
- **Bundle size will grow with every baked city** (~1.6 MB each, cached by the service worker).
- **Generated streets ignore world roads and rivers** (procedural cities are dormant for now).
- **Baking is only as stable as the committed files.** Editing land/lakes/forests near a city does not re-bake it; re-bake deliberately.
- **Glyph range 0–255 only.** Accented Latin is fine; other scripts render blank.
- **Tailwind and MapLibre CSS ordering.** MapLibre's CSS is imported into `layer(base)` so Tailwind utilities win; without that the map container collapses to 0 px.
- **MapLibre 6** is a recent major version; images are added explicitly after `load` (the `styleimagemissing` path didn't work).

---

## 7. Conventions

- **ids** are stable forever (links, URLs and bakes depend on them): `place-<slug>`, `district-<slug>`, `farm-<slug>`, `event-<slug>`, `gate-<city>-<name>`, `area-<slug>` / `city-<slug>` (polygons), `road-` / `path-` / `street-` (roads), `settlement-<slug>`.
- **rank** = importance (`capital|city|town|village|district|farm|poi|event`). **kind** = sub-type that picks the icon (`castle, gate, house, mine, shrine, farm, inn, port, ruin, cave, …`; add new ones in `src/world/categories.ts`).
- **minzoom** = detail level, not map zoom (zoom = 8 + level).
- **parent** links a place to the place it is part of; it can chain (Golgamutt's House → The Heights → Emerald Citadel).
- **area** on a place names its polygon in `areas.geojson`; **gates** list where roads cross a city's boundary.
- **Names** use the official spellings in `reference/PARTY.md`.

## 8. Commands

```bash
npm start          # local app (http://localhost:5173)
npm run bake       # re-bake every settlement into data/generated/ (or: npm run bake -- settlement-id)
npm run build      # typecheck + static site in dist/
npm run preview    # serve dist/ to test the production build
```
