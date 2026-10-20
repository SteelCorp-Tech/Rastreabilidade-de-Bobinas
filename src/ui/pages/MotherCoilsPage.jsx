import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Seg from '../components/Seg.jsx'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { lacksCertificate } from '../../domain/motherCoil.js'
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

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação</div>
          <h1>Bobinas mãe</h1>
        </div>
        {can('motherCoil.create') && <Link to="/bobinas-mae/nova" className="btn link-btn">Nova bobina mãe</Link>}
      </div>
      <Seg options={options} value={filter} onChange={setFilter} label="Filtro" />
      <div className="filters"><input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lote, fornecedor, NF, certificado…" aria-label="Buscar" /></div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Lote</th><th>Fornecedor</th><th>Material</th><th>Peso líquido</th><th>NF fornecedor</th><th>Certificado</th><th>Situação</th><th>CUBs</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
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
    </>
  )
}
