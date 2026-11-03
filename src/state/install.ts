// Installing the map as an app, shared by the install banner and the menu.
// The browser's install event can fire very early, so it is captured as soon as this module loads.
import { computed, reactive } from 'vue'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const install = reactive({
  installed: window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
  /** iPhone/iPad Safari: no install prompt, only Share > Add to Home Screen */
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  prompt: null as InstallPromptEvent | null,
})

/** The browser can install it (a prompt is available, or it is iOS with Add to Home Screen). */
export const canInstall = computed(() => !install.installed && (!!install.prompt || install.ios))

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // no browser mini-infobar; the app shows its own banner and menu item
  install.prompt = e as InstallPromptEvent
})
window.addEventListener('appinstalled', () => {
  install.installed = true
  install.prompt = null
})

/** Opens the browser's install dialog. Returns false when there is none (iOS: show the steps instead). */
export async function promptInstall() {
  const e = install.prompt
  if (!e) return false
  await e.prompt()
  if ((await e.userChoice).outcome === 'accepted') install.installed = true
  install.prompt = null // a prompt can only be used once
  return true
}
