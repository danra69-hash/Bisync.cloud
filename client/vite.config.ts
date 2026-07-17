import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Keep proxy target identical to the API listen address in launchSettings / dev.ps1.
// Mixing localhost (IPv6 ::1 on Windows) with 127.0.0.1 causes Vite to return 502 on /api/*.
const API_ORIGIN = 'http://127.0.0.1:5299'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
