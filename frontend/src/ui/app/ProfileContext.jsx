import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ROLES, can as canDo, canView as canSee } from '@dominio/permissions.js'

const KEY = 'bobinas:v1:role'
const ProfileContext = createContext(null)
/** Permissões alteradas pelo administrador (state.permissions). Quem provê é o StoreProvider, já na 1ª renderização. */
export const OverridesContext = createContext(undefined)

function loadRole() {
  try {
    const saved = localStorage.getItem(KEY)
    if (ROLES.some((r) => r.id === saved)) return saved
  } catch {
    // storage indisponível: segue com o padrão
  }
  return 'ADMIN'
}

export function ProfileProvider({ children }) {
  const [role, setRole] = useState(loadRole)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, role)
    } catch {
      // ignora
    }
  }, [role])

  const value = {
    role,
    setRole,
    roleLabel: ROLES.find((r) => r.id === role).label,
  }
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const base = useContext(ProfileContext)
  const overrides = useContext(OverridesContext)
  return useMemo(() => ({
    ...base,
    can: (action) => canDo(base.role, action, overrides),
    canView: (view) => canSee(base.role, view, overrides),
  }), [base, overrides])
}
