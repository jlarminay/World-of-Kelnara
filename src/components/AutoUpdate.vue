<script setup lang="ts">
// Keeps the installed app up to date with no maintenance and no prompts:
// checks for a new version every 30 minutes and whenever the app comes back to the foreground;
// the new service worker takes over at once (skipWaiting + clientsClaim in vite.config.ts) and
// the page reloads into it.
import { useRegisterSW } from 'virtual:pwa-register/vue'

const CHECK_EVERY_MS = 30 * 60 * 1000

if ('serviceWorker' in navigator) {
  // reload when a *new* version takes control (not on the very first install)
  let hadController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) {
      reloading = true
      location.reload()
    }
    hadController = true
  })
}

useRegisterSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => !reg.installing && navigator.onLine && reg.update().catch(() => {})
    setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  },
})
</script>

<template>
  <span hidden />
</template>
