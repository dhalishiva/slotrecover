import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// The React app lives at /app. The marketing site (/, /pricing, /industries/*)
// is pre-rendered to static HTML by scripts/build-site.mjs after the Vite build.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { app: resolve(__dirname, 'app/index.html') },
    },
  },
})
