// Builds the app against the fake Supabase client for screenshots.
// Usage: npx vite build --config scripts/screenshots/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const mock = resolve(here, 'mock-supabase.js')

export default defineConfig({
  root,
  plugins: [
    react(),
    {
      name: 'mock-supabase',
      enforce: 'pre',
      resolveId(source, importer) {
        if (importer && importer.startsWith(resolve(root, 'src')) && /^\.\/supabase(\.js)?$/.test(source)) return mock
      },
    },
  ],
  build: {
    outDir: resolve(root, 'dist-shots'),
    emptyOutDir: true,
    rollupOptions: { input: { app: resolve(root, 'app/index.html') } },
  },
})
