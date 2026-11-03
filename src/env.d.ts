/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

declare module '*.geojson' {
  const value: import('geojson').FeatureCollection
  export default value
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
