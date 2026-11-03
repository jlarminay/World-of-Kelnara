<script setup lang="ts">
// Local-only editor (npm run dev). Edits the in-memory store, then writes the JSON files in data/
// through the dev server's /__editor endpoints. Never included in a production build.
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type { MapMouseEvent } from 'maplibre-gl'
import { MousePointer2, Plus, Save, Trash2, Pencil, X, Hammer } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { mapRef, placeById, selectPlace, store } from '@/state/store'
import { KINDS } from '@/world/categories'
import { RANKS, type Place } from '@/world/types'
import { layers } from '@/world/data'
import { bakeStatus } from '@/map/controller'
import { zoomToLevel } from '@/world/coords'

const ed = store.editor
const place = computed(() => (store.selection?.type === 'place' ? placeById.value.get(store.selection.id) : undefined))
const provinces = layers.provinces.features.map((f) => f.properties?.name as string)
const parents = computed(() => store.places.features.filter((f) => ['capital', 'city', 'town', 'village'].includes(f.properties.rank)))
const settlement = computed(() => place.value && store.settlements.find((s) => s.placeId === place.value!.properties.id))

watch(() => [store.places, store.settlements], () => (ed.dirty = true), { deep: true })

function slug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'place'
  let id = `place-${base}`
  for (let i = 2; placeById.value.has(id); i++) id = `place-${base}-${i}`
  return id
}

function onMapClick(e: MapMouseEvent) {
  if (!ed.enabled || ed.tool !== 'add') return
  const level = Math.max(0, zoomToLevel(e.target.getZoom()) - 1)
  const f: Place = {
    type: 'Feature',
    properties: { id: slug('new place'), name: 'New place', rank: 'poi', kind: 'landmark', province: null, minzoom: level, description: '', history: '' },
    geometry: { type: 'Point', coordinates: [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)] },
  }
  store.places.features.push(f)
  selectPlace(f.properties.id)
  ed.tool = 'select'
}
onMounted(() => watch(mapRef, (m) => m?.on('click', onMapClick), { immediate: true }))
onBeforeUnmount(() => mapRef.value?.off('click', onMapClick))

function remove() {
  if (!place.value || !confirm(`Delete “${place.value.properties.name}”?`)) return
  store.places.features = store.places.features.filter((f) => f !== place.value)
  store.selection = null
  store.panel = 'none'
}

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
async function save() {
  ed.status = 'Saving…'
  try {
    await post('/__editor/save?file=places.geojson', store.places)
    await post('/__editor/save?file=settlements.json', store.settlements)
    ed.dirty = false
    ed.status = `Saved ${new Date().toLocaleTimeString()}`
  } catch (e) {
    ed.status = `Save failed: ${e}`
  }
}
async function bakeCity(id: string) {
  await save()
  ed.status = 'Baking…'
  try {
    await post(`/__editor/bake?id=${encodeURIComponent(id)}`)
    location.reload() // pick up the new file from data/generated
  } catch (e) {
    ed.status = `Bake failed: ${e}`
  }
}
// Fade the original drawing over the map to check the trace against it.
const overlay = computed({
  get: () => (store.baseLayer === 'original' ? Math.round(store.drawingOpacity * 100) : 0),
  set: (v: number) => {
    store.baseLayer = v > 0 ? 'original' : 'map'
    store.drawingOpacity = v > 0 ? v / 100 : 1
  },
})
watch(() => ed.enabled, (on) => !on && store.drawingOpacity < 1 && (overlay.value = 0))
const tags = computed({
  get: () => place.value?.properties.tags?.join(', ') ?? '',
  set: (v: string) => place.value && (place.value.properties.tags = v.split(',').map((t) => t.trim()).filter(Boolean)),
})
const aliases = computed({
  get: () => place.value?.properties.aliases?.join(', ') ?? '',
  set: (v: string) => place.value && (place.value.properties.aliases = v.split(',').map((t) => t.trim()).filter(Boolean)),
})
</script>

<template>
  <div class="absolute top-3 right-3 z-30 flex flex-col items-end gap-2">
    <div class="flex items-center gap-1 rounded-full bg-white p-1 shadow-gm">
      <Button :variant="ed.enabled ? 'default' : 'ghost'" size="sm" class="rounded-full" @click="ed.enabled = !ed.enabled">
        <Pencil /> Editor
      </Button>
      <template v-if="ed.enabled">
        <Button :variant="ed.tool === 'select' ? 'secondary' : 'ghost'" size="icon-sm" class="rounded-full" title="Select / drag" @click="ed.tool = 'select'"><MousePointer2 /></Button>
        <Button :variant="ed.tool === 'add' ? 'secondary' : 'ghost'" size="icon-sm" class="rounded-full" title="Add place (click the map)" @click="ed.tool = 'add'"><Plus /></Button>
        <Button variant="ghost" size="sm" class="rounded-full" :disabled="!ed.dirty" @click="save"><Save /> Save</Button>
      </template>
    </div>
    <label v-if="ed.enabled" class="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs shadow-gm">
      Drawing overlay
      <input v-model.number="overlay" type="range" min="0" max="100" step="5" class="w-28 accent-primary">
      <span class="w-8 text-right tabular-nums">{{ overlay }}%</span>
    </label>
    <p v-if="ed.enabled && (ed.status || ed.tool === 'add')" class="rounded-full bg-[#202124] px-3 py-1 text-xs text-white">
      {{ ed.tool === 'add' ? 'Click the map to add a place' : ed.status }}
    </p>

    <div v-if="ed.enabled && place" class="max-h-[calc(100vh-120px)] w-80 overflow-y-auto rounded-xl bg-white p-4 shadow-gm">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-medium">Edit place</h3>
        <button class="text-muted-foreground" @click="store.selection = null"><X class="size-4" /></button>
      </div>
      <div class="grid gap-3">
        <div class="grid gap-1.5"><Label>Name</Label><Input v-model="place.properties.name" /></div>
        <div class="grid grid-cols-2 gap-2">
          <div class="grid gap-1.5">
            <Label>Rank</Label>
            <select v-model="place.properties.rank" class="h-9 rounded-md border px-2 text-sm">
              <option v-for="r in RANKS" :key="r">{{ r }}</option>
            </select>
          </div>
          <div class="grid gap-1.5">
            <Label>Kind</Label>
            <Input v-model="place.properties.kind" list="kinds" />
            <datalist id="kinds"><option v-for="k in Object.keys(KINDS)" :key="k" :value="k" /></datalist>
          </div>
          <div class="grid gap-1.5">
            <Label>Detail level</Label>
            <Input v-model.number="place.properties.minzoom" type="number" min="0" max="8" />
          </div>
          <div class="grid gap-1.5">
            <Label>Province</Label>
            <select v-model="place.properties.province" class="h-9 rounded-md border px-2 text-sm">
              <option :value="null">—</option>
              <option v-for="p in provinces" :key="p">{{ p }}</option>
            </select>
          </div>
        </div>
        <div class="grid gap-1.5">
          <Label>Part of</Label>
          <select v-model="place.properties.parent" class="h-9 rounded-md border px-2 text-sm">
            <option :value="undefined">—</option>
            <option v-for="p in parents" :key="p.properties.id" :value="p.properties.id">{{ p.properties.name }}</option>
          </select>
        </div>
        <div class="grid gap-1.5"><Label>Also known as (comma separated)</Label><Input v-model="aliases" /></div>
        <div class="grid gap-1.5"><Label>Description</Label><Textarea v-model="place.properties.description" rows="2" /></div>
        <div class="grid gap-1.5"><Label>History</Label><Textarea v-model="place.properties.history" rows="4" /></div>
        <div class="grid gap-1.5"><Label>Details (blank line between paragraphs)</Label><Textarea v-model="place.properties.details" rows="8" /></div>
        <div class="grid gap-1.5"><Label>Tags (comma separated)</Label><Input v-model="tags" /></div>
        <p class="text-xs text-muted-foreground">id: {{ place.properties.id }} · drag the red pin to move</p>

        <template v-if="settlement">
          <Separator />
          <h3 class="text-sm font-medium">Generated city</h3>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-1.5"><Label>Seed</Label><Input v-model.number="settlement.seed" type="number" /></div>
            <div class="grid gap-1.5"><Label>Arteries</Label><Input v-model.number="settlement.arteries" type="number" min="0" max="12" /></div>
            <div class="grid gap-1.5"><Label>City radius km</Label><Input v-model.number="settlement.radiusKm" type="number" step="0.5" /></div>
            <div class="grid gap-1.5"><Label>Farmland km</Label><Input v-model.number="settlement.farmlandKm" type="number" step="1" /></div>
            <div class="grid gap-1.5"><Label>Old town km</Label><Input v-model.number="settlement.oldTownKm" type="number" step="0.1" /></div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span :class="bakeStatus(settlement.id) === 'baked' ? 'text-[#188038]' : 'text-[#e37400]'">
              {{ { baked: 'Baked: matches data/generated', stale: 'Changed since last bake (live preview)', none: 'Not baked yet (live preview)' }[bakeStatus(settlement.id)] }}
            </span>
            <Button size="sm" variant="outline" @click="bakeCity(settlement.id)"><Hammer /> Bake</Button>
          </div>
        </template>

        <Separator />
        <Button variant="ghost" size="sm" class="justify-start text-destructive" @click="remove"><Trash2 /> Delete place</Button>
      </div>
    </div>
  </div>
</template>
