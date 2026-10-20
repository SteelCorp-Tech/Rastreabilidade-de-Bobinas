/**
 * Perfis simulados e matriz de permissões (CLAUDE.md 8.2).
 * Domínio puro: sem React, sem acesso a storage.
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

/**
 * Ações do sistema. Quem pode o quê; ADMIN pode tudo (tratado em `can`).
 * AUDITOR só tem ações `view.*` (somente leitura).
 */
export const PERMISSIONS = {
  'registry.edit': ['SUPRIMENTOS'],
  'motherCoil.create': ['ALMOXARIFADO'],
  'motherCoil.attachCertificate': ['ALMOXARIFADO', 'QUALIDADE'],
  'cuttingPlan.edit': ['PCP'],
  'delivery.receive': ['ALMOXARIFADO'],
  'label.print': ['ALMOXARIFADO', 'PRODUCAO'],
  'coilUse.open': ['PRODUCAO'],
  'coilUse.close': ['PRODUCAO'],
  'block.manage': ['QUALIDADE'],
  'settings.edit': [],
  'seed.restore': [],
}

/** Telas visíveis por perfil. Todos veem as telas de consulta. */
const COMMON_VIEWS = ['home', 'search', 'coils', 'stock', 'reports']
const VIEWS_BY_ROLE = {
  ALMOXARIFADO: [...COMMON_VIEWS, 'motherCoils', 'deliveries'],
  PCP: [...COMMON_VIEWS, 'motherCoils', 'cuttingPlans'],
  PRODUCAO: [...COMMON_VIEWS, 'coilUse'],
  QUALIDADE: [...COMMON_VIEWS, 'motherCoils', 'blocks'],
  SUPRIMENTOS: [...COMMON_VIEWS, 'registry', 'motherCoils'],
  ADMIN: [...COMMON_VIEWS, 'registry', 'motherCoils', 'cuttingPlans', 'deliveries', 'coilUse', 'blocks', 'audit', 'settings'],
  AUDITOR: [...COMMON_VIEWS, 'registry', 'motherCoils', 'cuttingPlans', 'deliveries', 'blocks', 'audit'],
}

/** @param {RoleId} role @param {string} action */
export function can(role, action) {
  if (role === 'AUDITOR') return false
  if (role === 'ADMIN') return action in PERMISSIONS
  return (PERMISSIONS[action] ?? []).includes(role)
}

/** @param {RoleId} role @param {string} view */
export function canView(role, view) {
  return (VIEWS_BY_ROLE[role] ?? []).includes(view)
}
