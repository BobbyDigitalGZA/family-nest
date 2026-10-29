/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // El registro lo hace src/pwa.ts (con la revisión de versión nueva cada hora).
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Family Nest',
        short_name: 'Family Nest',
        description: 'Tareas, calendario y progreso de la familia.',
        lang: 'es',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#ece1d9',
        background_color: '#ece1d9',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only. No runtimeCaching entries: calls to *.supabase.co
        // (REST, RPC, auth, realtime) always go to the network.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['icons/source.svg'],
        navigateFallback: '/index.html',
        // Defensive: these paths belong to Supabase on another origin, so they should never reach the app shell anyway.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/rpc\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
