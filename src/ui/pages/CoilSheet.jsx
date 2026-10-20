import { Link, useParams } from 'react-router'
import Attachment from '../components/Attachment.jsx'
import BlockForm from '../components/BlockForm.jsx'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { chainOfCoil } from '../../domain/traceability.js'
import { COIL_STATUS, MOTHER_STATUS } from '../labels.js'
import { fmtDate, fmtDateTime, fmtKg, fmtThickness } from '../format.js'

const Link1 = ({ title, children, to }) => (
  <div className="link-card">
    <span className="eyebrow">{title}</span>
    <div className="lc-body">{children}</div>
    {to && <Link to={to} className="link small-link">Abrir</Link>}
  </div>
)

/** Ficha do CUB com a cadeia de elos: fornecedor e usina → mãe → lote e OP do prestador → entrega → CUB → usos → sobra. */
export default function CoilSheet() {
  const { cub } = useParams()
  const { state } = useStore()
  const { can } = useProfile()
  const chain = chainOfCoil(state, cub)
  if (!chain) return <div className="card placeholder">CUB {cub} não encontrado. <Link to="/consulta">Voltar à consulta</Link></div>
  const { coil, mother_coil: mc, delivery, plan, uses } = chain
  const st = COIL_STATUS[coil.status]
  const open = uses.find((u) => !u.closed_at)
  const leftover = coil.status === 'IN_STOCK' && coil.use_count > 0
  const blockedLot = mc.status === 'BLOCKED'

  return (
    <>
      <div className="no-print">
        <div className="page-head">
          <div>
            <div className="eyebrow">Consulta · <Link to="/consulta">Rastreabilidade</Link></div>
            <h1 className="mono">{coil.cub}</h1>
          </div>
          <div className="head-actions">
            <span className={`badge ${st?.tone ?? ''}`}>{st?.label ?? coil.status}</span>
            <Link to={`/dossie/lote/${mc.slitter_lot}`} className="btn ghost link-btn">Dossiê do lote</Link>
          </div>
        </div>
        {(coil.status === 'BLOCKED' || coil.block_pending) && <div className="err">Bloqueado{coil.block_reason ? `: ${coil.block_reason}` : ''}{coil.blocked_by ? ` · por ${coil.blocked_by}` : ''}{coil.blocked_at ? ` em ${fmtDateTime(coil.blocked_at)}` : ''}.{coil.block_pending ? ' O uso em andamento termina normalmente e a sobra volta bloqueada.' : ''}</div>}
      </div>

      <h2 className="sub">Cadeia de elos</h2>
      <div className="chain">
        <Link1 title="1 · Fornecedor e usina">
          <b>{mc.supplier}</b>
          <span className="muted">{mc.mill ? `usina ${mc.mill}` : 'usina não informada'}</span>
        </Link1>
        <i className="arrow">→</i>
        <Link1 title="2 · Bobina mãe" to={`/bobinas-mae/${mc.id}`}>
          <span>NF fornecedor <b className="mono">{mc.supplier_invoice_number || '—'}</b></span>
          <span>{fmtKg(mc.net_weight)} · <span className="mono">{fmtThickness(mc.thickness)}×{mc.width} {mc.galvanization}</span></span>
          <span>Certificado <b className="mono">{mc.certificate_number || '—'}</b></span>
          <Attachment file={mc.certificate_file} empty="sem arquivo de certificado" />
          <span className={`badge ${MOTHER_STATUS[mc.status]?.tone ?? ''}`}>{MOTHER_STATUS[mc.status]?.label}</span>
        </Link1>
        <i className="arrow">→</i>
        <Link1 title="3 · Lote e OP do prestador">
          <span>Lote LS <b className="mono">{mc.slitter_lot}</b></span>
          <span>OP do prestador <b className="mono">{mc.slitter_job_ref || '—'}</b></span>
          {plan && <span className="muted">Plano v{plan.version}: {plan.lines.map((l) => `${l.strip_count}×${l.strip_width}`).join(' + ')}</span>}
        </Link1>
        <i className="arrow">→</i>
        <Link1 title="4 · Entrega" to={delivery ? `/recebimento/${delivery.id}` : undefined}>
          <span>NF prestador <b className="mono">{coil.slitter_invoice_number || '—'}</b></span>
          <span>Recebida em {fmtDate(coil.received_date)}</span>
          <span>FVM <b className="mono">{coil.fvm_number || '—'}</b></span>
        </Link1>
        <i className="arrow">→</i>
        <Link1 title="5 · CUB">
          <b className="mono">{coil.cub}</b>
          <span>Recebido {fmtKg(coil.received_weight)}{coil.received_weight_estimated ? ' (estimado)' : ' (medido)'}</span>
          <span>Atual <b className="mono">{fmtKg(coil.current_weight)}</b></span>
          <span className="muted">Código {coil.material || '—'} · posição {coil.storage_location || '—'}</span>
        </Link1>
        <i className="arrow">→</i>
        <Link1 title={`6 · Usos (${uses.length})`}>
          {uses.length ? uses.map((u) => (
            <span key={u.id} className="use-line">
              <b>{u.project}</b> <span className="mono">OP {u.production_order}</span><br />
              <span className="muted mono">{fmtDate(u.opened_at)} · {u.closed_at ? `${fmtKg(u.weight_before)} → ${fmtKg(u.weight_after)}` : 'em andamento'}</span>
            </span>
          )) : <span className="muted">ainda não usado</span>}
        </Link1>
        <i className="arrow">→</i>
        <Link1 title="7 · Sobra">
          {coil.status === 'CONSUMED' ? <span className="muted">consumida por completo</span>
            : leftover ? <span><b className="mono">{fmtKg(coil.current_weight)}</b><br /><span className="muted">volta ao estoque com o mesmo CUB</span></span>
            : open ? <span className="muted">em uso agora</span>
            : <span className="muted">sem sobra (bobina inteira)</span>}
        </Link1>
      </div>

      <div className="grid-2 mt">
        <div className="card panel wide">
          <h2>Certificado de qualidade</h2>
          <p className="muted">Herdado da bobina mãe, vale para todos os CUBs dela.</p>
          <div className="kv"><span className="eyebrow">Número</span><div className="mono">{mc.certificate_number || '—'}</div></div>
          <div className="kv"><span className="eyebrow">Arquivo</span><div><Attachment file={mc.certificate_file} empty="Nenhum arquivo anexado" /></div></div>
        </div>
        {can('block.manage') && (
          <div className="card panel wide">
            <h2>Qualidade</h2>
            {coil.status === 'BLOCKED' || coil.block_pending
              ? <><p className="muted">Liberar este CUB{coil.block_scope === 'LOT' ? ' (foi bloqueado junto com o lote; para liberar o lote inteiro, use Bloqueio e liberação)' : ''}.</p><BlockForm scope="cub" target={coil.cub} mode="unblock" /></>
              : coil.status === 'CONSUMED' || coil.status === 'RETURNED'
                ? <p className="muted">CUB sem saldo: não há o que bloquear.</p>
                : <><p className="muted">Bloquear só este CUB{blockedLot ? ' (o lote já está bloqueado)' : ''}.</p><BlockForm scope="cub" target={coil.cub} mode="block" /></>}
          </div>
        )}
      </div>
    </>
  )
}
