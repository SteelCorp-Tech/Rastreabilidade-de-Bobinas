import { describe, it, expect } from 'vitest'
import { emptyState, markPlanSent, receiveDelivery, registerMotherCoil, savePlan } from './commands.js'
import { deleteCuttingPlans, deleteDelivery, deleteMotherCoil } from './deleteCommands.js'
import { CASO_8948 } from './test-helpers.js'

const NOW = new Date('2026-10-26T12:00:00Z')
const ctx = (role) => ({ role, user: 'teste', now: NOW })
const ALMOX = ctx('ALMOXARIFADO'), PCP = ctx('PCP'), ADM = ctx('ADMIN')

const lote = (n) => ({
  slitter_lot: String(n), supplier: 'AMAFER', supplier_invoice_number: `NF${n}`, thickness: 0.95, width: 1200,
  galvanization: 'Z275', net_weight: 12195, certificate_number: `C${n}`, certificate_file: { id: `a${n}`, name: 'c.pdf' },
})
const receive = (s, mc, n = 2) => receiveDelivery(s, {
  delivery: { slitter_invoice_number: `P-${mc}`, declared_coil_count: n },
  lines: Array.from({ length: n }, () => ({ mother_coil: mc, measured_weight: 800, width: 166 })),
}, ALMOX).state
const ids = (list) => list.map((x) => x.id)
const unique = (list) => new Set(ids(list)).size === list.length

// Identificadores internos nunca se repetem, nem depois de uma exclusão do administrador
// (senão o histórico de um registro excluído apareceria no registro novo).
describe('identificadores internos depois de exclusões', () => {
  it('bobina mãe: excluir uma do meio ou a última não faz o próximo cadastro repetir id', () => {
    let s = emptyState(CASO_8948)
    for (const n of [1, 2, 3]) s = registerMotherCoil(s, lote(n), ALMOX).state
    s = deleteMotherCoil(s, { mother_coil_id: 'mc-1' }, ADM).state
    s = deleteMotherCoil(s, { mother_coil_id: 'mc-3' }, ADM).state
    s = registerMotherCoil(s, lote(4), ALMOX).state
    expect(unique(s.motherCoils)).toBe(true)
    expect(ids(s.motherCoils)).toEqual(['mc-2', 'mc-4'])
  })

  it('entrega e CUB: excluir um recebimento não faz o próximo repetir id', () => {
    let s = emptyState(CASO_8948)
    s = registerMotherCoil(s, lote(1), ALMOX).state
    s = registerMotherCoil(s, lote(2), ALMOX).state
    s = receive(s, 'mc-1')
    s = receive(s, 'mc-2')
    s = deleteDelivery(s, { delivery_id: s.deliveries[1].id }, ADM).state
    s = receive(s, 'mc-2')
    expect(unique(s.deliveries)).toBe(true)
    expect(unique(s.coils)).toBe(true)
    expect(ids(s.deliveries)).toEqual(['dl-1', 'dl-3'])
  })

  it('plano de corte: excluir e criar de novo não repete id', () => {
    let s = emptyState(CASO_8948)
    s = registerMotherCoil(s, lote(1), ALMOX).state
    s = registerMotherCoil(s, lote(2), ALMOX).state
    s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
    s = savePlan(s, { mother_coil_id: 'mc-2', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
    s = markPlanSent(s, { plan_id: 'plan-1' }, PCP).state
    s = deleteCuttingPlans(s, { mother_coil_id: 'mc-1' }, ADM).state
    s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 6, strip_width: 166 }] }, PCP).state
    expect(unique(s.cuttingPlans)).toBe(true)
    expect(ids(s.cuttingPlans)).toEqual(['plan-2', 'plan-3'])
  })
})
