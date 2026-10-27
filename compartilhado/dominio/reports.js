/**
 * Relatórios tabulares e CSV (padrão Excel pt-BR: separador ";", decimal com vírgula, aspas quando precisa).
 * @typedef {{key: string, header: string}} Column
 */

const num = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v)

/** @param {Column[]} columns @param {Object[]} rows */
export function toCsv(columns, rows) {
  const cell = (v) => {
    const s = String(num(v) ?? '')
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.map((c) => cell(c.header)).join(';'), ...rows.map((r) => columns.map((c) => cell(r[c.key] ?? '')).join(';'))].join('\r\n')
}

export const RECALL_COLUMNS = [
  { key: 'lot', header: 'Lote' }, { key: 'cub', header: 'CUB' }, { key: 'status', header: 'Situação' },
  { key: 'received_weight', header: 'Peso recebido (kg)' }, { key: 'current_weight', header: 'Saldo atual (kg)' },
  { key: 'production_order', header: 'OP' }, { key: 'project', header: 'Obra' }, { key: 'use_date', header: 'Data do uso' },
  { key: 'consumption', header: 'Consumo (kg)' }, { key: 'certificate', header: 'Certificado' },
  { key: 'supplier', header: 'Fornecedor' }, { key: 'supplier_invoice', header: 'NF fornecedor' }, { key: 'slitter_invoice', header: 'NF prestador' },
]

/** Uma linha por uso; CUBs sem uso entram com os campos de uso vazios. @param {ReturnType<import('./traceability.js').recallByLot>} recall */
export function recallRows(state, recall) {
  const rows = []
  for (const c of recall.coils) {
    const coil = state.coils.find((x) => x.cub === c.cub)
    const mother = state.motherCoils.find((m) => m.id === coil.mother_coil)
    const base = {
      lot: coil.slitter_lot, cub: c.cub, status: c.status, received_weight: c.received_weight, current_weight: c.current_weight,
      certificate: mother.certificate_number, supplier: mother.supplier, supplier_invoice: mother.supplier_invoice_number, slitter_invoice: coil.slitter_invoice_number,
    }
    const uses = recall.uses.filter((u) => u.cub === c.cub)
    if (!uses.length) rows.push(base)
    for (const u of uses) rows.push({ ...base, production_order: u.production_order, project: u.project, use_date: u.opened_at.slice(0, 10), consumption: u.consumption })
  }
  return rows
}

export const PROJECT_COLUMNS = [
  { key: 'project', header: 'Obra' }, { key: 'use_date', header: 'Data do uso' }, { key: 'production_order', header: 'OP' }, { key: 'cub', header: 'CUB' },
  { key: 'consumption', header: 'Consumo (kg)' }, { key: 'lot', header: 'Lote' }, { key: 'supplier', header: 'Fornecedor' }, { key: 'mill', header: 'Usina' },
  { key: 'supplier_invoice', header: 'NF fornecedor' }, { key: 'slitter_invoice', header: 'NF prestador' }, { key: 'certificate', header: 'Certificado' },
  { key: 'dimension', header: 'Material' },
]

/** @param {NonNullable<ReturnType<import('./traceability.js').recallByProject>>} recall */
export function projectRows(recall) {
  return recall.rows.map(({ use, coil, mother }) => ({
    project: recall.project, use_date: use.opened_at.slice(0, 10), production_order: use.production_order, cub: coil.cub, consumption: use.consumption,
    lot: mother.slitter_lot, supplier: mother.supplier, mill: mother.mill, supplier_invoice: mother.supplier_invoice_number,
    slitter_invoice: coil.slitter_invoice_number, certificate: mother.certificate_number,
    dimension: `${coil.thickness} x ${coil.width} ${coil.galvanization}`,
  }))
}

export const BALANCE_COLUMNS = [
  { key: 'slitter_lot', header: 'Lote' }, { key: 'net_weight', header: 'Peso líquido (kg)' }, { key: 'received_weight', header: 'CUBs (kg)' },
  { key: 'trim_weight', header: 'Refilo (kg)' }, { key: 'difference', header: 'Diferença (kg)' }, { key: 'difference_pct', header: 'Diferença (%)' },
  { key: 'result', header: 'Resultado' }, { key: 'basis', header: 'Base dos pesos' },
]

export function balanceRows(report) {
  return report.map((b) => ({
    ...b, result: b.within_tolerance ? 'Dentro da tolerância' : 'Fora da tolerância',
    basis: b.estimated ? 'Estimado (fórmula do plano)' : 'Medido na balança',
  }))
}

export const AUDIT_COLUMNS = [
  { key: 'at', header: 'Quando' }, { key: 'user', header: 'Usuário' }, { key: 'role', header: 'Perfil' }, { key: 'action', header: 'Ação' },
  { key: 'entity', header: 'Entidade' }, { key: 'entity_id', header: 'Id' }, { key: 'reason', header: 'Motivo' },
  { key: 'before', header: 'Antes' }, { key: 'after', header: 'Depois' },
]

export function auditRows(log) {
  return log.map((a) => ({
    at: a.at, user: a.actor.user, role: a.actor.role, action: a.action, entity: a.entity, entity_id: a.entity_id, reason: a.reason ?? '',
    before: a.before == null ? '' : JSON.stringify(a.before), after: a.after == null ? '' : JSON.stringify(a.after),
  }))
}
