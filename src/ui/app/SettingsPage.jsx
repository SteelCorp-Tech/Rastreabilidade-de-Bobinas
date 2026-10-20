import { useState } from 'react'
import { useProfile } from './ProfileContext.jsx'
import { useStore } from './StoreContext.jsx'

/** Configurações: por enquanto só os dados de exemplo (o resto entra no incremento 3). */
export default function SettingsPage() {
  const { can } = useProfile()
  const { state, restoreSeed } = useStore()
  const [done, setDone] = useState(false)
  const counts = [
    ['Bobinas mãe', state.motherCoils.length],
    ['CUBs', state.coils.length],
    ['Entregas', state.deliveries.length],
    ['Usos', state.uses.length],
    ['Eventos de auditoria', state.auditLog.length],
  ]
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Sistema</div>
          <h1>Configurações</h1>
        </div>
      </div>
      <div className="card panel">
        <h2>Dados de exemplo</h2>
        <p className="muted">
          Gerados da planilha de controle (amostra de lotes com peso e largura da mãe). Os pesos dos CUBs são estimados pela fórmula do plano de corte.
        </p>
        <ul className="stat-list">
          {counts.map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <b className="mono">{v}</b>
            </li>
          ))}
        </ul>
        <button
          className="btn"
          disabled={!can('seed.restore')}
          title={can('seed.restore') ? '' : 'Somente o administrador'}
          onClick={async () => {
            if (!window.confirm('Restaurar os dados de exemplo? O que foi lançado nesta máquina será substituído. A auditoria é mantida.')) return
            await restoreSeed()
            setDone(true)
          }}
        >
          Restaurar dados de exemplo
        </button>
        {done && <p className="ok-msg">Dados restaurados.</p>}
      </div>
    </>
  )
}
