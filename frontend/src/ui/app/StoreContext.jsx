import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createLocalStorageRepository, STATE_KEY } from '../../persistence/localStorageRepository.js'
import { createCommandRunner } from '../../persistence/commandRunner.js'
import { clearAttachments } from '../../persistence/attachmentStore.js'
import { OverridesContext, useProfile } from './ProfileContext.jsx'

const StoreContext = createContext(null)
const USER = 'Gustavo Oliveira'

/** Estado inicial: vazio (sem dados; só configurações padrão e a numeração do CUB). */
async function loadSeed() {
  const { default: seed } = await import('../../persistence/seed/seed.json')
  return structuredClone(seed)
}

export function StoreProvider({ children }) {
  const { role } = useProfile()
  const repo = useMemo(() => createLocalStorageRepository(), [])
  const runner = useMemo(() => createCommandRunner({ repo, loadSeed }), [repo])
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const roleRef = useRef(role)
  roleRef.current = role

  useEffect(() => {
    runner.init().then(setState, (e) => setError(e))
    // outra aba gravou: relê o estado
    const onStorage = (e) => {
      if (e.key === STATE_KEY) setState(repo.load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [runner, repo])

  /** Executa um comando de domínio. Rejeita com DomainError (mensagem em pt-BR) se a regra recusar. */
  const run = useCallback(
    async (command, input) => {
      const out = await runner.run(command, input, { role: roleRef.current, user: USER })
      setState(out.state)
      return out.result
    },
    [runner],
  )

  const resetAll = useCallback(async () => {
    const next = await runner.resetAll({ role: roleRef.current, user: USER })
    await clearAttachments().catch(() => {})
    setState(next)
  }, [runner])

  const value = useMemo(() => ({ state, run, resetAll, error }), [state, run, resetAll, error])
  if (error) return <div className="placeholder">Não foi possível abrir os dados: {String(error.message ?? error)}</div>
  if (!state) return <div className="placeholder">Carregando dados…</div>
  return (
    <StoreContext.Provider value={value}>
      <OverridesContext.Provider value={state.permissions}>{children}</OverridesContext.Provider>
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
