/** Formatação pt-BR e leitura de números digitados (aceita vírgula ou ponto). */
const nf = (digits) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const KG = nf(1)
const MM2 = nf(2)
const PCT = nf(1)

export const fmtKg = (v) => (v == null ? '—' : `${KG.format(v)} kg`)
export const fmtMm = (v) => (v == null ? '—' : `${MM2.format(v)} mm`)
export const fmtThickness = (v) => MM2.format(v)
export const fmtPct = (v) => `${PCT.format(v)}%`
export const fmtInt = (v) => new Intl.NumberFormat('pt-BR').format(v)

/** "1,25" ou "1.25" → 1.25; vazio ou inválido → NaN. */
export function parseDecimal(text) {
  const t = String(text ?? '').trim().replace(/\s/g, '')
  if (!t) return NaN
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return Number(normalized)
}

const DATE = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })
const DATETIME = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
export const fmtDate = (iso) => (iso ? DATE.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)) : '—')
export const fmtDateTime = (iso) => (iso ? DATETIME.format(new Date(iso)) : '—')
