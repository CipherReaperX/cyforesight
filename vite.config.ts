import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const frontendPort = Number(process.env.FRONTEND_PORT || 3000)
const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://localhost:9999'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
