/**
 * Balanço de massa por lote: peso líquido da mãe contra soma dos pesos recebidos mais refilo.
 * @param {{net_weight: number, trim_weight?: number, received_weights: number[], tolerance_pct?: number}} input
 */
export function massBalance({ net_weight, trim_weight = 0, received_weights, tolerance_pct = 1 }) {
  const received = received_weights.reduce((s, w) => s + w, 0)
  const accounted = received + trim_weight
  const difference = net_weight - accounted
  const differencePct = net_weight > 0 ? (Math.abs(difference) / net_weight) * 100 : 0
  return {
    net_weight,
    received_weight: received,
    trim_weight,
    accounted_weight: accounted,
    difference,
    difference_pct: differencePct,
    within_tolerance: differencePct <= tolerance_pct,
  }
}
