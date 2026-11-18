import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { precacheManifestPlugin } from './scripts/precacheManifest.js'
import { robotsPlugin } from './scripts/robotsTxt.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precacheManifestPlugin(), robotsPlugin()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
})
