// Kelnara data viewer — MapLibre GL + plain JS. Serve the kelnara-map folder over http (see README).
const DATA = '../../data/';
const BASE_ZOOM = 8;                 // map zoom for detail level 0 (see data/world.json)
const DEG = 0.001, W0 = 1600, H0 = 2370;
const KM_PER_PX = 688 / 173;
const toPx = ([lng, lat]) => [lng / DEG + W0 / 2, H0 / 2 - lat / DEG];
const toLL = (x, y) => [(x - W0 / 2) * DEG, (H0 / 2 - y) * DEG];
const z = lvl => BASE_ZOOM + lvl;

const LAYERS = ['land', 'provinces', 'forests', 'mountains', 'ridges', 'lakes', 'rivers', 'borders', 'roads', 'places', 'labels'];

(async function main() {
  const [data, world] = await Promise.all([
    Promise.all(LAYERS.map(n => fetch(DATA + n + '.geojson').then(r => r.json()))).then(a => Object.fromEntries(LAYERS.map((n, i) => [n, a[i]]))),
    fetch(DATA + 'world.json').then(r => r.json())
  ]);

  const map = new maplibregl.Map({
    container: 'map',
    style: { version: 8, sources: {}, layers: [{ id: 'sea', type: 'background', paint: { 'background-color': '#c9d6d3' } }] },
    center: [0, 0], zoom: BASE_ZOOM, minZoom: BASE_ZOOM - 0.5, maxZoom: BASE_ZOOM + 5,
    maxBounds: [[-1.4, -1.6], [1.4, 1.6]], attributionControl: false, renderWorldCopies: false
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  map.on('load', async () => {
    const paper = await map.loadImage('paper.png');
    map.addImage('paper', paper.data);
    for (const n of LAYERS) map.addSource(n, { type: 'geojson', data: data[n] });

    const add = l => map.addLayer(l);
    // land
    add({ id: 'coast-glow', type: 'line', source: 'land', paint: { 'line-color': '#5f7f86', 'line-width': ['interpolate', ['linear'], ['zoom'], z(0), 6, z(4), 22], 'line-opacity': 0.18, 'line-blur': 4 } });
    add({ id: 'land', type: 'fill', source: 'land', paint: { 'fill-pattern': 'paper' } });
    add({ id: 'provinces', type: 'fill', source: 'provinces', paint: {
      'fill-color': ['match', ['get', 'name'], 'Vaelthorn', '#c9a96b', 'Eldravane', '#9fb07a', 'Scorched Lands', '#c98a5b', 'Orrenfall', '#a8a0c4', '#cccccc'],
      'fill-opacity': 0.12 } });
    add({ id: 'forests', type: 'fill', source: 'forests', minzoom: z(0) + 0.5, paint: { 'fill-color': '#6f8f4e', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], z(0) + 0.5, 0, z(1), 0.45], 'fill-outline-color': '#4f6b35' } });
    add({ id: 'mountains', type: 'fill', source: 'mountains', paint: { 'fill-color': '#8a7154', 'fill-opacity': 0.3 } });
    add({ id: 'ridges', type: 'line', source: 'ridges', paint: { 'line-color': '#4a3622', 'line-width': ['interpolate', ['linear'], ['zoom'], z(0), 1, z(4), 4], 'line-opacity': 0.8 } });
    add({ id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': '#7fa3b5', 'fill-outline-color': '#4d7488' } });
    add({ id: 'rivers', type: 'line', source: 'rivers', minzoom: z(1) - 0.5, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#5c87a0', 'line-width': ['interpolate', ['linear'], ['zoom'], z(1), 1, z(4), 4] } });
    add({ id: 'coastline', type: 'line', source: 'land', paint: { 'line-color': '#3b2f22', 'line-width': ['interpolate', ['linear'], ['zoom'], z(0), 1.2, z(4), 3] } });
    add({ id: 'borders', type: 'line', source: 'borders', paint: { 'line-color': '#8c2f1f', 'line-width': ['interpolate', ['linear'], ['zoom'], z(0), 1.2, z(4), 3], 'line-dasharray': [4, 3], 'line-opacity': 0.75 } });
    // roads by rank, each appearing at its own detail level
    const roadW = { highway: [1.6, 5], road: [1, 3.5], trail: [0.8, 2] };
    for (const [rank, [w0, w4]] of Object.entries(roadW)) {
      add({ id: 'road-' + rank, type: 'line', source: 'roads', filter: ['==', ['get', 'rank'], rank], minzoom: z({ highway: 0, road: 1, trail: 2 }[rank]),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': rank === 'trail' ? '#8a6d4a' : '#a0522d', 'line-width': ['interpolate', ['linear'], ['zoom'], z(0), w0, z(4), w4],
                 'line-dasharray': rank === 'trail' ? [2, 2] : [1, 0] } });
    }
    add({ id: 'route', type: 'line', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }, layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#c0392b', 'line-width': ['interpolate', ['linear'], ['zoom'], z(0), 3, z(4), 7], 'line-opacity': 0.85 } });

    // ---- HTML labels (no font server needed) with detail-level visibility ----
    const markers = [];
    for (const f of data.places.features) {
      const p = f.properties, el = document.createElement('div');
      el.className = 'place ' + p.rank + (p.note ? ' unnamed' : '');
      el.innerHTML = `<i></i><span>${p.name}</span>`;
      const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(f.geometry.coordinates)
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(`<b>${p.name}</b><br><i>${p.kind}${p.province ? ' · ' + p.province : ''}</i>${p.note ? '<br><small>' + p.note + '</small>' : ''}`));
      markers.push([m, p.minzoom ?? 0]);
    }
    for (const f of data.labels.features) {
      const p = f.properties, el = document.createElement('div');
      el.className = 'lbl ' + p.kind; el.textContent = p.name;
      const m = new maplibregl.Marker({ element: el, rotation: p.rotation || 0, rotationAlignment: 'map' }).setLngLat(f.geometry.coordinates);
      markers.push([m, p.minzoom ?? 0]);
    }
    const refresh = () => {
      const lvl = Math.max(0, Math.floor(map.getZoom() - BASE_ZOOM + 0.25));
      document.getElementById('lvl').textContent = lvl;
      document.getElementById('zm').textContent = map.getZoom().toFixed(1);
      for (const [m, mz] of markers) {
        const show = lvl >= mz;
        if (show && !m._on) { m.addTo(map); m._on = true; } else if (!show && m._on) { m.remove(); m._on = false; }
      }
    };
    map.on('zoom', refresh);
    const bb = data.land.features[0].geometry.coordinates[0].reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [9, 9, -9, -9]);
    map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 30, duration: 0 });
    refresh();

    // ---- journey planner ----
    const names = data.places.features.map(f => f.properties.name).sort();
    for (const id of ['from', 'to']) document.getElementById(id).innerHTML = names.map(n => `<option>${n}</option>`).join('');
    document.getElementById('from').value = 'Olympus'; document.getElementById('to').value = 'Moonlit Citadel';
    const grid = await loadTerrain(world, data.roads);
    document.getElementById('go').onclick = () => {
      const a = document.getElementById('from').value, b = document.getElementById('to').value;
      const mode = document.getElementById('mode').value, how = document.getElementById('how').value;
      const perDay = world.travel.km_per_day[mode];
      const res = how === 'roads' ? routeRoads(data, a, b) : routeTerrain(grid, data, a, b);
      const out = document.getElementById('result');
      if (!res) { out.innerHTML = 'No route found (different island?)'; map.getSource('route').setData({ type: 'FeatureCollection', features: [] }); return; }
      map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: res.coords }, properties: {} });
      const days = res.effKm / perDay;
      out.innerHTML = `<b>${Math.round(res.km)} km</b> · about <b>${days < 1 ? Math.round(days * 24) + ' hours' : days.toFixed(1) + ' days'}</b><br>` +
        (res.breakdown ? Object.entries(res.breakdown).filter(([, v]) => v > 1).map(([k, v]) => `${Math.round(v)} km ${k}`).join(' · ') : (res.via.length ? 'via ' + res.via.join(', ') : 'direct road'));
      const b2 = res.coords.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [9, 9, -9, -9]);
      map.fitBounds([[b2[0], b2[1]], [b2[2], b2[3]]], { padding: 80, maxZoom: z(2) });
    };
  });
})();

// Roads: Dijkstra over the place-to-place road graph
function routeRoads(data, from, to) {
  const adj = {};
  for (const f of data.roads.features) {
    const p = f.properties, km = p.length_km, g = f.geometry.coordinates;
    (adj[p.from] ||= []).push([p.to, km, g]); (adj[p.to] ||= []).push([p.from, km, [...g].reverse()]);
  }
  const dist = { [from]: 0 }, prev = {}, done = new Set();
  while (true) {
    let u = null; for (const k in dist) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
    if (u === null) return null; if (u === to) break; done.add(u);
    for (const [v, km, g] of adj[u] || []) if (!(v in dist) || dist[u] + km < dist[v]) { dist[v] = dist[u] + km; prev[v] = [u, g]; }
  }
  const coords = [], via = []; let cur = to;
  const segs = []; while (cur !== from) { const [u, g] = prev[cur]; segs.unshift(g); if (u !== from) via.unshift(u); cur = u; }
  for (const g of segs) coords.push(...g);
  return { coords, km: dist[to], effKm: dist[to], via };
}

// Terrain grid: A* over data/terrain.png, roads burned in as cheap cells
async function loadTerrain(world, roads) {
  const meta = await fetch(DATA + 'terrain.json').then(r => r.json());
  const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = DATA + 'terrain.png'; });
  const w = meta.width, h = meta.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data, cls = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cls[i] = px[i * 4];
  const road = new Uint8Array(w * h);
  const rc = document.createElement('canvas'); rc.width = w; rc.height = h; const r2 = rc.getContext('2d');
  r2.strokeStyle = '#fff'; r2.lineWidth = 1.5;
  for (const f of roads.features) { r2.beginPath(); f.geometry.coordinates.forEach((c, i) => { const [x, y] = toPx(c); (i ? r2.lineTo : r2.moveTo).call(r2, x / meta.cell_px, y / meta.cell_px); }); r2.stroke(); }
  const rd = r2.getImageData(0, 0, w, h).data; for (let i = 0; i < w * h; i++) road[i] = rd[i * 4 + 3] > 60;
  const tc = world.travel.terrain_cost_multiplier;
  const cost = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = cls[i];
    cost[i] = c === 0 || c === 4 ? Infinity : road[i] ? tc.road : c === 2 ? tc.forest : c === 3 ? tc.mountains : c === 5 ? tc.river_ford : tc.plains;
  }
  return { w, h, cls, cost, road, cell: meta.cell_px, kmCell: meta.km_per_cell };
}
function routeTerrain(G, data, from, to) {
  const get = n => data.places.features.find(f => f.properties.name === n).geometry.coordinates;
  const snap = ll => { let [x, y] = toPx(ll); let c = Math.floor(x / G.cell), r = Math.floor(y / G.cell), best = null;
    for (let d = 0; d < 15 && best === null; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) { const i = (r + dr) * G.w + c + dc; if (best === null && isFinite(G.cost[i])) best = i; }
    return best; };
  const s = snap(get(from)), t = snap(get(to)); if (s == null || t == null) return null;
  const tx = t % G.w, ty = (t / G.w) | 0, minC = 0.8;
  const g = new Float64Array(G.w * G.h).fill(Infinity), came = new Int32Array(G.w * G.h).fill(-1), closed = new Uint8Array(G.w * G.h);
  const heap = [[0, s]]; g[s] = 0;
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const [, u] = pop(); if (closed[u]) continue; closed[u] = 1; if (u === t) break;
    const ux = u % G.w, uy = (u / G.w) | 0;
    for (const [dx, dy, len] of D) {
      const vx = ux + dx, vy = uy + dy; if (vx < 0 || vy < 0 || vx >= G.w || vy >= G.h) continue;
      const v = vy * G.w + vx, c = G.cost[v]; if (!isFinite(c) || closed[v]) continue;
      const ng = g[u] + len * (c + G.cost[u]) / 2;
      if (ng < g[v]) { g[v] = ng; came[v] = u; push(ng + Math.hypot(vx - tx, vy - ty) * minC, v); }
    }
  }
  if (came[t] === -1) return null;
  const cells = []; for (let c = t; c !== -1; c = came[c]) cells.unshift(c);
  const kinds = ['sea', 'plains', 'forest', 'mountains', 'lake', 'river crossings'];
  const breakdown = { 'on road': 0, plains: 0, forest: 0, mountains: 0, 'river crossings': 0 }; let km = 0;
  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1], b = cells[i], step = Math.hypot(a % G.w - b % G.w, ((a / G.w) | 0) - ((b / G.w) | 0)) * G.kmCell;
    km += step; const k = G.road[b] ? 'on road' : kinds[G.cls[b]]; breakdown[k] = (breakdown[k] || 0) + step;
  }
  const coords = cells.filter((_, i) => i % 2 === 0 || i === cells.length - 1).map(c => toLL((c % G.w + 0.5) * G.cell, (((c / G.w) | 0) + 0.5) * G.cell));
  coords[0] = get(from); coords[coords.length - 1] = get(to);
  return { coords, km, effKm: g[t] * G.kmCell, breakdown };
}
