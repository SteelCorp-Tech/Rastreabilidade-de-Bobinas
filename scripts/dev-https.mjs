// Sobe o servidor de desenvolvimento em HTTPS (certificado de teste), para a câmera funcionar num tablet da rede local.
process.env.DEV_HTTPS = '1'
const { createServer } = await import('vite')
const server = await createServer()
await server.listen()
server.printUrls()
