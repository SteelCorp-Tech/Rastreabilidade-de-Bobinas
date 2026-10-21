// Gera os prints do manual (docs/manual/img/*.jpg), com setas numeradas, percorrendo o sistema como um usuário.
// Uso: com o app servido (ex.: `npm run build && npm run preview`), rode
//   node scripts/manual/capture.mjs            (BASE_URL padrão http://localhost:4173)
// Variáveis: BASE_URL, EDGE (caminho do msedge/chrome), MANUAL_TMP (pasta temporária do perfil).
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..', '..')
const OUT = path.join(ROOT, 'docs', 'manual', 'img')
const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const EDGE = process.env.EDGE ?? ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync)
if (!EDGE) throw new Error('Edge/Chrome não encontrado. Informe o caminho em EDGE.')
mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT)) if (f.endsWith('.jpg')) unlinkSync(path.join(OUT, f))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const page = await launch({ edge: EDGE, tmp: process.env.MANUAL_TMP })
await page.inject(readFileSync(path.join(here, 'inpage.js'), 'utf8'))

const J = (v) => JSON.stringify(v)
const M = (fn, ...args) => page.eval(`__m.${fn}(${args.map(J).join(',')})`)
const click = (spec) => M('click', spec)
const fillL = (t, v, n = 0) => M('fillLabel', t, v, n)
const fillC = (css, v, n = 0) => M('fillCss', css, v, n)
const scrollTo = (spec, block = 'center') => M('scroll', spec, block)
const attach = (label, name, content) => M('attach', label, name, content)
const key = (css, k) => M('key', css, k)
const eyes = (spec, nth = 0) => ({ css: spec, nth })
let role = null
let shots = 0
const legend = {} // nome do print -> textos das setas, na ordem (usado pelo manual)

async function waitFor(css, ms = 8000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await page.eval(`!!document.querySelector(${J(css)})`)) return
    await sleep(120)
  }
  throw new Error('Tempo esgotado esperando ' + css)
}
async function go(hash, r) {
  if (r && r !== role) {
    role = r
    await page.eval(`localStorage.setItem('bobinas:v1:role', ${J(r)}); location.hash = ${J(hash)}`)
    await page.reload()
  } else {
    await page.eval(`location.hash = ${J(hash)}`)
  }
  await waitFor('.main h1, .main .placeholder')
  await sleep(700)
}
async function shot(name, items = [], opts = {}) {
  // conteúdo cortado: quadros (fora das tabelas) com rolagem horizontal inesperada
  const clipped = await page.eval(
    "[...document.querySelectorAll('.main *')].filter((e) => !e.closest('.fill') && !e.closest('.table-wrap') && ['auto','scroll'].includes(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 2).slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0])",
  )
  if (clipped.length) console.warn(`  ! ${name}: conteúdo cortado em ${clipped.join(', ')}`)
  const wide = await page.eval("(() => { const f = document.querySelector('.fill'); return f && f.scrollWidth > f.clientWidth + 2 ? f.scrollWidth - f.clientWidth : 0 })()")
  if (wide) console.warn(`  ! ${name}: tabela ${wide}px mais larga que a janela (rolagem horizontal)`)
  const missing = await page.eval(`__m.annotate(${J(items)})`)
  if (missing.length) console.warn(`  ! ${name}: alvo não encontrado: ${missing.join(' | ')}`)
  await sleep(opts.settle ?? 160)
  await page.screenshot(path.join(OUT, `${name}.jpg`))
  await page.eval('__m.clear()')
  legend[name] = items.map((i) => i.text)
  shots++
  console.log(`  ✓ ${name}`)
}
const T = (css, text, nth = 0) => ({ css, text, nth })
const CERT_PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'

try {
  await page.goto(BASE + '/')
  await waitFor('.main h1')
  await sleep(900)

  console.log('Início e navegação')
  await go('#/', 'ADMIN')
  await shot('01-inicio', [
    { target: T('.nav a', 'Bobinas mãe'), text: 'Menu lateral: um item para cada módulo', side: 'right' },
    { target: eyes('.profile-btn'), text: 'Perfil simulado: clique para trocar', side: 'right' },
    { target: eyes('.pending-card'), text: 'Pendências de certificado: clique para ver as bobinas sem certificado', side: 'bottom', dx: -120 },
    { target: eyes('.grid-tiles .tile', 2), text: 'Cada cartão é um atalho para um módulo', side: 'bottom' },
  ])
  await click(eyes('.profile-btn'))
  await sleep(300)
  await shot('02-perfil', [{ target: eyes('.profile-menu'), text: 'Escolha o perfil a simular. O menu e as permissões mudam conforme o perfil', side: 'right' }])
  await click(eyes('.profile-btn'))
  await click(eyes('.collapse-btn'))
  await sleep(300)
  await shot('03-menu-recolhido', [{ target: eyes('.collapse-btn'), text: 'Clique de novo para expandir o menu', side: 'right' }, { target: T('.nav a', '', 2), text: 'Recolhido, o menu mostra só os ícones (passe o mouse para ver o nome)', side: 'right' }])
  await click(eyes('.collapse-btn'))

  console.log('Cadastros')
  await go('#/cadastros')
  await shot('04-cadastros', [
    { target: eyes('.seg'), text: 'Abas: fornecedores, usinas, obras, perfiladeiras e catálogo de materiais', side: 'bottom' },
    { target: eyes('.form-row'), text: 'Para adicionar: digite o nome e clique em Adicionar', side: 'bottom', dx: 120 },
    { target: T('.fill thead .th-btn', 'Nome'), text: 'Clique no nome da coluna para ordenar (crescente e decrescente)', side: 'right' },
    { target: T('td.actions button', 'Inativar'), text: 'Editar ou inativar. Nada é apagado', side: 'left' },
  ])
  await fillC('[placeholder="Nome do fornecedor"]', 'mval')
  await click(T('.form-row button', 'Adicionar'))
  await sleep(400)
  await shot('05-cadastros-duplicado', [{ target: eyes('.err'), text: 'Nome repetido é recusado e a mensagem diz o motivo', side: 'right' }])
  await click(T('td.actions button', 'Editar'))
  await sleep(300)
  await shot('06-cadastros-editar', [
    { target: T('.form-row button', 'Salvar'), text: 'No modo edição, o botão vira Salvar', side: 'bottom' },
    { target: T('.form-row button', 'Cancelar'), text: 'Cancelar volta ao modo de adicionar', side: 'bottom' },
  ])
  await click(T('.form-row button', 'Cancelar'))
  await click(T('.seg button', 'Catálogo'))
  await sleep(400)
  await shot('07-catalogo', [
    { target: eyes('.form-row'), text: 'Cada linha liga espessura, largura exata e galvanização a um código ERP', side: 'bottom', dx: 150 },
    { target: eyes('.filters .search'), text: 'Busque por código ou largura', side: 'bottom' },
    { target: { css: '.filters select', nth: 0 }, text: 'Filtre por galvanização ou espessura', side: 'bottom', dx: 80 },
    { target: T('.fill thead .th-btn', 'Largura'), text: 'Ordene por qualquer coluna', side: 'right' },
  ])

  console.log('Configurações')
  await go('#/configuracoes')
  await shot('08-configuracoes', [
    { target: T('label', 'Limite de peso por bobina'), text: 'Limite de peso por bobina: define em quantas bobinas cada tira é dividida', side: 'right' },
    { target: T('label', 'Tolerância do balanço'), text: 'Tolerância do balanço de massa (%)', side: 'right' },
    { target: eyes('label.check'), text: 'Certificado obrigatório ao registrar a bobina mãe', side: 'right' },
  ])
  await scrollTo(T('button', 'Salvar'))
  await shot('09-configuracoes-cub', [
    { target: T('label', 'Prefixo do CUB'), text: 'Prefixo e dígitos do CUB. Só valem para CUBs novos', side: 'right' },
    { target: T('label', 'Layout da etiqueta'), text: 'Layout da etiqueta: folha A4 ou térmica 100×50 mm', side: 'right' },
    { target: T('button', 'Salvar'), text: 'Salvar (só o Administrador altera)', side: 'right' },
  ])
  await scrollTo(T('button', 'Restaurar dados de exemplo'), 'end')
  await shot('10-dados-exemplo', [{ target: T('button', 'Restaurar dados de exemplo'), text: 'Volta aos dados de exemplo. A auditoria é mantida', side: 'top' }])

  console.log('Bobinas mãe')
  await go('#/bobinas-mae')
  await shot('11-bobinas-lista', [
    { target: T('a', 'Nova bobina mãe'), text: 'Registrar uma nova bobina mãe', side: 'bottom' },
    { target: eyes('.seg'), text: 'Filtros por situação, com contadores', side: 'bottom', dx: 100 },
    { target: eyes('.filters .search'), text: 'Busca por lote, fornecedor, NF ou certificado', side: 'bottom', dx: 150 },
    { target: T('.fill thead .th-btn', 'Peso líquido'), text: 'Clique no cabeçalho para ordenar', side: 'right' },
    { target: eyes('.fill tbody tr.click'), text: 'Clique na linha para abrir a ficha da bobina', side: 'bottom', dx: 200 },
  ])
  await click(T('.seg button', 'Sem certificado'))
  await sleep(300)
  await shot('12-bobinas-sem-certificado', [
    { target: T('.seg button', 'Sem certificado'), text: 'Mostra só as bobinas sem certificado (a lista de pendências)', side: 'bottom' },
    { target: eyes('.fill tbody .badge.warn'), text: 'Etiqueta laranja: sem certificado', side: 'right' },
  ])
  await click(T('.seg button', 'Todas'))
  await click(T('a', 'Nova bobina mãe'))
  await waitFor('.panel.wide form, form.panel')
  await sleep(500)
  await shot('13-bobina-form', [
    { target: T('label', 'Lote do prestador'), text: 'Lote (LS) que o prestador atribuiu. Campos com * são obrigatórios', side: 'right' },
    { target: T('label', 'Fornecedor *'), text: 'Fornecedor e usina vêm dos Cadastros', side: 'bottom' },
    { target: T('label', 'Peso líquido'), text: 'Peso líquido da bobina mãe, em kg', side: 'right' },
    { target: T('label', 'Galvanização'), text: 'Espessura, largura e galvanização da bobina mãe', side: 'right' },
  ])
  await fillL('Lote do prestador', '8948')
  await fillL('Fornecedor *', 'AMAFER')
  await fillL('Usina', 'CSN', 1) // o 1º rótulo com "usina" é "Nº da bobina na usina"
  await fillL('NF do fornecedor', '213061')
  await fillL('Espessura', '0,95')
  await fillL('Peso líquido', '12195')
  await click(T('button', 'Registrar bobina mãe'))
  await sleep(500)
  await scrollTo(eyes('.err'))
  await shot('14-bobina-sem-certificado', [{ target: eyes('.err'), text: 'Sem número e arquivo do certificado, o registro é recusado', side: 'top' }])
  await fillL('Número do certificado', '7948088101')
  await attach('Arquivo do certificado', 'cert-7948088101.pdf', CERT_PDF)
  await attach('Arquivo da NF', 'nf-213061.pdf', CERT_PDF)
  await sleep(300)
  await scrollTo(T('h2', 'Certificado de qualidade'), 'start')
  await shot('15-bobina-certificado', [
    { target: T('label', 'Número do certificado'), text: 'Número do certificado (emitido pela usina)', side: 'right' },
    { target: T('label', 'Arquivo do certificado'), text: 'Anexe o arquivo do certificado (PDF ou imagem)', side: 'bottom' },
    { target: T('label', 'Arquivo da NF'), text: 'A NF do fornecedor é opcional', side: 'bottom' },
    { target: T('button', 'Registrar bobina mãe'), text: 'Registrar', side: 'top' },
  ])
  await click(T('button', 'Registrar bobina mãe'))
  await waitFor('.timeline')
  await sleep(500)
  await shot('16-bobina-ficha', [
    { target: T('.attachment button', 'Visualizar'), text: 'Visualizar ou baixar o certificado', side: 'bottom' },
    { target: T('button', 'Substituir certificado'), text: 'Anexar ou substituir o certificado (fica na auditoria)', side: 'bottom' },
    { target: T('a', 'Abrir plano de corte'), text: 'Segue para o plano de corte', side: 'left' },
  ])
  await click(T('button', 'Substituir certificado'))
  await sleep(300)
  await fillL('Número do certificado', '7948088101-R1')
  await attach('Arquivo (PDF', 'cert-revisado.pdf', CERT_PDF)
  await sleep(200)
  await shot('17-certificado-substituir', [
    { target: T('label', 'Número do certificado'), text: 'Novo número', side: 'right' },
    { target: T('label', 'Arquivo (PDF'), text: 'Novo arquivo', side: 'bottom' },
    { target: T('button', 'Substituir', 0), text: 'Confirme. O anterior fica registrado no histórico', side: 'bottom' },
  ])
  await click(T('.inline-form button', 'Cancelar'))
  await scrollTo(eyes('.timeline'))
  await shot('18-bobina-historico', [{ target: eyes('.timeline'), text: 'Histórico de eventos da bobina: quem, o quê e quando', side: 'left' }])

  console.log('Plano de corte')
  await go('#/planos-de-corte')
  await shot('19-planos-lista', [
    { target: eyes('.seg'), text: 'A fazer: bobinas ainda sem plano ou com rascunho', side: 'bottom', dx: 80 },
    { target: T('tr.click', '8948'), text: 'Abra a bobina para montar o plano', side: 'bottom', dx: 220 },
    { target: T('.fill thead .th-btn', 'CUBs previstos'), text: 'Ordene as colunas', side: 'top' },
  ])
  await click(T('tr.click', '8948'))
  await waitFor('.lines-table')
  await fillC('[aria-label="Quantidade da linha 1"]', '7')
  await fillC('[aria-label="Largura da linha 1"]', '166')
  await sleep(400)
  await shot('20-plano-editor', [
    { target: eyes('.lines-table'), text: 'Informe quantas tiras e a largura de cada uma (mm)', side: 'bottom' },
    { target: T('button', '+ Adicionar linha'), text: 'Mais larguras: adicione outra linha', side: 'bottom', dx: -40 },
    { target: eyes('.stripbar'), text: 'Barra: tiras (azul) e refilo (laranja)', side: 'top' },
    { target: eyes('.metrics .hl'), text: 'Refilo em kg: o que se perde nas laterais', side: 'bottom', dx: 60 },
    { target: eyes('.metrics > div', 3), text: 'CUBs previstos', side: 'bottom' },
    { target: eyes('.res-table'), text: 'Peso por CUB estimado. O real é medido na balança', side: 'bottom' },
  ])
  await fillC('[aria-label="Quantidade da linha 1"]', '8')
  await sleep(300)
  await shot('21-plano-excedido', [{ target: eyes('.results .err'), text: 'Largura passou da bobina mãe: não deixa salvar', side: 'bottom' }])
  await fillC('[aria-label="Quantidade da linha 1"]', '7')
  await sleep(200)
  await click(T('button', 'Salvar rascunho'))
  await sleep(500)
  await shot('22-plano-rascunho', [
    { target: T('button', 'Marcar como enviado'), text: 'Depois de salvar, marque como enviado ao prestador', side: 'top' },
    { target: eyes('.timeline'), text: 'Versões do plano', side: 'left' },
    { target: T('button', 'Imprimir plano'), text: 'Imprimir a folha do plano para o prestador', side: 'top' },
  ])
  await click(T('button', 'Marcar como enviado'))
  await sleep(500)
  await shot('23-plano-enviado', [
    { target: T('button', 'Confirmar programação'), text: 'Quando o prestador confirmar a programação, clique aqui', side: 'top' },
    { target: eyes('.page-head .badge'), text: 'A bobina mãe passou para "Plano enviado"', side: 'left' },
  ])
  await click(T('button', 'Confirmar programação'))
  await sleep(400)
  await fillC('[aria-label="Quantidade da linha 1"]', '6')
  await sleep(300)
  await shot('24-plano-nova-versao', [{ target: T('button', 'Salvar como nova versão'), text: 'Plano já enviado: salvar cria a versão 2 e a 1 vira "Substituído"', side: 'top' }])
  await fillC('[aria-label="Quantidade da linha 1"]', '7')
  await page.emulateMedia('print')
  await sleep(300)
  await page.eval('window.scrollTo(0,0)')
  await shot('25-plano-impresso', [
    { target: T('h1', 'Plano de corte'), text: 'Folha limpa para o prestador, sem menu nem botões', side: 'right' },
    { target: eyes('.print-table'), text: 'Tiras, larguras, peso por bobina e CUBs previstos', side: 'bottom' },
    { target: eyes('.print-sheet .stripbar'), text: 'Desenho das tiras e do refilo', side: 'bottom' },
  ])
  await page.emulateMedia('')

  console.log('Recebimento e etiquetas')
  await go('#/recebimento')
  await shot('26-entregas-lista', [
    { target: T('a', 'Registrar entrega'), text: 'Registrar a chegada das tiras', side: 'bottom' },
    { target: eyes('.filters .search'), text: 'Busque por NF, lote ou FVM', side: 'bottom', dx: 150 },
    { target: eyes('.fill tbody tr.click'), text: 'Clique para ver a entrega e imprimir etiquetas', side: 'bottom', dx: 200 },
  ])
  await click(T('a', 'Registrar entrega'))
  await waitFor('[aria-label="Lote para pré-preencher"]')
  await fillL('NF do prestador', '14748')
  await fillC('[aria-label="Lote para pré-preencher"]', '8948')
  await click(T('button', 'Pré-preencher'))
  await sleep(400)
  await shot('27-entrega-prefill', [
    { target: T('label', 'NF do prestador'), text: 'NF que acompanha as tiras', side: 'right' },
    { target: T('label', 'Bobinas declaradas'), text: 'Quantidade de bobinas declarada na NF', side: 'bottom' },
    { target: eyes('[aria-label="Lote para pré-preencher"]'), text: 'Escolha o lote e clique em Pré-preencher: as linhas esperadas do plano aparecem', side: 'right', dx: 20 },
    { target: eyes('.row-between .badge'), text: 'Contagem lançada x declarada (verde quando bate)', side: 'left' },
  ])
  const pesos = ['843,5', '842', '845,5', '844', '843', '846,5', '841,5', '843,5', '844,5', '842,5', '845', '843,5', '842', '844']
  for (let i = 0; i < 14; i++) await fillC(`[aria-label="Peso da linha ${i + 1}"]`, pesos[i])
  await scrollTo(T('th', 'Peso medido'), 'start')
  await shot('28-entrega-pesos', [
    { target: eyes('[aria-label="Peso da linha 1"]'), text: 'Peso medido na balança (kg). Enter passa para a próxima linha', side: 'right' },
    { target: T('td', '10337'), text: 'Código ERP sugerido pelo catálogo', side: 'right', dx: 140 },
    { target: eyes('[aria-label="Posição da linha 1"]'), text: 'Posição no estoque (opcional)', side: 'top' },
  ])
  await click(T('button', 'Remover', 13))
  await sleep(300)
  await scrollTo(eyes('.row-between .badge'), 'center')
  await shot('29-entrega-contagem', [
    { target: eyes('.row-between .badge'), text: 'Contagem lançada diferente da declarada: o aviso fica laranja', side: 'left' },
  ])
  await scrollTo(T('label', 'Justificativa da diferença'), 'center')
  await shot('29b-entrega-justificativa', [
    { target: T('label', 'Justificativa da diferença'), text: 'Sem justificativa, a entrega não fecha. Escreva o motivo da diferença', side: 'top' },
  ])
  await click(T('button', '+ Adicionar bobina'))
  await sleep(300)
  await fillC('[aria-label="Peso da linha 14"]', '844')
  await scrollTo(T('button', 'Registrar entrega e gerar CUBs'))
  await shot('30-entrega-fechar', [{ target: T('button', 'Registrar entrega e gerar CUBs'), text: 'Com a contagem batendo, registre: os CUBs são gerados', side: 'top' }])
  await click(T('button', 'Registrar entrega e gerar CUBs'))
  await waitFor('.label-area')
  await sleep(600)
  await shot('31-entrega-detalhe', [
    { target: T('button', 'Imprimir etiquetas'), text: 'Imprimir as etiquetas marcadas (A4 ou térmica, conforme Configurações)', side: 'bottom' },
    { target: eyes('input[type=checkbox]'), text: 'Desmarque os CUBs que não quer imprimir', side: 'right' },
    { target: T('.kv', 'Contagem'), text: 'Contagem de bobinas da entrega', side: 'right' },
  ])
  await page.eval("[...document.querySelectorAll('input[type=checkbox]')].slice(1).forEach((c) => c.click())")
  await sleep(300)
  await scrollTo(eyes('.label-area'), 'start')
  await shot('32-etiqueta', [
    { target: eyes('.l-logo'), text: 'Logo no topo, como na etiqueta do Excel', side: 'right' },
    { target: eyes('.l-cub'), text: 'CUB em destaque', side: 'bottom', dx: -40 },
    { target: eyes('.l-lot'), text: 'Lote (LS)', side: 'bottom', dx: -60 },
    { target: eyes('.l-qr svg'), text: 'QR com o CUB: leia na Produção', side: 'bottom', dx: 90 },
    { target: eyes('.l-weight'), text: 'Peso medido', side: 'right' },
    { target: eyes('.l-col', 1), text: 'Fornecedor, NFs e certificado', side: 'top', dx: 70 },
  ])
  await go('#/configuracoes')
  await fillL('Layout da etiqueta', 'Etiqueta térmica')
  await click(T('button', 'Salvar'))
  await sleep(500)
  await go('#/recebimento/dl-19')
  await page.emulateMedia('print')
  await sleep(300)
  await page.eval('window.scrollTo(0,0)')
  await shot('33-etiqueta-termica', [
    { target: eyes('.label'), text: 'Layout térmico: 100×50 mm, uma etiqueta por página', side: 'right' },
    { target: eyes('.l-qr svg'), text: 'O QR continua com o CUB', side: 'right' },
  ])
  await page.emulateMedia('')
  await go('#/configuracoes')
  await fillL('Layout da etiqueta', 'Folha A4')
  await click(T('button', 'Salvar'))
  await sleep(400)

  console.log('Estoque')
  await go('#/estoque')
  await shot('34-estoque', [
    { target: eyes('.seg', 1), text: 'Situação do CUB, com contadores', side: 'bottom', dx: 120 },
    { target: eyes('.filters .search'), text: 'Busque por CUB, lote, NF, código, obra, posição ou dimensão (0,95x166)', side: 'bottom', dx: 120 },
    { target: T('.fill thead .th-btn', 'Peso atual'), text: 'Clique para ordenar', side: 'right' },
    { target: eyes('.link.loc'), text: 'Clique para informar ou mudar a posição do CUB', side: 'left' },
  ])
  await click(eyes('.link.loc'))
  await sleep(200)
  await fillC('.loc-input', 'Rua B · Prateleira 3')
  await shot('35-estoque-posicao', [{ target: eyes('.loc-input'), text: 'Digite a posição e tecle Enter (Esc cancela)', side: 'left' }])
  await key('.loc-input', 'Enter')
  await sleep(300)
  await click(T('.seg button', 'Saldo por código ERP'))
  await sleep(400)
  await shot('36-estoque-saldo', [
    { target: T('.fill thead .th-btn', 'Disponível'), text: 'Saldo disponível por código ERP', side: 'top' },
    { target: eyes('.fill tbody tr', 1), text: 'Cada linha soma os CUBs disponíveis, bloqueados e em uso', side: 'right', dx: 150 },
  ])

  console.log('Uso de bobina (Produção)')
  await go('#/', 'PRODUCAO')
  await shot('36b-home-producao', [
    { target: eyes('.nav'), text: 'Cada perfil vê só o que usa. Aqui, o menu da Produção', side: 'right' },
    { target: eyes('.profile-btn'), text: 'Perfil atual: Produção', side: 'right' },
  ])
  await go('#/uso')
  await shot('37-uso-inicio', [
    { target: eyes('.scan-input'), text: 'Passe o leitor ou digite o CUB. O cursor já está aqui', side: 'bottom', dx: 80 },
    { target: T('button', 'Ler com a câmera'), text: 'Ou leia o QR pela câmera do tablet', side: 'bottom' },
  ])
  await fillC('.scan-input', 'CUB-2026-00251')
  await click(T('button', 'Buscar'))
  await sleep(400)
  await shot('38-uso-recusa', [{ target: eyes('.big-err'), text: 'CUB já consumido (ou bloqueado): o sistema recusa e diz o motivo', side: 'bottom' }])
  await click(T('button', 'Ler com a câmera'))
  await sleep(2200)
  await shot('39-uso-camera', [
    { target: eyes('.scanner-frame'), text: 'Aponte o QR da etiqueta para o quadro', side: 'right', dx: 20 },
    { target: T('button', 'Fechar'), text: 'Fechar e voltar a digitar', side: 'top' },
  ])
  await click(T('button', 'Fechar'))
  await sleep(300)
  await fillC('.scan-input', 'CUB-2026-00576')
  await click(T('button', 'Buscar'))
  await waitFor('.coil-card')
  await sleep(400)
  await shot('40-uso-passo1', [
    { target: eyes('.coil-card'), text: 'A bobina lida: CUB, lote, material, código e peso atual', side: 'bottom' },
    { target: eyes('.big-input', 0), text: 'OP / protocolo', side: 'bottom' },
    { target: eyes('select.big-input'), text: 'Obra', side: 'bottom' },
    { target: eyes('.machines'), text: 'Perfiladeira (a última usada fica marcada)', side: 'top' },
  ])
  await fillC('.big-input', '13244', 0)
  await fillC('select.big-input', 'AUDITÓRIO ARARAS')
  await click(T('.machine', 'FRAMECAD 90'))
  await fillC('.big-input', '1,00', 2)
  await sleep(300)
  await shot('41-uso-espessura', [
    { target: eyes('.big-input', 2), text: 'Espessura medida com o micrômetro', side: 'top' },
    { target: eyes('.delta'), text: 'Diferença para a nominal. Acima de ±0,05 mm vira alerta laranja', side: 'right', dx: 20 },
  ])
  await fillC('.big-input', '0,95', 2)
  await sleep(200)
  await click(T('button', 'Iniciar uso'))
  await waitFor('.delta')
  await sleep(400)
  await fillC('.big-input', '300')
  await sleep(300)
  await shot('42-uso-passo2', [
    { target: eyes('.big-input'), text: 'Pese a sobra na balança e digite o peso', side: 'top' },
    { target: eyes('.delta'), text: 'Consumo deste uso, calculado pelo sistema', side: 'right', dx: 20 },
    { target: T('button', 'Sobra · imprimir etiqueta'), text: 'Sobra: volta ao estoque com o mesmo CUB', side: 'top' },
    { target: T('button', 'Consumida'), text: 'Consumida: o CUB sai de uso para sempre', side: 'top' },
  ])
  await click(T('button', 'Sobra · imprimir etiqueta'))
  await waitFor('.label')
  await sleep(500)
  await shot('43-uso-sobra', [
    { target: eyes('.label'), text: 'Etiqueta da sobra: mesmo CUB, novo peso e data, com a faixa SOBRA', side: 'right' },
    { target: T('button', 'Imprimir etiqueta da sobra'), text: 'Imprima e cole na bobina', side: 'bottom' },
    { target: T('button', 'Ler outra bobina'), text: 'Segue para a próxima bobina', side: 'bottom' },
  ])
  await click(T('button', 'Ler outra bobina'))
  await sleep(300)
  await fillC('.scan-input', 'CUB-2026-00576')
  await click(T('button', 'Buscar'))
  await waitFor('.coil-card')
  await fillC('.big-input', '13244', 0)
  await sleep(300)
  await shot('43b-uso-duplicidade', [{ target: eyes('.warn-box'), text: 'Mesmo CUB, mesma OP e mesmo dia: pode ser lançamento duplicado. O sistema avisa antes de gravar', side: 'right' }])
  await fillC('.big-input', 'OP-Z', 0)
  await fillC('select.big-input', 'AUDITÓRIO JARDINÓPOLIS')
  await click(T('.machine', 'PINNACLE X3'))
  await fillC('.big-input', '0,95', 2)
  await click(T('button', 'Iniciar uso'))
  await waitFor('.delta')
  await sleep(300)
  await click(T('button', 'Consumida'))
  await sleep(300)
  await shot('44-uso-consumida', [{ target: eyes('.warn-box'), text: 'Confirme: depois disso a bobina não pode mais ser usada', side: 'top' }])
  await click(T('button', 'Sim, consumida'))
  await sleep(500)
  await click(T('button', 'Ler outra bobina'))
  await fillC('.scan-input', 'CUB-2026-00577')
  await click(T('button', 'Buscar'))
  await waitFor('.coil-card')
  await fillC('.big-input', '13250', 0)
  await fillC('select.big-input', 'AUDITÓRIO SÃO JOSÉ')
  await click(T('.machine', 'FRAMECAD 150'))
  await fillC('.big-input', '0,95', 2)
  await click(T('button', 'Iniciar uso'))
  await waitFor('.delta')
  await click(T('button', 'Trocar bobina'))
  await sleep(500)
  await shot('45-uso-abertos', [
    { target: T('h2', 'Usos abertos'), text: 'Usos abertos: bobinas montadas e ainda não fechadas', side: 'right' },
    { target: T('button', 'Fechar uso'), text: 'Para fechar um uso, clique aqui (ou leia o CUB de novo)', side: 'left' },
  ])
  await page.setViewport(1024, 768, 1.5)
  await sleep(600)
  await shot('46-uso-tablet', [
    { target: eyes('.sidebar .nav'), text: 'No tablet o menu fica só com ícones', side: 'right' },
    { target: T('button', 'Ler com a câmera'), text: 'Botões grandes, fáceis de tocar', side: 'right' },
    { target: eyes('.scan-input'), text: 'O campo de leitura já vem com o cursor', side: 'bottom' },
  ])
  await page.setViewport(1280, 800, 1.35)
  await sleep(300)

  console.log('Consulta, ficha e dossiês')
  await go('#/consulta', 'ADMIN')
  await fillC('.big-search', '8948')
  await sleep(700)
  await shot('47-consulta', [
    { target: eyes('.big-search'), text: 'Digite CUB, lote, NF, OP, obra, certificado, código ERP ou dimensão. Atalho: tecla /', side: 'bottom' },
    { target: T('h2', 'Bobinas mãe'), text: 'Resultados agrupados por tipo', side: 'right' },
    { target: T('a', 'Recall'), text: 'Atalho para o recall do lote', side: 'left' },
  ])
  await go('#/cub/CUB-2026-00576')
  await sleep(300)
  await shot('48-ficha-cub', [
    { target: eyes('.chain .link-card', 1), text: 'Bobina mãe: NF, peso e certificado herdado, com Visualizar e Baixar', side: 'bottom' },
    { target: eyes('.chain .link-card', 3), text: 'Entrega: NF do prestador e data', side: 'bottom' },
    { target: eyes('.chain .link-card', 5), text: 'Usos: obra, OP e peso antes e depois', side: 'bottom' },
    { target: T('a', 'Dossiê do lote'), text: 'Dossiê do lote, para imprimir', side: 'bottom' },
  ])
  await go('#/dossie/obra/' + encodeURIComponent('AUDITÓRIO ARARAS'))
  await shot('49-dossie-obra', [
    { target: T('button', 'Imprimir dossiê'), text: 'Imprimir', side: 'bottom' },
    { target: T('button', 'Exportar CSV'), text: 'Exportar CSV para o Excel', side: 'bottom' },
    { target: T('h2', 'Lotes e certificados de origem'), text: 'De quais lotes e certificados saiu o aço desta obra', side: 'right', dx: 40 },
  ])
  await go('#/dossie/lote/8948')
  await shot('50-dossie-lote', [
    { target: T('h2', 'Origem e certificado'), text: 'Origem, NF e certificado do lote', side: 'right', dx: 40 },
    { target: T('h2', 'Balanço de massa'), text: 'Balanço de massa do lote', side: 'right', dx: 40 },
  ])

  console.log('Recall e relatórios')
  await go('#/recall?q=8948')
  await shot('51-recall', [
    { target: eyes('.scan-input'), text: 'Informe o número do lote ou do certificado', side: 'bottom', dx: 100 },
    { target: eyes('.metrics .hl'), text: 'Quanto já foi consumido', side: 'bottom' },
    { target: T('button', 'Exportar CSV'), text: 'Exportar CSV', side: 'bottom' },
    { target: T('h2', 'Obras e OPs'), text: 'Obras e OPs que consumiram este aço', side: 'right', dx: 60 },
  ])
  await go('#/recall?aba=balance')
  await shot('52-balanco', [
    { target: T('.fill thead .th-btn', 'Diferença'), text: 'Ordene por diferença para achar os lotes com problema', side: 'top' },
    { target: eyes('.fill tbody .badge'), text: 'Dentro ou fora da tolerância (Configurações)', side: 'left' },
    { target: T('button', 'Exportar CSV'), text: 'Exportar CSV', side: 'bottom' },
  ])
  await go('#/recall?aba=pend')
  await shot('53-pendencias', [
    { target: eyes('.fill tbody .badge.warn'), text: 'Falta o número ou o arquivo do certificado', side: 'right' },
    { target: T('a', 'Anexar certificado'), text: 'Abre a ficha para anexar', side: 'left' },
  ])

  console.log('Bloqueio e liberação (Qualidade)')
  await go('#/bloqueios', 'QUALIDADE')
  await fillL('Lote do prestador', '8948')
  await sleep(300)
  await shot('54-bloqueio-form', [
    { target: eyes('.seg'), text: 'Bloqueie um lote inteiro ou só um CUB', side: 'right' },
    { target: T('label', 'Lote do prestador'), text: 'Número do lote', side: 'right' },
    { target: eyes('.block-form input'), text: 'Motivo obrigatório', side: 'top' },
    { target: T('button', 'Bloquear lote'), text: 'Bloquear: a mãe e os CUBs com saldo', side: 'bottom' },
  ])
  await fillC('.block-form input', 'Descamação constatada na recepção')
  await click(T('button', 'Bloquear lote'))
  await sleep(600)
  await shot('55-bloqueio-ativo', [
    { target: T('td', 'Lote'), text: 'Bloqueios ativos, com motivo, quem e quando', side: 'bottom' },
    { target: T('button', 'Liberar lote'), text: 'Para liberar, clique aqui e informe o motivo', side: 'left' },
  ])
  await scrollTo(T('h2', 'Simular evento da FVM'), 'start')
  await shot('56-fvm', [
    { target: T('h2', 'Simular evento da FVM'), text: 'Só demonstração: mostra como a FVM bloquearia ou liberaria', side: 'right', dx: 40 },
    { target: T('button', 'Simular evento'), text: 'Aplica o resultado (reprovada bloqueia, aprovada libera)', side: 'top' },
  ])
  await go('#/uso', 'PRODUCAO')
  await fillC('.scan-input', 'CUB-2026-00580')
  await click(T('button', 'Buscar'))
  await sleep(400)
  await shot('57-uso-bloqueado', [{ target: eyes('.big-err'), text: 'Lote bloqueado: ninguém consegue abrir uso, e a tela mostra o motivo', side: 'bottom' }])
  await go('#/bloqueios', 'QUALIDADE')
  await click(T('button', 'Liberar lote'))
  await sleep(300)
  await fillC('.block-form input', 'Laudo aprovado pela Qualidade', 0)
  await shot('58-liberar', [
    { target: eyes('.block-form input'), text: 'Motivo da liberação (obrigatório)', side: 'top' },
    { target: T('.block-form button', 'Liberar lote'), text: 'Confirme a liberação', side: 'bottom' },
  ])
  await click(T('.block-form button', 'Liberar lote'))
  await sleep(500)
  await go('#/cub/CUB-2026-00580')
  await scrollTo(T('h2', 'Qualidade', 1))
  await fillC('.block-form input', 'Suspeita de amassado na borda')
  await shot('58b-bloqueio-cub', [
    { target: T('h2', 'Qualidade', 1), text: 'Na ficha do CUB, a Qualidade bloqueia só aquele CUB', side: 'right', dx: 40 },
    { target: eyes('.block-form input'), text: 'Motivo obrigatório', side: 'top' },
    { target: T('.block-form button', 'Bloquear CUB'), text: 'Bloquear CUB', side: 'bottom' },
  ])

  console.log('Auditoria e somente leitura')
  await go('#/auditoria', 'AUDITOR')
  await shot('59-auditoria', [
    { target: eyes('.filters .search'), text: 'Filtre por id, motivo, usuário ou conteúdo', side: 'bottom', dx: 120 },
    { target: T('.fill thead .th-btn', 'Quando'), text: 'Ordene por data, usuário ou ação', side: 'top' },
    { target: eyes('td.actions .link'), text: 'Detalhes: o antes e o depois', side: 'left' },
    { target: T('button', 'Exportar CSV'), text: 'Exportar tudo em CSV', side: 'bottom' },
  ])
  await click(eyes('td.actions .link'))
  await sleep(300)
  await shot('60-auditoria-detalhe', [{ target: eyes('.audit-detail'), text: 'Estado antes e depois da mudança', side: 'top' }])
  await go('#/cadastros')
  await shot('61-somente-leitura', [{ target: T('.badge', 'Somente leitura'), text: 'O Auditor só consulta: não há botões de alterar', side: 'left' }])
  writeFileSync(path.join(OUT, '..', 'legend.json'), JSON.stringify(legend, null, 2))
  console.log(`\nConcluído: ${shots} prints em ${OUT}`)
} catch (e) {
  console.error('\nFALHA:', e.message)
  try { await page.screenshot(path.join(OUT, '_erro.jpg')) } catch { /* sem print */ }
  process.exitCode = 1
} finally {
  await page.close()
}
