import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Agenda Mentes Brillantes',
        short_name: 'Agenda MB',
        description: 'Agenda del Gimnasio Emocional Mentes Brillantes: sesiones, reuniones y recordatorios.',
        lang: 'es',
        dir: 'ltr',
        theme_color: '#060913',
        background_color: '#060913',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff,woff2}'],
        globIgnores: [
          '**/brand/brand-hero-*.png',
          '**/brand/login-hero.png',
          '**/brand/login-visual.png',
          '**/brand/logo-gemb-gold.png',
          '**/brand/logo-gemb-blue.png',
          '**/brand/app-icon.png'
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/__/, /^\/api/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Imágenes y documentos guardados en Firebase Storage
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'agenda-storage',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Paquetes separados: se descargan en paralelo y el navegador los
        // conserva en caché entre versiones (React y Firebase casi no cambian).
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // Analytics se queda fuera: se carga con import() dinámico después del arranque.
            if (/[\\/]node_modules[\\/](@firebase|firebase)[\\/]analytics/.test(id)) return
            if (/[\\/]node_modules[\\/]@?firebase[\\/]/.test(id)) return 'firebase'
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          }
        }
      }
    }
  },
})
