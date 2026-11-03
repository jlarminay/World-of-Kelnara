import { createApp } from 'vue'
import './style.css'
import './state/install' // listen for the browser's install event from the start
import App from './App.vue'

createApp(App).mount('#app')
