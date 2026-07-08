import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    allowedHosts: ['props-swipe-chaffing.ngrok-free.dev'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'aces-logo.png'],
      manifest: {
        name: 'Aces Zone',
        short_name: 'Aces Zone',
        description: 'Association of Computer Engineering Students (ACES) — Uniuyo Chapter',
        theme_color: '#0066CC',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: '/aces-logo.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
