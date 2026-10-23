/**
 * Perfis simulados e matriz de permissões (CLAUDE.md 8.2).
 * Domínio puro: sem React, sem acesso a storage.
 *
 * A matriz padrão vive aqui. O administrador pode alterá-la na tela de Permissões: as mudanças ficam em
 * `state.permissions` ({ [perfil]: { actions, views } }) e entram aqui como `overrides`.
 * Trava de segurança: o ADMINISTRADOR sempre pode tudo, o AUDITOR nunca altera nada, e as ações
 * administrativas (configurações, permissões, exclusões) não podem ser concedidas a outros perfis.
 */

/** @typedef {'ALMOXARIFADO'|'PCP'|'PRODUCAO'|'QUALIDADE'|'SUPRIMENTOS'|'ADMIN'|'AUDITOR'} RoleId */

/** @type {{id: RoleId, label: string}[]} */
export const ROLES = [
  { id: 'ALMOXARIFADO', label: 'Almoxarifado' },
  { id: 'PCP', label: 'PCP' },
  { id: 'PRODUCAO', label: 'Produção' },
  { id: 'QUALIDADE', label: 'Qualidade' },
  { id: 'SUPRIMENTOS', label: 'Suprimentos' },
  { id: 'ADMIN', label: 'Administrador' },
  { id: 'AUDITOR', label: 'Auditor' },
]

/** Perfis cuja matriz não pode ser alterada. */
export const LOCKED_ROLES = ['ADMIN']

/**
 * Ações do sistema, com o rótulo mostrado na tela de Permissões.
 * `adminOnly`: só o administrador (não pode ser concedida).
 */
export const ACTIONS = [
  { id: 'registry.edit', label: 'Editar cadastros (fornecedores, obras, catálogo)', group: 'Cadastros' },
  { id: 'motherCoil.create', label: 'Registrar bobina mãe', group: 'Bobinas mãe' },
  { id: 'motherCoil.attachCertificate', label: 'Anexar ou substituir certificado', group: 'Bobinas mãe' },
  { id: 'cuttingPlan.edit', label: 'Criar e enviar plano de corte', group: 'Plano de corte' },
  { id: 'delivery.receive', label: 'Registrar entrega e gerar CUBs', group: 'Recebimento' },
  { id: 'label.print', label: 'Imprimir etiquetas', group: 'Recebimento' },
  { id: 'stock.locate', label: 'Definir a posição do CUB no estoque', group: 'Estoque' },
  { id: 'coilUse.open', label: 'Abrir uso de bobina (montar)', group: 'Uso de bobina' },
  { id: 'coilUse.close', label: 'Fechar uso de bobina (sobra ou consumida)', group: 'Uso de bobina' },
  { id: 'block.manage', label: 'Bloquear e liberar CUB ou lote', group: 'Qualidade' },
  { id: 'motherCoil.delete', label: 'Excluir bobina mãe', group: 'Administração', adminOnly: true },
  { id: 'cuttingPlan.delete', label: 'Excluir plano de corte', group: 'Administração', adminOnly: true },
  { id: 'delivery.delete', label: 'Excluir recebimento', group: 'Administração', adminOnly: true },
  { id: 'settings.edit', label: 'Alterar configurações', group: 'Administração', adminOnly: true },
  { id: 'permissions.edit', label: 'Alterar permissões dos perfis', group: 'Administração', adminOnly: true },
  { id: 'seed.restore', label: 'Restaurar dados de exemplo', group: 'Administração', adminOnly: true },
]

/** Telas (módulos do menu). `fixed`: todos veem; `adminOnly`: só o administrador. */
export const VIEWS = [
  { id: 'home', label: 'Início', fixed: true },
  { id: 'search', label: 'Consulta', fixed: true },
  { id: 'motherCoils', label: 'Bobinas mãe' },
  { id: 'cuttingPlans', label: 'Plano de corte' },
  { id: 'deliveries', label: 'Recebimento' },
  { id: 'stock', label: 'Estoque de CUBs' },
  { id: 'coilUse', label: 'Uso de bobina' },
  { id: 'blocks', label: 'Bloqueio e liberação' },
  { id: 'reports', label: 'Recall e relatórios' },
  { id: 'registry', label: 'Cadastros' },
  { id: 'audit', label: 'Auditoria' },
  { id: 'settings', label: 'Configurações', adminOnly: true },
  { id: 'permissions', label: 'Permissões', adminOnly: true },
]

const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]))
const VIEW_BY_ID = Object.fromEntries(VIEWS.map((v) => [v.id, v]))

/** Quem pode o quê por padrão. ADMIN pode tudo (tratado em `can`). */
export const PERMISSIONS = {
  'registry.edit': ['SUPRIMENTOS'],
  'motherCoil.create': ['ALMOXARIFADO'],
  'motherCoil.attachCertificate': ['ALMOXARIFADO', 'QUALIDADE'],
  'cuttingPlan.edit': ['PCP'],
  'delivery.receive': ['ALMOXARIFADO'],
  'label.print': ['ALMOXARIFADO', 'PRODUCAO'],
  'stock.locate': ['ALMOXARIFADO', 'PRODUCAO'],
  'coilUse.open': ['PRODUCAO'],
  'coilUse.close': ['PRODUCAO'],
  'block.manage': [], // só o administrador, por padrão
  'motherCoil.delete': [],
  'cuttingPlan.delete': [],
  'delivery.delete': [],
  'settings.edit': [],
  'permissions.edit': [],
  'seed.restore': [],
}

const COMMON_VIEWS = ['home', 'search', 'stock', 'reports']
const ALL_VIEWS = VIEWS.map((v) => v.id)
const VIEWS_BY_ROLE = {
  ALMOXARIFADO: [...COMMON_VIEWS, 'motherCoils', 'deliveries'],
  PCP: [...COMMON_VIEWS, 'motherCoils', 'cuttingPlans'],
  PRODUCAO: [...COMMON_VIEWS, 'coilUse'],
  QUALIDADE: [...COMMON_VIEWS, 'motherCoils'],
  SUPRIMENTOS: [...COMMON_VIEWS, 'registry', 'motherCoils'],
  ADMIN: ALL_VIEWS,
  AUDITOR: [...COMMON_VIEWS, 'registry', 'motherCoils', 'cuttingPlans', 'deliveries', 'audit'],
}

/** Ações padrão de um perfil. */
export function defaultActions(role) {
  if (role === 'ADMIN') return ACTIONS.map((a) => a.id)
  if (role === 'AUDITOR') return []
  return Object.keys(PERMISSIONS).filter((a) => PERMISSIONS[a].includes(role))
}

/** Telas padrão de um perfil. */
export function defaultViews(role) {
  return [...(VIEWS_BY_ROLE[role] ?? [])]
}

/**
 * Permissões efetivas de um perfil, aplicando as alterações salvas.
 * @param {RoleId} role @param {Record<string, {actions?: string[], views?: string[]}>} [overrides]
 * @returns {{actions: string[], views: string[]}}
 */
export function effectivePermissions(role, overrides) {
  if (role === 'ADMIN') return { actions: ACTIONS.map((a) => a.id), views: ALL_VIEWS }
  const o = overrides?.[role]
  const actions = role === 'AUDITOR' ? [] : (o?.actions ?? defaultActions(role)).filter((a) => ACTION_BY_ID[a] && !ACTION_BY_ID[a].adminOnly)
  const views = (o?.views ?? defaultViews(role)).filter((v) => VIEW_BY_ID[v] && !VIEW_BY_ID[v].adminOnly)
  for (const v of VIEWS.filter((x) => x.fixed)) if (!views.includes(v.id)) views.push(v.id)
  return { actions, views }
}

/** O perfil tem alteração salva em relação ao padrão? */
export function hasOverride(role, overrides) {
  return !!overrides?.[role]
}

/** @param {RoleId} role @param {string} action @param {Record<string, any>} [overrides] */
export function can(role, action, overrides) {
  if (role === 'ADMIN') return action in PERMISSIONS
  return effectivePermissions(role, overrides).actions.includes(action)
}

/** @param {RoleId} role @param {string} view @param {Record<string, any>} [overrides] */
export function canView(role, view, overrides) {
  return effectivePermissions(role, overrides).views.includes(view)
}
