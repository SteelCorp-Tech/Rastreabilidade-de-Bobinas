import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAction } from '../components/useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { confirmSchedule, markPlanSent, savePlan } from '../../domain/commands.js'
import { DEFAULT_CONFIG } from '../../domain/config.js'
import DeleteButton from '../components/DeleteButton.jsx'
import { calcCuttingPlan, checkTrim } from '../../domain/cuttingPlan.js'
import { deleteCuttingPlans } from '../../domain/deleteCommands.js'
import { activePlan } from '../../domain/traceability.js'
import { fmtDate, fmtDateTime, fmtInt, fmtKg, fmtMm, fmtPct, fmtThickness, parseDecimal } from '../format.js'
import { MOTHER_STATUS } from '../labels.js'
import { StatusBadge } from './MotherCoilsPage.jsx'

const blankLine = () => ({ qty: '', width: '' })
const toLines = (rows) => rows.map((r) => ({ strip_count: parseDecimal(r.qty), strip_width: parseDecimal(r.width) }))
const isFilled = (r) => r.qty !== '' || r.width !== ''

/** Barra proporcional: as tiras e o refilo (laranja) na largura da mãe. */
function StripBar({ lines, trim, total }) {
  const segs = lines.flatMap((l, i) => Array.from({ length: l.strip_count }, (_, k) => ({ w: l.strip_width, key: `${i}-${k}`, shade: i % 2 })))
  return (
    <div className="stripbar" role="img" aria-label="Distribuição das tiras na largura da bobina mãe">
      {segs.map((s) => (
        <span key={s.key} className={`strip s${s.shade}`} style={{ flexGrow: s.w, flexBasis: 0 }}>{s.w >= total * 0.06 ? s.w : ''}</span>
      ))}
      {trim > 0 && <span className="strip trim" style={{ flexGrow: trim, flexBasis: 0 }} title={`Refilo ${trim} mm`} />}
    </div>
  )
}

function PrintSheet({ mc, result, lines, plan, version, expected, limit }) {
  return (
    <div className="print-only print-sheet">
      <h1>Plano de corte</h1>
      <p className="muted">SteelCorp · Rastreabilidade de bobinas · emitido em {fmtDateTime(new Date().toISOString())}</p>
      <table className="print-kv">
        <tbody>
          <tr><th>Lote (LS)</th><td className="mono">{mc.slitter_lot}</td><th>Versão</th><td>v{version}{plan?.status === 'SENT' ? ' · enviado' : ' · rascunho'}</td></tr>
          <tr><th>Fornecedor</th><td>{mc.supplier}{mc.mill && mc.mill !== mc.supplier ? ` · ${mc.mill}` : ''}</td><th>NF do fornecedor</th><td className="mono">{mc.supplier_invoice_number}</td></tr>
          <tr><th>Material</th><td className="mono">{fmtThickness(mc.thickness)} mm × {mc.width} mm · {mc.galvanization}</td><th>Peso líquido</th><td className="mono">{fmtKg(mc.net_weight)}</td></tr>
          <tr><th>Limite por bobina</th><td className="mono">{fmtKg(limit)}</td><th>Previsão de entrega</th><td>{expected ? fmtDate(expected) : '—'}</td></tr>
        </tbody>
      </table>
      <h2>Cortes</h2>
      <table className="print-table">
        <thead><tr><th>Tiras</th><th>Largura</th><th>Peso de uma tira</th><th>Bobinas por tira</th><th>Peso por bobina</th><th>CUBs</th></tr></thead>
        <tbody>
          {result.lines.map((l, i) => (
            <tr key={i}><td>{l.strip_count}</td><td>{fmtMm(l.strip_width)}</td><td>{fmtKg(l.strip_weight)}</td><td>{l.coils_per_strip}</td><td>{fmtKg(l.coil_weight)}</td><td>{l.cubs}</td></tr>
          ))}
        </tbody>
      </table>
      <p>
        Largura utilizada <b>{fmtMm(result.used_width)}</b> · refilo <b>{fmtMm(result.trim_width)}</b> ({fmtKg(result.trim_weight)}) · aproveitamento <b>{fmtPct(result.utilization_pct)}</b> · <b>{result.total_cubs}</b> bobinas previstas.
      </p>
      <StripBar lines={lines} trim={result.trim_width} total={mc.width} />
      <p className="muted">Cada tira recebe etiqueta com o CUB na fábrica. O peso por bobina é estimado; o peso real é medido na balança no recebimento.</p>
    </div>
  )
}

export default function CuttingPlanEditor() {
  const { id } = useParams()
  const { state, run } = useStore()
  const { can } = useProfile()
  const { error, busy, exec } = useAction()
  const mc = state.motherCoils.find((m) => m.id === id)
  const plan = mc ? activePlan(state, mc.id) : null
  const cfg = { ...DEFAULT_CONFIG, ...state.config }
  const limit = cfg.weight_limit
  const editable = can('cuttingPlan.edit')

  const [rows, setRows] = useState([blankLine()])
  const [expected, setExpected] = useState('')
  const [saved, setSaved] = useState('')
  useEffect(() => {
    setRows(plan ? plan.lines.map((l) => ({ qty: String(l.strip_count), width: String(l.strip_width) })) : [blankLine()])
    setExpected(plan?.expected_delivery_date ?? '')
  }, [plan?.id, plan?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const calc = useMemo(() => {
    if (!mc) return null
    const filled = rows.filter(isFilled)
    if (!filled.length) return { empty: true }
    const lines = toLines(filled)
    try {
      return { lines, result: calcCuttingPlan({ mother_width: mc.width, net_weight: mc.net_weight, weight_limit: limit, lines }) }
    } catch (e) {
      return { lines, problem: e.message }
    }
  }, [rows, mc, limit])

  if (!mc) return <div className="card placeholder">Bobina mãe não encontrada. <Link to="/planos-de-corte">Voltar</Link></div>

  const versions = state.cuttingPlans.filter((p) => p.mother_coil === mc.id).sort((a, b) => b.version - a.version)
  const willBeNewVersion = plan?.status === 'SENT'
  const dirty = !plan || JSON.stringify(toLines(rows.filter(isFilled))) !== JSON.stringify(plan.lines) || expected !== (plan.expected_delivery_date ?? '')
  const update = (i, k) => (e) => { setSaved(''); setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r))) }

  const save = () => exec(async () => {
    const p = await run(savePlan, { mother_coil_id: mc.id, lines: calc.lines, expected_delivery_date: expected })
    setSaved(`Plano v${p.version} salvo como rascunho.`)
  })
  const send = () => exec(async () => {
    await run(markPlanSent, { plan_id: plan.id })
    setSaved(`Plano v${plan.version} marcado como enviado ao prestador.`)
  })
  const schedule = () => exec(async () => {
    await run(confirmSchedule, { mother_coil_id: mc.id })
    setSaved('Programação confirmada pelo prestador.')
  })
  const r = calc?.result
  const trimCheck = r ? checkTrim(r.trim_width, cfg) : { ok: true }

  return (
    <>
      <div className="no-print">
        <div className="page-head">
          <div>
            <div className="eyebrow">Operação · <Link to="/planos-de-corte">Plano de corte</Link></div>
            <h1>Lote <span className="mono">{mc.slitter_lot}</span></h1>
          </div>
          <StatusBadge map={MOTHER_STATUS} status={mc.status} />
        </div>

        <div className="grid-2">
          <div className="card panel wide">
            <h2>Bobina mãe</h2>
            <div className="kv"><span className="eyebrow">Fornecedor</span><div>{mc.supplier}</div></div>
            <div className="kv"><span className="eyebrow">Material</span><div className="mono">{fmtThickness(mc.thickness)} mm × {mc.width} mm · {mc.galvanization}</div></div>
            <div className="kv"><span className="eyebrow">Peso líquido</span><div className="mono">{fmtKg(mc.net_weight)}</div></div>
            <div className="kv"><span className="eyebrow">Refilo exigido</span><div className="mono">{cfg.trim_min_mm == null && cfg.trim_max_mm == null ? 'sem regra' : `${cfg.trim_min_mm ?? 0} a ${cfg.trim_max_mm ?? '—'} mm`}</div></div>
            <div className="kv"><span className="eyebrow">Limite por bobina</span><div className="mono">{fmtKg(limit)} <Link to="/configuracoes" className="muted">(configuração)</Link></div></div>

            <h2 className="sub">Linhas de corte</h2>
            <table className="lines-table">
              <thead><tr><th>Quantidade de tiras</th><th>Largura da tira (mm)</th><th /></tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td><input className="mono" inputMode="numeric" value={row.qty} onChange={update(i, 'qty')} disabled={!editable} aria-label={`Quantidade da linha ${i + 1}`} /></td>
                    <td><input className="mono" inputMode="numeric" value={row.width} onChange={update(i, 'width')} disabled={!editable} aria-label={`Largura da linha ${i + 1}`} /></td>
                    <td className="actions">{editable && rows.length > 1 && <button type="button" className="link" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remover</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button type="button" className="link" onClick={() => setRows([...rows, blankLine()])}>+ Adicionar linha</button>}
            <label className="mt">
              <span className="eyebrow">Previsão de entrega das tiras</span>
              <input type="date" value={expected} onChange={(e) => { setSaved(''); setExpected(e.target.value) }} disabled={!editable} />
            </label>
          </div>

          <div>
            <div className="card panel wide results">
              <h2>Resultado</h2>
              {calc?.empty && <p className="muted">Informe a quantidade e a largura das tiras para ver o cálculo.</p>}
              {calc?.problem && <div className="err" role="alert">{calc.problem}</div>}
              {r && (
                <>
                  {!trimCheck.ok && <div className="err" role="alert">{trimCheck.message} Ajuste as linhas para salvar.</div>}
                  <StripBar lines={calc.lines} trim={r.trim_width} total={mc.width} />
                  <div className="legend"><span><i className="sw s0" /> tiras</span><span><i className="sw trim" /> refilo</span></div>
                  <div className="metrics">
                    <div><span className="eyebrow">Largura utilizada</span><b className="mono">{fmtMm(r.used_width).replace(',00', '')}</b></div>
                    <div className="hl"><span className="eyebrow">Refilo</span><b className="mono">{fmtKg(r.trim_weight)}</b><small className="mono">{fmtMm(r.trim_width).replace(',00', '')}</small></div>
                    <div><span className="eyebrow">Aproveitamento</span><b className="mono">{fmtPct(r.utilization_pct)}</b></div>
                    <div><span className="eyebrow">CUBs previstos</span><b className="mono">{fmtInt(r.total_cubs)}</b></div>
                  </div>
                  <table className="res-table">
                    <thead><tr><th>Tiras × largura</th><th>Peso da tira</th><th>Bobinas/tira</th><th>Peso por CUB</th><th>CUBs</th></tr></thead>
                    <tbody>
                      {r.lines.map((l, i) => (
                        <tr key={i}>
                          <td className="mono">{l.strip_count} × {l.strip_width} mm</td>
                          <td className="mono">{fmtKg(l.strip_weight)}</td>
                          <td className="mono">{l.coils_per_strip}</td>
                          <td className="mono">{fmtKg(l.coil_weight)}</td>
                          <td className="mono">{l.cubs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted small">O peso por CUB é estimado, só como referência: o peso real é medido na balança no recebimento. O refilo não entra no peso das bobinas.</p>
                </>
              )}
            </div>

            <div className="card panel wide">
              <h2>Versões</h2>
              {versions.length ? (
                <ol className="timeline">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <span className="mono when">v{v.version}</span>
                      <span>
                        <b>{{ DRAFT: 'Rascunho', SENT: 'Enviado', SUPERSEDED: 'Substituído' }[v.status]}</b>
                        <small className="muted"> · {v.lines.map((l) => `${l.strip_count} × ${l.strip_width}`).join(' + ')} · {v.result.total_cubs} CUBs · {fmtDateTime(v.sent_at ?? v.updated_at ?? v.created_at)}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : <p className="muted">Nenhum plano salvo ainda.</p>}
              {can('cuttingPlan.delete') && versions.length > 0 && (
                <div className="mt">
                  <DeleteButton
                    key={mc.id}
                    label="Excluir plano de corte"
                    warning={`Excluir ${versions.length === 1 ? 'o plano' : `as ${versions.length} versões do plano`} do lote ${mc.slitter_lot}? Isso não pode ser desfeito.`}
                    onDelete={async () => { await run(deleteCuttingPlans, { mother_coil_id: mc.id }) }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <div className="err" role="alert">{error}</div>}
        {saved && <p className="ok-msg">{saved}</p>}
        <div className="actions-row sticky-actions">
          {editable && <button className="btn" onClick={save} disabled={busy || !r || !dirty || !trimCheck.ok}>{willBeNewVersion ? `Salvar como nova versão (v${(plan?.version ?? 0) + 1})` : 'Salvar rascunho'}</button>}
          {editable && plan?.status === 'DRAFT' && !dirty && <button className="btn" onClick={send} disabled={busy}>Marcar como enviado ao prestador</button>}
          {editable && mc.status === 'PLANNED' && plan?.status === 'SENT' && !dirty && <button className="btn ghost" onClick={schedule} disabled={busy}>Confirmar programação do prestador</button>}
          <button className="btn ghost" onClick={() => window.print()} disabled={!r}>Imprimir plano</button>
        </div>
        {editable && dirty && r && <p className="muted small">Há alterações não salvas. Salve antes de marcar como enviado ou confirmar a programação.</p>}
        {!editable && <p className="muted small">Somente o PCP (ou o administrador) altera o plano. Você pode imprimi-lo.</p>}
      </div>

      {r && <PrintSheet mc={mc} result={r} lines={calc.lines} plan={plan} version={plan?.version ?? 1} expected={expected} limit={limit} />}
    </>
  )
}
