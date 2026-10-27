import { useCallback, useEffect, useRef, useState } from 'react'
import LabelSheet from '../components/Label.jsx'
import { useAction } from '../components/useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import QrScanner from '../scan/QrScanner.jsx'
import { cubFromScan } from '../scan/detector.js'
import { closeCoilUse, openCoilUse } from '@dominio/commands.js'
import { DEFAULT_CONFIG } from '@dominio/config.js'
import { findPossibleDuplicateUse, refusalMessage } from '@dominio/coil.js'
import { buildLabel } from '@dominio/label.js'
import { dateInSaoPaulo } from '@dominio/units.js'
import { fmtDateTime, fmtKg, fmtThickness, parseDecimal } from '../format.js'

const LAST_KEY = 'bobinas:v1:last-use'
const readLast = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY)) ?? {} } catch { return {} } }
const saveLast = (v) => { try { localStorage.setItem(LAST_KEY, JSON.stringify(v)) } catch { /* sem storage */ } }

function CoilCard({ coil }) {
  return (
    <div className="coil-card">
      <div className="mono cc-cub">{coil.cub}</div>
      <div className="cc-grid">
        <div><span className="eyebrow">Lote</span><b className="mono">{coil.slitter_lot}</b></div>
        <div><span className="eyebrow">Material</span><b className="mono">{fmtThickness(coil.thickness)} × {coil.width} {coil.galvanization}</b></div>
        <div><span className="eyebrow">Código ERP</span><b className="mono">{coil.material || '—'}</b></div>
        <div><span className="eyebrow">Peso atual</span><b className="mono">{fmtKg(coil.current_weight)}</b></div>
      </div>
    </div>
  )
}

export default function CoilUsePage() {
  const { state, run } = useStore()
  const { can } = useProfile()
  const { error, busy, exec, clearError } = useAction()
  const [cubText, setCubText] = useState('')
  const [scanning, setScanning] = useState(false)
  const [coilId, setCoilId] = useState(null) // CUB selecionado
  const [done, setDone] = useState(null) // { kind, cub, label }
  const scanRef = useRef(null)
  const canOpen = can('coilUse.open')

  const coil = state.coils.find((c) => c.id === coilId)
  const openUse = coil && state.uses.find((u) => u.coil === coil.id && !u.closed_at)
  const layout = { ...DEFAULT_CONFIG, ...state.config }.label_layout
  const openUses = state.uses.filter((u) => !u.closed_at)
  // CUBs disponíveis para montar (em estoque), agrupados por lote para facilitar a procura
  const available = state.coils.filter((c) => c.status === 'IN_STOCK')
  const byLot = [...available.reduce((m, c) => m.set(c.slitter_lot, [...(m.get(c.slitter_lot) ?? []), c]), new Map())]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR', { numeric: true }))

  useEffect(() => { if (!coil && !done && !scanning) scanRef.current?.focus() }, [coil, done, scanning])

  const select = useCallback((raw) => {
    clearError()
    const cub = cubFromScan(raw)
    if (!cub) return exec(async () => { throw new Error(`"${String(raw).trim()}" não parece um CUB (formato CUB-AAAA-NNNNN).`) })
    const found = state.coils.find((c) => c.cub === cub)
    if (!found) return exec(async () => { throw new Error(`${cub} não foi encontrado.`) })
    if (found.status !== 'IN_STOCK' && found.status !== 'IN_USE') return exec(async () => { throw new Error(refusalMessage(found)) })
    setCoilId(found.id)
    setCubText('')
  }, [state.coils, exec, clearError])

  const onScan = useCallback((raw) => { setScanning(false); select(raw) }, [select])
  const reset = () => { setCoilId(null); setDone(null); setCubText(''); clearError() }

  if (done) {
    return (
      <div className="use-page">
        <div className="no-print">
        <div className="card panel wide done">
          <button type="button" className="back-btn" onClick={reset}>← Voltar aos usos</button>
          <h1>{done.kind === 'LEFTOVER' ? 'Sobra registrada' : 'Bobina consumida'}</h1>
          <p className="big-text mono">{done.cub}</p>
          <p className="muted">{done.kind === 'LEFTOVER' ? `Volta ao estoque com ${fmtKg(done.weight)}, mesmo CUB. Cole a nova etiqueta.` : 'Consumo total registrado. O CUB não pode mais ser usado.'}</p>
          {done.label && <LabelSheet labels={[done.label]} layout={layout} />}
          <div className="actions-row">
            {done.label && <button className="btn big" onClick={() => window.print()}>Imprimir etiqueta da sobra</button>}
            <button className="btn big ghost" onClick={reset}>Ler outra bobina</button>
          </div>
        </div>
        </div>
        {done.label && <div className="print-only"><LabelSheet labels={[done.label]} layout={layout} /></div>}
      </div>
    )
  }

  return (
    <div className="use-page">
      <div className="no-print">
        <div className="page-head">
          <div>
            {coil && <button type="button" className="back-btn" onClick={reset}>← Voltar aos usos</button>}
            <div className="eyebrow">Operação</div>
            <h1>Uso de bobina</h1>
          </div>
        </div>

        {!coil && (
          <>
            {!canOpen && <div className="err">O perfil atual só consulta. Troque para Produção para abrir ou fechar usos.</div>}
            <div className="card panel wide scan-panel">
              <h2>Ler o CUB da bobina</h2>
              <form onSubmit={(e) => { e.preventDefault(); select(cubText) }}>
                <input
                  ref={scanRef} className="scan-input mono" value={cubText} onChange={(e) => setCubText(e.target.value)}
                  placeholder="Passe o leitor ou digite CUB-2026-00000" autoComplete="off" autoCapitalize="characters" inputMode="text" aria-label="CUB" list="cubs-disponiveis"
                />
                <datalist id="cubs-disponiveis">{available.map((c) => <option key={c.id} value={c.cub} />)}</datalist>
                <div className="actions-row">
                  <button className="btn big" disabled={!cubText.trim()}>Buscar</button>
                  <button type="button" className="btn big ghost" onClick={() => setScanning(true)}>Ler com a câmera</button>
                </div>
              </form>
              <label className="pick-cub">
                <span className="eyebrow">Ou escolha um CUB disponível ({available.length})</span>
                <select className="big-input" value="" onChange={(e) => e.target.value && select(e.target.value)} aria-label="CUBs disponíveis para uso" disabled={!available.length}>
                  <option value="">{available.length ? 'Selecione na lista…' : 'Nenhum CUB em estoque'}</option>
                  {byLot.map(([lot, list]) => (
                    <optgroup key={lot} label={`Lote ${lot} · ${list.length} ${list.length === 1 ? 'CUB' : 'CUBs'}`}>
                      {list.map((c) => <option key={c.id} value={c.cub}>{c.cub} · {fmtThickness(c.thickness)} × {c.width} {c.galvanization} · {fmtKg(c.current_weight)}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              {error && <div className="err big-err" role="alert">{error}</div>}
            </div>

            <h2 className="sub">Usos abertos ({openUses.length})</h2>
            <div className="card table-wrap">
              <table>
                <thead><tr><th>CUB</th><th>OP</th><th>Obra</th><th>Perfiladeira</th><th>Aberto em</th><th /></tr></thead>
                <tbody>
                  {openUses.map((u) => {
                    const c = state.coils.find((x) => x.id === u.coil)
                    return (
                      <tr key={u.id}>
                        <td className="mono"><b>{c?.cub}</b></td><td className="mono">{u.production_order}</td><td>{u.project}</td><td>{u.machine}</td><td>{fmtDateTime(u.opened_at)}</td>
                        <td className="actions">{can('coilUse.close') && <button className="link" onClick={() => setCoilId(u.coil)}>Fechar uso</button>}</td>
                      </tr>
                    )
                  })}
                  {!openUses.length && <tr><td colSpan={6} className="empty-row">Nenhum uso aberto.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {coil && !openUse && <MountStep coil={coil} state={state} canOpen={canOpen} onDone={(c) => setCoilId(c.id)} run={run} exec={exec} busy={busy} error={error} />}
        {coil && openUse && <CloseStep coil={coil} use={openUse} state={state} layout={layout} canClose={can('coilUse.close')} run={run} exec={exec} busy={busy} error={error} onDone={setDone} />}
      </div>
      {scanning && <QrScanner onResult={onScan} onClose={() => setScanning(false)} />}
    </div>
  )
}

/** Passo 1: montagem. OP, obra e perfiladeira. */
function MountStep({ coil, state, canOpen, onDone, run, exec, busy, error }) {
  const last = readLast()
  const [op, setOp] = useState('')
  const [project, setProject] = useState('')
  const [machine, setMachine] = useState(last.machine ?? '')
  const [confirmDup, setConfirmDup] = useState(false)
  const projects = state.projects.filter((p) => p.active !== false)
  const machines = state.machines.filter((m) => m.active !== false)
  const dup = op.trim() && findPossibleDuplicateUse(state.uses, { coil: coil.id, production_order: op, day: dateInSaoPaulo(new Date()) })

  const submit = (e) => {
    e.preventDefault()
    if (dup && !confirmDup) { setConfirmDup(true); return }
    exec(async () => {
      await run(openCoilUse, { cub: coil.cub, production_order: op, project, machine })
      saveLast({ machine })
      onDone(coil)
    })
  }

  return (
    <form onSubmit={submit}>
      <CoilCard coil={coil} />
      <div className="card panel wide">
        <h2>Passo 1 · Montagem na perfiladeira</h2>
        {!canOpen && <div className="err">O perfil atual não abre usos.</div>}
        <div className="fields two">
          <label><span className="eyebrow">OP / Protocolo *</span><input className="big-input mono" value={op} onChange={(e) => { setOp(e.target.value); setConfirmDup(false) }} inputMode="numeric" autoFocus /></label>
          <label><span className="eyebrow">Obra *</span>
            <select className="big-input" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Selecione…</option>
              {projects.map((p) => <option key={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <span className="eyebrow">Perfiladeira *</span>
        <div className="machines">
          {machines.map((m) => (
            <button type="button" key={m.id} className={'machine' + (machine === m.name ? ' on' : '')} onClick={() => setMachine(m.name)}>{m.name}</button>
          ))}
        </div>
        {dup && <div className="warn-box">Já existe um uso deste CUB com a mesma OP hoje ({dup.project}). Pode ser lançamento duplicado.{confirmDup ? ' Toque em Iniciar uso de novo para confirmar.' : ''}</div>}
        {error && <div className="err big-err" role="alert">{error}</div>}
        <button className="btn big go" disabled={busy || !canOpen}>{confirmDup ? 'Confirmar e iniciar uso' : 'Iniciar uso'}</button>
      </div>
    </form>
  )
}

/** Passo 2: fim do uso. Pesar a sobra e escolher sobra ou consumida. */
function CloseStep({ coil, use, state, layout, canClose, run, exec, busy, error, onDone }) {
  const [weight, setWeight] = useState('')
  const [scrap, setScrap] = useState('')
  const [confirming, setConfirming] = useState(false)
  const after = parseDecimal(weight)
  const cons = after >= 0 ? use.weight_before - after : null

  const finish = (outcome) => exec(async () => {
    const res = await run(closeCoilUse, {
      use_id: use.id, outcome, weight_after: outcome === 'CONSUMED' ? 0 : after, scrap_weight: parseDecimal(scrap) > 0 ? parseDecimal(scrap) : 0,
    })
    const today = dateInSaoPaulo(new Date())
    const label = outcome === 'LEFTOVER'
      ? buildLabel({ ...state, motherCoils: state.motherCoils }, res.coil, { kind: 'LEFTOVER', weight: res.coil.current_weight, date: today })
      : null
    onDone({ kind: outcome, cub: coil.cub, weight: res.coil.current_weight, label })
  })

  return (
    <>
      <CoilCard coil={coil} />
      <div className="card panel wide">
        <h2>Passo 2 · Fim do uso</h2>
        <div className="kv"><span className="eyebrow">OP</span><div className="mono">{use.production_order}</div></div>
        <div className="kv"><span className="eyebrow">Obra</span><div>{use.project}</div></div>
        <div className="kv"><span className="eyebrow">Perfiladeira</span><div>{use.machine}</div></div>
        <div className="kv"><span className="eyebrow">Peso na montagem</span><div className="mono">{fmtKg(use.weight_before)}</div></div>

        {!canClose && <div className="err">O perfil atual não fecha usos.</div>}
        <div className="fields two">
          <label>
            <span className="eyebrow">Peso da sobra na balança (kg)</span>
            <input className="big-input mono" value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" autoFocus />
          </label>
          <div className="delta">
            <span className="eyebrow">Consumo neste uso</span>
            <b className="mono">{cons == null || Number.isNaN(cons) || cons < 0 ? '—' : fmtKg(cons)}</b>
          </div>
        </div>
        <label className="scrap"><span className="eyebrow">Refugo (kg, opcional)</span><input className="mono" value={scrap} onChange={(e) => setScrap(e.target.value)} inputMode="decimal" /></label>
        {error && <div className="err big-err" role="alert">{error}</div>}

        {!confirming ? (
          <div className="actions-row two-big">
            <button className="btn big go" disabled={busy || !canClose || !(after > 0)} onClick={() => finish('LEFTOVER')}>Sobra · imprimir etiqueta</button>
            <button className="btn big ghost danger" disabled={busy || !canClose} onClick={() => setConfirming(true)}>Consumida (100%)</button>
          </div>
        ) : (
          <div className="warn-box">
            Marcar {coil.cub} como totalmente consumida? Depois disso ela não pode mais ser usada.
            <div className="actions-row">
              <button className="btn big go" disabled={busy} onClick={() => finish('CONSUMED')}>Sim, consumida</button>
              <button className="btn big ghost" onClick={() => setConfirming(false)}>Voltar</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
