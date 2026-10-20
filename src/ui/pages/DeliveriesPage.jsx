import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { fmtDate, fmtKg } from '../format.js'

export default function DeliveriesPage() {
  const { state } = useStore()
  const { can } = useProfile()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const lotOf = (id) => state.motherCoils.find((m) => m.id === id)?.slitter_lot
  const weightOf = (d) => d.cubs.reduce((s, cub) => s + (state.coils.find((c) => c.cub === cub)?.received_weight ?? 0), 0)
  const needle = q.trim().toLowerCase()
  const rows = state.deliveries
    .filter((d) => !needle || d.slitter_invoice_number.toLowerCase().includes(needle) || d.mother_coils.some((m) => String(lotOf(m)).includes(needle)) || (d.fvm_number ?? '').toLowerCase().includes(needle))
    .sort((a, b) => (b.received_date + b.id).localeCompare(a.received_date + a.id))

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação</div>
          <h1>Recebimento</h1>
        </div>
        {can('delivery.receive') && <Link to="/recebimento/nova" className="btn link-btn">Registrar entrega</Link>}
      </div>
      <div className="filters"><input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="NF do prestador, lote ou FVM…" aria-label="Buscar" /></div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>NF do prestador</th><th>Recebida em</th><th>Lotes</th><th>CUBs</th><th>Peso medido</th><th>FVM</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="click" onClick={() => navigate(`/recebimento/${d.id}`)}>
                <td className="mono"><b>{d.slitter_invoice_number || 'sem NF'}</b></td>
                <td>{fmtDate(d.received_date)}</td>
                <td className="mono">{d.mother_coils.map(lotOf).join(', ')}</td>
                <td className="mono">{d.cubs.length}{d.declared_coil_count !== d.cubs.length ? ` de ${d.declared_coil_count}` : ''}</td>
                <td className="mono">{fmtKg(weightOf(d))}</td>
                <td className="mono">{d.fvm_number || '—'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="empty-row">Nenhuma entrega encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
