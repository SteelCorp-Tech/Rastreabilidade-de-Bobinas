// Gera src/persistence/seed/seed.json e scripts/seed-report.md a partir do Excel de controle.
// Uso: npm run seed   (o .xlsx fica na raiz do projeto e não vai para o git)
import { writeFileSync, mkdirSync } from 'node:fs'
import readXlsxFile from 'read-excel-file/node'
import { calcCuttingPlan } from '../src/domain/cuttingPlan.js'
import { emptyState } from '../src/domain/commands.js'
import { massBalance } from '../src/domain/massBalance.js'
import { roundKg } from '../src/domain/units.js'
import { CERT_MODEL } from '../src/persistence/certModel.js'

const XLSX = process.argv[2] ?? 'CONTROLE_RASTREABILIDADE_BOBINAS_A29.xlsx'
const EXCLUDED_LOT = '8948' // o roteiro de aceite registra este lote do zero
const WEIGHT_LIMIT = 1000
const SEED_ACTOR = 'Importação Excel'

// ---------------------------------------------------------------- normalização explícita
/** Fornecedor (texto do Excel) → { supplier, mill }. */
const SUPPLIER_MAP = {
  'ARCELOMITAL': { supplier: 'ARCELORMITTAL', mill: 'ARCELORMITTAL' },
  'ARCELORMITTAL': { supplier: 'ARCELORMITTAL', mill: 'ARCELORMITTAL' },
  'AMAFER': { supplier: 'AMAFER', mill: '' },
  'MVAL - CSN': { supplier: 'MVAL', mill: 'CSN' },
  'MVAL': { supplier: 'MVAL', mill: '' },
  'CSN': { supplier: 'CSN', mill: 'CSN' },
  'USIMINAS': { supplier: 'USIMINAS', mill: 'USIMINAS' },
  'MALTA RIO': { supplier: 'MALTA RIO', mill: '' },
  'PERF NARDI': { supplier: 'PERF NARDI', mill: '' },
  'BOX STEEL': { supplier: 'BOX STEEL', mill: '' },
}
/** Obra (texto do Excel) → nome canônico. Só o que difere do próprio nome (após aparar espaços). */
const PROJECT_MAP = {
  'AUDITORIO SAO JOSE': 'AUDITÓRIO SÃO JOSÉ',
  'SALTO PIRAPORA': 'SALTO DE PIRAPORA',
  'ESCOLA RIBEIRÃO': 'ESCOLA RIBEIRÃO PRETO', // suposição: validar com a Produção
  'ESCOLA RIBEIRÃO 2': 'ESCOLA RIBEIRÃO PRETO 2', // suposição: validar com a Produção
}
/** Lançamentos de teste na planilha: descartados do seed. */
const TEST_PROJECTS = new Set(['TESTE', 'PRIMEIRO PV TESTE', 'PRIMEIRO PV (3) TESTE', 'Z 350'])
const AMBIGUOUS_PROJECTS = ['MUP JBS', 'MVP JBJ'] // provável erro de digitação do mesmo nome; mantidos como estão
const MACHINES = ['FRAMECAD 90', 'FRAMECAD 150', 'PINNACLE X3']

// ---------------------------------------------------------------- utilitários
const issues = new Map() // categoria → { title, items[] }
function report(cat, title, item) {
  if (!issues.has(cat)) issues.set(cat, { title, items: [] })
  const list = issues.get(cat).items
  if (!list.includes(item)) list.push(item)
}
const text = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const isoDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : '')
const isoTs = (d) => (d instanceof Date ? new Date(d.getTime() + 12 * 3600e3).toISOString() : '')
function parseDim(v) {
  const m = /^(\d+[.,]\d+)\s*[xX]\s*(\d+)$/.exec(text(v))
  return m ? { thickness: Number(m[1].replace(',', '.')), width: Number(m[2]) } : null
}
const cubKey = (v) => text(v).toUpperCase()

// ---------------------------------------------------------------- leitura
const sheets = await readXlsxFile(XLSX)
const rowsOf = (name, skip) => sheets.find((s) => s.sheet === name).data.slice(skip)
const c26 = rowsOf('CONTROLE 2026', 6).filter((r) => /^CUB-/.test(text(r[0])))
const estoque = rowsOf('ESTOQUE BOBINAS SENASERV', 6).filter((r) => r[0] != null && text(r[0]) !== '')
const projRows = rowsOf('CONTROLE PROJ 2026', 6).filter((r) => text(r[2]))
const catalogRows = rowsOf('CÓD MICROSYS', 1).filter((r) => r[1])
const sentRows = rowsOf('BOBINAS ENVIADAS', 1).filter((r) => text(r[0]))

// ---------------------------------------------------------------- catálogo
const materials = []
const catalogIndex = new Map()
for (const r of catalogRows) {
  const dim = parseDim(r[3])
  if (!dim) { report('catalog', 'Linhas do catálogo com dimensão inválida', `${r[1]} ${r[3]}`); continue }
  const m = { id: `mat-${materials.length + 1}`, code: text(r[1]), galvanization: text(r[2]), ...dim }
  materials.push(m)
  catalogIndex.set(`${m.thickness}|${m.width}|${m.galvanization}`, m.code)
}

// ---------------------------------------------------------------- lotes
const cubsByLot = new Map()
let withoutLot = 0
for (const r of c26) {
  const lot = text(r[1])
  if (!lot || lot === '0') { withoutLot++; continue }
  if (!cubsByLot.has(lot)) cubsByLot.set(lot, [])
  cubsByLot.get(lot).push(r)
}
const estoqueByLot = new Map(estoque.map((r) => [text(r[0]), r]))
const cub_floor_2026 = Math.max(...c26.map((r) => Number(/-(\d+)$/.exec(text(r[0]))?.[1] ?? 0)))

const state = emptyState()
state.materials = materials
state.machines = MACHINES.map((n, i) => ({ id: `mq-${i + 1}`, name: n, active: true }))
state.cub_floor = { 2026: cub_floor_2026 }

const supplierNames = new Set()
const millNames = new Set()
function supplierOf(raw, ctx) {
  const key = text(raw).toUpperCase()
  const hit = SUPPLIER_MAP[key]
  if (!hit) { report('supplier', 'Fornecedor fora da tabela de normalização', `${ctx}: "${text(raw)}"`); return { supplier: text(raw), mill: '' } }
  if (text(raw) !== hit.supplier && key !== hit.supplier) report('supplier-norm', 'Fornecedor normalizado', `"${text(raw)}" → ${hit.supplier}${hit.mill && hit.mill !== hit.supplier ? ` (usina ${hit.mill})` : ''}`)
  supplierNames.add(hit.supplier)
  if (hit.mill) millNames.add(hit.mill)
  return hit
}
const certModel = () => ({ ...CERT_MODEL })

const excludedLots = []
const motherByLot = new Map()
let coilSeq = 0

for (const [lot, rs] of cubsByLot) {
  if (lot === EXCLUDED_LOT) { excludedLots.push([lot, rs.length, 'reservado para o roteiro de aceite']); continue }
  const est = estoqueByLot.get(lot)
  if (!est) { excludedLots.push([lot, rs.length, 'sem peso e largura da bobina mãe']); continue }

  const first = rs[0]
  // espessura e galvanização: valores dos CUBs (maioria); a aba de estoque tem erros de digitação (ex.: 1,255)
  const cubDims = rs.map((r) => parseDim(r[4]))
  const estDim = parseDim(est[2])
  const thickness = cubDims.find((d) => d)?.thickness
  if (estDim && estDim.thickness !== thickness) report('mother-dim', 'Espessura da mãe (aba de estoque) diverge da dos CUBs', `lote ${lot}: estoque ${text(est[2])} × CUB ${text(first[4])} → usei ${thickness} mm`)
  const galv = text(first[3])
  if (text(est[3]) !== galv) report('mother-dim', 'Galvanização da mãe diverge da dos CUBs', `lote ${lot}: estoque ${text(est[3])} × CUB ${galv} → usei ${galv}`)
  const rawSup = text(first[6]) || text(est[5])
  if (text(first[6]) && text(est[5]) && SUPPLIER_MAP[text(first[6]).toUpperCase()]?.supplier !== SUPPLIER_MAP[text(est[5]).toUpperCase()]?.supplier && !text(first[6]).toUpperCase().startsWith(text(est[5]).toUpperCase())) {
    report('supplier-conflict', 'Fornecedor diverge entre o controle e a aba de estoque', `lote ${lot}: controle "${text(first[6])}" × estoque "${text(est[5])}" → usei o do controle`)
  }
  const { supplier, mill } = supplierOf(rawSup, `lote ${lot}`)

  const certs = [...new Set(rs.map((r) => text(r[9])).filter((c) => c && c !== '0'))]
  if (certs.length > 1) report('cert-multi', 'Lote com mais de um certificado (usei o primeiro)', `lote ${lot}: ${certs.join(' / ')}`)
  const motherWidth = estDim?.width ?? 1200
  const net = Number(est[1])
  const mother = {
    id: `mc-${motherByLot.size + 1}`,
    slitter_lot: lot,
    mill_coil_number: '',
    supplier,
    mill,
    purchase_order_ref: '',
    supplier_invoice_number: text(first[7]),
    supplier_invoice_date: '',
    thickness,
    width: motherWidth,
    galvanization: galv,
    net_weight: net,
    slitter_entry_date: isoDate(est[4]),
    certificate_number: certs[0] ?? '',
    certificate_file: certs[0] ? certModel() : null,
    invoice_file: null,
    slitter_job_ref: text(first[10]),
    status: 'RECEIVED',
    received_at: isoTs(first[5]) || isoTs(est[4]),
  }
  if (!mother.certificate_number) report('cert-missing', 'Bobinas mãe sem certificado', `lote ${lot}`)
  if (!mother.supplier_invoice_number) report('chain', 'Bobina mãe sem NF do fornecedor', `lote ${lot}`)
  motherByLot.set(lot, mother)
  state.motherCoils.push(mother)

  // plano de corte derivado dos CUBs: um por largura de tira
  const widths = new Map()
  for (const d of cubDims) if (d) widths.set(d.width, (widths.get(d.width) ?? 0) + 1)
  const lines = []
  for (const [w, n] of widths) {
    const strip = (net * w) / motherWidth
    const cps = Math.max(1, Math.ceil(strip / WEIGHT_LIMIT - 1e-9))
    lines.push({ strip_count: Math.max(1, Math.round(n / cps)), strip_width: w })
  }
  let plan = null
  try {
    const result = calcCuttingPlan({ mother_width: motherWidth, net_weight: net, weight_limit: WEIGHT_LIMIT, lines })
    plan = {
      id: `plan-${state.cuttingPlans.length + 1}`, mother_coil: mother.id, version: 1, lines, result,
      expected_delivery_date: '', status: 'SENT', created_by: SEED_ACTOR, created_at: mother.received_at, sent_at: mother.received_at,
    }
    state.cuttingPlans.push(plan)
  } catch (e) {
    report('plan', 'Plano de corte não pôde ser derivado dos CUBs', `lote ${lot}: ${e.message}`)
  }

  // CUBs (pesos estimados pela fórmula correta: a planilha só tem rateio)
  const planWeightByWidth = new Map((plan?.result.lines ?? []).map((l) => [l.strip_width, l.coil_weight]))
  const perCubDefault = net / rs.length
  const weightSheet = rs.filter((r) => typeof r[11] === 'number').length
  if (weightSheet) report('weights', 'Pesos da planilha (rateio) substituídos pela fórmula correta', `lote ${lot}: ${weightSheet} CUBs`)
  for (const r of rs) {
    const dim = parseDim(r[4])
    if (!dim) { report('coil', 'CUB com dimensão ilegível (descartado)', `${text(r[0])}: "${text(r[4])}"`); continue }
    if (dim.thickness !== thickness || text(r[3]) !== galv) report('coil', 'CUB com espessura ou galvanização diferente da mãe', `${text(r[0])}: ${text(r[4])} ${text(r[3])} × mãe ${thickness} ${galv}`)
    const catCode = catalogIndex.get(`${dim.thickness}|${dim.width}|${text(r[3])}`)
    const sheetCode = text(r[2])
    let material = /^\d+$/.test(sheetCode) ? sheetCode : catCode ?? ''
    if (catCode && /^\d+$/.test(sheetCode) && catCode !== sheetCode) report('catalog', 'Código ERP do CUB diverge do catálogo', `${text(r[0])}: planilha ${sheetCode} × catálogo ${catCode} (${text(r[4])} ${text(r[3])})`)
    if (!catCode) report('catalog', 'Dimensão e galvanização sem linha no catálogo', `${text(r[0])}: ${text(r[4])} ${text(r[3])}`)
    if (!/^\d+$/.test(sheetCode) && !catCode) material = ''
    const w = roundKg(planWeightByWidth.get(dim.width) ?? perCubDefault)
    coilSeq++
    state.coils.push({
      id: `coil-${coilSeq}`, cub: text(r[0]), mother_coil: mother.id, delivery: '', slitter_lot: lot,
      slitter_invoice_number: text(r[8]), received_date: isoDate(r[5]), supplier, galvanization: text(r[3]),
      thickness: dim.thickness, width: dim.width, material, certificate_number: mother.certificate_number, fvm_number: '',
      received_weight: w, current_weight: w, received_weight_estimated: true, status: 'IN_STOCK', storage_location: '',
      last_project: null, last_production_order: null, use_count: 0, cumulative_consumption: 0,
      fully_used_flag: text(r[13]).toUpperCase() === 'SIM',
    })
    if (!text(r[8])) report('chain', 'CUB sem NF do prestador', text(r[0]))
  }
}

// lotes só da aba de estoque (ainda no prestador): vão de REGISTERED até SCHEDULED
for (const [lot, r] of estoqueByLot) {
  if (cubsByLot.has(lot)) continue
  const status = text(r[8]).toUpperCase() === 'SIM' || text(r[9]).toUpperCase() === 'SIM' ? null : text(r[8]).toUpperCase() === 'EM CORTE' ? 'SCHEDULED' : 'REGISTERED'
  if (!status) { report('estoque', 'Lote marcado como entregue na aba de estoque, sem CUBs no controle (descartado)', `lote ${lot}`); continue }
  const dim = parseDim(r[2])
  const sup = supplierOf(r[5], `lote ${lot}`)
  if (!dim) { report('estoque', 'Lote com dimensão ilegível (descartado)', `lote ${lot}: ${text(r[2])}`); continue }
  const mother = {
    id: `mc-${state.motherCoils.length + 1}`, slitter_lot: lot, mill_coil_number: '', supplier: sup.supplier, mill: sup.mill,
    purchase_order_ref: '', supplier_invoice_number: text(r[6]), supplier_invoice_date: '', thickness: dim.thickness, width: dim.width,
    galvanization: text(r[3]), net_weight: Number(r[1]), slitter_entry_date: isoDate(r[4]), certificate_number: '', certificate_file: null,
    invoice_file: null, slitter_job_ref: '', status, received_at: isoTs(r[4]),
  }
  report('cert-missing', 'Bobinas mãe sem certificado', `lote ${lot} (no prestador, ${status})`)
  state.motherCoils.push(mother)
}

// ---------------------------------------------------------------- entregas (NF do prestador + data)
const deliveries = new Map()
for (const c of state.coils) {
  const key = `${c.slitter_invoice_number}|${c.received_date}|${c.slitter_invoice_number ? '' : c.slitter_lot}`
  if (!deliveries.has(key)) deliveries.set(key, { id: `dl-${deliveries.size + 1}`, slitter_invoice_number: c.slitter_invoice_number, received_date: c.received_date, coils: [] })
  const d = deliveries.get(key)
  d.coils.push(c)
  c.delivery = d.id
}
state.deliveries = [...deliveries.values()].map((d) => ({
  id: d.id, slitter_invoice_number: d.slitter_invoice_number, received_date: d.received_date, declared_coil_count: d.coils.length,
  mother_coils: [...new Set(d.coils.map((c) => c.mother_coil))], cubs: d.coils.map((c) => c.cub), delivery_note_file: null,
  fvm_number: '', count_justification: '', received_by: SEED_ACTOR, created_at: isoTs(new Date(`${d.received_date}T00:00:00Z`)),
}))

// ---------------------------------------------------------------- obras e usos
const projectNames = new Set()
const coilByCub = new Map(state.coils.map((c) => [cubKey(c.cub), c]))
const usesByCub = new Map()
const seenUse = new Set()
let skippedForeign = 0, testRows = 0, dupRows = 0
const canonicalProject = (raw) => {
  const t = text(raw)
  return PROJECT_MAP[t.toUpperCase()] ?? t
}
for (const [raw, canon] of Object.entries(PROJECT_MAP)) report('project-norm', 'Obra normalizada', `"${raw}" → ${canon}`)
for (const r of projRows) {
  const cub = cubKey(r[2])
  const rawProject = text(r[0])
  if (TEST_PROJECTS.has(rawProject.toUpperCase())) { testRows++; continue }
  const coil = coilByCub.get(cub)
  if (!coil) { skippedForeign++; if (!/^CUB-/.test(cub)) report('use', 'Uso sem CUB válido (descartado)', `${rawProject}: "${text(r[2])}"`); continue }
  const project = canonicalProject(rawProject)
  let date = isoDate(r[1])
  if (!date) { date = coil.received_date; report("use", "Uso sem data (usei a data de recebimento do CUB)", `${cub} · ${project}`) }
  const k = `${cub}|${project}|${date}`
  if (seenUse.has(k)) { dupRows++; report('use-dup', 'Lançamento duplicado (mesmo CUB, obra e data): mantido um só', k); continue }
  seenUse.add(k)
  projectNames.add(project)
  if (AMBIGUOUS_PROJECTS.includes(project)) report('project-amb', 'Nome de obra possivelmente digitado de dois jeitos (mantido como está)', project)
  if (project === 'SEM INFORMAÇÃO') report('project-amb', 'Uso sem obra informada', cub)
  if (!usesByCub.has(cub)) usesByCub.set(cub, [])
  usesByCub.get(cub).push({ project, date, order: usesByCub.size })
}

const sentCubs = new Set(sentRows.map((r) => cubKey(r[0])))
let useSeq = 0
for (const [cub, list] of usesByCub) {
  const coil = coilByCub.get(cub)
  list.sort((a, b) => a.date.localeCompare(b.date))
  const n = list.length
  const consumedAtEnd = coil.fully_used_flag
  // distribui o peso recebido entre os usos (estimativa; a planilha não tem peso por uso)
  const share = coil.received_weight / (consumedAtEnd ? n : n + 1)
  let weight = coil.received_weight
  list.forEach((u, i) => {
    const last = i === n - 1
    const after = last && consumedAtEnd ? 0 : roundKg(Math.max(weight - share, 0.1))
    const outcome = after === 0 ? 'CONSUMED' : 'LEFTOVER'
    useSeq++
    state.uses.push({
      id: `use-${useSeq}`, coil: coil.id, production_order: 'SEM OP', project: u.project, machine: 'N/D',
      nominal_thickness: coil.thickness, measured_thickness: coil.thickness, thickness_delta: 0,
      weight_before: weight, weight_after: after, consumption: roundKg(weight - after), scrap_weight: 0, outcome,
      opened_by: SEED_ACTOR, opened_at: isoTs(new Date(`${u.date}T00:00:00Z`)), closed_by: SEED_ACTOR,
      closed_at: isoTs(new Date(`${u.date}T00:00:00Z`)), label_photo: null, estimated: true,
    })
    coil.use_count++
    coil.cumulative_consumption = roundKg(coil.cumulative_consumption + roundKg(weight - after))
    coil.last_project = u.project
    coil.last_production_order = 'SEM OP'
    weight = after
  })
  coil.current_weight = weight
  coil.status = weight === 0 ? 'CONSUMED' : 'IN_STOCK'
}
for (const c of state.coils) {
  if (c.fully_used_flag && !usesByCub.has(cubKey(c.cub))) {
    report('use', 'CUB marcado "100% utilizado" sem nenhuma obra registrada (mantido como consumido)', c.cub)
    c.status = 'CONSUMED'
    c.current_weight = 0
  }
  delete c.fully_used_flag
  if (sentCubs.has(cubKey(c.cub))) { c.status = 'RETURNED'; report('returned', 'CUB da aba "Bobinas enviadas" marcado como enviado a terceiros', c.cub) }
}
if (usesByCub.size) report('use', 'Usos sem OP, perfiladeira e peso: preenchidos com "SEM OP" e "N/D"; pesos distribuídos por estimativa', `${useSeq} usos`)

// ---------------------------------------------------------------- cadastros
state.suppliers = [...supplierNames].sort().map((n, i) => ({ id: `sup-${i + 1}`, name: n, active: true }))
state.mills = [...millNames].sort().map((n, i) => ({ id: `mil-${i + 1}`, name: n, active: true }))
state.projects = [...projectNames].sort().map((n, i) => ({ id: `obra-${i + 1}`, name: n, active: true }))

// ---------------------------------------------------------------- balanço por lote (conferência)
const balanceRows = []
for (const m of state.motherCoils.filter((x) => x.status === 'RECEIVED')) {
  const plan = state.cuttingPlans.find((p) => p.mother_coil === m.id)
  const b = massBalance({
    net_weight: m.net_weight, trim_weight: plan?.result.trim_weight ?? 0,
    received_weights: state.coils.filter((c) => c.mother_coil === m.id).map((c) => c.received_weight), tolerance_pct: 1,
  })
  balanceRows.push([m.slitter_lot, b.net_weight, roundKg(b.received_weight), roundKg(b.trim_weight), roundKg(b.difference), b.within_tolerance ? 'ok' : 'fora'])
  if (!b.within_tolerance) report('balance', 'Balanço de massa fora da tolerância de 1% (estimativa a partir dos CUBs recebidos)', `lote ${m.slitter_lot}: líquido ${b.net_weight}, CUBs ${roundKg(b.received_weight)}, refilo ${roundKg(b.trim_weight)}, diferença ${roundKg(b.difference)} kg`)
}

// ---------------------------------------------------------------- saída
mkdirSync('src/persistence/seed', { recursive: true })
writeFileSync('src/persistence/seed/seed.json', JSON.stringify(state))

const L = []
L.push('# Relatório do seed', '', `Gerado de \`${XLSX}\` por \`npm run seed\`. Não editar à mão.`, '')
L.push('## Resumo', '')
L.push(`- Bobinas mãe: **${state.motherCoils.length}** (${state.motherCoils.filter((m) => m.status === 'RECEIVED').length} com CUBs; ${state.motherCoils.filter((m) => m.status !== 'RECEIVED').length} ainda no prestador)`)
L.push(`- CUBs: **${state.coils.length}** · entregas: ${state.deliveries.length} · planos de corte: ${state.cuttingPlans.length} · usos: ${state.uses.length}`)
L.push(`- Cadastros: ${state.suppliers.length} fornecedores, ${state.mills.length} usinas, ${state.projects.length} obras, ${state.machines.length} perfiladeiras, ${state.materials.length} linhas de catálogo`)
L.push(`- Piso de numeração de CUB 2026: **${cub_floor_2026}** (o próximo CUB emitido pelo sistema será ${cub_floor_2026 + 1})`)
L.push(`- Critério da amostra: lotes do controle 2026 que também constam na aba de estoque (têm peso e largura da mãe). Ficaram de fora ${excludedLots.length} lotes e ${withoutLot} CUBs sem lote.`, '')
L.push('## Lotes de fora do seed', '', '| Lote | CUBs | Motivo |', '|---|---|---|', ...excludedLots.map((x) => `| ${x[0]} | ${x[1]} | ${x[2]} |`), '')
L.push('## Tabela de normalização', '', '### Fornecedor', '', '| No Excel | Fornecedor | Usina |', '|---|---|---|', ...Object.entries(SUPPLIER_MAP).map(([k, v]) => `| ${k} | ${v.supplier} | ${v.mill || '—'} |`), '')
L.push('### Obra', '', '| No Excel | No app |', '|---|---|', ...Object.entries(PROJECT_MAP).map(([k, v]) => `| ${k} | ${v} |`), `| (espaços duplos, ex.: "CDHU  1º PAV") | espaços colapsados |`, `| ${[...TEST_PROJECTS].join(', ')} | **descartadas** (lançamentos de teste: ${testRows} linhas) |`, '')
L.push('## Inconsistências encontradas', '')
for (const [, { title, items }] of issues) {
  L.push(`### ${title} (${items.length})`, '', ...items.slice(0, 40).map((i) => `- ${i}`), ...(items.length > 40 ? [`- … e mais ${items.length - 40}`] : []), '')
}
L.push('## Balanço de massa por lote (estimativa)', '', '| Lote | Líquido (kg) | CUBs (kg) | Refilo (kg) | Diferença (kg) | 1% |', '|---|---|---|---|---|---|', ...balanceRows.map((r) => `| ${r.join(' | ')} |`), '')
writeFileSync('scripts/seed-report.md', L.join('\n'))

console.log(`seed: ${state.motherCoils.length} mães, ${state.coils.length} CUBs, ${state.deliveries.length} entregas, ${state.uses.length} usos, ${state.projects.length} obras`)
console.log(`descartados: ${testRows} linhas de teste, ${dupRows} duplicados, ${skippedForeign - testRows} usos de CUBs fora da amostra`)
console.log('relatório: scripts/seed-report.md')
