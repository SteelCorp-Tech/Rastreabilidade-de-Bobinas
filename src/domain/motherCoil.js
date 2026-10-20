import { DomainError, ensure } from './errors.js'

/**
 * @typedef {Object} AttachmentRef
 * @property {string} id      Chave do arquivo no IndexedDB.
 * @property {string} name
 * @property {string} [type]
 * @property {number} [size]
 *
 * @typedef {'REGISTERED'|'PLANNED'|'SCHEDULED'|'RECEIVED'|'BLOCKED'} MotherStatus
 *
 * @typedef {Object} MotherCoil
 * @property {string} id
 * @property {string} slitter_lot
 * @property {string} [mill_coil_number]
 * @property {string} supplier
 * @property {string} [mill]
 * @property {string} [purchase_order_ref]
 * @property {string} supplier_invoice_number
 * @property {string} [supplier_invoice_date]
 * @property {number} thickness
 * @property {number} width
 * @property {string} galvanization
 * @property {number} net_weight
 * @property {string} [slitter_entry_date]
 * @property {string} [certificate_number]
 * @property {AttachmentRef|null} certificate_file
 * @property {string} [certificate_attached_at]
 * @property {string} [certificate_attached_by]
 * @property {AttachmentRef|null} [invoice_file]
 * @property {string} [slitter_job_ref]
 * @property {MotherStatus} status
 * @property {string} received_at
 */

const NEXT = { REGISTERED: 'PLANNED', PLANNED: 'SCHEDULED', SCHEDULED: 'RECEIVED' }

const blank = (v) => v == null || String(v).trim() === ''

/** Sem certificado completo (número e arquivo). */
export function lacksCertificate(mc) {
  return blank(mc.certificate_number) || !mc.certificate_file
}

/**
 * Registra a bobina mãe. Com `certificate_required`, número e arquivo do certificado
 * são obrigatórios; sem a exigência, a bobina entra marcada "sem certificado" nas pendências.
 * @param {object} input @param {MotherCoil[]} existing @param {import('./config.js').Config} config
 * @returns {MotherCoil}
 */
export function buildMotherCoil(input, existing, config, now) {
  ensure(!blank(input.slitter_lot), 'MOTHER_LOT_REQUIRED', 'Informe o lote do prestador de slitagem.')
  ensure(!blank(input.supplier), 'MOTHER_SUPPLIER_REQUIRED', 'Informe o fornecedor.')
  ensure(!blank(input.supplier_invoice_number), 'MOTHER_INVOICE_REQUIRED', 'Informe a NF do fornecedor.')
  ensure(!blank(input.galvanization), 'MOTHER_GALV_REQUIRED', 'Informe a galvanização.')
  ensure(input.thickness > 0, 'MOTHER_THICKNESS_INVALID', 'A espessura deve ser maior que zero.')
  ensure(input.width > 0, 'MOTHER_WIDTH_INVALID', 'A largura deve ser maior que zero.')
  ensure(input.net_weight > 0, 'MOTHER_WEIGHT_INVALID', 'O peso líquido deve ser maior que zero.')
  ensure(
    !existing.some((m) => String(m.slitter_lot).trim() === String(input.slitter_lot).trim()),
    'MOTHER_LOT_DUPLICATE',
    `Já existe uma bobina mãe com o lote ${input.slitter_lot}.`,
  )
  if (config.certificate_required && (blank(input.certificate_number) || !input.certificate_file)) {
    throw new DomainError(
      'CERTIFICATE_REQUIRED',
      'Certificado obrigatório: informe o número e anexe o arquivo para registrar a bobina mãe.',
    )
  }
  const hasCert = !blank(input.certificate_number) && !!input.certificate_file
  return {
    id: `mc-${existing.length + 1}`,
    slitter_lot: String(input.slitter_lot).trim(),
    mill_coil_number: input.mill_coil_number ?? '',
    supplier: input.supplier,
    mill: input.mill ?? '',
    purchase_order_ref: input.purchase_order_ref ?? '',
    supplier_invoice_number: String(input.supplier_invoice_number).trim(),
    supplier_invoice_date: input.supplier_invoice_date ?? '',
    thickness: input.thickness,
    width: input.width,
    galvanization: input.galvanization,
    net_weight: input.net_weight,
    slitter_entry_date: input.slitter_entry_date ?? '',
    certificate_number: input.certificate_number ?? '',
    certificate_file: input.certificate_file ?? null,
    certificate_attached_at: hasCert ? now.toISOString() : undefined,
    certificate_attached_by: hasCert ? input.actor : undefined,
    invoice_file: input.invoice_file ?? null,
    slitter_job_ref: input.slitter_job_ref ?? '',
    status: 'REGISTERED',
    received_at: now.toISOString(),
  }
}

/** Anexa ou substitui o certificado. @param {MotherCoil} mc */
export function withCertificate(mc, { number, file }, actor, now) {
  ensure(!blank(number), 'CERTIFICATE_NUMBER_REQUIRED', 'Informe o número do certificado.')
  ensure(!!file, 'CERTIFICATE_FILE_REQUIRED', 'Anexe o arquivo do certificado (PDF ou imagem).')
  return {
    ...mc,
    certificate_number: String(number).trim(),
    certificate_file: file,
    certificate_attached_at: now.toISOString(),
    certificate_attached_by: actor,
  }
}

/** Avança REGISTERED → PLANNED → SCHEDULED → RECEIVED. Bloqueada não avança. @param {MotherCoil} mc */
export function advanceMotherCoil(mc, to) {
  if (mc.status === 'BLOCKED') {
    throw new DomainError('MOTHER_BLOCKED', `O lote ${mc.slitter_lot} está bloqueado; libere antes de avançar.`)
  }
  if (mc.status === to && to === 'RECEIVED') return mc // nova entrega do mesmo lote
  if (NEXT[mc.status] !== to) {
    throw new DomainError('MOTHER_TRANSITION_INVALID', `Não é possível ir de ${mc.status} para ${to}.`)
  }
  return { ...mc, status: to }
}
