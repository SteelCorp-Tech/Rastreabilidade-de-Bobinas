import { ensure } from './errors.js'
import { audit, authorize } from './commands.js'

/**
 * Exclusões (só o administrador).
 * Exceção deliberada à regra "registros de negócio só são inativados" (pedido do dono do produto, 23/10/2026).
 * O que sai do sistema fica no AuditLog (que só cresce), com o conteúdo excluído em `before`, e um número de CUB
 * já emitido nunca volta a ser usado (o piso `cub_floor` do ano sobe).
 */

const replace = (list, id, next) => list.map((x) => (x.id === id ? next : x))
const find = (list, id, code, msg) => {
  const x = list.find((i) => i.id === id)
  ensure(x, code, msg)
  return x
}

/** Exclui todas as versões do plano de corte de uma bobina mãe. */
export function deleteCuttingPlans(state, { mother_coil_id }, ctx) {
  authorize(ctx, 'cuttingPlan.delete')
  const mc = find(state.motherCoils, mother_coil_id, 'MOTHER_NOT_FOUND', 'Bobina mãe não encontrada.')
  const plans = state.cuttingPlans.filter((p) => p.mother_coil === mc.id)
  ensure(plans.length > 0, 'PLAN_NOT_FOUND', `O lote ${mc.slitter_lot} não tem plano de corte.`)
  // sem plano, a bobina que estava planejada ou programada volta a "registrada"
  const motherCoils = ['PLANNED', 'SCHEDULED'].includes(mc.status)
    ? replace(state.motherCoils, mc.id, { ...mc, status: 'REGISTERED' })
    : state.motherCoils
  const next = audit(
    { ...state, cuttingPlans: state.cuttingPlans.filter((p) => p.mother_coil !== mc.id), motherCoils },
    ctx,
    { action: 'cuttingPlan.delete', entity: 'CuttingPlan', entity_id: mc.id, before: { slitter_lot: mc.slitter_lot, plans }, after: null },
  )
  return { state: next, result: { removed: plans.length } }
}

/** Exclui um recebimento e os CUBs que ele gerou. Só se nenhum CUB já foi usado. */
export function deleteDelivery(state, { delivery_id }, ctx) {
  authorize(ctx, 'delivery.delete')
  const d = find(state.deliveries, delivery_id, 'DELIVERY_NOT_FOUND', 'Entrega não encontrada.')
  const cubSet = new Set(d.cubs)
  const coils = state.coils.filter((c) => cubSet.has(c.cub))
  const used = coils.find((c) => c.status === 'IN_USE' || c.status === 'CONSUMED' || state.uses.some((u) => u.coil === c.id))
  ensure(
    !used,
    'DELIVERY_HAS_USES',
    used ? `Não dá para excluir: o ${used.cub} já foi usado. Só entregas cujos CUBs nunca foram usados podem ser excluídas.` : '',
  )
  // um número de CUB já emitido nunca volta: sobe o piso do ano
  const cub_floor = { ...state.cub_floor }
  for (const c of coils) {
    const m = /^[A-Z]+-(\d{4})-(\d+)$/.exec(c.cub)
    if (m) cub_floor[m[1]] = Math.max(cub_floor[m[1]] ?? 0, Number(m[2]))
  }
  const remainingCoils = state.coils.filter((c) => !cubSet.has(c.cub))
  const motherCoils = state.motherCoils.map((m) => {
    if (!d.mother_coils.includes(m.id) || m.status !== 'RECEIVED') return m
    if (remainingCoils.some((c) => c.mother_coil === m.id)) return m
    const sent = state.cuttingPlans.some((p) => p.mother_coil === m.id && p.status === 'SENT')
    return { ...m, status: sent ? 'PLANNED' : 'REGISTERED' }
  })
  const next = audit(
    { ...state, coils: remainingCoils, deliveries: state.deliveries.filter((x) => x.id !== d.id), cub_floor, motherCoils },
    ctx,
    { action: 'delivery.delete', entity: 'Delivery', entity_id: [d.id, ...d.mother_coils].join(','), before: { delivery: d, coils }, after: null },
  )
  return { state: next, result: { removed_cubs: coils.length } }
}

/** Exclui uma bobina mãe e seus planos. Só se ela não tem CUBs (exclua antes os recebimentos). */
export function deleteMotherCoil(state, { mother_coil_id }, ctx) {
  authorize(ctx, 'motherCoil.delete')
  const mc = find(state.motherCoils, mother_coil_id, 'MOTHER_NOT_FOUND', 'Bobina mãe não encontrada.')
  const coils = state.coils.filter((c) => c.mother_coil === mc.id)
  ensure(
    coils.length === 0,
    'MOTHER_HAS_COILS',
    `O lote ${mc.slitter_lot} já tem ${coils.length} CUB${coils.length === 1 ? '' : 's'}. Exclua antes o(s) recebimento(s) dele.`,
  )
  const plans = state.cuttingPlans.filter((p) => p.mother_coil === mc.id)
  const next = audit(
    {
      ...state,
      motherCoils: state.motherCoils.filter((m) => m.id !== mc.id),
      cuttingPlans: state.cuttingPlans.filter((p) => p.mother_coil !== mc.id),
    },
    ctx,
    { action: 'motherCoil.delete', entity: 'MotherCoil', entity_id: mc.id, before: { motherCoil: mc, plans }, after: null },
  )
  return { state: next, result: { removed_plans: plans.length } }
}
