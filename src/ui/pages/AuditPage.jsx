import { useMemo, useState } from 'react'
import { useStore } from '../app/StoreContext.jsx'
import { AUDIT_COLUMNS, auditRows, toCsv } from '../../domain/reports.js'
import { downloadCsv } from '../csv.js'
import { auditLabel } from '../labels.js'
import { fmtDateTime } from '../format.js'

const pretty = (v) => (v == null ? '—' : JSON.stringify(v, null, 2))

/** Consulta do AuditLog (só leitura; a lista só cresce). */
export default function AuditPage() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [role, setRole] = useState('')
  const [open, setOpen] = useState(null)

  const actions = useMemo(() => [...new Set(state.auditLog.map((a) => a.action))].sort(), [state.auditLog])
  const roles = useMemo(() => [...new Set(state.auditLog.map((a) => a.actor.role))].sort(), [state.auditLog])
  const needle = q.trim().toLowerCase()
  const rows = state.auditLog
    .filter((a) => (!action || a.action === action) && (!role || a.actor.role === role))
    .filter((a) => !needle || [a.entity_id, a.reason, a.actor.user, a.entity, JSON.stringify(a.after ?? '')].some((v) => String(v ?? '').toLowerCase().includes(needle)))
    .slice().reverse()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Sistema</div>
          <h1>Auditoria</h1>
        </div>
        <button className="btn ghost" onClick={() => downloadCsv('auditoria.csv', toCsv(AUDIT_COLUMNS, auditRows(state.auditLog)))} disabled={!state.auditLog.length}>Exportar CSV</button>
      </div>
      <p className="muted">Todo evento relevante fica aqui, com quem fez, quando, o que e o antes e depois. Não há edição nem exclusão.</p>
      <div className="filters">
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Id, motivo, usuário ou conteúdo…" aria-label="Buscar" />
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Ação"><option value="">Todas as ações</option>{actions.map((a) => <option key={a} value={a}>{auditLabel(a)}</option>)}</select>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Perfil"><option value="">Todos os perfis</option>{roles.map((r) => <option key={r}>{r}</option>)}</select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th><th>Motivo</th><th /></tr></thead>
          <tbody>
            {rows.slice(0, 300).map((a) => (
              <>
                <tr key={a.id} className="click" onClick={() => setOpen(open === a.id ? null : a.id)}>
                  <td className="mono">{fmtDateTime(a.at)}</td><td>{a.actor.user} <small className="muted">({a.actor.role})</small></td>
                  <td><b>{auditLabel(a.action)}</b></td><td className="mono">{a.entity} {a.entity_id}</td><td>{a.reason ?? ''}</td><td className="actions"><span className="link">{open === a.id ? 'Ocultar' : 'Detalhes'}</span></td>
                </tr>
                {open === a.id && (
                  <tr key={a.id + 'd'}><td colSpan={6} className="audit-detail">
                    <div><span className="eyebrow">Antes</span><pre>{pretty(a.before)}</pre></div>
                    <div><span className="eyebrow">Depois</span><pre>{pretty(a.after)}</pre></div>
                  </td></tr>
                )}
              </>
            ))}
            {!rows.length && <tr><td colSpan={6} className="empty-row">Nenhum evento. Faça uma operação (ex.: registrar uma bobina) e volte aqui.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted foot">{rows.length} de {state.auditLog.length} eventos{rows.length > 300 ? ' (mostrando os 300 mais recentes)' : ''}</p>
    </>
  )
}
