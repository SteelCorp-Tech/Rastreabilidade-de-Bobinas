// Gera docs/manual/manual-rastreabilidade-bobinas.pdf imprimindo docs/manual/index.html com o Edge/Chrome (modo invisível).
// Uso: node scripts/manual/pdf.mjs    (rode antes: node scripts/manual/build.mjs)
import { spawnSync } from 'node:child_process'
import { existsSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.resolve(here, '..', '..', '..', 'docs', 'manual')
const EDGE = process.env.EDGE ?? ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync)
if (!EDGE) throw new Error('Edge/Chrome não encontrado. Informe o caminho em EDGE.')

const out = path.join(DOCS, 'manual-rastreabilidade-bobinas.pdf')
const profile = mkdtempSync(path.join(process.env.MANUAL_TMP ?? os.tmpdir(), 'bobinas-manual-pdf-'))
const r = spawnSync(
  EDGE,
  ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, '--no-pdf-header-footer', '--virtual-time-budget=30000', `--print-to-pdf=${out}`, pathToFileURL(path.join(DOCS, 'index.html')).href],
  { stdio: 'ignore', timeout: 180000 },
)
try { rmSync(profile, { recursive: true, force: true }) } catch { /* perfil temporário */ }
if (!existsSync(out)) throw new Error('O PDF não foi gerado (código ' + r.status + ').')
console.log(`PDF: ${out} (${(statSync(out).size / 1024 / 1024).toFixed(1)} MB)`)
