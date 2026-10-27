// Monta docs/manual/index.html a partir de scripts/manual/content.mjs e docs/manual/legend.json.
// Depois, para gerar o PDF:  node scripts/manual/pdf.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { blocks, meta } from './content.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.resolve(here, '..', '..', '..', 'docs', 'manual')
const legend = JSON.parse(readFileSync(path.join(DOCS, 'legend.json'), 'utf8'))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

let h2n = 0, h3n = 0, figN = 0
const toc = []
const out = []
const missingLegend = []

function render(b) {
  switch (b.t) {
    case 'h2': {
      h2n++; h3n = 0
      const id = `c${h2n}`
      toc.push({ level: 2, id, label: `${h2n}. ${b.text}` })
      return `<h2 id="${id}"><span class="num">${h2n}</span>${b.text}</h2>${b.who ? `<p class="who">Quem usa: ${b.who.map((w) => `<span>${w}</span>`).join('')}</p>` : ''}`
    }
    case 'h3': {
      h3n++
      const id = `c${h2n}-${h3n}`
      toc.push({ level: 3, id, label: `${h2n}.${h3n} ${b.text}` })
      return `<h3 id="${id}">${h2n}.${h3n} ${b.text}</h3>`
    }
    case 'p': return `<p>${b.html}</p>`
    case 'ul': return `<ul>${b.items.map((i) => `<li>${i}</li>`).join('')}</ul>`
    case 'ol': return `<ol class="steps">${b.items.map((i) => `<li>${i}</li>`).join('')}</ol>`
    case 'note': return `<div class="box note"><b>Nota.</b> ${b.html}</div>`
    case 'tip': return `<div class="box tip"><b>Dica.</b> ${b.html}</div>`
    case 'warn': return `<div class="box warn"><b>Atenção.</b> ${b.html}</div>`
    case 'fig': {
      figN++
      const items = legend[b.name]
      if (!items) missingLegend.push(b.name)
      return `<figure id="f${figN}"><img src="img/${b.name}.jpg" alt="${esc(b.title)}"><figcaption><b>Figura ${figN}.</b> ${b.title}</figcaption>${
        items ? `<ol class="legend">${items.map((t, i) => `<li><i>${i + 1}</i>${t}</li>`).join('')}</ol>` : ''
      }</figure>`
    }
    case 'table': return `<table class="t"><thead><tr>${b.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    case 'flow': return `<div class="flow">${b.steps.map((s, i) => `<div class="fstep"><b>${s[0]}</b><span>${s[1]}</span></div>${i < b.steps.length - 1 ? '<i class="farrow">→</i>' : ''}`).join('')}</div>`
    case 'html': return b.html
    default: throw new Error('bloco desconhecido: ' + b.t)
  }
}
for (const b of blocks) out.push(render(b))
if (missingLegend.length) console.warn('Sem legenda no legend.json:', missingLegend.join(', '))

const css = readFileSync(path.join(here, 'manual.css'), 'utf8')
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<style>${css}</style>
</head>
<body>
<section class="cover">
  <img class="logo" src="assets/logo.png" alt="Grupo SteelCorp">
  <div class="cover-eyebrow">${esc(meta.eyebrow)}</div>
  <h1>${esc(meta.title)}</h1>
  <p class="sub">${esc(meta.subtitle)}</p>
  <div class="cover-meta"><span>${esc(meta.version)}</span><span>${esc(meta.date)}</span></div>
</section>
<nav class="toc">
  <h2 class="toc-title">Índice</h2>
  <ul>${toc.map((t) => `<li class="l${t.level}"><a href="#${t.id}">${t.label}</a></li>`).join('')}</ul>
</nav>
<main>
${out.join('\n')}
</main>
</body>
</html>`
writeFileSync(path.join(DOCS, 'index.html'), html)
console.log(`Manual: ${h2n} capítulos, ${figN} figuras -> docs/manual/index.html`)
