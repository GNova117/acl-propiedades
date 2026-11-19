import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { precacheManifestPlugin } from './scripts/precacheManifest.js'
import { robotsPlugin } from './scripts/robotsTxt.js'

// https://vite.dev/config/
export default defineConfig({
  // Versión que se manda con cada error del navegador (los primeros 7 del commit que despliega Vercel).
  define: { __RELEASE__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7)) },
  plugins: [react(), precacheManifestPlugin(), robotsPlugin()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
})
