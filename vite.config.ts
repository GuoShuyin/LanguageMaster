import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: 'src',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api/': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
})
