import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  worker: {
    format: 'es',
  },
  resolve: {
    dedupe: ['@react-three/fiber', 'three'],
    alias: {
      '@zappar/msdf-generator': path.resolve(__dirname, 'node_modules/@zappar/msdf-generator/dist'),
    },
  },
  optimizeDeps: {
    exclude: ['@zappar/msdf-generator'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
})
