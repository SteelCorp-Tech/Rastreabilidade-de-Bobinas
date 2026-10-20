import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// base './' + HashRouter: o build roda em qualquer subpasta do portal, sem configurar o servidor.
// `npm run dev:https` serve em HTTPS (certificado de teste), para usar a câmera de um tablet na rede local.
const https = process.env.DEV_HTTPS === '1'

export default defineConfig({
  base: './',
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  server: https ? { host: true } : {},
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
