import { describe, it, expect } from 'vitest'
import { formatCub, generateCubs, nextCubSeq, parseCub } from './cub.js'

describe('CUB', () => {
  it('formata CUB-AAAA-NNNNN', () => {
    expect(formatCub(2026, 237)).toBe('CUB-2026-00237')
  })
  it('lê e recusa formatos inválidos', () => {
    expect(parseCub('CUB-2026-00237')).toEqual({ prefix: 'CUB', year: 2026, seq: 237 })
    expect(parseCub('N/D')).toBeNull()
    expect(parseCub('')).toBeNull()
  })
  it('sequencial por ano, ignorando outros anos', () => {
    const coils = [{ cub: 'CUB-2025-00500' }, { cub: 'CUB-2026-00003' }]
    expect(nextCubSeq(coils, 2026)).toBe(4)
    expect(nextCubSeq(coils, 2027)).toBe(1)
  })
  it('nunca reutiliza número, mesmo de CUB consumido', () => {
    const coils = [{ cub: 'CUB-2026-00001', status: 'CONSUMED' }, { cub: 'CUB-2026-00002', status: 'CONSUMED' }]
    expect(generateCubs(coils, 2026, 2)).toEqual(['CUB-2026-00003', 'CUB-2026-00004'])
  })
  it('recusa quantidade inválida', () => {
    expect(() => generateCubs([], 2026, 0)).toThrow()
  })
})
