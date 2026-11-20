import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    // '.e2b.app' is the sandbox preview domain (any subdomain), so the live preview loads.
    allowedHosts: ['props-swipe-chaffing.ngrok-free.dev', '.e2b.app'],
  },
  build: {
    rollupOptions: {
      output: {
        // Keep large optional features out of the app's entry chunk.
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (id.includes('/pdfjs-dist/')) return 'pdf-viewer';
          if (id.includes('/jspdf/')) return 'pdf-export';
          if (/\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion';
          if (/\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          // Charts — only used by AnalyticsPage + LecturerReportsPage
          if (/\/recharts\//.test(id)) return 'BarChart';
          // Form validation — only needed on form-heavy pages
          if (/\/(zod|@hookform|react-hook-form)\//.test(id)) return 'forms';
          // Date utilities
          if (/\/date-fns\//.test(id)) return 'date-fns';
          // QR code generation + scanning
          if (/\/(qrcode|html5-qrcode)\//.test(id)) return 'qr-scanner';
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { importScripts: ['/push-events.js'] },
      includeAssets: ['favicon.ico', 'aces-logo.png'],
      manifest: {
        name: 'Admin Pack',
        short_name: 'Admin Pack',
        description: 'Department administration and student portal',
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
});
