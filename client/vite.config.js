import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },

    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
})