import { lacksCertificate } from './motherCoil.js'
import { massBalance } from './massBalance.js'
import { calcCuttingPlan } from './cuttingPlan.js'

/** Plano vigente de uma mãe: a maior versão não substituída. */
export function activePlan(state, motherId) {
  const plans = state.cuttingPlans.filter((p) => p.mother_coil === motherId && p.status !== 'SUPERSEDED')
  return plans.sort((a, b) => b.version - a.version)[0] ?? null
}

/** Cadeia de elos de um CUB: fornecedor/usina → mãe (NF, certificado) → lote e OP do prestador → entrega → CUB → usos. */
export function chainOfCoil(state, cub) {
  const coil = state.coils.find((c) => c.cub === cub)
  if (!coil) return null
  const mother = state.motherCoils.find((m) => m.id === coil.mother_coil)
  return {
    coil,
    mother_coil: mother,
    delivery: state.deliveries.find((d) => d.id === coil.delivery) ?? null,
    plan: mother ? activePlan(state, mother.id) : null,
    certificate: mother ? { number: mother.certificate_number, file: mother.certificate_file } : null,
    uses: state.uses.filter((u) => u.coil === coil.id),
  }
}

function summarize(state, motherCoils) {
  const motherIds = new Set(motherCoils.map((m) => m.id))
  const coils = state.coils.filter((c) => motherIds.has(c.mother_coil))
  const coilIds = new Set(coils.map((c) => c.id))
  const uses = state.uses.filter((u) => coilIds.has(u.coil))
  const distinct = (xs) => [...new Set(xs.filter(Boolean))]

  const balances = motherCoils.map((m) => {
    const plan = activePlan(state, m.id)
    const trim = plan?.result?.trim_weight ?? 0
    return {
      mother_coil: m.id,
      slitter_lot: m.slitter_lot,
      trim_known: !!plan,
      ...massBalance({
        net_weight: m.net_weight,
        trim_weight: trim,
        received_weights: coils.filter((c) => c.mother_coil === m.id).map((c) => c.received_weight),
        tolerance_pct: state.config.mass_tolerance_pct,
      }),
    }
  })

  return {
    mother_coils: motherCoils,
    coils: coils.map((c) => ({
      cub: c.cub,
      status: c.status,
      received_weight: c.received_weight,
      current_weight: c.current_weight,
    })),
    stock_weight: coils.filter((c) => c.status === 'IN_STOCK' || c.status === 'BLOCKED' || c.status === 'IN_USE').reduce((s, c) => s + c.current_weight, 0),
    uses: uses.map((u) => ({ ...u, cub: coils.find((c) => c.id === u.coil).cub })),
    projects: distinct(uses.map((u) => u.project)),
    production_orders: distinct(uses.map((u) => u.production_order)),
    total_consumption: uses.reduce((s, u) => s + (u.consumption ?? 0), 0),
    balances,
  }
}

/** Recall por lote do prestador. @returns {ReturnType<typeof summarize>|null} */
export function recallByLot(state, slitterLot) {
  const lot = String(slitterLot).trim()
  const mothers = state.motherCoils.filter((m) => m.slitter_lot === lot)
  return mothers.length ? summarize(state, mothers) : null
}

/** Recall por número de certificado (pode abranger mais de uma mãe). */
export function recallByCertificate(state, certificateNumber) {
  const n = String(certificateNumber).trim().toLowerCase()
  const mothers = state.motherCoils.filter((m) => (m.certificate_number ?? '').trim().toLowerCase() === n)
  return mothers.length ? summarize(state, mothers) : null
}

/** Pendências: bobinas mãe sem certificado completo (número e arquivo). */
export function certificatePendencies(state) {
  return state.motherCoils.filter(lacksCertificate)
}

/** Previsão do plano usando o limite da configuração (utilitário para telas). */
export function planFor(state, mother, lines) {
  return calcCuttingPlan({ mother_width: mother.width, net_weight: mother.net_weight, weight_limit: state.config.weight_limit, lines })
}

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(',', '.')

/** Busca universal: CUB, lote, NF, OP, obra, certificado, código ERP, dimensão. */
export function searchAll(state, query) {
  const q = norm(query)
  if (!q) return []
  const hit = (v) => norm(v).includes(q)
  const out = []
  for (const c of state.coils) {
    const dim = `${c.thickness}x${c.width}`
    if ([c.cub, c.slitter_lot, c.slitter_invoice_number, c.material, c.certificate_number, c.last_project, c.last_production_order].some(hit) || hit(dim)) {
      out.push({ type: 'coil', id: c.id, label: c.cub })
    }
  }
  for (const m of state.motherCoils) {
    if ([m.slitter_lot, m.supplier_invoice_number, m.certificate_number, m.slitter_job_ref, m.mill_coil_number].some(hit)) {
      out.push({ type: 'mother_coil', id: m.id, label: `Lote ${m.slitter_lot}` })
    }
  }
  for (const u of state.uses) {
    if ([u.production_order, u.project].some(hit)) out.push({ type: 'use', id: u.id, label: `OP ${u.production_order} · ${u.project}` })
  }
  return out
}
