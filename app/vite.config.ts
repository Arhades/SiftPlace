import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable PWA: app shell cached for offline; API responses cached
    // briefly so a flaky connection still shows the last results.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'siftplace-logo.svg'],
      manifest: {
        name: 'SiftPlace — find your place',
        short_name: 'SiftPlace',
        description:
          'Weighted housing search for exchange students: ranked by true monthly cost (rent + commute fare), not rent alone.',
        theme_color: '#ffc107',
        background_color: '#fff8f6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // FX rates change daily — long cache is correct and saves the backend
            urlPattern: /\/rates$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'siftplace-rates',
              expiration: { maxEntries: 4, maxAgeSeconds: 24 * 3600 },
            },
          },
          {
            urlPattern: /\/flood-risk/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'siftplace-flood',
              expiration: { maxEntries: 24, maxAgeSeconds: 3 * 3600 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
