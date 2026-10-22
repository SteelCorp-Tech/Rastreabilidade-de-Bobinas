import { DomainError, ensure } from './errors.js'
import { ceilTolerant } from './units.js'
import { DEFAULT_CONFIG } from './config.js'

/**
 * @typedef {{strip_count: number, strip_width: number}} PlanLine
 * @typedef {Object} PlanLineResult
 * @property {number} strip_count
 * @property {number} strip_width
 * @property {number} strip_weight        Peso de uma tira inteira (kg).
 * @property {number} coils_per_strip     Bobinas por tira (a tira é dividida no comprimento).
 * @property {number} coil_weight         Peso estimado por CUB (kg), só referência.
 * @property {number} cubs                CUBs previstos desta linha.
 * @typedef {Object} PlanResult
 * @property {number} used_width
 * @property {number} trim_width
 * @property {number} trim_weight
 * @property {number} utilization_pct
 * @property {PlanLineResult[]} lines
 * @property {number} total_cubs
 */

/**
 * Cálculos do plano de corte (CLAUDE.md seção 6). Valores sem arredondar:
 * quem exibe arredonda.
 * @param {{mother_width: number, net_weight: number, weight_limit?: number, lines: PlanLine[]}} input
 * @returns {PlanResult}
 */
export function calcCuttingPlan({ mother_width: W, net_weight: P, weight_limit: L = DEFAULT_CONFIG.weight_limit, lines }) {
  ensure(W > 0, 'PLAN_INVALID', 'A largura da bobina mãe deve ser maior que zero.')
  ensure(P > 0, 'PLAN_INVALID', 'O peso líquido da bobina mãe deve ser maior que zero.')
  ensure(L > 0, 'PLAN_INVALID', 'O limite de peso por bobina deve ser maior que zero.')
  ensure(lines.length > 0, 'PLAN_INVALID', 'O plano precisa de ao menos uma linha.')
  for (const l of lines) {
    ensure(Number.isInteger(l.strip_count) && l.strip_count > 0, 'PLAN_INVALID', 'A quantidade de tiras deve ser um inteiro positivo.')
    ensure(l.strip_width > 0, 'PLAN_INVALID', 'A largura da tira deve ser maior que zero.')
  }

  const usedWidth = lines.reduce((s, l) => s + l.strip_count * l.strip_width, 0)
  if (usedWidth > W) {
    throw new DomainError(
      'PLAN_WIDTH_EXCEEDED',
      `A largura utilizada (${usedWidth} mm) passa da largura da bobina mãe (${W} mm).`,
      { used_width: usedWidth, mother_width: W },
    )
  }
  const trimWidth = W - usedWidth

  const resultLines = lines.map((l) => {
    const stripWeight = (P * l.strip_width) / W
    const coilsPerStrip = ceilTolerant(stripWeight / L)
    return {
      strip_count: l.strip_count,
      strip_width: l.strip_width,
      strip_weight: stripWeight,
      coils_per_strip: coilsPerStrip,
      coil_weight: stripWeight / coilsPerStrip,
      cubs: l.strip_count * coilsPerStrip,
    }
  })

  return {
    used_width: usedWidth,
    trim_width: trimWidth,
    trim_weight: (P * trimWidth) / W,
    utilization_pct: (usedWidth / W) * 100,
    lines: resultLines,
    total_cubs: resultLines.reduce((s, l) => s + l.cubs, 0),
  }
}

/**
 * Regra do refilo (sobra lateral): todo plano precisa deixar entre `trim_min_mm` e `trim_max_mm`.
 * Sem limites configurados (null), a regra fica desligada.
 * @param {number} trimWidth refilo do plano em mm
 * @param {{trim_min_mm?: number|null, trim_max_mm?: number|null}} [config]
 * @returns {{ok: boolean, min: number|null, max: number|null, message: string}}
 */
export function checkTrim(trimWidth, config = DEFAULT_CONFIG) {
  const min = config.trim_min_mm ?? null
  const max = config.trim_max_mm ?? null
  if (min == null && max == null) return { ok: true, min, max, message: '' }
  const range = min != null && max != null ? `entre ${min} e ${max} mm` : min != null ? `de no mínimo ${min} mm` : `de no máximo ${max} mm`
  const tooLow = min != null && trimWidth < min
  const tooHigh = max != null && trimWidth > max
  const message = `O refilo do plano é de ${trimWidth} mm e precisa ficar ${range}.`
  return { ok: !tooLow && !tooHigh, min, max, message }
}
