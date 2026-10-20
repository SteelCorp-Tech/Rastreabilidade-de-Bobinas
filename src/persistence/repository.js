/**
 * Repositório de estado: a interface que o resto do app usa. Hoje há duas implementações
 * (memória, para testes, e localStorage); para ligar um backend, basta outra com o mesmo formato.
 *
 * @typedef {Object} Repository
 * @property {() => import('../domain/commands.js').State|null} load  Lê o estado gravado (ou null).
 * @property {(state: import('../domain/commands.js').State) => void} save
 * @property {() => void} clear
 */

/** @returns {Repository} */
export function createMemoryRepository(initial = null) {
  let current = initial ? structuredClone(initial) : null
  return {
    load: () => (current ? structuredClone(current) : null),
    save: (state) => {
      current = structuredClone(state)
    },
    clear: () => {
      current = null
    },
  }
}
