import { describe, it, expect } from 'vitest'
import { emptyState } from './commands.js'
import { saveMaterial, saveRegistryItem, setMaterialActive, setRegistryActive, suggestMaterial, updateConfig } from './registryCommands.js'

const NOW = new Date('2026-10-20T15:00:00Z')
const ctx = (role) => ({ role, user: 'teste', now: NOW })
const SUP = ctx('SUPRIMENTOS')
const ADMIN = ctx('ADMIN')
const codeOf = (fn) => { try { fn() } catch (e) { return e.code } return null }

describe('cadastros simples', () => {
  it('cria, edita e audita; id sequencial', () => {
    let s = emptyState()
    s = saveRegistryItem(s, { kind: 'suppliers', name: 'MVAL' }, SUP).state
    s = saveRegistryItem(s, { kind: 'suppliers', name: 'AMAFER', code: '123' }, SUP).state
    expect(s.suppliers.map((x) => x.id)).toEqual(['sup-1', 'sup-2'])
    s = saveRegistryItem(s, { kind: 'suppliers', id: 'sup-2', name: 'AMAFER SA', code: '123' }, SUP).state
    expect(s.suppliers[1].name).toBe('AMAFER SA')
    expect(s.auditLog.map((a) => a.action)).toEqual(['suppliers.create', 'suppliers.create', 'suppliers.update'])
  })
  it('nome único sem diferenciar maiúsculas; nome obrigatório', () => {
    const s = saveRegistryItem(emptyState(), { kind: 'projects', name: 'Casa Morumbi' }, SUP).state
    expect(codeOf(() => saveRegistryItem(s, { kind: 'projects', name: ' CASA MORUMBI ' }, SUP))).toBe('REGISTRY_DUPLICATE')
    expect(codeOf(() => saveRegistryItem(s, { kind: 'projects', name: '  ' }, SUP))).toBe('REGISTRY_NAME_REQUIRED')
    expect(codeOf(() => saveRegistryItem(s, { kind: 'x', name: 'a' }, SUP))).toBe('REGISTRY_KIND_INVALID')
  })
  it('inativa e reativa, nunca apaga', () => {
    let s = saveRegistryItem(emptyState(), { kind: 'machines', name: 'FRAMECAD 90' }, SUP).state
    s = setRegistryActive(s, { kind: 'machines', id: 'mq-1', active: false }, SUP).state
    expect(s.machines).toHaveLength(1)
    expect(s.machines[0].active).toBe(false)
    s = setRegistryActive(s, { kind: 'machines', id: 'mq-1', active: true }, SUP).state
    expect(s.machines[0].active).toBe(true)
  })
  it('só Suprimentos e Administrador editam cadastros; auditor não', () => {
    const s = emptyState()
    expect(codeOf(() => saveRegistryItem(s, { kind: 'mills', name: 'CSN' }, ctx('ALMOXARIFADO')))).toBe('FORBIDDEN')
    expect(codeOf(() => saveRegistryItem(s, { kind: 'mills', name: 'CSN' }, ctx('AUDITOR')))).toBe('FORBIDDEN')
    expect(saveRegistryItem(s, { kind: 'mills', name: 'CSN' }, ADMIN).result.name).toBe('CSN')
  })
})

describe('catálogo de materiais', () => {
  const m = { code: '10337', galvanization: 'Z275', thickness: 0.95, width: 166 }
  it('vários registros podem apontar para o mesmo código (largura varia dentro da tolerância)', () => {
    let s = saveMaterial(emptyState(), m, SUP).state
    s = saveMaterial(s, { ...m, width: 165 }, SUP).state
    expect(s.materials.map((x) => x.code)).toEqual(['10337', '10337'])
  })
  it('recusa a mesma combinação (espessura, largura, galvanização) duas vezes', () => {
    const s = saveMaterial(emptyState(), m, SUP).state
    expect(codeOf(() => saveMaterial(s, { ...m, code: '99999' }, SUP))).toBe('MATERIAL_DUPLICATE')
    expect(saveMaterial(s, { ...m, galvanization: 'Z350' }, SUP).state.materials).toHaveLength(2)
  })
  it('valida campos', () => {
    const s = emptyState()
    expect(codeOf(() => saveMaterial(s, { ...m, code: '' }, SUP))).toBe('MATERIAL_CODE_REQUIRED')
    expect(codeOf(() => saveMaterial(s, { ...m, thickness: 0 }, SUP))).toBe('MATERIAL_THICKNESS_INVALID')
    expect(codeOf(() => saveMaterial(s, { ...m, width: 166.5 }, SUP))).toBe('MATERIAL_WIDTH_INVALID')
  })
  it('sugere o código só entre os ativos', () => {
    let s = saveMaterial(emptyState(), m, SUP).state
    expect(suggestMaterial(s, { thickness: 0.95, width: 166, galvanization: 'Z275' }).code).toBe('10337')
    s = setMaterialActive(s, { id: 'mat-1', active: false }, SUP).state
    expect(suggestMaterial(s, { thickness: 0.95, width: 166, galvanization: 'Z275' })).toBeNull()
    expect(suggestMaterial(s, { thickness: 1.25, width: 166, galvanization: 'Z275' })).toBeNull()
  })
})

describe('configurações', () => {
  it('só o administrador altera; grava antes e depois na auditoria', () => {
    const s = emptyState()
    expect(codeOf(() => updateConfig(s, { weight_limit: 800 }, ctx('PCP')))).toBe('FORBIDDEN')
    const r = updateConfig(s, { weight_limit: 800, certificate_required: false }, ADMIN)
    expect(r.state.config.weight_limit).toBe(800)
    expect(r.state.auditLog.at(-1)).toMatchObject({ action: 'config.update', before: { weight_limit: 700, certificate_required: true }, after: { weight_limit: 800, certificate_required: false } })
  })
  it('valida cada campo', () => {
    const s = emptyState()
    expect(codeOf(() => updateConfig(s, { weight_limit: 0 }, ADMIN))).toBe('CONFIG_WEIGHT_INVALID')
    expect(codeOf(() => updateConfig(s, { mass_tolerance_pct: -1 }, ADMIN))).toBe('CONFIG_TOLERANCE_INVALID')
    expect(codeOf(() => updateConfig(s, { cub_prefix: 'cub1' }, ADMIN))).toBe('CONFIG_PREFIX_INVALID')
    expect(codeOf(() => updateConfig(s, { cub_digits: 2 }, ADMIN))).toBe('CONFIG_DIGITS_INVALID')
    expect(codeOf(() => updateConfig(s, { label_layout: 'X' }, ADMIN))).toBe('CONFIG_LABEL_INVALID')
    expect(codeOf(() => updateConfig(s, {}, ADMIN))).toBe('CONFIG_UNCHANGED')
  })
  it('estado antigo sem label_layout é completado com o padrão', () => {
    const s = emptyState()
    delete s.config.label_layout
    expect(updateConfig(s, { weight_limit: 900 }, ADMIN).state.config.label_layout).toBe('A4')
  })
})
