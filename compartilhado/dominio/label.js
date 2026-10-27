/**
 * Dados da etiqueta do CUB. Mesmos campos da etiqueta de hoje (aba "Gerador de etiqueta" do Excel),
 * mais o peso medido e o QR, que carrega o CUB.
 *
 * `kind`: NEW (recebimento) ou LEFTOVER (sobra reetiquetada: mesmo CUB, novo peso e data).
 * @typedef {Object} LabelData
 * @property {string} cub
 * @property {'NEW'|'LEFTOVER'} kind
 * @property {string} lot
 * @property {string} material         Código ERP (Microsys).
 * @property {string} supplier
 * @property {string} galvanization
 * @property {string} dimension        Ex.: 0,95x166.
 * @property {string} supplier_invoice NF do fornecedor.
 * @property {string} slitter_invoice  NF do prestador.
 * @property {string} received_date    AAAA-MM-DD.
 * @property {string} certificate
 * @property {number} weight
 * @property {string} date             Data da etiqueta (recebimento ou da sobra).
 * @property {string} qr               Valor do QR: o CUB.
 */

const dec = (n) => Number(n).toFixed(2).replace('.', ',')

/**
 * @param {import('./commands.js').State} state
 * @param {import('./coil.js').Coil} coil
 * @param {{kind?: 'NEW'|'LEFTOVER', weight?: number, date?: string}} [opts]
 * @returns {LabelData}
 */
export function buildLabel(state, coil, { kind = 'NEW', weight, date } = {}) {
  const mc = state.motherCoils.find((m) => m.id === coil.mother_coil)
  return {
    cub: coil.cub,
    kind,
    lot: coil.slitter_lot,
    material: coil.material ?? '',
    supplier: [mc?.supplier ?? coil.supplier, mc?.mill && mc.mill !== mc.supplier ? mc.mill : null].filter(Boolean).join(' - '),
    galvanization: coil.galvanization,
    dimension: `${dec(coil.thickness)}x${coil.width}`,
    supplier_invoice: mc?.supplier_invoice_number ?? '',
    slitter_invoice: coil.slitter_invoice_number,
    received_date: coil.received_date,
    certificate: coil.certificate_number || mc?.certificate_number || '',
    weight: weight ?? (kind === 'NEW' ? coil.received_weight : coil.current_weight),
    date: date ?? coil.received_date,
    qr: coil.cub,
  }
}
