import { describe, it, expect } from 'vitest'
import {
  closeCoilUse, emptyState, markPlanSent, openCoilUse, receiveDelivery, registerMotherCoil, savePlan,
} from './commands.js'
import { massBalanceReport, projectNames, recallByLot, recallByProject, searchAll } from './traceability.js'
import { balanceRows, BALANCE_COLUMNS, PROJECT_COLUMNS, projectRows, RECALL_COLUMNS, recallRows, toCsv } from './reports.js'
import { CASO_8948 } from './test-helpers.js'

const NOW = new Date('2026-10-20T15:00:00Z')
const ctx = (role) => ({ role, user: 'teste', now: NOW })
const ALMOX = ctx('ALMOXARIFADO'), PCP = ctx('PCP'), PROD = ctx('PRODUCAO')

function scenario() {
  let s = registerMotherCoil(emptyState(CASO_8948), {
    slitter_lot: '8948', supplier: 'AMAFER', mill: 'CSN', supplier_invoice_number: '213061', thickness: 0.95, width: 1200,
    galvanization: 'Z275', net_weight: 12195, certificate_number: '7948088101', certificate_file: { id: 'a', name: 'c.pdf' },
  }, ALMOX).state
  s = savePlan(s, { mother_coil_id: 'mc-1', lines: [{ strip_count: 7, strip_width: 166 }] }, PCP).state
  s = markPlanSent(s, { plan_id: 'plan-1' }, PCP).state
  const lines = Array.from({ length: 14 }, () => ({ mother_coil: 'mc-1', measured_weight: 843.5, width: 166 }))
  s = receiveDelivery(s, { delivery: { slitter_invoice_number: '14748', declared_coil_count: 14 }, lines }, ALMOX).state
  const use = (cub, project, op) => ({ cub, production_order: op, project, machine: 'FRAMECAD 90', measured_thickness: 0.95 })
  s = openCoilUse(s, use('CUB-2026-00001', 'OBRA Y', 'OP-X'), PROD).state
  s = closeCoilUse(s, { use_id: 'use-1', outcome: 'LEFTOVER', weight_after: 300 }, PROD).state
  s = openCoilUse(s, use('CUB-2026-00001', 'OBRA Z', 'OP-Z'), PROD).state
  s = closeCoilUse(s, { use_id: 'use-2', outcome: 'CONSUMED' }, PROD).state
  s = openCoilUse(s, use('CUB-2026-00002', 'Obra Y', 'OP-Y2'), PROD).state
  s = closeCoilUse(s, { use_id: 'use-3', outcome: 'CONSUMED' }, PROD).state
  return s
}

describe('rastreabilidade por obra', () => {
  it('diz de quais lote, certificado e NF saiu o aço da obra (sem diferenciar maiúsculas)', () => {
    const s = scenario()
    const r = recallByProject(s, 'obra y')
    expect(r.rows).toHaveLength(2)
    expect(r.lots).toHaveLength(1)
    expect(r.lots[0].mother_coil.slitter_lot).toBe('8948')
    expect(r.certificates).toEqual(['7948088101'])
    expect(r.production_orders.sort()).toEqual(['OP-X', 'OP-Y2'])
    expect(r.total_consumption).toBe(543.5 + 843.5)
    expect(recallByProject(s, 'OBRA INEXISTENTE')).toBeNull()
  })
  it('lista as obras e a busca universal encontra a obra', () => {
    const s = scenario()
    expect(projectNames(s)).toEqual(['OBRA Y', 'OBRA Z'])
    expect(searchAll(s, 'obra z').some((x) => x.type === 'project')).toBe(true)
  })
})

describe('balanço de massa por lote', () => {
  it('fecha o 8948 dentro da tolerância, medido', () => {
    const rows = massBalanceReport(scenario())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ slitter_lot: '8948', cubs: 14, trim_known: true, within_tolerance: true, estimated: false })
  })
})

describe('CSV', () => {
  it('padrão Excel pt-BR: ponto e vírgula, vírgula decimal, aspas quando preciso', () => {
    const csv = toCsv([{ key: 'a', header: 'A' }, { key: 'b', header: 'B;C' }], [{ a: 843.5, b: 'x "y"' }, { a: 'z', b: 'p;q' }])
    expect(csv).toBe('A;"B;C"\r\n843,5;"x ""y"""\r\nz;"p;q"')
  })
  it('recall por lote: uma linha por uso, CUBs sem uso incluídos', () => {
    const s = scenario()
    const rows = recallRows(s, recallByLot(s, '8948'))
    // 12 CUBs sem uso (1 linha cada) + CUB 00001 com 2 usos (2 linhas) + CUB 00002 com 1 uso (1 linha)
    expect(rows).toHaveLength(15)
    expect(rows.filter((r) => r.cub === 'CUB-2026-00001').map((r) => r.project)).toEqual(['OBRA Y', 'OBRA Z'])
  })
  it('as colunas casam com as linhas', () => {
    const s = scenario()
    const csv = toCsv(RECALL_COLUMNS, recallRows(s, recallByLot(s, '8948')))
    expect(csv.split('\r\n')[0].split(';')).toHaveLength(RECALL_COLUMNS.length)
    expect(csv).toContain('CUB-2026-00001')
    const p = toCsv(PROJECT_COLUMNS, projectRows(recallByProject(s, 'OBRA Z')))
    expect(p.split('\r\n')[1]).toContain('7948088101')
    const b = toCsv(BALANCE_COLUMNS, balanceRows(massBalanceReport(s)))
    expect(b).toContain('Dentro da tolerância')
  })
})
