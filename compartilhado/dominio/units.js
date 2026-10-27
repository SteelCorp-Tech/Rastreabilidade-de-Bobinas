/**
 * Unidades e arredondamento. Calcula-se com precisão total e arredonda-se só na exibição
 * ou ao gravar um valor medido: peso em kg (1 casa), espessura em mm (2 casas), largura em mm.
 */

/** Arredonda sem o erro de ponto flutuante de x.xx5. */
export function round(value, digits) {
  const f = 10 ** digits
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f
}
export const roundKg = (v) => round(v, 1)
export const roundMm = (v) => round(v, 2)

/** ceil tolerante a erro de ponto flutuante (2000.0000000001 / 1000 não vira 3). */
export function ceilTolerant(value) {
  return Math.ceil(value - 1e-9)
}

const SP = 'America/Sao_Paulo'

/** Ano civil em America/Sao_Paulo. @param {Date} date */
export function yearInSaoPaulo(date) {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: SP, year: 'numeric' }).format(date))
}

/** Data AAAA-MM-DD em America/Sao_Paulo. @param {Date} date */
export function dateInSaoPaulo(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SP, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
