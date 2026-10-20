import { describe, it, expect } from 'vitest'
import {
  attachCertificate, blockCoilCmd, blockLot, closeCoilUse, confirmSchedule, emptyState, markPlanSent,
  openCoilUse, receiveDelivery, registerMotherCoil, savePlan, unblockLot,
} from './commands.js'
import { certificatePendencies, chainOfCoil, recallByCertificate, recallByLot, searchAll } from './traceability.js'
import { roundKg } from './units.js'
import { findPossibleDuplicateUse } from './coil.js'

const NOW = new Date('2026-10-20T15:00:00Z')
const ctx = (role, user = 'teste', now = NOW) => ({ role, user, now })
const ALMOX = ctx('ALMOXARIFADO', 'almox')
const PCP = ctx('PCP', 'pcp')
const PROD = ctx('PRODUCAO', 'prod')
const QUAL = ctx('QUALIDADE', 'qual')

const cert = { id: 'att-1', name: 'cert-7948088101.pdf', type: 'application/pdf', size: 1000 }
const lote8948 = {
  slitter_lot: '8948', supplier: 'ARCELORMITTAL', mill: 'ARCELORMITTAL', supplier_invoice_number: '213061',
  thickness: 0.95, width: 1200, galvanization: 'Z275', net_weight: 12195,
  certificate_number: '7948088101', certificate_file: cert,
}

function codeOf(fn) {
  try { fn() } catch (e) { return e.code }
  return null
}

/** Estado com a mãe 8948 registrada, plano de 7 × 166 enviado e entrega de 14 CUBs recebida. */
function stockWith14() {
  let s = emptyState()
  s = registerMotherCoil(s, lote8948, ALMOX).state
  s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
  s = markPlanSent(s, { plan_id: 'plan-1' }, PCP).state
  s = confirmSchedule(s, { mother_coil_id: 'mc-1' }, PCP).state
  const lines = Array.from({ length: 14 }, () => ({ mother_coil: 'mc-1', measured_weight: 843.5, width: 166, material: '10337' }))
  s = receiveDelivery(s, { delivery: { slitter_invoice_number: '14748', declared_coil_count: 14 }, lines }, ALMOX).state
  return s
}

describe('critério de aceite (domínio) — lote 8948', () => {
  it('1. recusa registrar a mãe sem certificado (padrão) e aceita com certificado', () => {
    const s = emptyState()
    const { certificate_file, ...semArquivo } = lote8948
    expect(codeOf(() => registerMotherCoil(s, semArquivo, ALMOX))).toBe('CERTIFICATE_REQUIRED')
    expect(codeOf(() => registerMotherCoil(s, { ...lote8948, certificate_number: '' }, ALMOX))).toBe('CERTIFICATE_REQUIRED')
    const r = registerMotherCoil(s, lote8948, ALMOX)
    expect(r.result.status).toBe('REGISTERED')
    expect(r.state.auditLog.at(-1).action).toBe('motherCoil.create')
  })

  it('2. plano 7 × 166 → 14 CUBs de ≈ 843,5 kg, refilo 386,2 kg; mãe vai a PLANNED e SCHEDULED', () => {
    let s = registerMotherCoil(emptyState(), lote8948, ALMOX).state
    const { state, result } = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP)
    expect(result.result.total_cubs).toBe(14)
    expect(roundKg(result.result.lines[0].coil_weight)).toBe(843.5)
    expect(roundKg(result.result.trim_weight)).toBe(386.2)
    s = markPlanSent(state, { plan_id: result.id }, PCP).state
    expect(s.motherCoils[0].status).toBe('PLANNED')
    s = confirmSchedule(s, { mother_coil_id: 'mc-1' }, PCP).state
    expect(s.motherCoils[0].status).toBe('SCHEDULED')
  })

  it('3. recebe 14 CUBs com contagem igual à declarada; recusa contagem diferente sem justificativa', () => {
    const s = stockWith14()
    expect(s.coils).toHaveLength(14)
    expect(s.coils[0].cub).toBe('CUB-2026-00001')
    expect(s.coils[13].cub).toBe('CUB-2026-00014')
    expect(s.coils.every((c) => c.status === 'IN_STOCK' && c.slitter_lot === '8948' && c.slitter_invoice_number === '14748')).toBe(true)
    expect(s.motherCoils[0].status).toBe('RECEIVED')

    const base = registerMotherCoil(emptyState(), lote8948, ALMOX).state
    const linhas13 = Array.from({ length: 13 }, () => ({ mother_coil: 'mc-1', measured_weight: 843.5, width: 166 }))
    const delivery = { slitter_invoice_number: '14748', declared_coil_count: 14 }
    expect(codeOf(() => receiveDelivery(base, { delivery, lines: linhas13 }, ALMOX))).toBe('DELIVERY_COUNT_MISMATCH')
    const ok = receiveDelivery(base, { delivery: { ...delivery, count_justification: 'Bobina 14 retida no prestador' }, lines: linhas13 }, ALMOX)
    expect(ok.result.coils).toHaveLength(13)
  })

  it('4. abre uso de um CUB para a OP X da obra Y e recusa o segundo uso', () => {
    let s = stockWith14()
    const r = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP-X', project: 'OBRA Y', machine: 'FRAMECAD 90', measured_thickness: 0.97 }, PROD)
    expect(r.result.coil.status).toBe('IN_USE')
    expect(r.result.use.thickness_delta).toBe(0.02)
    expect(r.result.use.weight_before).toBe(843.5)
    s = r.state
    const again = { cub: 'CUB-2026-00001', production_order: 'OP-X2', project: 'OBRA Y', machine: 'FRAMECAD 90', measured_thickness: 0.95 }
    expect(codeOf(() => openCoilUse(s, again, PROD))).toBe('COIL_NOT_AVAILABLE')
    expect(() => openCoilUse(s, again, PROD)).toThrow(/já tem um uso aberto/)
  })

  it('5. fecha com sobra de 300 kg (mesmo CUB), reabre para a obra Z e consome tudo', () => {
    let s = stockWith14()
    s = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP-X', project: 'OBRA Y', machine: 'FRAMECAD 90', measured_thickness: 0.95 }, PROD).state
    const closed = closeCoilUse(s, { use_id: 'use-1', outcome: 'LEFTOVER', weight_after: 300 }, PROD)
    s = closed.state
    expect(closed.result.coil.cub).toBe('CUB-2026-00001')
    expect(closed.result.coil.status).toBe('IN_STOCK')
    expect(closed.result.coil.current_weight).toBe(300)
    expect(closed.result.use.consumption).toBe(543.5)
    expect(s.coils).toHaveLength(14) // a sobra não cria CUB novo

    s = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP-Z', project: 'OBRA Z', machine: 'PINNACLE X3', measured_thickness: 0.94 }, PROD).state
    expect(s.uses[1].weight_before).toBe(300)
    const done = closeCoilUse(s, { use_id: 'use-2', outcome: 'CONSUMED' }, PROD)
    expect(done.result.coil.status).toBe('CONSUMED')
    expect(done.result.coil.current_weight).toBe(0)
    expect(done.result.coil.use_count).toBe(2)
    expect(done.result.coil.cumulative_consumption).toBe(843.5)
    // consumido não abre mais
    expect(codeOf(() => openCoilUse(done.state, { cub: 'CUB-2026-00001', production_order: 'OP-W', project: 'OBRA W', machine: 'FRAMECAD 90', measured_thickness: 0.95 }, PROD))).toBe('COIL_NOT_AVAILABLE')
  })

  it('6. consulta e recall do lote 8948: obras, OPs, consumos, saldos, balanço e certificado em todos os CUBs', () => {
    let s = stockWith14()
    s = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP-X', project: 'OBRA Y', machine: 'FRAMECAD 90', measured_thickness: 0.95 }, PROD).state
    s = closeCoilUse(s, { use_id: 'use-1', outcome: 'LEFTOVER', weight_after: 300 }, PROD).state
    s = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP-Z', project: 'OBRA Z', machine: 'FRAMECAD 90', measured_thickness: 0.95 }, PROD).state
    s = closeCoilUse(s, { use_id: 'use-2', outcome: 'CONSUMED' }, PROD).state

    const recall = recallByLot(s, '8948')
    expect(recall.coils).toHaveLength(14)
    expect(recall.projects.sort()).toEqual(['OBRA Y', 'OBRA Z'])
    expect(recall.production_orders.sort()).toEqual(['OP-X', 'OP-Z'])
    expect(recall.total_consumption).toBe(843.5)
    expect(recall.stock_weight).toBe(13 * 843.5)
    const b = recall.balances[0]
    expect(b.trim_known).toBe(true)
    expect(b.within_tolerance).toBe(true)
    expect(recallByCertificate(s, '7948088101').coils).toHaveLength(14)

    for (const c of s.coils) {
      const chain = chainOfCoil(s, c.cub)
      expect(chain.certificate.number).toBe('7948088101')
      expect(chain.certificate.file.id).toBe('att-1')
      expect(chain.mother_coil.slitter_lot).toBe('8948')
    }
    expect(searchAll(s, '8948').some((r) => r.type === 'mother_coil')).toBe(true)
    expect(searchAll(s, 'obra z').some((r) => r.type === 'use')).toBe(true)
    expect(searchAll(s, '0,95x166').length).toBe(14)
  })

  it('7. bloquear o lote impede novos usos e fica na auditoria; liberar restaura', () => {
    let s = stockWith14()
    expect(codeOf(() => blockLot(s, { slitter_lot: '8948', reason: '' }, QUAL))).toBe('BLOCK_REASON_REQUIRED')
    expect(codeOf(() => blockLot(s, { slitter_lot: '8948', reason: 'Descamação' }, PROD))).toBe('FORBIDDEN')
    const blocked = blockLot(s, { slitter_lot: '8948', reason: 'Descamação' }, QUAL)
    s = blocked.state
    expect(blocked.result.blocked_cubs).toHaveLength(14)
    const input = { cub: 'CUB-2026-00005', production_order: 'OP-X', project: 'OBRA Y', machine: 'FRAMECAD 90', measured_thickness: 0.95 }
    expect(() => openCoilUse(s, input, PROD)).toThrow(/bloqueado: Descamação/)
    expect(s.auditLog.at(-1)).toMatchObject({ action: 'lot.block', reason: 'Descamação', actor: { role: 'QUALIDADE' } })

    s = unblockLot(s, { slitter_lot: '8948', reason: 'Laudo aprovado' }, QUAL).state
    expect(s.coils.every((c) => c.status === 'IN_STOCK')).toBe(true)
    expect(s.motherCoils[0].status).toBe('RECEIVED')
    expect(openCoilUse(s, input, PROD).result.coil.status).toBe('IN_USE')
  })
})

describe('invariantes (CLAUDE.md 5.2)', () => {
  it('sem exigência de certificado, a mãe entra marcada "sem certificado" nas pendências, até anexar', () => {
    let s = emptyState({ ...emptyState().config, certificate_required: false })
    const { certificate_file, certificate_number, ...semCert } = lote8948
    s = registerMotherCoil(s, semCert, ALMOX).state
    expect(certificatePendencies(s)).toHaveLength(1)
    s = attachCertificate(s, { mother_coil_id: 'mc-1', number: '7948088101', file: cert }, ctx('QUALIDADE')).state
    expect(certificatePendencies(s)).toHaveLength(0)
    expect(s.auditLog.at(-1).action).toBe('motherCoil.attachCertificate')
    s = attachCertificate(s, { mother_coil_id: 'mc-1', number: '7948088101-R', file: { ...cert, id: 'att-2' } }, ctx('QUALIDADE')).state
    expect(s.auditLog.at(-1).action).toBe('motherCoil.replaceCertificate')
  })

  it('lote da mãe é único', () => {
    const s = registerMotherCoil(emptyState(), lote8948, ALMOX).state
    expect(codeOf(() => registerMotherCoil(s, lote8948, ALMOX))).toBe('MOTHER_LOT_DUPLICATE')
  })

  it('peso depois não pode passar do peso antes; sobra precisa de peso; consumida zera', () => {
    let s = stockWith14()
    s = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP-X', project: 'OBRA Y', machine: 'FRAMECAD 90', measured_thickness: 0.95 }, PROD).state
    expect(codeOf(() => closeCoilUse(s, { use_id: 'use-1', outcome: 'LEFTOVER', weight_after: 900 }, PROD))).toBe('USE_WEIGHT_INCREASED')
    expect(codeOf(() => closeCoilUse(s, { use_id: 'use-1', outcome: 'LEFTOVER', weight_after: 0 }, PROD))).toBe('USE_LEFTOVER_ZERO')
    expect(codeOf(() => closeCoilUse(s, { use_id: 'use-1', outcome: 'CONSUMED', weight_after: 50 }, PROD))).toBe('USE_CONSUMED_WEIGHT')
  })

  it('galvanização e espessura da tira devem bater com as da mãe; CUB exige peso medido', () => {
    const s = registerMotherCoil(emptyState(), lote8948, ALMOX).state
    const delivery = { slitter_invoice_number: '14748', declared_coil_count: 1 }
    const line = { mother_coil: 'mc-1', measured_weight: 800, width: 166 }
    expect(codeOf(() => receiveDelivery(s, { delivery, lines: [{ ...line, galvanization: 'Z350' }] }, ALMOX))).toBe('DELIVERY_GALV_MISMATCH')
    expect(codeOf(() => receiveDelivery(s, { delivery, lines: [{ ...line, thickness: 1.25 }] }, ALMOX))).toBe('DELIVERY_THICKNESS_MISMATCH')
    expect(codeOf(() => receiveDelivery(s, { delivery, lines: [{ ...line, measured_weight: 0 }] }, ALMOX))).toBe('COIL_WEIGHT_REQUIRED')
    expect(codeOf(() => receiveDelivery(s, { delivery: { ...delivery, slitter_invoice_number: '' }, lines: [line] }, ALMOX))).toBe('DELIVERY_INVOICE_REQUIRED')
  })

  it('uma entrega pode trazer tiras de mais de um lote', () => {
    let s = registerMotherCoil(emptyState(), lote8948, ALMOX).state
    s = registerMotherCoil(s, { ...lote8948, slitter_lot: '8949', supplier_invoice_number: '213062' }, ALMOX).state
    const lines = [{ mother_coil: 'mc-1', measured_weight: 800, width: 166 }, { mother_coil: 'mc-2', measured_weight: 810, width: 166 }]
    const r = receiveDelivery(s, { delivery: { slitter_invoice_number: '14748', declared_coil_count: 2 }, lines }, ALMOX)
    expect(r.result.delivery.mother_coils).toEqual(['mc-1', 'mc-2'])
    expect(r.result.coils.map((c) => c.slitter_lot)).toEqual(['8948', '8949'])
  })

  it('CUB não é reutilizado em entregas seguintes', () => {
    let s = stockWith14()
    s = registerMotherCoil(s, { ...lote8948, slitter_lot: '8949', supplier_invoice_number: '213062' }, ALMOX).state
    s = receiveDelivery(s, { delivery: { slitter_invoice_number: '14749', declared_coil_count: 1 }, lines: [{ mother_coil: 'mc-2', measured_weight: 800, width: 166 }] }, ALMOX).state
    expect(s.coils.at(-1).cub).toBe('CUB-2026-00015')
  })

  it('bloquear CUB em uso: a sobra volta bloqueada', () => {
    let s = stockWith14()
    s = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP-X', project: 'OBRA Y', machine: 'FRAMECAD 90', measured_thickness: 0.95 }, PROD).state
    s = blockCoilCmd(s, { cub: 'CUB-2026-00001', reason: 'Suspeita de descamação' }, QUAL).state
    expect(s.coils[0].status).toBe('IN_USE')
    s = closeCoilUse(s, { use_id: 'use-1', outcome: 'LEFTOVER', weight_after: 300 }, PROD).state
    expect(s.coils[0].status).toBe('BLOCKED')
    expect(s.coils[0].current_weight).toBe(300)
  })

  it('alerta de possível duplicidade: mesmo CUB, OP e dia', () => {
    let s = stockWith14()
    s = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP-X', project: 'OBRA Y', machine: 'FRAMECAD 90', measured_thickness: 0.95 }, PROD).state
    expect(findPossibleDuplicateUse(s.uses, { coil: 'coil-1', production_order: 'OP-X', day: '2026-10-20' })).toBeTruthy()
    expect(findPossibleDuplicateUse(s.uses, { coil: 'coil-1', production_order: 'OP-X', day: '2026-10-21' })).toBeUndefined()
  })

  it('o estado anterior não é alterado (funções puras) e o AuditLog só cresce', () => {
    const s0 = registerMotherCoil(emptyState(), lote8948, ALMOX).state
    const snapshot = JSON.stringify(s0)
    const s1 = savePlan(s0, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
    expect(JSON.stringify(s0)).toBe(snapshot)
    expect(s1.auditLog.length).toBe(s0.auditLog.length + 1)
    expect(s1.auditLog.slice(0, s0.auditLog.length)).toEqual(s0.auditLog)
  })

  it('perfil sem permissão é recusado; auditor é somente leitura', () => {
    expect(codeOf(() => registerMotherCoil(emptyState(), lote8948, PROD))).toBe('FORBIDDEN')
    expect(codeOf(() => registerMotherCoil(emptyState(), lote8948, ctx('AUDITOR')))).toBe('FORBIDDEN')
  })

  it('salvar de novo um rascunho o atualiza; depois de enviado, cria nova versão e substitui a anterior', () => {
    let s = registerMotherCoil(emptyState(), lote8948, ALMOX).state
    s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
    s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 6, strip_width: 166 }] }, PCP).state
    expect(s.cuttingPlans.map((p) => [p.version, p.status, p.result.total_cubs])).toEqual([[1, 'DRAFT', 12]])
    s = markPlanSent(s, { plan_id: 'plan-1' }, PCP).state
    s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
    expect(s.cuttingPlans.map((p) => [p.version, p.status])).toEqual([[1, 'SUPERSEDED'], [2, 'DRAFT']])
    expect(s.auditLog.filter((x) => x.action === 'cuttingPlan.save')).toHaveLength(3)
  })
})
