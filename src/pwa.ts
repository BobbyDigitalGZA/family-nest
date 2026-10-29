import { registerSW } from 'virtual:pwa-register'

const HOUR_MS = 60 * 60 * 1000

/**
 * Registra el service worker (autoUpdate: una versión nueva se activa y recarga sola). La pantalla
 * de la casa puede quedar abierta semanas: además de al abrir, busca una versión nueva cada hora.
 */
export function registerPwa(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        if (registration.installing || !navigator.onLine) return
        void registration.update().catch(() => {})
      }, HOUR_MS)
    },
  })
}
