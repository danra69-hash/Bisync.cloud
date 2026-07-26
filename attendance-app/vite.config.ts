import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL || 'https://uat.mobileapi.bisync.cloud/'
  const tokenTarget = env.VITE_TOKEN_BASE_URL || 'https://uat.identity.bisync.cloud/'
  const rawBase = env.VITE_BASE_PATH || '/'
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`
  const clockProduct = env.VITE_CLOCK_MODE !== 'false'

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'favicon-48.png',
          'bisync-logo.png',
          'bisync-logo-white.png',
          'apple-touch-icon.png',
        ],
        manifest: {
          name: clockProduct ? 'Bisync Clock' : 'Bisync RMS',
          short_name: clockProduct ? 'Clock' : 'Bisync RMS',
          description: clockProduct
            ? 'Bisync time clock and attendance'
            : 'Bisync RMS ordering and inventory',
          theme_color: '#2c1a0a',
          background_color: '#2c1a0a',
          display: 'standalone',
          display_override: ['standalone', 'fullscreen', 'minimal-ui'],
          orientation: 'portrait-primary',
          start_url: base,
          scope: base,
          id: base,
          lang: 'en',
          categories: ['business', 'productivity'],
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
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    server: {
      port: 5174,
      // Public tunnels rewrite Host — allow any host in dev.
      allowedHosts: true,
      proxy: {
        '/mobile-api': {
          target: apiTarget.replace(/\/$/, ''),
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/mobile-api/, ''),
        },
        '/identity': {
          target: tokenTarget.replace(/\/$/, ''),
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/identity/, ''),
        },
        '/hr-api': {
          target: (
            env.VITE_HR_API_BASE_URL || 'http://127.0.0.1:5299'
          ).replace(/\/$/, ''),
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/hr-api/, ''),
        },
      },
    },
    preview: {
      port: 5174,
      allowedHosts: true,
      proxy: {
        '/mobile-api': {
          target: apiTarget.replace(/\/$/, ''),
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/mobile-api/, ''),
        },
        '/identity': {
          target: tokenTarget.replace(/\/$/, ''),
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/identity/, ''),
        },
        '/hr-api': {
          target: (
            env.VITE_HR_API_BASE_URL || 'http://127.0.0.1:5299'
          ).replace(/\/$/, ''),
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/hr-api/, ''),
        },
      },
    },
  }
})
