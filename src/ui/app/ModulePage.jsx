import { Navigate } from 'react-router'
import { useProfile } from './ProfileContext.jsx'

/** Página provisória de um módulo: mostra o que virá e em qual incremento. */
export default function ModulePage({ module: m }) {
  const { canView, roleLabel } = useProfile()
  if (!canView(m.view)) return <Navigate to="/" replace />
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{m.group ?? 'Geral'}</div>
          <h1>{m.label}</h1>
        </div>
      </div>
      <div className="card placeholder">
        <div className="badge">Incremento {m.increment}</div>
        <p>{m.desc}.</p>
        <p>Perfil atual: {roleLabel}.</p>
      </div>
    </>
  )
}
