import { describe, it, expect } from 'vitest'
import { closeCoilUse, emptyState, markPlanSent, openCoilUse, receiveDelivery, registerMotherCoil, savePlan, setStorageLocation, blockCoilCmd } from './commands.js'
import { expectedRowsFromPlan } from './delivery.js'
import { buildLabel } from './label.js'
import { stockBalanceByMaterial } from './stock.js'
import { roundKg } from './units.js'
import { CASO_8948 } from './test-helpers.js'

const NOW = new Date('2026-10-20T15:00:00Z')
const ctx = (role) => ({ role, user: 'teste', now: NOW })
const ALMOX = ctx('ALMOXARIFADO'), PCP = ctx('PCP'), PROD = ctx('PRODUCAO'), QUAL = ctx('QUALIDADE'), ADM = ctx('ADMIN')
const codeOf = (fn) => { try { fn() } catch (e) { return e.code } return null }

const lote = {
  slitter_lot: '8948', supplier: 'AMAFER', mill: 'CSN', supplier_invoice_number: '213061', thickness: 0.95, width: 1200,
  galvanization: 'Z275', net_weight: 12195, certificate_number: '7948088101', certificate_file: { id: 'a1', name: 'c.pdf' },
}

function withStock() {
  let s = registerMotherCoil(emptyState(CASO_8948), lote, ALMOX).state
  const lines = [
    { mother_coil: 'mc-1', measured_weight: 840, width: 166, material: '10337' },
    { mother_coil: 'mc-1', measured_weight: 850, width: 166, material: '10337' },
    { mother_coil: 'mc-1', measured_weight: 860, width: 166, material: '10337' },
    { mother_coil: 'mc-1', measured_weight: 400, width: 100, material: '10322' },
  ]
  s = receiveDelivery(s, { delivery: { slitter_invoice_number: '14748', declared_coil_count: 4 }, lines }, ALMOX).state
  return s
}

describe('linhas esperadas pelo plano', () => {
  it('lote 8948: 14 linhas de 166 mm com ≈ 843,5 kg estimados', () => {
    let s = registerMotherCoil(emptyState(CASO_8948), lote, ALMOX).state
    s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
    const rows = expectedRowsFromPlan(s.cuttingPlans[0])
    expect(rows).toHaveLength(14)
    expect(rows.every((r) => r.width === 166 && roundKg(r.estimated_weight) === 843.5)).toBe(true)
  })
})

describe('saldo por código ERP', () => {
  it('separa disponível, bloqueado e em uso; consumido não conta', () => {
    let s = withStock()
    s = blockCoilCmd(s, { cub: 'CUB-2026-00001', reason: 'Teste' }, ADM).state
    s = openCoilUse(s, { cub: 'CUB-2026-00002', production_order: 'OP1', project: 'OBRA', machine: 'M', measured_thickness: 0.95 }, PROD).state
    s = openCoilUse(s, { cub: 'CUB-2026-00004', production_order: 'OP2', project: 'OBRA', machine: 'M', measured_thickness: 0.95 }, PROD).state
    s = closeCoilUse(s, { use_id: 'use-2', outcome: 'CONSUMED' }, PROD).state
    const rows = stockBalanceByMaterial(s)
    const r337 = rows.find((r) => r.code === '10337')
    expect(r337).toMatchObject({ available_count: 1, available_weight: 860, blocked_count: 1, blocked_weight: 840, in_use_count: 1, in_use_weight: 850 })
    expect(rows.find((r) => r.code === '10322')).toBeUndefined() // consumido
  })
  it('CUB sem código aparece como "SEM CÓDIGO"', () => {
    let s = registerMotherCoil(emptyState(CASO_8948), lote, ALMOX).state
    s = receiveDelivery(s, { delivery: { slitter_invoice_number: '1', declared_coil_count: 1 }, lines: [{ mother_coil: 'mc-1', measured_weight: 800, width: 166 }] }, ALMOX).state
    expect(stockBalanceByMaterial(s)[0].code).toBe('SEM CÓDIGO')
  })
})

describe('posição no estoque', () => {
  it('Almoxarifado e Produção posicionam; Qualidade não; consumido recusa; audita antes e depois', () => {
    let s = withStock()
    s = setStorageLocation(s, { cub: 'CUB-2026-00001', location: ' Rua B · Prat. 3 ' }, ALMOX).state
    expect(s.coils[0].storage_location).toBe('Rua B · Prat. 3')
    expect(s.auditLog.at(-1)).toMatchObject({ action: 'coil.locate', before: { storage_location: '' }, after: { storage_location: 'Rua B · Prat. 3' } })
    expect(codeOf(() => setStorageLocation(s, { cub: 'CUB-2026-00001', location: 'X' }, QUAL))).toBe('FORBIDDEN')
    s = openCoilUse(s, { cub: 'CUB-2026-00004', production_order: 'OP2', project: 'OBRA', machine: 'M', measured_thickness: 0.95 }, PROD).state
    s = closeCoilUse(s, { use_id: 'use-1', outcome: 'CONSUMED' }, PROD).state
    expect(codeOf(() => setStorageLocation(s, { cub: 'CUB-2026-00004', location: 'X' }, ALMOX))).toBe('LOCATE_NOT_APPLICABLE')
  })
})

describe('etiqueta', () => {
  it('traz os campos da etiqueta atual, o peso medido e o CUB no QR', () => {
    const s = withStock()
    const l = buildLabel(s, s.coils[0])
    expect(l).toMatchObject({
      cub: 'CUB-2026-00001', kind: 'NEW', lot: '8948', material: '10337', supplier: 'AMAFER - CSN', galvanization: 'Z275',
      dimension: '0,95x166', supplier_invoice: '213061', slitter_invoice: '14748', certificate: '7948088101', weight: 840, qr: 'CUB-2026-00001',
    })
  })
  it('sobra: mesmo CUB, novo peso e nova data', () => {
    const s = withStock()
    const l = buildLabel(s, s.coils[0], { kind: 'LEFTOVER', weight: 300, date: '2026-10-21' })
    expect(l).toMatchObject({ cub: 'CUB-2026-00001', kind: 'LEFTOVER', weight: 300, date: '2026-10-21', qr: 'CUB-2026-00001' })
  })
})
