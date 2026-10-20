import { DEFAULT_CONFIG } from './config.js'
import { DomainError, ensure } from './errors.js'
import { audit, authorize } from './commands.js'

/**
 * Cadastros (fornecedor, usina, obra, perfiladeira, catálogo de materiais) e configurações.
 * Registros de negócio nunca são apagados: só inativados.
 */

export const REGISTRY_KINDS = {
  suppliers: { label: 'Fornecedor', entity: 'Supplier' },
  mills: { label: 'Usina', entity: 'Mill' },
  projects: { label: 'Obra', entity: 'Project' },
  machines: { label: 'Perfiladeira', entity: 'Machine' },
}

const blank = (v) => v == null || String(v).trim() === ''
const norm = (v) => String(v).trim().toLowerCase()

function kindOf(kind) {
  const k = REGISTRY_KINDS[kind]
  ensure(k, 'REGISTRY_KIND_INVALID', `Cadastro desconhecido: ${kind}.`)
  return k
}

/** Cria ou edita um item de cadastro simples. Nome é único (sem diferenciar maiúsculas). */
export function saveRegistryItem(state, { kind, id, name, code = '' }, ctx) {
  authorize(ctx, 'registry.edit')
  const k = kindOf(kind)
  ensure(!blank(name), 'REGISTRY_NAME_REQUIRED', `Informe o nome (${k.label.toLowerCase()}).`)
  const list = state[kind]
  const clash = list.find((i) => norm(i.name) === norm(name) && i.id !== id)
  ensure(!clash, 'REGISTRY_DUPLICATE', `Já existe ${k.label.toLowerCase()} com o nome "${clash?.name}".`)
  const prefix = { suppliers: 'sup', mills: 'mil', projects: 'obra', machines: 'mq' }[kind]
  if (id) {
    const before = list.find((i) => i.id === id)
    ensure(before, 'REGISTRY_NOT_FOUND', `${k.label} não encontrado.`)
    const after = { ...before, name: String(name).trim(), code: String(code).trim() }
    return {
      state: audit({ ...state, [kind]: list.map((i) => (i.id === id ? after : i)) }, ctx, {
        action: `${kind}.update`, entity: k.entity, entity_id: id, before, after,
      }),
      result: after,
    }
  }
  const nextNum = Math.max(0, ...list.map((i) => Number(i.id.split('-').pop()) || 0)) + 1
  const item = { id: `${prefix}-${nextNum}`, name: String(name).trim(), code: String(code).trim(), active: true }
  return {
    state: audit({ ...state, [kind]: [...list, item] }, ctx, { action: `${kind}.create`, entity: k.entity, entity_id: item.id, after: item }),
    result: item,
  }
}

/** Inativa ou reativa (nunca exclui). */
export function setRegistryActive(state, { kind, id, active }, ctx) {
  authorize(ctx, 'registry.edit')
  const k = kindOf(kind)
  const before = state[kind].find((i) => i.id === id)
  ensure(before, 'REGISTRY_NOT_FOUND', `${k.label} não encontrado.`)
  const after = { ...before, active: !!active }
  return {
    state: audit({ ...state, [kind]: state[kind].map((i) => (i.id === id ? after : i)) }, ctx, {
      action: `${kind}.${active ? 'activate' : 'deactivate'}`, entity: k.entity, entity_id: id, before, after,
    }),
    result: after,
  }
}

/** Material do catálogo: (espessura, largura exata, galvanização) → código ERP. Vários registros podem ter o mesmo código. */
export function saveMaterial(state, { id, code, galvanization, thickness, width }, ctx) {
  authorize(ctx, 'registry.edit')
  ensure(!blank(code), 'MATERIAL_CODE_REQUIRED', 'Informe o código ERP.')
  ensure(!blank(galvanization), 'MATERIAL_GALV_REQUIRED', 'Informe a galvanização.')
  ensure(thickness > 0, 'MATERIAL_THICKNESS_INVALID', 'A espessura deve ser maior que zero.')
  ensure(Number.isInteger(width) && width > 0, 'MATERIAL_WIDTH_INVALID', 'A largura (mm) deve ser um inteiro maior que zero.')
  const clash = state.materials.find((m) => m.id !== id && m.thickness === thickness && m.width === width && m.galvanization === galvanization)
  ensure(!clash, 'MATERIAL_DUPLICATE', `Já existe ${thickness.toFixed(2)} × ${width} mm ${galvanization} no catálogo (código ${clash?.code}).`)
  const data = { code: String(code).trim(), galvanization: String(galvanization).trim(), thickness, width }
  if (id) {
    const before = state.materials.find((m) => m.id === id)
    ensure(before, 'MATERIAL_NOT_FOUND', 'Material não encontrado.')
    const after = { ...before, ...data }
    return {
      state: audit({ ...state, materials: state.materials.map((m) => (m.id === id ? after : m)) }, ctx, {
        action: 'materials.update', entity: 'Material', entity_id: id, before, after,
      }),
      result: after,
    }
  }
  const nextNum = Math.max(0, ...state.materials.map((m) => Number(m.id.split('-').pop()) || 0)) + 1
  const item = { id: `mat-${nextNum}`, ...data, active: true }
  return {
    state: audit({ ...state, materials: [...state.materials, item] }, ctx, { action: 'materials.create', entity: 'Material', entity_id: item.id, after: item }),
    result: item,
  }
}

export function setMaterialActive(state, { id, active }, ctx) {
  authorize(ctx, 'registry.edit')
  const before = state.materials.find((m) => m.id === id)
  ensure(before, 'MATERIAL_NOT_FOUND', 'Material não encontrado.')
  const after = { ...before, active: !!active }
  return {
    state: audit({ ...state, materials: state.materials.map((m) => (m.id === id ? after : m)) }, ctx, {
      action: `materials.${active ? 'activate' : 'deactivate'}`, entity: 'Material', entity_id: id, before, after,
    }),
    result: after,
  }
}

/** Código ERP sugerido para uma tira (ativos). Devolve null se não há linha no catálogo. */
export function suggestMaterial(state, { thickness, width, galvanization }) {
  return state.materials.find((m) => m.active !== false && m.thickness === thickness && m.width === width && m.galvanization === galvanization) ?? null
}

/** Atualiza as configurações, validando cada campo. */
export function updateConfig(state, patch, ctx) {
  authorize(ctx, 'settings.edit')
  const before = { ...DEFAULT_CONFIG, ...state.config }
  const next = { ...before, ...patch }
  ensure(next.weight_limit > 0, 'CONFIG_WEIGHT_INVALID', 'O limite de peso por bobina deve ser maior que zero.')
  ensure(next.mass_tolerance_pct >= 0 && next.mass_tolerance_pct <= 100, 'CONFIG_TOLERANCE_INVALID', 'A tolerância do balanço deve ficar entre 0 e 100%.')
  ensure(/^[A-Z]{2,6}$/.test(next.cub_prefix), 'CONFIG_PREFIX_INVALID', 'O prefixo do CUB deve ter de 2 a 6 letras maiúsculas.')
  ensure(Number.isInteger(next.cub_digits) && next.cub_digits >= 3 && next.cub_digits <= 8, 'CONFIG_DIGITS_INVALID', 'O sequencial do CUB deve ter de 3 a 8 dígitos.')
  ensure(typeof next.certificate_required === 'boolean', 'CONFIG_CERT_INVALID', 'Informe se o certificado é obrigatório.')
  ensure(next.label_layout === 'A4' || next.label_layout === 'THERMAL', 'CONFIG_LABEL_INVALID', 'Escolha o layout da etiqueta: A4 ou térmica.')
  const changed = Object.keys(next).filter((k) => next[k] !== before[k])
  if (!changed.length) throw new DomainError('CONFIG_UNCHANGED', 'Nenhuma alteração para salvar.')
  return {
    state: audit({ ...state, config: next }, ctx, {
      action: 'config.update', entity: 'Config', entity_id: 'config',
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, next[k]])),
    }),
    result: next,
  }
}
