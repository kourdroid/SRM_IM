import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite config: React, Tailwind v4 and the "@/" alias to src/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre starts its worker with { type: 'module' }: emit workers as ES modules.
  worker: { format: 'es' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
