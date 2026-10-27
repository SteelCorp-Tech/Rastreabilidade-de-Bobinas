/**
 * Saldo de estoque por código ERP (Microsys).
 * - disponível: CUBs IN_STOCK; bloqueado: BLOCKED; em uso: IN_USE. Consumidos e enviados não contam.
 * @param {import('./commands.js').State} state
 */
export function stockBalanceByMaterial(state) {
  const rows = new Map()
  for (const c of state.coils) {
    if (c.status === 'CONSUMED' || c.status === 'RETURNED') continue
    const code = c.material || 'SEM CÓDIGO'
    if (!rows.has(code)) {
      rows.set(code, {
        code, thickness: c.thickness, width: c.width, galvanization: c.galvanization,
        available_count: 0, available_weight: 0, blocked_count: 0, blocked_weight: 0, in_use_count: 0, in_use_weight: 0,
        dimensions: new Set(),
      })
    }
    const r = rows.get(code)
    r.dimensions.add(`${c.thickness}|${c.width}|${c.galvanization}`)
    if (c.status === 'IN_STOCK') { r.available_count++; r.available_weight += c.current_weight }
    else if (c.status === 'BLOCKED') { r.blocked_count++; r.blocked_weight += c.current_weight }
    else if (c.status === 'IN_USE') { r.in_use_count++; r.in_use_weight += c.current_weight }
  }
  return [...rows.values()]
    .map(({ dimensions, ...r }) => ({ ...r, variants: dimensions.size }))
    .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))
}
