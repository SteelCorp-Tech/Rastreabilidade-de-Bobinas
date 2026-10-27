import { DEFAULT_CONFIG } from './config.js'

/**
 * Configuração dos cenários do lote real 8948 (CLAUDE.md, seção 6): limite de 1.000 kg e sem regra de refilo.
 * O padrão de operação é outro (700 kg e refilo de 14 a 30 mm, definidos pela PCP em 22/10/2026),
 * e o refilo real do 8948 (38 mm) não cumpriria a regra.
 */
export const CASO_8948 = { ...DEFAULT_CONFIG, weight_limit: 1000, trim_min_mm: null, trim_max_mm: null }
