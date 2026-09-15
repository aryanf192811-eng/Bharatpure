import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      devOptions: { enabled: true },
      manifest: {
        name: 'BharatPure',
        short_name: 'BharatPure',
        description: "India's farm-to-market trust network",
        theme_color: '#1B4332',
        background_color: '#1B4332',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Path-matched (not origin-anchored) so this works against localhost in dev and the
        // real API origin in production without hardcoding a domain per BHARATPURE-UI.md's spec.
        runtimeCaching: [
          {
            // Auth must never serve stale/cached responses -- always network.
            urlPattern: /\/api\/auth\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/api\/listings/,
            handler: 'NetworkFirst',
            options: { cacheName: 'listings-cache', expiration: { maxAgeSeconds: 300 } },
          },
          {
            // Provenance data is immutable once written -- cache forever, matches the offline-
            // first rule for BIR/QR scan results.
            urlPattern: /\/api\/qr\/scan/,
            handler: 'CacheFirst',
            options: { cacheName: 'bir-cache', expiration: { maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
