import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import FileField from '../components/FileField.jsx'
import { useAction } from '../components/useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { receiveDelivery } from '../../domain/commands.js'
import { expectedRowsFromPlan } from '../../domain/delivery.js'
import { suggestMaterial } from '../../domain/registryCommands.js'
import { activePlan } from '../../domain/traceability.js'
import { dateInSaoPaulo } from '../../domain/units.js'
import { deleteAttachment, putAttachment } from '../../persistence/attachmentStore.js'
import { fmtKg, fmtThickness, parseDecimal } from '../format.js'

let seq = 0
const newRow = (over = {}) => ({ key: ++seq, lot: '', width: '', weight: '', location: '', hint: null, ...over })

export default function DeliveryForm() {
  const { state, run } = useStore()
  const { can } = useProfile()
  const navigate = useNavigate()
  const { error, busy, exec } = useAction()
  const [head, setHead] = useState({ nf: '', date: dateInSaoPaulo(new Date()), declared: '', fvm: '', justification: '' })
  const [rows, setRows] = useState([newRow()])
  const [note, setNote] = useState(null)
  const [planLot, setPlanLot] = useState('')
  const weightRefs = useRef({})

  if (!can('delivery.receive')) return <div className="card placeholder">O perfil atual não pode receber entregas. Troque para Almoxarifado.</div>

  const mothers = [...state.motherCoils].sort((a, b) => {
    const rank = (m) => ({ SCHEDULED: 0, PLANNED: 1, REGISTERED: 2, RECEIVED: 3, BLOCKED: 4 })[m.status]
    return rank(a) - rank(b) || a.slitter_lot.localeCompare(b.slitter_lot, 'pt-BR', { numeric: true })
  })
  const mother = (id) => state.motherCoils.find((m) => m.id === id)
  const setH = (k) => (e) => setHead({ ...head, [k]: e.target.value })
  const patch = (key, p) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const filled = rows.filter((r) => r.lot || r.width || r.weight)
  const declared = parseDecimal(head.declared)
  const matches = Number.isInteger(declared) && filled.length === declared
  const total = filled.reduce((s, r) => s + (parseDecimal(r.weight) || 0), 0)

  const materialFor = (r) => {
    const mc = mother(r.lot)
    const w = parseDecimal(r.width)
    return mc && w > 0 ? suggestMaterial(state, { thickness: mc.thickness, width: w, galvanization: mc.galvanization }) : null
  }

  function fillFromPlan() {
    const mc = mother(planLot)
    const plan = mc && activePlan(state, mc.id)
    if (!plan) { setNote('Esse lote ainda não tem plano de corte.'); return }
    const expected = expectedRowsFromPlan(plan)
    setNote(null)
    setRows((rs) => [...rs.filter((r) => r.lot || r.width || r.weight), ...expected.map((e) => newRow({ lot: mc.id, width: String(e.width), hint: e.estimated_weight }))])
    setHead((h) => (h.declared ? h : { ...h, declared: String(expected.length) }))
  }

  function onWeightEnter(e, r, i) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const next = rows[i + 1]
    if (next) return weightRefs.current[next.key]?.focus()
    const row = newRow({ lot: r.lot, width: r.width })
    setRows((rs) => [...rs, row])
    setTimeout(() => weightRefs.current[row.key]?.focus(), 0)
  }

  const submit = (e) => {
    e.preventDefault()
    exec(async () => {
      const saved = []
      try {
        const file = head.file ? await putAttachment(head.file) : null
        if (file) saved.push(file.id)
        const out = await run(receiveDelivery, {
          delivery: {
            slitter_invoice_number: head.nf, received_date: head.date, declared_coil_count: declared, fvm_number: head.fvm,
            count_justification: head.justification, delivery_note_file: file,
          },
          lines: filled.map((r) => ({
            mother_coil: r.lot, measured_weight: parseDecimal(r.weight), width: parseDecimal(r.width),
            material: materialFor(r)?.code ?? '', storage_location: r.location,
          })),
        })
        navigate(`/recebimento/${out.delivery.id}`)
      } catch (err) {
        await Promise.all(saved.map((id) => deleteAttachment(id).catch(() => {})))
        throw err
      }
    })
  }

  return (
    <div className="fit-page tall">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação · <Link to="/recebimento">Recebimento</Link></div>
          <h1>Registrar entrega</h1>
        </div>
      </div>
      <form onSubmit={submit} className="fit-form">
        <div className="card panel wide">
          <h2>Nota do prestador</h2>
          <div className="fields three">
            <label><span className="eyebrow">NF do prestador *</span><input className="mono" value={head.nf} onChange={setH('nf')} autoFocus /></label>
            <label><span className="eyebrow">Data de recebimento</span><input type="date" value={head.date} onChange={setH('date')} /></label>
            <label><span className="eyebrow">Bobinas declaradas na NF *</span><input className="mono" inputMode="numeric" value={head.declared} onChange={setH('declared')} /></label>
            <label><span className="eyebrow">Nº FVM (opcional)</span><input className="mono" value={head.fvm} onChange={setH('fvm')} /></label>
            <FileField label="Romaneio (opcional)" value={head.file} onChange={(f) => setHead({ ...head, file: f })} />
          </div>
        </div>

        <div className="card panel wide mt recv-card">
          <div className="row-between">
            <h2>Bobinas recebidas</h2>
            <span className={'badge ' + (matches ? 'ok' : 'warn')}>{filled.length} lançadas de {Number.isInteger(declared) ? declared : '—'} declaradas</span>
          </div>
          <div className="prefill">
            <select value={planLot} onChange={(e) => setPlanLot(e.target.value)} aria-label="Lote para pré-preencher">
              <option value="">Pré-preencher pelo plano de corte do lote…</option>
              {mothers.filter((m) => activePlan(state, m.id)).map((m) => <option key={m.id} value={m.id}>{m.slitter_lot} · {m.supplier} · {activePlan(state, m.id).result.total_cubs} CUBs previstos</option>)}
            </select>
            <button type="button" className="btn ghost" onClick={fillFromPlan} disabled={!planLot}>Pré-preencher</button>
          </div>
          {note && <p className="muted small">{note}</p>}
          <div className="table-wrap fill">
            <table className="lines-table recv">
              <thead><tr><th>#</th><th>Lote (LS)</th><th>Largura (mm)</th><th>Peso medido (kg)</th><th>Código ERP</th><th>Posição</th><th /></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const mc = mother(r.lot)
                  const mat = materialFor(r)
                  return (
                    <tr key={r.key}>
                      <td className="mono muted">{i + 1}</td>
                      <td>
                        <select value={r.lot} onChange={(e) => patch(r.key, { lot: e.target.value })} aria-label={`Lote da linha ${i + 1}`}>
                          <option value="">Selecione…</option>
                          {mothers.map((m) => <option key={m.id} value={m.id}>{m.slitter_lot} · {fmtThickness(m.thickness)} × {m.width} {m.galvanization}{m.status === 'BLOCKED' ? ' (bloqueada)' : ''}</option>)}
                        </select>
                      </td>
                      <td><input className="mono" inputMode="numeric" value={r.width} onChange={(e) => patch(r.key, { width: e.target.value })} aria-label={`Largura da linha ${i + 1}`} /></td>
                      <td>
                        <input
                          className="mono" inputMode="decimal" value={r.weight} onChange={(e) => patch(r.key, { weight: e.target.value })}
                          placeholder={r.hint ? `≈ ${String(Math.round(r.hint * 10) / 10).replace('.', ',')}` : ''}
                          ref={(el) => { weightRefs.current[r.key] = el }} onKeyDown={(e) => onWeightEnter(e, r, i)} aria-label={`Peso da linha ${i + 1}`}
                        />
                      </td>
                      <td className="mono">{mat ? mat.code : mc && r.width ? <span className="badge warn" title="Não há linha no catálogo para essa espessura, largura e galvanização">sem código</span> : '—'}</td>
                      <td><input value={r.location} onChange={(e) => patch(r.key, { location: e.target.value })} placeholder="Rua / prateleira" aria-label={`Posição da linha ${i + 1}`} /></td>
                      <td className="actions">{rows.length > 1 && <button type="button" className="link" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>Remover</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="row-between">
            <button type="button" className="link" onClick={() => setRows([...rows, newRow({ lot: rows.at(-1)?.lot ?? '', width: rows.at(-1)?.width ?? '' })])}>+ Adicionar bobina</button>
            <span className="mono">Total medido: <b>{fmtKg(total)}</b></span>
          </div>
          <p className="muted small">Espessura e galvanização vêm da bobina mãe. Pressione Enter no peso para ir à próxima linha (a última cria outra igual).</p>

          {Number.isInteger(declared) && filled.length !== declared && (
            <label className="mt">
              <span className="eyebrow">Justificativa da diferença de contagem *</span>
              <input value={head.justification} onChange={setH('justification')} placeholder="Ex.: bobina 14 retida no prestador" />
              <small className="muted">A NF declara {declared}, foram lançadas {filled.length}. Sem justificativa a entrega não fecha.</small>
            </label>
          )}
        </div>

        {error && <div className="err" role="alert">{error}</div>}
        <div className="actions-row mt">
          <button className="btn" disabled={busy || !filled.length}>Registrar entrega e gerar CUBs</button>
          <Link to="/recebimento" className="btn ghost link-btn">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
