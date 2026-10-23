import { useState } from 'react'
import { Link, useParams } from 'react-router'
import Attachment from '../components/Attachment.jsx'
import CoilSummary from '../components/CoilSummary.jsx'
import FileField from '../components/FileField.jsx'
import { useAction } from '../components/useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { attachCertificate } from '../../domain/commands.js'
import { lacksCertificate } from '../../domain/motherCoil.js'
import { activePlan } from '../../domain/traceability.js'
import { deleteAttachment, putAttachment } from '../../persistence/attachmentStore.js'
import { auditLabel, COIL_STATUS, MOTHER_STATUS } from '../labels.js'
import { fmtDate, fmtDateTime, fmtKg, fmtMm, fmtPct, fmtThickness } from '../format.js'
import { StatusBadge } from './MotherCoilsPage.jsx'

const Row = ({ k, children }) => (
  <div className="kv"><span className="eyebrow">{k}</span><div>{children || '—'}</div></div>
)

function CertificateCard({ mc }) {
  const { run } = useStore()
  const { can } = useProfile()
  const { error, busy, exec } = useAction()
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState(mc.certificate_number ?? '')
  const [file, setFile] = useState(null)
  const has = !lacksCertificate(mc)

  const submit = (e) => {
    e.preventDefault()
    exec(async () => {
      let ref = null
      try {
        ref = file ? await putAttachment(file) : null
        await run(attachCertificate, { mother_coil_id: mc.id, number, file: ref })
        setOpen(false)
        setFile(null)
      } catch (err) {
        if (ref) await deleteAttachment(ref.id).catch(() => {})
        throw err
      }
    })
  }

  return (
    <div className="card panel wide">
      <h2>Certificado de qualidade</h2>
      <Row k="Número"><span className="mono">{mc.certificate_number}</span> {!has && <span className="badge warn">Sem certificado</span>}</Row>
      <Row k="Arquivo"><Attachment file={mc.certificate_file} empty="Nenhum arquivo anexado" /></Row>
      {mc.certificate_attached_at && <Row k="Anexado">{fmtDateTime(mc.certificate_attached_at)}{mc.certificate_attached_by ? ` · ${mc.certificate_attached_by}` : ''}</Row>}
      {can('motherCoil.attachCertificate') && !open && (
        <button className="btn ghost" onClick={() => setOpen(true)}>{has ? 'Substituir certificado' : 'Anexar certificado'}</button>
      )}
      {open && (
        <form onSubmit={submit} className="inline-form">
          <div className="fields two">
            <label><span className="eyebrow">Número do certificado *</span><input className="mono" value={number} onChange={(e) => setNumber(e.target.value)} autoFocus /></label>
            <FileField label="Arquivo (PDF ou imagem)" required value={file} onChange={setFile} />
          </div>
          {error && <div className="err" role="alert">{error}</div>}
          <div className="actions-row">
            <button className="btn" disabled={busy}>{has ? 'Substituir' : 'Anexar'}</button>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function MotherCoilDetail() {
  const { id } = useParams()
  const { state } = useStore()
  const [summaryCub, setSummaryCub] = useState(null)
  const mc = state.motherCoils.find((m) => m.id === id)
  if (!mc) return <div className="card placeholder">Bobina mãe não encontrada. <Link to="/bobinas-mae">Voltar à lista</Link></div>

  const coils = state.coils.filter((c) => c.mother_coil === mc.id)
  const plan = activePlan(state, mc.id)
  const plans = state.cuttingPlans.filter((p) => p.mother_coil === mc.id)
  const planIds = new Set(plans.map((p) => p.id))
  const deliveryIds = new Set(state.deliveries.filter((d) => d.mother_coils.includes(mc.id)).map((d) => d.id))
  const events = state.auditLog
    .filter((a) => a.entity_id.split(',').includes(mc.id) || planIds.has(a.entity_id) || deliveryIds.has(a.entity_id))
    .map((a) => ({ at: a.at, label: auditLabel(a.action), who: `${a.actor.user} (${a.actor.role})`, reason: a.reason }))
  if (!events.some((e) => e.label === auditLabel('motherCoil.create'))) {
    events.unshift({ at: mc.received_at, label: 'Bobina mãe registrada (carga inicial)', who: 'Importação Excel' })
  }
  events.sort((a, b) => a.at.localeCompare(b.at))

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação · <Link to="/bobinas-mae">Bobinas mãe</Link></div>
          <h1>Lote <span className="mono">{mc.slitter_lot}</span></h1>
        </div>
        <StatusBadge map={MOTHER_STATUS} status={mc.status} />
      </div>

      <div className="grid-2">
        <div className="card panel wide">
          <h2>Dados da bobina</h2>
          <Row k="Fornecedor">{mc.supplier}{mc.mill && mc.mill !== mc.supplier ? ` · usina ${mc.mill}` : ''}</Row>
          <Row k="Material"><span className="mono">{fmtThickness(mc.thickness)} mm × {mc.width} mm · {mc.galvanization}</span></Row>
          <Row k="Peso líquido"><span className="mono">{fmtKg(mc.net_weight)}</span></Row>
          <Row k="NF do fornecedor"><span className="mono">{mc.supplier_invoice_number}</span>{mc.supplier_invoice_date ? ` · ${fmtDate(mc.supplier_invoice_date)}` : ''}</Row>
          <Row k="Arquivo da NF"><Attachment file={mc.invoice_file} /></Row>
          <Row k="Nº da bobina na usina"><span className="mono">{mc.mill_coil_number}</span></Row>
          <Row k="Pedido de compra"><span className="mono">{mc.purchase_order_ref}</span></Row>
          <Row k="OP do prestador"><span className="mono">{mc.slitter_job_ref}</span></Row>
          <Row k="Entrada no prestador">{mc.slitter_entry_date ? fmtDate(mc.slitter_entry_date) : ''}</Row>
        </div>
        <div>
          <CertificateCard mc={mc} />
          <div className="card panel wide">
            <h2>Plano de corte</h2>
            {plan ? (
              <>
                <Row k="Versão">v{plan.version} · {plan.status === 'SENT' ? 'enviado' : 'rascunho'}</Row>
                <Row k="Tiras">{plan.lines.map((l) => `${l.strip_count} × ${l.strip_width} mm`).join(' + ')}</Row>
                <Row k="Refilo"><span className="mono">{fmtMm(plan.result.trim_width)} · {fmtKg(plan.result.trim_weight)}</span></Row>
                <Row k="Aproveitamento"><span className="mono">{fmtPct(plan.result.utilization_pct)}</span></Row>
                <Row k="CUBs previstos"><span className="mono">{plan.result.total_cubs}</span></Row>
              </>
            ) : (
              <p className="muted">Ainda sem plano de corte.</p>
            )}
            <Link to={`/planos-de-corte/${mc.id}`} className="link">Abrir plano de corte</Link>
          </div>
        </div>
      </div>

      <div className="card panel wide">
        <h2>CUBs desta bobina ({coils.length})</h2>
        {coils.length ? (
          <div className="chips">
            {coils.map((c) => (
              <button type="button" key={c.id} className="chip" onClick={() => setSummaryCub(c.cub)} title={`${COIL_STATUS[c.status]?.label ?? c.status} · ${fmtKg(c.current_weight)} · clique para ver o resumo`}>
                <span className="mono">{c.cub.replace('CUB-', '')}</span>
                <i className={`dot ${COIL_STATUS[c.status]?.tone ?? ''}`} />
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">As tiras ainda não foram recebidas.</p>
        )}
        {coils.length > 0 && <p className="muted small">Clique em um CUB para ver o resumo.</p>}
      </div>
      {summaryCub && <CoilSummary coil={coils.find((c) => c.cub === summaryCub)} onClose={() => setSummaryCub(null)} />}

      <div className="card panel wide">
        <h2>Histórico</h2>
        <ol className="timeline">
          {events.map((e, i) => (
            <li key={i}>
              <span className="mono when">{fmtDateTime(e.at)}</span>
              <span><b>{e.label}</b><small className="muted"> · {e.who}{e.reason ? ` · ${e.reason}` : ''}</small></span>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
