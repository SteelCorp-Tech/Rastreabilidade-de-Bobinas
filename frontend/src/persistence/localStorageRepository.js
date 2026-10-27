export const STATE_KEY = 'bobinas:v1:state'

/**
 * Repositório em localStorage. O prefixo `bobinas:v1:` evita colisão com outros apps do mesmo domínio.
 * @param {Pick<Storage, 'getItem'|'setItem'|'removeItem'>} [storage]
 * @returns {import('./repository.js').Repository}
 */
export function createLocalStorageRepository(storage = globalThis.localStorage, key = STATE_KEY) {
  return {
    load() {
      try {
        const raw = storage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    },
    save(state) {
      storage.setItem(key, JSON.stringify(state))
    },
    clear() {
      storage.removeItem(key)
    },
  }
}
