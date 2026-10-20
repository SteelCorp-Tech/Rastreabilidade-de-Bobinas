import { createContext, useContext, useEffect, useState } from 'react'
import { ROLES, can as canDo, canView as canSee } from '../../domain/permissions.js'

const KEY = 'bobinas:v1:role'
const ProfileContext = createContext(null)

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
    can: (action) => canDo(role, action),
    canView: (view) => canSee(role, view),
  }
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  return useContext(ProfileContext)
}
