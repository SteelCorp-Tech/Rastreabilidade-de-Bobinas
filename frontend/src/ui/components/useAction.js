import { useCallback, useState } from 'react'

/**
 * Executa uma ação assíncrona e guarda a mensagem de erro (os DomainError já vêm em pt-BR,
 * dizendo o motivo da recusa).
 */
export function useAction() {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const exec = useCallback(async (fn) => {
    setError(null)
    setBusy(true)
    try {
      return await fn()
    } catch (e) {
      setError(e?.message ?? String(e))
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])
  return { error, busy, exec, clearError: () => setError(null) }
}
