import { DomainError, ensure } from './errors.js'
import { roundKg, roundMm } from './units.js'

/**
 * @typedef {'IN_STOCK'|'IN_USE'|'BLOCKED'|'CONSUMED'|'RETURNED'} CoilStatus
 *
 * @typedef {Object} Coil
 * @property {string} id
 * @property {string} cub
 * @property {string} mother_coil
 * @property {string} delivery
 * @property {string} slitter_lot
 * @property {string} slitter_invoice_number
 * @property {string} received_date
 * @property {string} supplier
 * @property {string} galvanization
 * @property {number} thickness
 * @property {number} width
 * @property {string} [material]
 * @property {string} [certificate_number]
 * @property {string} [fvm_number]
 * @property {number} received_weight
 * @property {number} current_weight
 * @property {CoilStatus} status
 * @property {string} [storage_location]
 * @property {string|null} last_project
 * @property {string|null} last_production_order
 * @property {number} use_count
 * @property {number} cumulative_consumption
 * @property {string} [block_reason]
 * @property {'COIL'|'LOT'} [block_scope]
 * @property {CoilStatus} [status_before_block]
 * @property {boolean} [block_pending]  Bloqueada durante o uso: a sobra volta bloqueada.
 *
 * @typedef {Object} CoilUse
 * @property {string} id
 * @property {string} coil
 * @property {string} production_order
 * @property {string} project
 * @property {string} machine
 * @property {number} nominal_thickness
 * @property {number} measured_thickness
 * @property {number} thickness_delta
 * @property {number} weight_before
 * @property {number|null} weight_after
 * @property {number|null} consumption
 * @property {number} scrap_weight
 * @property {'LEFTOVER'|'CONSUMED'|null} outcome
 * @property {string} opened_by
 * @property {string} opened_at
 * @property {string|null} closed_by
 * @property {string|null} closed_at
 * @property {string|null} [label_photo]
 */

const blank = (v) => v == null || String(v).trim() === ''

/** Uma bobina só entra em IN_STOCK com lote, NF do prestador e peso recebido preenchidos. */
export function assertCanEnterStock(c) {
  ensure(!blank(c.slitter_lot), 'COIL_LOT_REQUIRED', `${c.cub}: informe o lote do prestador.`)
  ensure(!blank(c.slitter_invoice_number), 'COIL_INVOICE_REQUIRED', `${c.cub}: informe a NF do prestador.`)
  ensure(c.received_weight > 0, 'COIL_WEIGHT_REQUIRED', `${c.cub}: informe o peso medido na balança.`)
}

/** Mensagem do motivo pelo qual o CUB não pode abrir uso. */
export function refusalMessage(coil) {
  switch (coil.status) {
    case 'BLOCKED':
      return `${coil.cub} está bloqueado${coil.block_reason ? `: ${coil.block_reason}` : ''}.`
    case 'CONSUMED':
      return `${coil.cub} já foi totalmente consumido.`
    case 'IN_USE':
      return `${coil.cub} já tem um uso aberto; feche-o antes de abrir outro.`
    case 'RETURNED':
      return `${coil.cub} foi devolvido ou enviado a terceiros.`
    default:
      return `${coil.cub} não está disponível (status ${coil.status}).`
  }
}

/**
 * Abre um uso: exige IN_STOCK e passa para IN_USE na mesma operação.
 * @param {Coil} coil @param {CoilUse[]} uses
 * @returns {{coil: Coil, use: CoilUse}}
 */
export function openUse(coil, input, uses, actor, now) {
  if (coil.status !== 'IN_STOCK') {
    throw new DomainError('COIL_NOT_AVAILABLE', refusalMessage(coil), { status: coil.status })
  }
  ensure(
    !uses.some((u) => u.coil === coil.id && u.closed_at == null),
    'COIL_USE_ALREADY_OPEN',
    `${coil.cub} já tem um uso aberto.`,
  )
  ensure(!blank(input.production_order), 'USE_OP_REQUIRED', 'Informe a OP.')
  ensure(!blank(input.project), 'USE_PROJECT_REQUIRED', 'Informe a obra.')
  ensure(!blank(input.machine), 'USE_MACHINE_REQUIRED', 'Informe a perfiladeira.')
  ensure(input.measured_thickness > 0, 'USE_THICKNESS_REQUIRED', 'Informe a espessura medida (mm).')
  const nominal = input.nominal_thickness ?? coil.thickness
  const use = {
    id: `use-${uses.length + 1}`,
    coil: coil.id,
    production_order: String(input.production_order).trim(),
    project: input.project,
    machine: input.machine,
    nominal_thickness: nominal,
    measured_thickness: input.measured_thickness,
    thickness_delta: roundMm(input.measured_thickness - nominal),
    weight_before: coil.current_weight,
    weight_after: null,
    consumption: null,
    scrap_weight: 0,
    outcome: null,
    opened_by: actor,
    opened_at: now.toISOString(),
    closed_by: null,
    closed_at: null,
    label_photo: null,
  }
  return {
    coil: { ...coil, status: 'IN_USE', last_project: use.project, last_production_order: use.production_order },
    use,
  }
}

/**
 * Fecha o uso com sobra ou consumida. A sobra mantém o mesmo CUB.
 * @param {Coil} coil @param {CoilUse} use
 * @returns {{coil: Coil, use: CoilUse}}
 */
export function closeUse(coil, use, input, actor, now) {
  ensure(use.closed_at == null, 'USE_ALREADY_CLOSED', 'Este uso já foi fechado.')
  ensure(coil.status === 'IN_USE', 'COIL_NOT_IN_USE', `${coil.cub} não está em uso.`)
  const { outcome } = input
  ensure(outcome === 'LEFTOVER' || outcome === 'CONSUMED', 'USE_OUTCOME_INVALID', 'Escolha sobra ou consumida.')
  const after = outcome === 'CONSUMED' ? 0 : input.weight_after
  if (outcome === 'CONSUMED' && input.weight_after != null && input.weight_after !== 0) {
    throw new DomainError('USE_CONSUMED_WEIGHT', 'Bobina consumida deve ter peso final zero.')
  }
  ensure(after != null && after >= 0, 'USE_WEIGHT_REQUIRED', 'Informe o peso da sobra.')
  ensure(
    after <= use.weight_before,
    'USE_WEIGHT_INCREASED',
    `O peso depois (${after} kg) não pode passar do peso antes (${use.weight_before} kg).`,
  )
  ensure(outcome !== 'LEFTOVER' || after > 0, 'USE_LEFTOVER_ZERO', 'Sobra precisa ter peso maior que zero; para zerar, marque consumida.')
  const consumption = roundKg(use.weight_before - after)
  const closedUse = {
    ...use,
    weight_after: after,
    consumption,
    scrap_weight: input.scrap_weight ?? 0,
    outcome,
    closed_by: actor,
    closed_at: now.toISOString(),
    label_photo: input.label_photo ?? null,
  }
  let status = 'IN_STOCK'
  if (outcome === 'CONSUMED') status = 'CONSUMED'
  else if (coil.block_pending) status = 'BLOCKED'
  const next = {
    ...coil,
    status,
    current_weight: after,
    use_count: coil.use_count + 1,
    cumulative_consumption: roundKg(coil.cumulative_consumption + consumption),
  }
  if (status === 'BLOCKED') next.status_before_block = 'IN_STOCK'
  delete next.block_pending
  return { coil: next, use: closedUse }
}

/** Alerta de possível duplicidade: mesmo CUB, OP e dia. @param {CoilUse[]} uses */
export function findPossibleDuplicateUse(uses, { coil, production_order, day }) {
  return uses.find(
    (u) => u.coil === coil && u.production_order === String(production_order).trim() && u.opened_at.slice(0, 10) === day,
  )
}

/**
 * Bloqueia o CUB. Em uso, marca para bloquear ao fechar (a sobra volta bloqueada).
 * @param {Coil} coil @returns {Coil}
 */
export function blockCoil(coil, { reason, scope = 'COIL' }, actor, now) {
  ensure(!blank(reason), 'BLOCK_REASON_REQUIRED', 'Informe o motivo do bloqueio.')
  if (coil.status === 'BLOCKED' || coil.block_pending) {
    throw new DomainError('COIL_ALREADY_BLOCKED', `${coil.cub} já está bloqueado.`)
  }
  if (coil.status === 'CONSUMED' || coil.status === 'RETURNED') {
    throw new DomainError('BLOCK_NOT_APPLICABLE', `${coil.cub} não tem saldo para bloquear (${coil.status}).`)
  }
  const meta = { block_reason: String(reason).trim(), block_scope: scope, blocked_by: actor, blocked_at: now.toISOString() }
  if (coil.status === 'IN_USE') return { ...coil, ...meta, block_pending: true }
  return { ...coil, ...meta, status: 'BLOCKED', status_before_block: coil.status }
}

/** Libera o CUB bloqueado. @param {Coil} coil @returns {Coil} */
export function unblockCoil(coil, { reason }, actor, now) {
  ensure(!blank(reason), 'UNBLOCK_REASON_REQUIRED', 'Informe o motivo da liberação.')
  if (coil.status !== 'BLOCKED' && !coil.block_pending) {
    throw new DomainError('COIL_NOT_BLOCKED', `${coil.cub} não está bloqueado.`)
  }
  const next = { ...coil, released_by: actor, released_at: now.toISOString(), release_reason: String(reason).trim() }
  if (coil.block_pending) delete next.block_pending
  else next.status = coil.status_before_block ?? 'IN_STOCK'
  delete next.block_reason
  delete next.block_scope
  delete next.status_before_block
  return next
}
