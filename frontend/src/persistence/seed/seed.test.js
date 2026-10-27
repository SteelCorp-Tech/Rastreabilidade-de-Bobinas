import { describe, it, expect } from 'vitest'
import seed from './seed.json'
import { DEFAULT_CONFIG } from '@dominio/config.js'
import { generateCubs } from '@dominio/cub.js'

// Desde 26/10/2026 o app começa vazio: nenhum dado de negócio, só configuração padrão e a numeração do CUB.
describe('estado inicial do app (vazio)', () => {
  it('tem o formato do estado de domínio e nenhum dado', () => {
    for (const k of ['suppliers', 'mills', 'projects', 'machines', 'materials', 'motherCoils', 'cuttingPlans', 'deliveries', 'coils', 'uses', 'auditLog']) {
      expect(seed[k], k).toEqual([])
    }
    expect(seed.permissions).toBeUndefined()
  })

  it('vem com a configuração padrão', () => {
    expect(seed.config).toEqual(DEFAULT_CONFIG)
  })

  it('o próximo CUB continua depois das 575 etiquetas físicas de 2026 (número nunca se repete)', () => {
    expect(seed.cub_floor['2026']).toBe(575)
    expect(generateCubs(seed.coils, 2026, 1, undefined, seed.cub_floor['2026'])[0]).toBe('CUB-2026-00576')
  })
})
