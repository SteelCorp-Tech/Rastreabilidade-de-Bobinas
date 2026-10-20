import { ensure } from './errors.js'
import { assertCanEnterStock } from './coil.js'
import { generateCubs } from './cub.js'
import { dateInSaoPaulo, yearInSaoPaulo } from './units.js'

/**
 * @typedef {Object} Delivery
 * @property {string} id
 * @property {string} slitter_invoice_number
 * @property {string} received_date
 * @property {number} declared_coil_count
 * @property {number} [total_weight]
 * @property {string[]} mother_coils      Uma entrega pode trazer tiras de mais de um lote.
 * @property {string[]} cubs
 * @property {object|null} [delivery_note_file]
 * @property {string} [fvm_number]
 * @property {string} [count_justification]
 * @property {string} received_by
 * @property {string} created_at
 */

const blank = (v) => v == null || String(v).trim() === ''

/**
 * Registra a entrega e gera um CUB por linha.
 * - a contagem de linhas deve ser igual à declarada, ou haver justificativa;
 * - galvanização e espessura da tira devem bater com as da mãe;
 * - bobina de lote bloqueado entra BLOCKED.
 * @param {{delivery: object, lines: object[]}} input
 * @param {{motherCoils: import('./motherCoil.js').MotherCoil[], coils: import('./coil.js').Coil[], deliveries: Delivery[]}} state
 * @param {import('./config.js').Config} config
 * @returns {{delivery: Delivery, coils: import('./coil.js').Coil[]}}
 */
export function buildDelivery({ delivery: d, lines }, state, config, actor, now) {
  ensure(!blank(d.slitter_invoice_number), 'DELIVERY_INVOICE_REQUIRED', 'Informe a NF do prestador.')
  ensure(Number.isInteger(d.declared_coil_count) && d.declared_coil_count > 0, 'DELIVERY_COUNT_REQUIRED', 'Informe a quantidade declarada de bobinas.')
  ensure(lines.length > 0, 'DELIVERY_EMPTY', 'Lance ao menos uma bobina.')
  if (lines.length !== d.declared_coil_count && blank(d.count_justification)) {
    ensure(
      false,
      'DELIVERY_COUNT_MISMATCH',
      `A NF declara ${d.declared_coil_count} bobinas, mas foram lançadas ${lines.length}. Acerte a contagem ou registre uma justificativa.`,
      { declared: d.declared_coil_count, entered: lines.length },
    )
  }

  const year = yearInSaoPaulo(now)
  const cubs = generateCubs(state.coils, year, lines.length, config, state.cub_floor?.[year] ?? 0)
  const deliveryId = `dl-${state.deliveries.length + 1}`
  const receivedDate = d.received_date ?? dateInSaoPaulo(now)

  const coils = lines.map((line, i) => {
    const mc = state.motherCoils.find((m) => m.id === line.mother_coil)
    ensure(mc, 'DELIVERY_MOTHER_NOT_FOUND', `Linha ${i + 1}: bobina mãe não encontrada.`)
    ensure(line.measured_weight > 0, 'COIL_WEIGHT_REQUIRED', `Linha ${i + 1} (${cubs[i]}): informe o peso medido na balança.`)
    ensure(line.width > 0 && line.width <= mc.width, 'DELIVERY_WIDTH_INVALID', `Linha ${i + 1} (${cubs[i]}): a largura deve ser maior que zero e não passar da mãe (${mc.width} mm).`)
    ensure(
      line.galvanization == null || line.galvanization === mc.galvanization,
      'DELIVERY_GALV_MISMATCH',
      `Linha ${i + 1} (${cubs[i]}): galvanização ${line.galvanization} diverge da mãe (${mc.galvanization}).`,
    )
    ensure(
      line.thickness == null || line.thickness === mc.thickness,
      'DELIVERY_THICKNESS_MISMATCH',
      `Linha ${i + 1} (${cubs[i]}): espessura ${line.thickness} mm diverge da mãe (${mc.thickness} mm).`,
    )
    const coil = {
      id: `coil-${state.coils.length + i + 1}`,
      cub: cubs[i],
      mother_coil: mc.id,
      delivery: deliveryId,
      slitter_lot: mc.slitter_lot,
      slitter_invoice_number: String(d.slitter_invoice_number).trim(),
      received_date: receivedDate,
      supplier: mc.supplier,
      galvanization: mc.galvanization,
      thickness: mc.thickness,
      width: line.width,
      material: line.material ?? '',
      certificate_number: mc.certificate_number,
      fvm_number: d.fvm_number ?? '',
      received_weight: line.measured_weight,
      current_weight: line.measured_weight,
      status: 'IN_STOCK',
      storage_location: line.storage_location ?? '',
      last_project: null,
      last_production_order: null,
      use_count: 0,
      cumulative_consumption: 0,
    }
    assertCanEnterStock(coil)
    if (mc.status === 'BLOCKED') {
      return { ...coil, status: 'BLOCKED', status_before_block: 'IN_STOCK', block_scope: 'LOT', block_reason: `Lote ${mc.slitter_lot} bloqueado` }
    }
    return coil
  })

  /** @type {Delivery} */
  const delivery = {
    id: deliveryId,
    slitter_invoice_number: String(d.slitter_invoice_number).trim(),
    received_date: receivedDate,
    declared_coil_count: d.declared_coil_count,
    total_weight: d.total_weight,
    mother_coils: [...new Set(coils.map((c) => c.mother_coil))],
    cubs,
    delivery_note_file: d.delivery_note_file ?? null,
    fvm_number: d.fvm_number ?? '',
    count_justification: d.count_justification ?? '',
    received_by: actor,
    created_at: now.toISOString(),
  }
  return { delivery, coils }
}
