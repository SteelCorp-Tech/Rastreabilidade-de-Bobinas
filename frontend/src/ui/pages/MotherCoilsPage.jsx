import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import SortTh from '../components/SortTh.jsx'
import { useSort } from '../sortRows.js'
import Seg from '../components/Seg.jsx'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { lacksCertificate } from '@dominio/motherCoil.js'
import { MOTHER_STATUS } from '../labels.js'
import { fmtKg, fmtThickness } from '../format.js'

export function CertBadge({ mc }) {
  return lacksCertificate(mc) ? <span className="badge warn">Sem certificado</span> : <span className="mono">{mc.certificate_number}</span>
}

export function StatusBadge({ map, status }) {
  const s = map[status] ?? { label: status, tone: '' }
  return <span className={`badge ${s.tone}`}>{s.label}</span>
}

export default function MotherCoilsPage() {
  const { state } = useStore()
  const { can } = useProfile()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  const cubCount = useMemo(() => {
    const m = new Map()
    for (const c of state.coils) m.set(c.mother_coil, (m.get(c.mother_coil) ?? 0) + 1)
    return m
  }, [state.coils])

  const matches = {
    all: () => true,
    nocert: lacksCertificate,
    REGISTERED: (m) => m.status === 'REGISTERED',
    SCHEDULED: (m) => m.status === 'PLANNED' || m.status === 'SCHEDULED',
    RECEIVED: (m) => m.status === 'RECEIVED',
    BLOCKED: (m) => m.status === 'BLOCKED',
  }
  const count = (k) => state.motherCoils.filter(matches[k]).length
  const options = [
    { value: 'all', label: 'Todas' },
    { value: 'nocert', label: 'Sem certificado' },
    { value: 'REGISTERED', label: 'Registradas' },
    { value: 'SCHEDULED', label: 'No prestador' },
    { value: 'RECEIVED', label: 'Recebidas' },
    { value: 'BLOCKED', label: 'Bloqueadas' },
  ].map((o) => ({ ...o, count: count(o.value) }))

  const needle = q.trim().toLowerCase()
  const rows = state.motherCoils
    .filter(matches[filter])
    .filter((m) => !needle || [m.slitter_lot, m.supplier, m.supplier_invoice_number, m.certificate_number, m.slitter_job_ref, m.mill].some((v) => String(v ?? '').toLowerCase().includes(needle)))
    .sort((a, b) => (b.received_at ?? '').localeCompare(a.received_at ?? ''))
  const { rows: sorted, sort, toggle } = useSort(rows, {
    lot: (m) => m.slitter_lot, supplier: (m) => m.supplier, material: (m) => m.thickness * 100000 + m.width, weight: (m) => m.net_weight,
    invoice: (m) => m.supplier_invoice_number, cert: (m) => m.certificate_number, status: (m) => MOTHER_STATUS[m.status]?.label, cubs: (m) => cubCount.get(m.id) ?? 0,
  })

  return (
    <div className="fit-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação</div>
          <h1>Bobinas mãe</h1>
        </div>
        {can('motherCoil.create') && <Link to="/bobinas-mae/nova" className="btn link-btn">Nova bobina mãe</Link>}
      </div>
      <Seg options={options} value={filter} onChange={setFilter} label="Filtro" />
      <div className="filters"><input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lote, fornecedor, NF, certificado…" aria-label="Buscar" /></div>
      <div className="card table-wrap fill">
        <table>
          <thead>
            <tr><SortTh k="lot" sort={sort} onSort={toggle}>Lote</SortTh><SortTh k="supplier" sort={sort} onSort={toggle}>Fornecedor</SortTh><SortTh k="material" sort={sort} onSort={toggle}>Material</SortTh><SortTh k="weight" sort={sort} onSort={toggle}>Peso líquido</SortTh><SortTh k="invoice" sort={sort} onSort={toggle}>NF fornecedor</SortTh><SortTh k="cert" sort={sort} onSort={toggle}>Certificado</SortTh><SortTh k="status" sort={sort} onSort={toggle}>Situação</SortTh><SortTh k="cubs" sort={sort} onSort={toggle}>CUBs</SortTh></tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id} className="click" onClick={() => navigate(`/bobinas-mae/${m.id}`)}>
                <td className="mono"><b>{m.slitter_lot}</b></td>
                <td>{m.supplier}{m.mill && m.mill !== m.supplier ? <small className="muted"> · {m.mill}</small> : null}</td>
                <td className="mono">{fmtThickness(m.thickness)} × {m.width} {m.galvanization}</td>
                <td className="mono">{fmtKg(m.net_weight)}</td>
                <td className="mono">{m.supplier_invoice_number || '—'}</td>
                <td><CertBadge mc={m} /></td>
                <td><StatusBadge map={MOTHER_STATUS} status={m.status} /></td>
                <td className="mono">{cubCount.get(m.id) ?? 0}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="empty-row">Nenhuma bobina mãe encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted foot">{rows.length} de {state.motherCoils.length}</p>
    </div>
  )
}
