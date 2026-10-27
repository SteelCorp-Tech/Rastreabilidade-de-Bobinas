import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Attachment from '../components/Attachment.jsx'
import DeleteButton from '../components/DeleteButton.jsx'
import LabelSheet from '../components/Label.jsx'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { DEFAULT_CONFIG } from '@dominio/config.js'
import { deleteDelivery } from '@dominio/deleteCommands.js'
import { deleteAttachments } from '../../persistence/attachmentStore.js'
import { buildLabel } from '@dominio/label.js'
import { COIL_STATUS } from '../labels.js'
import { fmtDate, fmtKg } from '../format.js'

export default function DeliveryDetail() {
  const { id } = useParams()
  const { state, run } = useStore()
  const { can } = useProfile()
  const navigate = useNavigate()
  const [off, setOff] = useState(new Set())
  const [showAll, setShowAll] = useState(false)
  const d = state.deliveries.find((x) => x.id === id)
  if (!d) return <div className="card placeholder">Entrega não encontrada. <Link to="/recebimento">Voltar</Link></div>

  const layout = { ...DEFAULT_CONFIG, ...state.config }.label_layout
  const coils = d.cubs.map((cub) => state.coils.find((c) => c.cub === cub)).filter(Boolean)
  const labels = coils.map((c) => ({ coil: c, label: buildLabel(state, c) }))
  const picked = labels.filter((l) => !off.has(l.coil.cub))
  const lots = d.mother_coils.map((m) => state.motherCoils.find((x) => x.id === m)).filter(Boolean)
  const toggle = (cub) => setOff((s) => { const n = new Set(s); n.has(cub) ? n.delete(cub) : n.add(cub); return n })
  const total = coils.reduce((s, c) => s + c.received_weight, 0)
  const estimated = coils.some((c) => c.received_weight_estimated)

  return (
    <>
      <div className="fit-page no-print">
        <div className="page-head">
          <div>
            <div className="eyebrow">Operação · <Link to="/recebimento">Recebimento</Link></div>
            <h1>NF <span className="mono">{d.slitter_invoice_number || 'sem NF'}</span></h1>
          </div>
          {can('label.print') && <button className="btn" onClick={() => window.print()} disabled={!picked.length}>Imprimir etiquetas ({picked.length})</button>}
        </div>

        <div className="delivery-grid">
          <div className="delivery-left">
            <div className="card panel wide">
              <h2>Entrega</h2>
              <div className="kv"><span className="eyebrow">Recebida em</span><div>{fmtDate(d.received_date)}</div></div>
              <div className="kv"><span className="eyebrow">Lotes</span><div>{lots.map((m, i) => <span key={m.id}>{i > 0 && ', '}<Link to={`/bobinas-mae/${m.id}`} className="mono">{m.slitter_lot}</Link></span>)}</div></div>
              <div className="kv"><span className="eyebrow">Contagem</span><div className="mono">{d.cubs.length} de {d.declared_coil_count} declaradas</div></div>
              {d.count_justification && <div className="kv"><span className="eyebrow">Justificativa</span><div>{d.count_justification}</div></div>}
              <div className="kv"><span className="eyebrow">Peso {estimated ? 'estimado' : 'medido'}</span><div className="mono">{fmtKg(total)}</div></div>
              <div className="kv"><span className="eyebrow">Nº FVM</span><div className="mono">{d.fvm_number || '—'}</div></div>
              <div className="kv"><span className="eyebrow">Romaneio</span><div><Attachment file={d.delivery_note_file} /></div></div>
              <div className="kv"><span className="eyebrow">Recebida por</span><div>{d.received_by}</div></div>
              {can('delivery.delete') && (
                <div className="mt">
                  <DeleteButton
                    key={d.id}
                    label="Excluir recebimento"
                    warning={`Excluir a NF ${d.slitter_invoice_number || 'sem NF'} e os ${coils.length} CUBs dela? Só é possível se nenhum CUB foi usado. Isso não pode ser desfeito.`}
                    onDelete={async () => {
                      await run(deleteDelivery, { delivery_id: d.id })
                      await deleteAttachments([d.delivery_note_file])
                      navigate('/recebimento')
                    }}
                  />
                </div>
              )}
            </div>

            <div className="card panel wide labels-card">
              <div className="row-between">
                <h2>Etiquetas ({layout === 'THERMAL' ? 'térmica 100×50 mm' : 'folha A4, 2 colunas'})</h2>
                {picked.length > 1 && (
                  <button type="button" className="btn ghost small-btn" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Mostrar só a primeira' : `Ver todas as etiquetas (${picked.length})`}
                  </button>
                )}
              </div>
              <p className="muted small">O QR de cada etiqueta carrega o CUB. Desmarque na tabela os CUBs que não quer imprimir; a impressão leva todas as marcadas, mesmo com só a primeira à mostra.</p>
              <div className="labels-scroll">
                {picked.length
                  ? <LabelSheet labels={(showAll ? picked : picked.slice(0, 1)).map((l) => l.label)} layout={layout} />
                  : <p className="muted">Nenhum CUB marcado para impressão.</p>}
              </div>
            </div>
          </div>

          <div className="card panel wide cubs-card">
            <h2>CUBs ({coils.length})</h2>
            <div className="table-wrap fill">
              <table>
                <thead><tr><th /><th>CUB</th><th>Peso</th><th>Código</th><th>Situação</th></tr></thead>
                <tbody>
                  {coils.map((c) => (
                    <tr key={c.id}>
                      <td><input type="checkbox" checked={!off.has(c.cub)} onChange={() => toggle(c.cub)} aria-label={`Imprimir ${c.cub}`} style={{ width: 20, minHeight: 20 }} /></td>
                      <td className="mono">{c.cub}</td>
                      <td className="mono">{fmtKg(c.received_weight)}</td>
                      <td className="mono">{c.material || '—'}</td>
                      <td><span className={`badge ${COIL_STATUS[c.status]?.tone ?? ''}`}>{COIL_STATUS[c.status]?.label ?? c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div className="print-only"><LabelSheet labels={picked.map((l) => l.label)} layout={layout} /></div>
    </>
  )
}
