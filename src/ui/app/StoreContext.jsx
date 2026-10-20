import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createLocalStorageRepository, STATE_KEY } from '../../persistence/localStorageRepository.js'
import { createCommandRunner } from '../../persistence/commandRunner.js'
import { ensureSeedAttachments } from '../../persistence/attachmentStore.js'
import { useProfile } from './ProfileContext.jsx'

const StoreContext = createContext(null)
const USER = 'Gustavo Oliveira'

/** O seed vai num pacote separado, carregado só na primeira vez. */
async function loadSeed() {
  const [{ default: seed }, { CERT_MODEL }] = await Promise.all([import('../../persistence/seed/seed.json'), import('../../persistence/certModel.js')])
  await ensureSeedAttachments(CERT_MODEL).catch(() => {})
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

  const restoreSeed = useCallback(async () => {
    setState(await runner.restoreSeed({ role: roleRef.current, user: USER }))
  }, [runner])

  const value = useMemo(() => ({ state, run, restoreSeed, error }), [state, run, restoreSeed, error])
  if (error) return <div className="placeholder">Não foi possível abrir os dados: {String(error.message ?? error)}</div>
  if (!state) return <div className="placeholder">Carregando dados…</div>
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}
