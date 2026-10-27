import { useNavigate } from 'react-router'

/** Volta à tela anterior; se esta foi aberta direto (sem histórico), vai para `fallback`. */
export default function BackButton({ fallback = '/consulta' }) {
  const navigate = useNavigate()
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(fallback))
  return <button type="button" className="back-btn no-print" onClick={back}>← Voltar</button>
}
