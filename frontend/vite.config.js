import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { fileURLToPath, URL } from 'node:url'

// O domínio (regras puras) fica em ../compartilhado/dominio e é importado como '@dominio/...'.
const dominio = fileURLToPath(new URL('../compartilhado/dominio', import.meta.url))

// base './' + HashRouter: o build roda em qualquer subpasta do portal, sem configurar o servidor.
// `npm run dev:https` serve em HTTPS (certificado de teste), para usar a câmera de um tablet na rede local.
const https = process.env.DEV_HTTPS === '1'

export default defineConfig({
  base: './',
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  resolve: { alias: { '@dominio': dominio } },
  // compartilhado/ fica fora da raiz do Vite; sem isto o servidor de desenvolvimento recusa servir os arquivos.
  server: { ...(https ? { host: true } : {}), fs: { allow: ['.', dominio] } },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
