import { describe, it, expect } from 'vitest'
import { can, canView, effectivePermissions, ACTIONS } from './permissions.js'
import { emptyState } from './commands.js'
import { resetRolePermissions, updateRolePermissions } from './registryCommands.js'

const NOW = new Date('2026-10-23T12:00:00Z')
const ctx = (role, permissions) => ({ role, user: 'teste', now: NOW, permissions })
const ADMIN = ctx('ADMIN')
const codeOf = (fn) => { try { fn() } catch (e) { return e.code } return null }

describe('permissões por perfil (padrão)', () => {
  it('auditor é somente leitura', () => {
    expect(can('AUDITOR', 'motherCoil.create')).toBe(false)
    expect(can('AUDITOR', 'block.manage')).toBe(false)
    expect(canView('AUDITOR', 'audit')).toBe(true)
  })
  it('bloqueio e liberação é só do administrador', () => {
    expect(can('ADMIN', 'block.manage')).toBe(true)
    expect(can('QUALIDADE', 'block.manage')).toBe(false)
    expect(can('PRODUCAO', 'block.manage')).toBe(false)
    expect(canView('ADMIN', 'blocks')).toBe(true)
    expect(canView('QUALIDADE', 'blocks')).toBe(false)
    expect(canView('AUDITOR', 'blocks')).toBe(false)
  })
  it('almoxarifado e qualidade anexam certificado; produção não', () => {
    expect(can('ALMOXARIFADO', 'motherCoil.attachCertificate')).toBe(true)
    expect(can('QUALIDADE', 'motherCoil.attachCertificate')).toBe(true)
    expect(can('PRODUCAO', 'motherCoil.attachCertificate')).toBe(false)
  })
  it('configurações, permissões e exclusões são só do administrador', () => {
    for (const a of ['settings.edit', 'permissions.edit', 'motherCoil.delete', 'cuttingPlan.delete', 'delivery.delete']) {
      expect(can('ADMIN', a), a).toBe(true)
      expect(can('PCP', a), a).toBe(false)
    }
    expect(canView('ADMIN', 'permissions')).toBe(true)
    expect(canView('PCP', 'permissions')).toBe(false)
  })
})

describe('permissões editáveis', () => {
  it('só o administrador altera, e a mudança passa a valer para o perfil', () => {
    const s = emptyState()
    const input = { role: 'QUALIDADE', actions: ['motherCoil.attachCertificate', 'block.manage'], views: ['home', 'search', 'blocks', 'motherCoils'] }
    expect(codeOf(() => updateRolePermissions(s, input, ctx('QUALIDADE')))).toBe('FORBIDDEN')
    const out = updateRolePermissions(s, input, ADMIN)
    expect(can('QUALIDADE', 'block.manage', out.state.permissions)).toBe(true)
    expect(canView('QUALIDADE', 'blocks', out.state.permissions)).toBe(true)
    expect(can('QUALIDADE', 'block.manage')).toBe(false) // sem a alteração, continua o padrão
    expect(out.state.auditLog.at(-1)).toMatchObject({ action: 'permissions.update', entity_id: 'QUALIDADE', actor: { role: 'ADMIN' } })
  })

  it('não deixa conceder ação de administrador, mexer no administrador ou dar ação ao auditor', () => {
    const s = emptyState()
    expect(codeOf(() => updateRolePermissions(s, { role: 'PCP', actions: ['settings.edit'], views: ['home', 'search'] }, ADMIN))).toBe('PERMISSION_ACTION_INVALID')
    expect(codeOf(() => updateRolePermissions(s, { role: 'PCP', actions: [], views: ['home', 'search', 'permissions'] }, ADMIN))).toBe('PERMISSION_VIEW_INVALID')
    expect(codeOf(() => updateRolePermissions(s, { role: 'ADMIN', actions: [], views: ['home'] }, ADMIN))).toBe('PERMISSION_ROLE_LOCKED')
    expect(codeOf(() => updateRolePermissions(s, { role: 'AUDITOR', actions: ['block.manage'], views: ['home', 'search'] }, ADMIN))).toBe('PERMISSION_AUDITOR_READONLY')
  })

  it('Início e Consulta nunca somem; o administrador sempre pode tudo', () => {
    const s = emptyState()
    const out = updateRolePermissions(s, { role: 'PRODUCAO', actions: [], views: [] }, ADMIN)
    expect(canView('PRODUCAO', 'home', out.state.permissions)).toBe(true)
    expect(canView('PRODUCAO', 'search', out.state.permissions)).toBe(true)
    expect(canView('PRODUCAO', 'coilUse', out.state.permissions)).toBe(false)
    expect(effectivePermissions('ADMIN', out.state.permissions).actions).toHaveLength(ACTIONS.length)
  })

  it('recusa salvar sem mudança e restaura o padrão', () => {
    const s = emptyState()
    const same = { role: 'PCP', actions: ['cuttingPlan.edit'], views: effectivePermissions('PCP').views }
    expect(codeOf(() => updateRolePermissions(s, same, ADMIN))).toBe('PERMISSION_UNCHANGED')
    const changed = updateRolePermissions(s, { ...same, actions: [] }, ADMIN).state
    expect(can('PCP', 'cuttingPlan.edit', changed.permissions)).toBe(false)
    const back = resetRolePermissions(changed, { role: 'PCP' }, ADMIN).state
    expect(can('PCP', 'cuttingPlan.edit', back.permissions)).toBe(true)
    expect(codeOf(() => resetRolePermissions(back, { role: 'PCP' }, ADMIN))).toBe('PERMISSION_UNCHANGED')
  })
})
