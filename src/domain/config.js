/**
 * @typedef {Object} Config
 * @property {number} weight_limit      Limite de peso por bobina no desbobinador (kg).
 * @property {boolean} certificate_required  Certificado obrigatório ao registrar a bobina mãe.
 * @property {string} cub_prefix
 * @property {number} cub_digits        Dígitos do sequencial (só vale para CUBs novos).
 * @property {number} mass_tolerance_pct Tolerância do balanço de massa, % do peso líquido.
 * @property {'A4'|'THERMAL'} label_layout  Folha A4 (2 colunas) ou etiqueta térmica 100×50 mm.
 */

/** @type {Config} */
export const DEFAULT_CONFIG = {
  weight_limit: 1000,
  certificate_required: true,
  cub_prefix: 'CUB',
  cub_digits: 5,
  mass_tolerance_pct: 1,
  label_layout: 'A4',
}
