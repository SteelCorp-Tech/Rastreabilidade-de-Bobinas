import { appendAudit } from '../domain/audit.js'

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
        const out = command(state, input, { ...actor, now: clock() })
        repo.save(out.state)
        return out
      })
    },

    /** Restaura os dados de exemplo, preservando o AuditLog (que só cresce) e registrando o evento. */
    async restoreSeed(actor) {
      return locks.run(async () => {
        const old = repo.load()
        const seed = await loadSeed()
        const state = {
          ...seed,
          auditLog: appendAudit(
            old?.auditLog ?? [],
            { actor, action: 'seed.restore', entity: 'System', entity_id: 'seed', after: { motherCoils: seed.motherCoils.length, coils: seed.coils.length } },
            clock(),
          ),
        }
        repo.save(state)
        return state
      })
    },
  }
}
