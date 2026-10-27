import { appendAudit } from '@dominio/audit.js'
import { parseCub } from '@dominio/cub.js'

export const LOCK_NAME = 'bobinas:v1:write'

/** Trava entre abas do navegador (Web Locks). Sem suporte, executa direto. */
export function browserLocks() {
  const locks = globalThis.navigator?.locks
  return {
    run: (fn) => (locks ? locks.request(LOCK_NAME, fn) : fn()),
  }
}

/**
 * Executor de comandos: toda gravação passa por aqui, nesta ordem:
 * 1. pega a trava entre abas; 2. relê o storage; 3. aplica o comando de domínio;
 * 4. grava; 5. as outras abas são avisadas pelo evento `storage` do navegador.
 * Assim duas abas nunca gravam por cima uma da outra nem repetem um CUB.
 *
 * @param {{repo: import('./repository.js').Repository, loadSeed: () => Promise<object>|object, locks?: {run: (fn: () => Promise<any>) => Promise<any>}, clock?: () => Date}} deps
 */
export function createCommandRunner({ repo, loadSeed, locks = browserLocks(), clock = () => new Date() }) {
  async function currentState() {
    return repo.load() ?? (await loadSeed())
  }

  return {
    /** Estado atual (carrega o seed na primeira vez). */
    async init() {
      return locks.run(async () => {
        let state = repo.load()
        if (!state) {
          state = await loadSeed()
          repo.save(state)
        }
        return state
      })
    },

    /**
     * @param {(state: object, input: any, ctx: object) => {state: object, result: any}} command
     * @param {*} input @param {{role: string, user: string}} actor
     * @returns {Promise<{state: object, result: any}>}
     */
    async run(command, input, actor) {
      return locks.run(async () => {
        const state = await currentState()
        const out = command(state, input, { ...actor, now: clock(), permissions: state.permissions })
        repo.save(out.state)
        return out
      })
    },

    /**
     * Apaga todos os dados: volta ao estado inicial (vazio). Ficam só as regras do app (configurações e
     * permissões) e a numeração do CUB, que nunca volta atrás (as etiquetas já impressas continuam valendo).
     * A auditoria recomeça com o registro de quem apagou, quando e quanto havia.
     */
    async resetAll(actor) {
      return locks.run(async () => {
        const old = repo.load()
        const blank = await loadSeed()
        const cub_floor = { ...blank.cub_floor }
        for (const [year, floor] of Object.entries(old?.cub_floor ?? {})) cub_floor[year] = Math.max(cub_floor[year] ?? 0, floor)
        for (const c of old?.coils ?? []) {
          const p = parseCub(c.cub)
          if (p) cub_floor[p.year] = Math.max(cub_floor[p.year] ?? 0, p.seq)
        }
        const keys = ['motherCoils', 'cuttingPlans', 'deliveries', 'coils', 'uses', 'suppliers', 'mills', 'projects', 'machines', 'materials', 'auditLog']
        const before = old ? Object.fromEntries(keys.map((k) => [k, old[k]?.length ?? 0])) : null
        const state = {
          ...blank,
          config: old?.config ?? blank.config,
          ...(old?.permissions ? { permissions: old.permissions } : {}),
          cub_floor,
          auditLog: appendAudit([], { actor, action: 'data.reset', entity: 'System', entity_id: 'all', before, after: null }, clock()),
        }
        repo.save(state)
        return state
      })
    },
  }
}
