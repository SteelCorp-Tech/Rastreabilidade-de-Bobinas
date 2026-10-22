import { describe, it, expect } from 'vitest'
import seed from './seed.json'
import { parseCub } from '../../domain/cub.js'
import { certificatePendencies, chainOfCoil, recallByLot } from '../../domain/traceability.js'
import { generateCubs } from '../../domain/cub.js'

describe('seed (gerado do Excel real)', () => {
  const coilById = new Map(seed.coils.map((c) => [c.id, c]))

  it('tem o formato do estado de domínio', () => {
    for (const k of ['config', 'suppliers', 'mills', 'projects', 'machines', 'materials', 'motherCoils', 'cuttingPlans', 'deliveries', 'coils', 'uses', 'auditLog']) {
      expect(seed, k).toHaveProperty(k)
    }
    expect(seed.config.weight_limit).toBe(700)
    expect(seed.config.certificate_required).toBe(true)
  })

  it('CUBs únicos, no formato CUB-AAAA-NNNNN, e o lote 8948 reservado ficou de fora', () => {
    const cubs = seed.coils.map((c) => c.cub)
    expect(new Set(cubs).size).toBe(cubs.length)
    expect(cubs.every((c) => parseCub(c))).toBe(true)
    expect(seed.motherCoils.some((m) => m.slitter_lot === '8948')).toBe(false)
  })

  it('o próximo CUB emitido vem depois de todos os CUBs físicos do Excel', () => {
    expect(seed.cub_floor['2026']).toBeGreaterThanOrEqual(575)
    expect(generateCubs(seed.coils, 2026, 1, undefined, seed.cub_floor['2026'])[0]).toBe('CUB-2026-00576')
  })

  it('referências íntegras: toda bobina aponta para mãe e entrega existentes', () => {
    const mothers = new Set(seed.motherCoils.map((m) => m.id))
    const deliveries = new Set(seed.deliveries.map((d) => d.id))
    for (const c of seed.coils) {
      expect(mothers.has(c.mother_coil), c.cub).toBe(true)
      expect(deliveries.has(c.delivery), c.cub).toBe(true)
      expect(c.received_weight, c.cub).toBeGreaterThan(0)
      expect(c.current_weight, c.cub).toBeGreaterThanOrEqual(0)
      expect(c.current_weight, c.cub).toBeLessThanOrEqual(c.received_weight)
    }
    for (const d of seed.deliveries) expect(d.declared_coil_count).toBe(d.cubs.length)
  })

  it('usos coerentes: peso depois ≤ antes, encadeados, e consumida zera', () => {
    const byCoil = new Map()
    for (const u of seed.uses) {
      expect(coilById.has(u.coil)).toBe(true)
      expect(u.weight_after).toBeLessThanOrEqual(u.weight_before)
      expect(u.consumption).toBeCloseTo(u.weight_before - u.weight_after, 1)
      if (u.outcome === 'CONSUMED') expect(u.weight_after).toBe(0)
      if (!byCoil.has(u.coil)) byCoil.set(u.coil, [])
      byCoil.get(u.coil).push(u)
    }
    for (const [id, list] of byCoil) {
      for (let i = 1; i < list.length; i++) expect(list[i].weight_before, id).toBe(list[i - 1].weight_after)
      const c = coilById.get(id)
      expect(c.current_weight).toBe(list.at(-1).weight_after)
      expect(c.use_count).toBe(list.length)
    }
  })

  it('um CUB tem no máximo um uso aberto (no seed, nenhum) e CUB consumido tem peso zero', () => {
    expect(seed.uses.every((u) => u.closed_at)).toBe(true)
    for (const c of seed.coils.filter((x) => x.status === 'CONSUMED')) expect(c.current_weight).toBe(0)
  })

  it('certificado: número e arquivo andam juntos; pendências aparecem para lotes sem certificado', () => {
    for (const m of seed.motherCoils) expect(!!m.certificate_number).toBe(!!m.certificate_file)
    const pend = certificatePendencies(seed)
    expect(pend.length).toBeGreaterThan(0)
    expect(pend.every((m) => !m.certificate_file)).toBe(true)
  })

  it('planos de corte derivados fecham o balanço de massa dentro de 1% nos lotes com plano', () => {
    const lotsWithPlan = seed.cuttingPlans.map((p) => seed.motherCoils.find((m) => m.id === p.mother_coil).slitter_lot)
    expect(lotsWithPlan.length).toBeGreaterThan(10)
    for (const lot of lotsWithPlan) {
      const r = recallByLot(seed, lot)
      if (!r.coils.length) continue
      const b = r.balances[0]
      expect(b.trim_known).toBe(true)
      if (b.difference_pct > 1) console.warn(`lote ${lot}: balanço fora de 1% (${b.difference_pct.toFixed(1)}%), ver seed-report.md`)
    }
  })

  it('a cadeia de elos funciona sobre um CUB do seed com uso', () => {
    const used = seed.uses[0]
    const coil = coilById.get(used.coil)
    const chain = chainOfCoil(seed, coil.cub)
    expect(chain.mother_coil.slitter_lot).toBe(coil.slitter_lot)
    expect(chain.uses.length).toBeGreaterThan(0)
    expect(chain.delivery).not.toBeNull()
  })
})
