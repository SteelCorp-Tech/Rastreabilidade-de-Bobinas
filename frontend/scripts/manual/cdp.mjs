// Cliente mínimo do protocolo de depuração do Edge/Chrome (sem dependências) para gerar os prints do manual.
// Abre um navegador invisível com perfil temporário: não toca no seu navegador nem nos seus dados.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch({ edge, port = 9333, width = 1280, height = 800, scale = 1.35, tmp = os.tmpdir() }) {
  try {
    await fetch(`http://127.0.0.1:${port}/json/version`)
    throw new Error(`A porta ${port} já está em uso por outro navegador de depuração. Feche-o antes de gerar o manual.`)
  } catch (e) {
    if (e.message.startsWith('A porta')) throw e // livre: segue
  }
  const profile = path.join(tmp, `bobinas-manual-profile-${Date.now()}`)
  mkdirSync(profile, { recursive: true })
  const proc = spawn(
    edge,
    [
      '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
      '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--lang=pt-BR', `--window-size=${width},${height}`, 'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let targets
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      if (targets.some((t) => t.type === 'page')) break
    } catch {
      // ainda subindo
    }
    await sleep(250)
  }
  const target = targets?.find((t) => t.type === 'page')
  if (!target) throw new Error('Não consegui conectar ao navegador.')

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  const waiters = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result)
    } else if (msg.method) {
      for (const w of [...waiters]) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.res(msg.params) }
    }
  }
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id
    pending.set(i, { res, rej })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  const once = (method) => new Promise((res) => waiters.push({ method, res }))

  await send('Page.enable')
  await send('Runtime.enable')
  const setViewport = (w, h, dpr = scale) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false })
  await setViewport(width, height)

  const page = {
    send,
    setViewport,
    async inject(source) { await send('Page.addScriptToEvaluateOnNewDocument', { source }) },
    async goto(url) { const p = once('Page.loadEventFired'); await send('Page.navigate', { url }); await p },
    async reload() { const p = once('Page.loadEventFired'); await send('Page.reload', { ignoreCache: true }); await p },
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    },
    async emulateMedia(media) { await send('Emulation.setEmulatedMedia', { media }) },
    async screenshot(file, quality = 80) {
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality, fromSurface: true })
      writeFileSync(file, Buffer.from(r.data, 'base64'))
    },
    async close() {
      try { ws.close() } catch { /* já fechado */ }
      // encerra o navegador e os processos filhos (no Windows, kill() sozinho deixa processos abertos)
      if (process.platform === 'win32') {
        // o Edge pode se reparentar: encerra tudo que usa a nossa pasta de perfil temporária
        const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${path.basename(profile)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
        spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' })
      } else proc.kill()
      await sleep(1500)
      try { rmSync(profile, { recursive: true, force: true }) } catch { /* perfil temporário */ }
    },
  }
  return page
}
