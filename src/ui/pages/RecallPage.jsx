import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Seg from '../components/Seg.jsx'
import BlockForm from '../components/BlockForm.jsx'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { balanceRows, BALANCE_COLUMNS, RECALL_COLUMNS, recallRows, toCsv } from '../../domain/reports.js'
import { certificatePendencies, massBalanceReport, recallByCertificate, recallByLot } from '../../domain/traceability.js'
import { downloadCsv } from '../csv.js'
import { COIL_STATUS } from '../labels.js'
import { fmtDate, fmtInt, fmtKg, fmtPct } from '../format.js'

function Recall() {
  const { state } = useStore()
  const { can } = useProfile()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const needle = (params.get('q') ?? '').trim()

  const found = useMemo(() => {
    if (!needle) return null
    const byLot = recallByLot(state, needle)
    if (byLot) return { kind: 'lote', lot: needle, r: byLot }
    const byCert = recallByCertificate(state, needle)
    return byCert ? { kind: 'certificado', r: byCert } : { kind: 'none' }
  }, [state, needle])

  const lots = found?.r?.mother_coils.map((m) => m.slitter_lot) ?? []
  const exportCsv = () => downloadCsv(`recall-${needle}.csv`, toCsv(RECALL_COLUMNS, recallRows(state, found.r)))

  return (
    <>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}) }}>
        <input className="scan-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número do lote (LS) ou do certificado" aria-label="Lote ou certificado" list="lots" autoFocus />
        <datalist id="lots">{state.motherCoils.map((m) => <option key={m.id} value={m.slitter_lot} />)}</datalist>
        <button className="btn big">Levantar</button>
      </form>
      {!needle && <div className="card placeholder">Informe um lote ou um certificado para ver os CUBs, o saldo atual, e as obras e OPs que consumiram esse aço.</div>}
      {found?.kind === 'none' && <div className="err">Nenhum lote ou certificado "{needle}".</div>}
      {found?.r && (
        <>
          <div className="metrics five">
            <div><span className="eyebrow">CUBs do {found.kind}</span><b className="mono">{found.r.coils.length}</b></div>
            <div><span className="eyebrow">Saldo atual</span><b className="mono">{fmtKg(found.r.stock_weight)}</b></div>
            <div className="hl"><span className="eyebrow">Consumido</span><b className="mono">{fmtKg(found.r.total_consumption)}</b></div>
            <div><span className="eyebrow">Obras</span><b className="mono">{found.r.projects.length}</b></div>
            <div><span className="eyebrow">OPs</span><b className="mono">{found.r.production_orders.length}</b></div>
          </div>
          <div className="actions-row no-print-row">
            <button className="btn ghost" onClick={exportCsv}>Exportar CSV</button>
            {lots.map((l) => <Link key={l} to={`/dossie/lote/${l}`} className="btn ghost link-btn">Dossiê do lote {l}</Link>)}
          </div>

          <h2 className="sub">Obras e OPs que consumiram este aço</h2>
          <div className="card table-wrap"><table>
            <thead><tr><th>Obra</th><th>OP</th><th>CUB</th><th>Data</th><th>Consumo</th></tr></thead>
            <tbody>
              {found.r.uses.map((u) => (
                <tr key={u.id}><td><Link to={`/dossie/obra/${encodeURIComponent(u.project)}`}>{u.project}</Link></td><td className="mono">{u.production_order}</td><td className="mono"><Link to={`/cub/${u.cub}`}>{u.cub}</Link></td><td>{fmtDate(u.opened_at)}</td><td className="mono">{fmtKg(u.consumption)}</td></tr>
              ))}
              {!found.r.uses.length && <tr><td colSpan={5} className="empty-row">Nenhum uso registrado: este aço ainda não foi para nenhuma obra.</td></tr>}
            </tbody>
          </table></div>

          <h2 className="sub">CUBs e saldos ({found.r.coils.length})</h2>
          <div className="card table-wrap"><table>
            <thead><tr><th>CUB</th><th>Situação</th><th>Recebido</th><th>Saldo atual</th></tr></thead>
            <tbody>
              {found.r.coils.map((c) => (
                <tr key={c.cub}><td className="mono"><Link to={`/cub/${c.cub}`}>{c.cub}</Link></td><td><span className={`badge ${COIL_STATUS[c.status]?.tone ?? ''}`}>{COIL_STATUS[c.status]?.label}</span></td><td className="mono">{fmtKg(c.received_weight)}</td><td className="mono">{fmtKg(c.current_weight)}</td></tr>
              ))}
            </tbody>
          </table></div>

          <h2 className="sub">Balanço de massa</h2>
          <div className="card table-wrap"><table>
            <thead><tr><th>Lote</th><th>Peso líquido</th><th>CUBs</th><th>Refilo</th><th>Diferença</th><th>Resultado</th></tr></thead>
            <tbody>
              {found.r.balances.map((b) => (
                <tr key={b.mother_coil}>
                  <td className="mono">{b.slitter_lot}</td><td className="mono">{fmtKg(b.net_weight)}</td><td className="mono">{fmtKg(b.received_weight)}</td>
                  <td className="mono">{b.trim_known ? fmtKg(b.trim_weight) : 'sem plano'}</td><td className="mono">{fmtKg(b.difference)} ({fmtPct(b.difference_pct)})</td>
                  <td><span className={`badge ${b.within_tolerance ? 'ok' : 'bad'}`}>{b.within_tolerance ? 'dentro da tolerância' : 'fora da tolerância'}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>

          {can('block.manage') && lots.length === 1 && (
            <div className="card panel wide mt">
              <h2>Qualidade: bloquear o lote {lots[0]}</h2>
              <p className="muted">Bloqueia a mãe e todos os CUBs com saldo; um CUB em uso bloqueia ao terminar o uso.</p>
              <BlockForm scope="lot" target={lots[0]} mode="block" />
            </div>
          )}
        </>
      )}
    </>
  )
}

function Balance() {
  const { state } = useStore()
  const rows = massBalanceReport(state).sort((a, b) => b.difference_pct - a.difference_pct)
  const out = rows.filter((r) => !r.within_tolerance).length
  const tol = state.config.mass_tolerance_pct
  return (
    <>
      <p className="muted">Peso líquido da mãe contra a soma dos CUBs recebidos mais o refilo do plano. Tolerância: {fmtPct(tol)} (Configurações). {out ? <b>{out} de {rows.length} lotes fora da tolerância.</b> : 'Todos dentro da tolerância.'}</p>
      <div className="actions-row no-print-row"><button className="btn ghost" onClick={() => downloadCsv('balanco-de-massa.csv', toCsv(BALANCE_COLUMNS, balanceRows(rows)))}>Exportar CSV</button></div>
      <div className="card table-wrap fill"><table>
        <thead><tr><th>Lote</th><th>CUBs</th><th>Peso líquido</th><th>CUBs (kg)</th><th>Refilo</th><th>Diferença</th><th>Base</th><th /></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.mother_coil}>
              <td className="mono"><Link to={`/recall?q=${b.slitter_lot}`}><b>{b.slitter_lot}</b></Link></td><td className="mono">{b.cubs}</td><td className="mono">{fmtKg(b.net_weight)}</td>
              <td className="mono">{fmtKg(b.received_weight)}</td><td className="mono">{b.trim_known ? fmtKg(b.trim_weight) : <span className="badge warn">sem plano</span>}</td>
              <td className="mono">{fmtKg(b.difference)} · {fmtPct(b.difference_pct)}</td>
              <td className="muted small">{b.estimated ? 'estimado' : 'medido'}</td>
              <td><span className={`badge ${b.within_tolerance ? 'ok' : 'bad'}`}>{b.within_tolerance ? 'ok' : 'fora'}</span></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={8} className="empty-row">Nenhum lote com CUBs recebidos.</td></tr>}
        </tbody>
      </table></div>
      <p className="muted small">Pesos "estimados" vêm da fórmula do plano de corte (carga inicial do Excel, que só tinha rateio); em lotes novos o peso é medido na balança, e a diferença mostra perda ou erro real.</p>
    </>
  )
}

function Pendencies() {
  const { state } = useStore()
  const rows = certificatePendencies(state)
  const coilsOf = (id) => state.coils.filter((c) => c.mother_coil === id).length
  return (
    <>
      <p className="muted">Bobinas mãe sem número de certificado ou sem arquivo anexado. {rows.length} no total.</p>
      <div className="card table-wrap fill"><table>
        <thead><tr><th>Lote</th><th>Fornecedor</th><th>NF fornecedor</th><th>CUBs afetados</th><th>Número</th><th>Arquivo</th><th /></tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="mono"><b>{m.slitter_lot}</b></td><td>{m.supplier}</td><td className="mono">{m.supplier_invoice_number || '—'}</td><td className="mono">{coilsOf(m.id)}</td>
              <td className="mono">{m.certificate_number || <span className="badge warn">falta</span>}</td><td>{m.certificate_file ? 'anexado' : <span className="badge warn">falta</span>}</td>
              <td className="actions"><Link className="link" to={`/bobinas-mae/${m.id}`}>Anexar certificado</Link></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="empty-row">Nenhuma pendência de certificado.</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}

export default function RecallPage() {
  const { state } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = params.get('aba') ?? (params.get('q') ? 'recall' : 'recall')
  const go = (aba) => setParams(aba === 'recall' ? {} : { aba })
  const options = [
    { value: 'recall', label: 'Recall por lote ou certificado' },
    { value: 'balance', label: 'Balanço de massa', count: massBalanceReport(state).filter((b) => !b.within_tolerance).length || undefined },
    { value: 'pend', label: 'Pendências de certificado', count: certificatePendencies(state).length },
  ]
  return (
    <div className={tab === 'recall' ? undefined : 'fit-page'}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Qualidade</div>
          <h1>Recall e relatórios</h1>
        </div>
      </div>
      <Seg options={options} value={tab} onChange={go} label="Relatórios" />
      <div className="tab-body">{tab === 'balance' ? <Balance /> : tab === 'pend' ? <Pendencies /> : <Recall />}</div>
    </div>
  )
}
