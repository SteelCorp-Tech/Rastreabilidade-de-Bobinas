import { describe, it, expect } from 'vitest'
import { createMemoryRepository } from './repository.js'
import { createLocalStorageRepository } from './localStorageRepository.js'
import { createCommandRunner } from './commandRunner.js'
import { emptyState, receiveDelivery, registerMotherCoil } from '@dominio/commands.js'

const NOW = new Date('2026-10-20T15:00:00Z')
const ALMOX = { role: 'ALMOXARIFADO', user: 'almox' }
const lote = (n) => ({
  slitter_lot: String(n), supplier: 'MVAL', supplier_invoice_number: `NF${n}`, thickness: 0.95, width: 1200,
  galvanization: 'Z275', net_weight: 12000, certificate_number: `C${n}`, certificate_file: { id: `a${n}`, name: 'c.pdf' },
})

/** Trava em fila, como o navigator.locks: uma gravação por vez, mesmo com várias "abas". */
function fakeLocks() {
  let tail = Promise.resolve()
  return { run: (fn) => { const p = tail.then(fn); tail = p.catch(() => {}); return p } }
}

describe('repositórios', () => {
  it('memória: devolve cópia, sem compartilhar referência', () => {
    const repo = createMemoryRepository()
    const s = emptyState()
    repo.save(s)
    const a = repo.load()
    a.motherCoils.push({ id: 'x' })
    expect(repo.load().motherCoils).toHaveLength(0)
  })

  it('localStorage: grava com o prefixo bobinas:v1: e tolera JSON quebrado', () => {
    const data = new Map()
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) }
    const repo = createLocalStorageRepository(storage)
    expect(repo.load()).toBeNull()
    repo.save(emptyState())
    expect([...data.keys()]).toEqual(['bobinas:v1:state'])
    expect(repo.load().motherCoils).toEqual([])
    data.set('bobinas:v1:state', '{quebrado')
    expect(repo.load()).toBeNull()
    repo.clear()
    expect(data.size).toBe(0)
  })
})

describe('executor de comandos', () => {
  const make = (repo, locks) => createCommandRunner({ repo, loadSeed: () => emptyState(), locks, clock: () => NOW })

  it('carrega o seed na primeira vez e depois lê do repositório', async () => {
    const repo = createMemoryRepository()
    const runner = make(repo, fakeLocks())
    await runner.init()
    expect(repo.load()).not.toBeNull()
  })

  it('recusa sem gravar nada quando a regra de domínio falha', async () => {
    const repo = createMemoryRepository()
    const runner = make(repo, fakeLocks())
    await runner.init()
    const { certificate_file, ...semArquivo } = lote(1)
    await expect(runner.run(registerMotherCoil, semArquivo, ALMOX)).rejects.toMatchObject({ code: 'CERTIFICATE_REQUIRED' })
    expect(repo.load().motherCoils).toHaveLength(0)
    expect(repo.load().auditLog).toHaveLength(0)
  })

  it('duas abas gravando ao mesmo tempo: nenhuma perde dados e nenhum CUB se repete', async () => {
    const repo = createMemoryRepository()
    const locks = fakeLocks()
    const tabA = make(repo, locks)
    const tabB = make(repo, locks) // mesma "base", outro executor, como duas abas
    await tabA.init()
    await tabA.run(registerMotherCoil, lote(1), ALMOX)
    await tabB.run(registerMotherCoil, lote(2), ALMOX)

    const entrega = (mc) => ({
      delivery: { slitter_invoice_number: `P${mc}`, declared_coil_count: 3 },
      lines: Array.from({ length: 3 }, () => ({ mother_coil: mc, measured_weight: 800, width: 166 })),
    })
    await Promise.all([
      tabA.run(receiveDelivery, entrega('mc-1'), ALMOX),
      tabB.run(receiveDelivery, entrega('mc-2'), ALMOX),
    ])

    const s = repo.load()
    const cubs = s.coils.map((c) => c.cub)
    expect(cubs).toHaveLength(6)
    expect(new Set(cubs).size).toBe(6)
    expect(s.deliveries).toHaveLength(2)
    expect(s.motherCoils).toHaveLength(2)
    expect(s.auditLog.map((a) => a.action)).toEqual(['motherCoil.create', 'motherCoil.create', 'delivery.receive', 'delivery.receive'])
  })

  it('apagar todos os dados: zera tudo, mantém configuração e permissões e não reaproveita número de CUB', async () => {
    const repo = createMemoryRepository()
    const runner = make(repo, fakeLocks())
    await runner.init()
    await runner.run(registerMotherCoil, lote(1), ALMOX)
    await runner.run(receiveDelivery, {
      delivery: { slitter_invoice_number: 'P1', declared_coil_count: 3 },
      lines: Array.from({ length: 3 }, () => ({ mother_coil: 'mc-1', measured_weight: 800, width: 166 })),
    }, ALMOX)
    repo.save({ ...repo.load(), config: { ...repo.load().config, weight_limit: 650 }, permissions: { PCP: { actions: [], views: ['home', 'search'] } } })

    await runner.resetAll({ role: 'ADMIN', user: 'admin' })
    const s = repo.load()
    for (const k of ['motherCoils', 'cuttingPlans', 'deliveries', 'coils', 'uses', 'suppliers', 'mills', 'projects', 'machines', 'materials']) {
      expect(s[k], k).toEqual([])
    }
    expect(s.config.weight_limit).toBe(650)
    expect(s.permissions.PCP.actions).toEqual([])
    expect(s.auditLog).toHaveLength(1)
    expect(s.auditLog[0]).toMatchObject({ action: 'data.reset', before: { motherCoils: 1, coils: 3, auditLog: 2 } })

    // CUB-2026-00001 a 00003 já foram emitidos: o próximo é o 00004
    await runner.run(registerMotherCoil, lote(2), ALMOX)
    await runner.run(receiveDelivery, {
      delivery: { slitter_invoice_number: 'P2', declared_coil_count: 1 },
      lines: [{ mother_coil: 'mc-1', measured_weight: 800, width: 166 }],
    }, ALMOX)
    expect(repo.load().coils.map((c) => c.cub)).toEqual(['CUB-2026-00004'])
  })
})
