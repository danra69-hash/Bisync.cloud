import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Keep proxy target identical to the API listen address in launchSettings / dev.ps1.
// Mixing localhost (IPv6 ::1 on Windows) with 127.0.0.1 causes Vite to return 502 on /api/*.
const API_ORIGIN = 'http://127.0.0.1:5299'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'bisync-logo.png',
        'bisync-logo-white.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      manifest: {
        name: 'Bisync POS',
        short_name: 'Bisync POS',
        description: 'Bisync Point of Sale — fullscreen station app',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: '/POS?fs=1',
        scope: '/',
        id: '/POS',
        lang: 'en',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Never hijack API / auth / swagger navigations with the SPA shell.
        navigateFallbackDenylist: [
          /^\/api(?:\/|$)/i,
          /^\/swagger(?:\/|$)/i,
          /^\/health(?:\/|$)/i,
        ],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        // Lazy PDF/canvas chunks are optional and change hash every deploy — do not
        // precache them or offline SW will request stale jspdf-*.js after rollout.
        globIgnores: [
          '**/jspdf*.js',
          '**/html2canvas*.js',
          '**/purify.es*.js',
          '**/index.es-*.js',
        ],
        // Main SPA chunk is large; still precache so POS installs offline-capable.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    // 0.0.0.0 so Cursor Cloud Agent port-forward can reach the UI
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
        secure: false,
        timeout: 60_000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.error(`[vite proxy] API unreachable at ${API_ORIGIN}:`, err.message)
            if (res && 'writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                message: `API is not running at ${API_ORIGIN}. Start it with: powershell -ExecutionPolicy Bypass -File .\\scripts\\dev.ps1`,
              }))
            }
          })
        },
      },
    },
  },
})
