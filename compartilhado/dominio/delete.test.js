import { describe, it, expect } from 'vitest'
import {
  closeCoilUse, emptyState, markPlanSent, openCoilUse, receiveDelivery, registerMotherCoil, savePlan,
} from './commands.js'
import { deleteCuttingPlans, deleteDelivery, deleteMotherCoil } from './deleteCommands.js'
import { CASO_8948 } from './test-helpers.js'

const NOW = new Date('2026-10-23T12:00:00Z')
const ctx = (role) => ({ role, user: 'teste', now: NOW })
const ALMOX = ctx('ALMOXARIFADO'), PCP = ctx('PCP'), PROD = ctx('PRODUCAO'), ADM = ctx('ADMIN')
const codeOf = (fn) => { try { fn() } catch (e) { return e.code } return null }

const lote = { slitter_lot: '8948', supplier: 'AMAFER', mill: 'CSN', supplier_invoice_number: '213061', thickness: 0.95, width: 1200, galvanization: 'Z275', net_weight: 12195, certificate_number: '7948088101', certificate_file: { id: 'a', name: 'c.pdf' } }
const receive = (s, n = 14) => receiveDelivery(s, {
  delivery: { slitter_invoice_number: '14748', declared_coil_count: n },
  lines: Array.from({ length: n }, () => ({ mother_coil: 'mc-1', measured_weight: 843.5, width: 166 })),
}, ALMOX).state

function scenario() {
  let s = registerMotherCoil(emptyState(CASO_8948), lote, ALMOX).state
  s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
  s = markPlanSent(s, { plan_id: 'plan-1' }, PCP).state
  return receive(s)
}

describe('exclusões (só administrador)', () => {
  it('os demais perfis são recusados', () => {
    const s = scenario()
    for (const role of ['ALMOXARIFADO', 'PCP', 'PRODUCAO', 'QUALIDADE', 'SUPRIMENTOS', 'AUDITOR']) {
      expect(codeOf(() => deleteDelivery(s, { delivery_id: 'dl-1' }, ctx(role))), role).toBe('FORBIDDEN')
      expect(codeOf(() => deleteCuttingPlans(s, { mother_coil_id: 'mc-1' }, ctx(role))), role).toBe('FORBIDDEN')
      expect(codeOf(() => deleteMotherCoil(s, { mother_coil_id: 'mc-1' }, ctx(role))), role).toBe('FORBIDDEN')
    }
  })

  it('recebimento sem uso: apaga a entrega e os CUBs, devolve a mãe a "planejada" e não reaproveita números', () => {
    const s0 = scenario()
    expect(s0.coils).toHaveLength(14)
    const out = deleteDelivery(s0, { delivery_id: s0.deliveries[0].id }, ADM)
    expect(out.result.removed_cubs).toBe(14)
    expect(out.state.coils).toHaveLength(0)
    expect(out.state.deliveries).toHaveLength(0)
    expect(out.state.motherCoils[0].status).toBe('PLANNED')
    expect(out.state.auditLog.at(-1)).toMatchObject({ action: 'delivery.delete', actor: { role: 'ADMIN' } })
    expect(out.state.auditLog.at(-1).before.coils).toHaveLength(14)
    // nova entrega do mesmo lote começa depois do último número já emitido
    const again = receive(out.state, 2)
    expect(again.coils.map((c) => c.cub)).toEqual(['CUB-2026-00015', 'CUB-2026-00016'])
  })

  it('recebimento com CUB já usado é recusado, e o motivo cita o CUB', () => {
    let s = scenario()
    s = openCoilUse(s, { cub: 'CUB-2026-00001', production_order: 'OP1', project: 'OBRA Y', machine: 'FRAMECAD 90' }, PROD).state
    const e = (() => { try { deleteDelivery(s, { delivery_id: s.deliveries[0].id }, ADM) } catch (x) { return x } })()
    expect(e.code).toBe('DELIVERY_HAS_USES')
    expect(e.message).toMatch(/CUB-2026-00001/)
    s = closeCoilUse(s, { use_id: s.uses[0].id, outcome: 'LEFTOVER', weight_after: 300 }, PROD).state
    expect(codeOf(() => deleteDelivery(s, { delivery_id: s.deliveries[0].id }, ADM))).toBe('DELIVERY_HAS_USES')
  })

  it('plano de corte: apaga todas as versões e a mãe volta a "registrada"', () => {
    const s0 = registerMotherCoil(emptyState(CASO_8948), lote, ALMOX).state
    let s = savePlan(s0, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
    s = markPlanSent(s, { plan_id: 'plan-1' }, PCP).state
    s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 6, strip_width: 166 }] }, PCP).state
    expect(s.cuttingPlans).toHaveLength(2)
    expect(s.motherCoils[0].status).toBe('PLANNED')
    const out = deleteCuttingPlans(s, { mother_coil_id: 'mc-1' }, ADM)
    expect(out.result.removed).toBe(2)
    expect(out.state.cuttingPlans).toHaveLength(0)
    expect(out.state.motherCoils[0].status).toBe('REGISTERED')
    expect(codeOf(() => deleteCuttingPlans(out.state, { mother_coil_id: 'mc-1' }, ADM))).toBe('PLAN_NOT_FOUND')
  })

  it('bobina mãe: recusada se tem CUBs; depois de excluir o recebimento, sai com os planos e o lote pode ser registrado de novo', () => {
    const s = scenario()
    expect(codeOf(() => deleteMotherCoil(s, { mother_coil_id: 'mc-1' }, ADM))).toBe('MOTHER_HAS_COILS')
    const noCoils = deleteDelivery(s, { delivery_id: s.deliveries[0].id }, ADM).state
    const out = deleteMotherCoil(noCoils, { mother_coil_id: 'mc-1' }, ADM)
    expect(out.state.motherCoils).toHaveLength(0)
    expect(out.state.cuttingPlans).toHaveLength(0)
    expect(out.result.removed_plans).toBe(1)
    expect(out.state.auditLog.at(-1)).toMatchObject({ action: 'motherCoil.delete', entity_id: 'mc-1' })
    const again = registerMotherCoil(out.state, lote, ALMOX)
    expect(again.state.motherCoils).toHaveLength(1)
  })
})
