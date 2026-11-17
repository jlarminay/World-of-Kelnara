import { createApp } from 'vue'
import './style.css'
import './state/install' // listen for the browser's install event from the start
import App from './App.vue'

// Installed on Android (opened from the home screen) and drawn under the system bars: see .android-app in style.css.
// Only when the page really reaches the bottom of the screen; where Android lays the app out between the status
// and navigation bars (the page is shorter than the screen), no strip is needed.
const standaloneAndroid = /Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches
const underBars = () => screen.height - window.innerHeight < 24
const markAndroid = () => document.documentElement.classList.toggle('android-app', standaloneAndroid && underBars())
markAndroid()
window.addEventListener('resize', markAndroid)

createApp(App).mount('#app')
