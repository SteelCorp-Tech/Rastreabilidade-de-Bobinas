import { describe, it, expect } from 'vitest'
import { can, canView } from './permissions.js'

describe('permissões por perfil', () => {
  it('auditor é somente leitura', () => {
    expect(can('AUDITOR', 'motherCoil.create')).toBe(false)
    expect(can('AUDITOR', 'block.manage')).toBe(false)
    expect(canView('AUDITOR', 'audit')).toBe(true)
  })
  it('só a Qualidade bloqueia; admin também', () => {
    expect(can('QUALIDADE', 'block.manage')).toBe(true)
    expect(can('PRODUCAO', 'block.manage')).toBe(false)
    expect(can('ADMIN', 'block.manage')).toBe(true)
  })
  it('almoxarifado e qualidade anexam certificado; produção não', () => {
    expect(can('ALMOXARIFADO', 'motherCoil.attachCertificate')).toBe(true)
    expect(can('QUALIDADE', 'motherCoil.attachCertificate')).toBe(true)
    expect(can('PRODUCAO', 'motherCoil.attachCertificate')).toBe(false)
  })
  it('só admin edita configurações', () => {
    expect(can('ADMIN', 'settings.edit')).toBe(true)
    expect(can('PCP', 'settings.edit')).toBe(false)
  })
})
