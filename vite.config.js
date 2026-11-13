import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { precacheManifestPlugin } from './scripts/precacheManifest.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precacheManifestPlugin()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
})
