import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/gamma': {
    target: 'https://gamma-api.polymarket.com',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/gamma/, ''),
  },
  '/clob': {
    target: 'https://clob.polymarket.com',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/clob/, ''),
  },
  '/api': {
    target: 'http://127.0.0.1:8001',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/api/, ''),
  },
  '/poly': {
    target: 'https://polymarket.com',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/poly/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
