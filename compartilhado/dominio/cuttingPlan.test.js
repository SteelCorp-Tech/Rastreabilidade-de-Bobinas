import { describe, it, expect } from 'vitest'
import { calcCuttingPlan, checkTrim } from './cuttingPlan.js'
import { massBalance } from './massBalance.js'
import { roundKg } from './units.js'

// Lote real 8948: mãe 0,95 × 1.200 mm, 12.195 kg; 7 tiras de 166 mm.
const lote8948 = { mother_width: 1200, net_weight: 12195, lines: [{ strip_count: 7, strip_width: 166 }] }

describe('plano de corte: lote 8948', () => {
  it('com limite de 1.000 kg: refilo 386,2 kg, 2 bobinas por tira, 14 CUBs de 843,5 kg', () => {
    const r = calcCuttingPlan({ ...lote8948, weight_limit: 1000 })
    expect(r.used_width).toBe(1162)
    expect(r.trim_width).toBe(38)
    expect(roundKg(r.trim_weight)).toBe(386.2)
    expect(r.utilization_pct).toBeCloseTo(96.83, 2)
    const l = r.lines[0]
    expect(roundKg(l.strip_weight)).toBe(1687) // 1.686,975 antes de arredondar
    expect(l.coils_per_strip).toBe(2)
    expect(roundKg(l.coil_weight)).toBe(843.5)
    expect(r.total_cubs).toBe(14)
  })

  it('com limite de 800 kg: 3 bobinas por tira e 21 CUBs', () => {
    const r = calcCuttingPlan({ ...lote8948, weight_limit: 800 })
    expect(r.lines[0].coils_per_strip).toBe(3)
    expect(roundKg(r.lines[0].coil_weight)).toBe(562.3)
    expect(r.total_cubs).toBe(21)
  })

  it('usa 700 kg como limite padrão (definido pela PCP)', () => {
    const r = calcCuttingPlan(lote8948)
    expect(r.lines[0].coils_per_strip).toBe(3)
    expect(roundKg(r.lines[0].coil_weight)).toBe(562.3)
    expect(r.total_cubs).toBe(21)
  })

  it('o peso do CUB não soma o refilo (erro da planilha: 871,1 kg)', () => {
    const r = calcCuttingPlan(lote8948)
    expect(roundKg(r.lines[0].coil_weight)).not.toBe(871.1)
    const liquido = 12195 - r.trim_weight
    expect(roundKg(liquido)).toBe(11808.8)
    expect(roundKg(liquido / 14)).toBe(843.5)
  })

  it('peso exatamente no limite não cria bobina a mais', () => {
    const r = calcCuttingPlan({ mother_width: 1000, net_weight: 2000, weight_limit: 1000, lines: [{ strip_count: 1, strip_width: 500 }] })
    expect(r.lines[0].coils_per_strip).toBe(1) // 1.000 kg / 1.000 kg
  })

  it('várias linhas somam os CUBs previstos', () => {
    const r = calcCuttingPlan({
      mother_width: 1200,
      net_weight: 12000,
      lines: [{ strip_count: 2, strip_width: 295 }, { strip_count: 4, strip_width: 148 }],
    })
    expect(r.used_width).toBe(1182)
    expect(r.total_cubs).toBe(r.lines.reduce((s, l) => s + l.cubs, 0))
  })
})

describe('plano de corte: validações', () => {
  it('recusa largura utilizada maior que a da mãe', () => {
    expect(() => calcCuttingPlan({ ...lote8948, lines: [{ strip_count: 8, strip_width: 166 }] })).toThrow(/passa da largura/)
  })
  it('recusa quantidade e largura inválidas', () => {
    expect(() => calcCuttingPlan({ ...lote8948, lines: [{ strip_count: 0, strip_width: 166 }] })).toThrow()
    expect(() => calcCuttingPlan({ ...lote8948, lines: [{ strip_count: 1, strip_width: -5 }] })).toThrow()
    expect(() => calcCuttingPlan({ ...lote8948, lines: [] })).toThrow()
  })
})

describe('balanço de massa', () => {
  it('fecha dentro da tolerância: pesos medidos + refilo contra o peso líquido', () => {
    const r = massBalance({ net_weight: 12195, trim_weight: 386.175, received_weights: Array(14).fill(843.5), tolerance_pct: 1 })
    expect(r.received_weight).toBe(11809)
    expect(Math.abs(r.difference)).toBeLessThan(1)
    expect(r.within_tolerance).toBe(true)
  })
  it('acusa diferença acima da tolerância', () => {
    const r = massBalance({ net_weight: 12195, trim_weight: 386.2, received_weights: Array(14).fill(800), tolerance_pct: 1 })
    expect(r.within_tolerance).toBe(false)
  })
})

describe('regra do refilo (14 a 30 mm)', () => {
  it('aceita refilo dentro da faixa e recusa fora dela', () => {
    expect(checkTrim(14).ok).toBe(true)
    expect(checkTrim(30).ok).toBe(true)
    expect(checkTrim(13.9).ok).toBe(false)
    expect(checkTrim(38).ok).toBe(false)
    expect(checkTrim(38).message).toMatch(/entre 14 e 30 mm/)
  })

  it('sem limites configurados a regra fica desligada', () => {
    expect(checkTrim(500, { trim_min_mm: null, trim_max_mm: null }).ok).toBe(true)
  })
})
