import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' + HashRouter: o build roda em qualquer subpasta do portal, sem configurar o servidor.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
