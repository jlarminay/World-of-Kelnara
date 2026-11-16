import { createApp } from 'vue'
import './style.css'
import './state/install' // listen for the browser's install event from the start
import App from './App.vue'

// Installed on Android (opened from the home screen): see .android-app in style.css.
const androidApp = /Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches
document.documentElement.classList.toggle('android-app', androidApp)

createApp(App).mount('#app')
