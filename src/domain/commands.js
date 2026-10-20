import { DEFAULT_CONFIG } from './config.js'
import { DomainError, ensure } from './errors.js'
import { can } from './permissions.js'
import { appendAudit } from './audit.js'
import { calcCuttingPlan } from './cuttingPlan.js'
import { advanceMotherCoil, buildMotherCoil, withCertificate } from './motherCoil.js'
import { buildDelivery } from './delivery.js'
import { blockCoil, closeUse, openUse, unblockCoil } from './coil.js'

/**
 * Camada de comandos: cada função recebe o estado inteiro e devolve `{state, result}`,
 * sem mutar nada. Valida permissão, aplica a regra de domínio e grava no AuditLog.
 * É o que a persistência chama, dentro da trava entre abas.
 *
 * @typedef {Object} State
 * @property {import('./config.js').Config} config
 * @property {{id: string, name: string, active: boolean}[]} suppliers
 * @property {{id: string, name: string, active: boolean}[]} mills
 * @property {{id: string, name: string, active: boolean}[]} projects
 * @property {{id: string, name: string, active: boolean}[]} machines
 * @property {{id: string, code: string, galvanization: string, thickness: number, width: number}[]} materials
 * @property {Object<string, number>} cub_floor  Maior sequencial já usado fora do sistema, por ano.
 * @property {import('./motherCoil.js').MotherCoil[]} motherCoils
 * @property {object[]} cuttingPlans
 * @property {import('./delivery.js').Delivery[]} deliveries
 * @property {import('./coil.js').Coil[]} coils
 * @property {import('./coil.js').CoilUse[]} uses
 * @property {import('./audit.js').AuditEntry[]} auditLog
 *
 * @typedef {{role: string, user: string, now: Date}} Ctx
 */

/** @returns {State} */
export function emptyState(config = DEFAULT_CONFIG) {
  return {
    config: { ...config },
    suppliers: [], mills: [], projects: [], machines: [], materials: [],
    cub_floor: {},
    motherCoils: [], cuttingPlans: [], deliveries: [], coils: [], uses: [], auditLog: [],
  }
}

export function authorize(ctx, action) {
  if (!can(ctx.role, action)) {
    throw new DomainError('FORBIDDEN', `O perfil ${ctx.role} não tem permissão para esta ação (${action}).`)
  }
}

const actorOf = (ctx) => ({ role: ctx.role, user: ctx.user })
const replace = (list, id, next) => list.map((x) => (x.id === id ? next : x))
const find = (list, id, code, msg) => {
  const x = list.find((i) => i.id === id)
  ensure(x, code, msg)
  return x
}
export const audit = (state, ctx, entry) => ({ ...state, auditLog: appendAudit(state.auditLog, { actor: actorOf(ctx), ...entry }, ctx.now) })

export function registerMotherCoil(state, input, ctx) {
  authorize(ctx, 'motherCoil.create')
  const mc = buildMotherCoil({ ...input, actor: ctx.user }, state.motherCoils, state.config, ctx.now)
  const next = audit({ ...state, motherCoils: [...state.motherCoils, mc] }, ctx, {
    action: 'motherCoil.create', entity: 'MotherCoil', entity_id: mc.id, after: mc,
  })
  return { state: next, result: mc }
}

export function attachCertificate(state, { mother_coil_id, number, file }, ctx) {
  authorize(ctx, 'motherCoil.attachCertificate')
  const before = find(state.motherCoils, mother_coil_id, 'MOTHER_NOT_FOUND', 'Bobina mãe não encontrada.')
  const after = withCertificate(before, { number, file }, ctx.user, ctx.now)
  const next = audit({ ...state, motherCoils: replace(state.motherCoils, before.id, after) }, ctx, {
    action: before.certificate_file ? 'motherCoil.replaceCertificate' : 'motherCoil.attachCertificate',
    entity: 'MotherCoil', entity_id: before.id,
    before: { certificate_number: before.certificate_number, certificate_file: before.certificate_file },
    after: { certificate_number: after.certificate_number, certificate_file: after.certificate_file },
  })
  return { state: next, result: after }
}

/** Salva o plano de corte; se já existe plano, cria nova versão e marca a anterior como substituída. */
export function savePlan(state, { mother_coil_id, lines, expected_delivery_date }, ctx) {
  authorize(ctx, 'cuttingPlan.edit')
  const mc = find(state.motherCoils, mother_coil_id, 'MOTHER_NOT_FOUND', 'Bobina mãe não encontrada.')
  const result = calcCuttingPlan({ mother_width: mc.width, net_weight: mc.net_weight, weight_limit: state.config.weight_limit, lines })
  const previous = state.cuttingPlans.filter((p) => p.mother_coil === mc.id)
  const plan = {
    id: `plan-${state.cuttingPlans.length + 1}`,
    mother_coil: mc.id,
    version: previous.length + 1,
    lines,
    result,
    expected_delivery_date: expected_delivery_date ?? '',
    status: 'DRAFT',
    created_by: ctx.user,
    created_at: ctx.now.toISOString(),
  }
  const plans = [...state.cuttingPlans.map((p) => (p.mother_coil === mc.id && p.status !== 'SUPERSEDED' ? { ...p, status: 'SUPERSEDED' } : p)), plan]
  const next = audit({ ...state, cuttingPlans: plans }, ctx, {
    action: 'cuttingPlan.save', entity: 'CuttingPlan', entity_id: plan.id, after: plan,
  })
  return { state: next, result: plan }
}

/** Marca o plano como enviado ao prestador: a mãe vai para PLANNED. */
export function markPlanSent(state, { plan_id }, ctx) {
  authorize(ctx, 'cuttingPlan.edit')
  const plan = find(state.cuttingPlans, plan_id, 'PLAN_NOT_FOUND', 'Plano não encontrado.')
  ensure(plan.status === 'DRAFT', 'PLAN_NOT_DRAFT', 'Só um plano em rascunho pode ser marcado como enviado.')
  const mc = find(state.motherCoils, plan.mother_coil, 'MOTHER_NOT_FOUND', 'Bobina mãe não encontrada.')
  const sent = { ...plan, status: 'SENT', sent_at: ctx.now.toISOString() }
  const mother = mc.status === 'REGISTERED' ? advanceMotherCoil(mc, 'PLANNED') : mc
  const next = audit(
    { ...state, cuttingPlans: replace(state.cuttingPlans, plan.id, sent), motherCoils: replace(state.motherCoils, mc.id, mother) },
    ctx,
    { action: 'cuttingPlan.send', entity: 'CuttingPlan', entity_id: plan.id, before: plan, after: sent },
  )
  return { state: next, result: sent }
}

/** Programação confirmada pelo prestador: PLANNED → SCHEDULED. */
export function confirmSchedule(state, { mother_coil_id }, ctx) {
  authorize(ctx, 'cuttingPlan.edit')
  const mc = find(state.motherCoils, mother_coil_id, 'MOTHER_NOT_FOUND', 'Bobina mãe não encontrada.')
  const after = advanceMotherCoil(mc, 'SCHEDULED')
  const next = audit({ ...state, motherCoils: replace(state.motherCoils, mc.id, after) }, ctx, {
    action: 'motherCoil.schedule', entity: 'MotherCoil', entity_id: mc.id, before: { status: mc.status }, after: { status: after.status },
  })
  return { state: next, result: after }
}

export function receiveDelivery(state, input, ctx) {
  authorize(ctx, 'delivery.receive')
  const { delivery, coils } = buildDelivery(input, state, state.config, ctx.user, ctx.now)
  const touched = new Set(delivery.mother_coils)
  const motherCoils = state.motherCoils.map((m) =>
    touched.has(m.id) && m.status !== 'BLOCKED' ? { ...m, status: 'RECEIVED' } : m,
  )
  const next = audit(
    { ...state, motherCoils, deliveries: [...state.deliveries, delivery], coils: [...state.coils, ...coils] },
    ctx,
    { action: 'delivery.receive', entity: 'Delivery', entity_id: delivery.id, after: { ...delivery, cubs: delivery.cubs } },
  )
  return { state: next, result: { delivery, coils } }
}

export function openCoilUse(state, { cub, ...input }, ctx) {
  authorize(ctx, 'coilUse.open')
  const coil = state.coils.find((c) => c.cub === cub)
  ensure(coil, 'COIL_NOT_FOUND', `CUB ${cub} não encontrado.`)
  const { coil: nextCoil, use } = openUse(coil, input, state.uses, ctx.user, ctx.now)
  const next = audit(
    { ...state, coils: replace(state.coils, coil.id, nextCoil), uses: [...state.uses, use] },
    ctx,
    { action: 'coilUse.open', entity: 'CoilUse', entity_id: use.id, after: use },
  )
  return { state: next, result: { coil: nextCoil, use } }
}

export function closeCoilUse(state, { use_id, ...input }, ctx) {
  authorize(ctx, 'coilUse.close')
  const use = find(state.uses, use_id, 'USE_NOT_FOUND', 'Uso não encontrado.')
  const coil = find(state.coils, use.coil, 'COIL_NOT_FOUND', 'CUB não encontrado.')
  const { coil: nextCoil, use: nextUse } = closeUse(coil, use, input, ctx.user, ctx.now)
  const next = audit(
    { ...state, coils: replace(state.coils, coil.id, nextCoil), uses: replace(state.uses, use.id, nextUse) },
    ctx,
    { action: 'coilUse.close', entity: 'CoilUse', entity_id: use.id, before: use, after: nextUse },
  )
  return { state: next, result: { coil: nextCoil, use: nextUse } }
}

export function blockCoilCmd(state, { cub, reason }, ctx) {
  authorize(ctx, 'block.manage')
  const coil = state.coils.find((c) => c.cub === cub)
  ensure(coil, 'COIL_NOT_FOUND', `CUB ${cub} não encontrado.`)
  const after = blockCoil(coil, { reason }, ctx.user, ctx.now)
  const next = audit({ ...state, coils: replace(state.coils, coil.id, after) }, ctx, {
    action: 'coil.block', entity: 'Coil', entity_id: coil.id, before: coil, after, reason,
  })
  return { state: next, result: after }
}

export function unblockCoilCmd(state, { cub, reason }, ctx) {
  authorize(ctx, 'block.manage')
  const coil = state.coils.find((c) => c.cub === cub)
  ensure(coil, 'COIL_NOT_FOUND', `CUB ${cub} não encontrado.`)
  const after = unblockCoil(coil, { reason }, ctx.user, ctx.now)
  const next = audit({ ...state, coils: replace(state.coils, coil.id, after) }, ctx, {
    action: 'coil.unblock', entity: 'Coil', entity_id: coil.id, before: coil, after, reason,
  })
  return { state: next, result: after }
}

/** Bloqueia o lote inteiro: a mãe e todos os CUBs com saldo (os em uso bloqueiam ao fechar). */
export function blockLot(state, { slitter_lot, reason }, ctx) {
  authorize(ctx, 'block.manage')
  ensure(reason && String(reason).trim(), 'BLOCK_REASON_REQUIRED', 'Informe o motivo do bloqueio.')
  const mothers = state.motherCoils.filter((m) => m.slitter_lot === String(slitter_lot).trim())
  ensure(mothers.length, 'LOT_NOT_FOUND', `Lote ${slitter_lot} não encontrado.`)
  ensure(!mothers.every((m) => m.status === 'BLOCKED'), 'LOT_ALREADY_BLOCKED', `O lote ${slitter_lot} já está bloqueado.`)
  const ids = new Set(mothers.map((m) => m.id))
  const motherCoils = state.motherCoils.map((m) =>
    ids.has(m.id) && m.status !== 'BLOCKED' ? { ...m, status: 'BLOCKED', status_before_block: m.status, block_reason: reason } : m,
  )
  const blocked = []
  const coils = state.coils.map((c) => {
    if (!ids.has(c.mother_coil) || c.status === 'BLOCKED' || c.status === 'CONSUMED' || c.status === 'RETURNED' || c.block_pending) return c
    const after = blockCoil(c, { reason, scope: 'LOT' }, ctx.user, ctx.now)
    blocked.push(c.cub)
    return after
  })
  const next = audit({ ...state, motherCoils, coils }, ctx, {
    action: 'lot.block', entity: 'MotherCoil', entity_id: mothers.map((m) => m.id).join(','),
    after: { slitter_lot, blocked_cubs: blocked }, reason,
  })
  return { state: next, result: { blocked_cubs: blocked } }
}

/** Libera o lote: só desfaz o que foi bloqueado pelo lote (bloqueios individuais continuam). */
export function unblockLot(state, { slitter_lot, reason }, ctx) {
  authorize(ctx, 'block.manage')
  ensure(reason && String(reason).trim(), 'UNBLOCK_REASON_REQUIRED', 'Informe o motivo da liberação.')
  const mothers = state.motherCoils.filter((m) => m.slitter_lot === String(slitter_lot).trim() && m.status === 'BLOCKED')
  ensure(mothers.length, 'LOT_NOT_BLOCKED', `O lote ${slitter_lot} não está bloqueado.`)
  const ids = new Set(mothers.map((m) => m.id))
  const motherCoils = state.motherCoils.map((m) => {
    if (!ids.has(m.id)) return m
    const { status_before_block, block_reason, ...rest } = m
    return { ...rest, status: status_before_block ?? 'REGISTERED' }
  })
  const released = []
  const coils = state.coils.map((c) => {
    if (!ids.has(c.mother_coil) || c.block_scope !== 'LOT') return c
    if (c.status !== 'BLOCKED' && !c.block_pending) return c
    released.push(c.cub)
    return unblockCoil(c, { reason }, ctx.user, ctx.now)
  })
  const next = audit({ ...state, motherCoils, coils }, ctx, {
    action: 'lot.unblock', entity: 'MotherCoil', entity_id: mothers.map((m) => m.id).join(','),
    after: { slitter_lot, released_cubs: released }, reason,
  })
  return { state: next, result: { released_cubs: released } }
}
