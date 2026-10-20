import { ensure } from './errors.js'

/**
 * CUB (Código Único da Bobina): `CUB-AAAA-NNNNN`. Sequencial por ano, nunca reutilizado.
 */

/** @param {number} year @param {number} seq @param {{cub_prefix?: string, cub_digits?: number}} [fmt] */
export function formatCub(year, seq, { cub_prefix = 'CUB', cub_digits = 5 } = {}) {
  return `${cub_prefix}-${year}-${String(seq).padStart(cub_digits, '0')}`
}

/** @param {string} cub @returns {{prefix: string, year: number, seq: number}|null} */
export function parseCub(cub) {
  const m = /^([A-Z]+)-(\d{4})-(\d+)$/.exec(String(cub ?? '').trim().toUpperCase())
  return m ? { prefix: m[1], year: Number(m[2]), seq: Number(m[3]) } : null
}

/**
 * Próximo sequencial do ano: maior número já emitido + 1. Considera TODOS os CUBs
 * (inclusive consumidos), por isso um número nunca volta.
 * @param {{cub: string}[]} coils
 */
export function nextCubSeq(coils, year) {
  let max = 0
  for (const c of coils) {
    const p = parseCub(c.cub)
    if (p && p.year === year && p.seq > max) max = p.seq
  }
  return max + 1
}

/** Gera `count` CUBs consecutivos. @param {{cub: string}[]} coils */
export function generateCubs(coils, year, count, fmt) {
  ensure(Number.isInteger(count) && count > 0, 'CUB_COUNT_INVALID', 'A quantidade de CUBs deve ser um inteiro positivo.')
  const start = nextCubSeq(coils, year)
  return Array.from({ length: count }, (_, i) => formatCub(year, start + i, fmt))
}
