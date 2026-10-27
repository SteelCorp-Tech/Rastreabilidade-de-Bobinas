import { useState } from 'react'
import { useNavigate } from 'react-router'
import SortTh from '../components/SortTh.jsx'
import { useSort } from '../sortRows.js'
import Seg from '../components/Seg.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { activePlan } from '@dominio/traceability.js'
import { MOTHER_STATUS } from '../labels.js'
import { fmtKg, fmtThickness } from '../format.js'
import { StatusBadge } from './MotherCoilsPage.jsx'

const PLAN_STATUS = { DRAFT: { label: 'Rascunho', tone: 'warn' }, SENT: { label: 'Enviado', tone: 'ok' } }

export default function CuttingPlansPage() {
  const { state } = useStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('open')
  const [q, setQ] = useState('')

  const rows = state.motherCoils.map((m) => ({ m, plan: activePlan(state, m.id) }))
  const kind = ({ m, plan }) => {
    if (m.status === 'RECEIVED' && !plan) return 'done'
    if (!plan) return 'none'
    return plan.status === 'DRAFT' ? 'draft' : 'sent'
  }
  const matches = {
    open: (r) => ['none', 'draft'].includes(kind(r)) && r.m.status !== 'RECEIVED',
    none: (r) => kind(r) === 'none' && r.m.status !== 'RECEIVED',
    draft: (r) => kind(r) === 'draft',
    sent: (r) => kind(r) === 'sent',
    all: () => true,
  }
  const options = [
    { value: 'open', label: 'A fazer' },
    { value: 'none', label: 'Sem plano' },
    { value: 'draft', label: 'Rascunho' },
    { value: 'sent', label: 'Enviado' },
    { value: 'all', label: 'Todas' },
  ].map((o) => ({ ...o, count: rows.filter(matches[o.value]).length }))
  const needle = q.trim().toLowerCase()
  const shown = rows
    .filter(matches[filter])
    .filter((r) => !needle || [r.m.slitter_lot, r.m.supplier].some((v) => String(v).toLowerCase().includes(needle)))
    .sort((a, b) => (b.m.received_at ?? '').localeCompare(a.m.received_at ?? ''))
  const { rows: sortedShown, sort, toggle } = useSort(shown, {
    lot: (r) => r.m.slitter_lot, supplier: (r) => r.m.supplier, material: (r) => r.m.thickness * 100000 + r.m.width, weight: (r) => r.m.net_weight,
    plan: (r) => (r.plan ? r.plan.version : null), cubs: (r) => r.plan?.result.total_cubs, trim: (r) => r.plan?.result.trim_weight, status: (r) => MOTHER_STATUS[r.m.status]?.label,
  })

  return (
    <div className="fit-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação</div>
          <h1>Plano de corte</h1>
        </div>
      </div>
      <Seg options={options} value={filter} onChange={setFilter} label="Filtro" />
      <div className="filters"><input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lote ou fornecedor…" aria-label="Buscar" /></div>
      <div className="card table-wrap fill">
        <table>
          <thead>
            <tr><SortTh k="lot" sort={sort} onSort={toggle}>Lote</SortTh><SortTh k="supplier" sort={sort} onSort={toggle}>Fornecedor</SortTh><SortTh k="material" sort={sort} onSort={toggle}>Material</SortTh><SortTh k="weight" sort={sort} onSort={toggle}>Peso líquido</SortTh><SortTh k="plan" sort={sort} onSort={toggle}>Plano</SortTh><SortTh k="cubs" sort={sort} onSort={toggle}>CUBs previstos</SortTh><SortTh k="trim" sort={sort} onSort={toggle}>Refilo</SortTh><SortTh k="status" sort={sort} onSort={toggle}>Situação da mãe</SortTh></tr>
          </thead>
          <tbody>
            {sortedShown.map(({ m, plan }) => (
              <tr key={m.id} className="click" onClick={() => navigate(`/planos-de-corte/${m.id}`)}>
                <td className="mono"><b>{m.slitter_lot}</b></td>
                <td>{m.supplier}</td>
                <td className="mono">{fmtThickness(m.thickness)} × {m.width} {m.galvanization}</td>
                <td className="mono">{fmtKg(m.net_weight)}</td>
                <td>{plan ? <span className={`badge ${PLAN_STATUS[plan.status]?.tone ?? ''}`}>v{plan.version} · {PLAN_STATUS[plan.status]?.label ?? plan.status}</span> : <span className="muted">—</span>}</td>
                <td className="mono">{plan ? plan.result.total_cubs : '—'}</td>
                <td className="mono">{plan ? fmtKg(plan.result.trim_weight) : '—'}</td>
                <td><StatusBadge map={MOTHER_STATUS} status={m.status} /></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={8} className="empty-row">Nenhuma bobina nesta visão.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
