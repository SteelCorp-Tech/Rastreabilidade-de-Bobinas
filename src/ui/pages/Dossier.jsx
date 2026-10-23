import { Link, useParams } from 'react-router'
import Attachment from '../components/Attachment.jsx'
import BackButton from '../components/BackButton.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { PROJECT_COLUMNS, projectRows, toCsv } from '../../domain/reports.js'
import { activePlan, recallByLot, recallByProject } from '../../domain/traceability.js'
import { downloadCsv } from '../csv.js'
import { COIL_STATUS } from '../labels.js'
import { fmtDate, fmtDateTime, fmtKg, fmtPct, fmtThickness } from '../format.js'

const Head = ({ title, sub, actions }) => (
  <div className="page-head no-print">
    <div><BackButton /><div className="eyebrow">Dossiê de rastreabilidade</div><h1>{title}</h1><p className="muted">{sub}</p></div>
    <div className="head-actions">{actions}</div>
  </div>
)

/** Dossiê por lote: tudo que se sabe da mãe, do certificado, dos CUBs e das obras. Pronto para imprimir. */
export function LotDossier() {
  const { lot } = useParams()
  const { state } = useStore()
  const r = recallByLot(state, lot)
  if (!r) return <div className="card placeholder">Lote {lot} não encontrado. <Link to="/consulta">Voltar</Link></div>
  const mc = r.mother_coils[0]
  const plan = activePlan(state, mc.id)
  const deliveries = state.deliveries.filter((d) => d.mother_coils.includes(mc.id))
  const b = r.balances[0]

  return (
    <>
      <Head title={`Lote ${lot}`} sub={`Emitido em ${fmtDateTime(new Date().toISOString())} · ${mc.supplier}${mc.mill ? ` · usina ${mc.mill}` : ''}`}
        actions={<button className="btn" onClick={() => window.print()}>Imprimir dossiê</button>} />
      <div className="doc">
        <h1 className="print-only doc-title">Dossiê de rastreabilidade · Lote {lot}</h1>
        <p className="print-only muted">SteelCorp · emitido em {fmtDateTime(new Date().toISOString())}</p>
        <h2>Origem e certificado</h2>
        <table className="doc-kv"><tbody>
          <tr><th>Fornecedor</th><td>{mc.supplier}</td><th>Usina</th><td>{mc.mill || '—'}</td></tr>
          <tr><th>NF do fornecedor</th><td className="mono">{mc.supplier_invoice_number || '—'}</td><th>Pedido de compra</th><td className="mono">{mc.purchase_order_ref || '—'}</td></tr>
          <tr><th>Material</th><td className="mono">{fmtThickness(mc.thickness)} × {mc.width} mm · {mc.galvanization}</td><th>Peso líquido</th><td className="mono">{fmtKg(mc.net_weight)}</td></tr>
          <tr><th>Certificado</th><td className="mono">{mc.certificate_number || 'SEM CERTIFICADO'}</td><th>Arquivo</th><td><Attachment file={mc.certificate_file} empty="sem arquivo" /></td></tr>
          <tr><th>OP do prestador</th><td className="mono">{mc.slitter_job_ref || '—'}</td><th>Plano de corte</th><td>{plan ? `v${plan.version}: ${plan.lines.map((l) => `${l.strip_count}×${l.strip_width} mm`).join(' + ')}` : '—'}</td></tr>
        </tbody></table>

        <h2>Entregas</h2>
        <table className="doc-table"><thead><tr><th>NF do prestador</th><th>Recebida em</th><th>CUBs</th><th>FVM</th></tr></thead>
          <tbody>{deliveries.map((d) => <tr key={d.id}><td className="mono">{d.slitter_invoice_number || '—'}</td><td>{fmtDate(d.received_date)}</td><td className="mono">{d.cubs.length}</td><td className="mono">{d.fvm_number || '—'}</td></tr>)}</tbody></table>

        <h2>Balanço de massa</h2>
        <p>Peso líquido {fmtKg(b.net_weight)} · CUBs {fmtKg(b.received_weight)} · refilo {b.trim_known ? fmtKg(b.trim_weight) : 'sem plano'} · diferença {fmtKg(b.difference)} ({fmtPct(b.difference_pct)}) — <b>{b.within_tolerance ? 'dentro' : 'fora'} da tolerância</b>.</p>

        <h2>CUBs ({r.coils.length}) · saldo atual {fmtKg(r.stock_weight)}</h2>
        <table className="doc-table"><thead><tr><th>CUB</th><th>Situação</th><th>Recebido</th><th>Saldo atual</th></tr></thead>
          <tbody>{r.coils.map((c) => <tr key={c.cub}><td className="mono">{c.cub}</td><td>{COIL_STATUS[c.status]?.label}</td><td className="mono">{fmtKg(c.received_weight)}</td><td className="mono">{fmtKg(c.current_weight)}</td></tr>)}</tbody></table>

        <h2>Obras e OPs que consumiram este aço ({r.projects.length} obras, {fmtKg(r.total_consumption)})</h2>
        <table className="doc-table"><thead><tr><th>Obra</th><th>OP</th><th>CUB</th><th>Data</th><th>Consumo</th></tr></thead>
          <tbody>
            {r.uses.map((u) => <tr key={u.id}><td>{u.project}</td><td className="mono">{u.production_order}</td><td className="mono">{u.cub}</td><td>{fmtDate(u.opened_at)}</td><td className="mono">{fmtKg(u.consumption)}</td></tr>)}
            {!r.uses.length && <tr><td colSpan={5}>Nenhum uso registrado.</td></tr>}
          </tbody></table>
      </div>
    </>
  )
}

/** Dossiê por obra: de quais bobinas mães, lotes e certificados saiu o aço que foi para a obra. */
export function ProjectDossier() {
  const { project } = useParams()
  const { state } = useStore()
  const r = recallByProject(state, project)
  if (!r) return <div className="card placeholder">Nenhum uso registrado para a obra "{project}". <Link to="/consulta">Voltar</Link></div>

  return (
    <>
      <Head title={r.project} sub={`${r.rows.length} usos · ${r.lots.length} lotes · ${r.certificates.length} certificados · ${fmtKg(r.total_consumption)} consumidos`}
        actions={<><button className="btn ghost" onClick={() => downloadCsv(`dossie-obra-${r.project}.csv`, toCsv(PROJECT_COLUMNS, projectRows(r)))}>Exportar CSV</button><button className="btn" onClick={() => window.print()}>Imprimir dossiê</button></>} />
      <div className="doc">
        <h1 className="print-only doc-title">Dossiê de rastreabilidade · Obra {r.project}</h1>
        <p className="print-only muted">SteelCorp · emitido em {fmtDateTime(new Date().toISOString())}</p>
        <h2>Lotes e certificados de origem</h2>
        <table className="doc-table"><thead><tr><th>Lote</th><th>Fornecedor / usina</th><th>NF fornecedor</th><th>Certificado</th><th>CUBs usados</th><th>Consumo</th></tr></thead>
          <tbody>{r.lots.map((l) => (
            <tr key={l.mother_coil.id}>
              <td className="mono"><Link to={`/dossie/lote/${l.mother_coil.slitter_lot}`}><b>{l.mother_coil.slitter_lot}</b></Link></td>
              <td>{l.mother_coil.supplier}{l.mother_coil.mill ? ` · ${l.mother_coil.mill}` : ''}</td><td className="mono">{l.mother_coil.supplier_invoice_number || '—'}</td>
              <td className="mono">{l.mother_coil.certificate_number || 'SEM CERTIFICADO'} <Attachment file={l.mother_coil.certificate_file} empty="" /></td>
              <td className="mono">{l.cubs.length}</td><td className="mono">{fmtKg(l.consumption)}</td>
            </tr>))}</tbody></table>
        <h2>Usos na obra</h2>
        <table className="doc-table"><thead><tr><th>Data</th><th>OP</th><th>CUB</th><th>Lote</th><th>NF prestador</th><th>Certificado</th><th>Consumo</th></tr></thead>
          <tbody>{r.rows.slice().sort((a, b) => a.use.opened_at.localeCompare(b.use.opened_at)).map(({ use, coil, mother }) => (
            <tr key={use.id}><td>{fmtDate(use.opened_at)}</td><td className="mono">{use.production_order}</td><td className="mono"><Link to={`/cub/${coil.cub}`}>{coil.cub}</Link></td><td className="mono">{mother.slitter_lot}</td><td className="mono">{coil.slitter_invoice_number || '—'}</td><td className="mono">{mother.certificate_number || '—'}</td><td className="mono">{fmtKg(use.consumption)}</td></tr>
          ))}</tbody></table>
      </div>
    </>
  )
}
