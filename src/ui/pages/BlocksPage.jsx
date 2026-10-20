import { useState } from 'react'
import { Link } from 'react-router'
import BlockForm from '../components/BlockForm.jsx'
import Seg from '../components/Seg.jsx'
import { useAction } from '../components/useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { blockCoilCmd, blockLot, unblockCoilCmd, unblockLot } from '../../domain/commands.js'
import { fmtDateTime } from '../format.js'

/** Bloqueio e liberação pela Qualidade, com motivo obrigatório. A ferramenta de FVM faz checklist e não conformidade; aqui só o efeito sobre o estoque. */
export default function BlocksPage() {
  const { state, run } = useStore()
  const { can } = useProfile()
  const manage = can('block.manage')
  const [scope, setScope] = useState('lot')
  const [target, setTarget] = useState('')
  const [release, setRelease] = useState(null) // { scope, target }
  const [fvm, setFvm] = useState({ number: '', scope: 'lot', target: '', result: 'REPROVADA' })
  const sim = useAction()
  const [simMsg, setSimMsg] = useState('')

  const lastLotEvent = (lot) => [...state.auditLog].reverse().find((a) => a.action === 'lot.block' && a.after?.slitter_lot === lot)
  const blockedLots = state.motherCoils.filter((m) => m.status === 'BLOCKED').map((m) => {
    const ev = lastLotEvent(m.slitter_lot)
    return { lot: m.slitter_lot, reason: m.block_reason ?? ev?.reason ?? '', by: ev?.actor.user, at: ev?.at, cubs: state.coils.filter((c) => c.mother_coil === m.id && c.block_scope === 'LOT' && (c.status === 'BLOCKED' || c.block_pending)).length }
  })
  const blockedCoils = state.coils.filter((c) => (c.status === 'BLOCKED' || c.block_pending) && c.block_scope !== 'LOT')

  const simulate = () => sim.exec(async () => {
    if (!fvm.number.trim()) throw new Error('Informe o número da FVM do evento.')
    if (!fvm.target.trim()) throw new Error('Informe o lote ou o CUB do evento.')
    const block = fvm.result === 'REPROVADA'
    const reason = `Evento FVM (simulado) nº ${fvm.number.trim()}: bobina ${block ? 'reprovada' : 'aprovada'}`
    const cmd = fvm.scope === 'lot' ? (block ? blockLot : unblockLot) : block ? blockCoilCmd : unblockCoilCmd
    await run(cmd, fvm.scope === 'lot' ? { slitter_lot: fvm.target.trim(), reason } : { cub: fvm.target.trim().toUpperCase(), reason })
    setSimMsg(`Evento recebido: ${fvm.scope === 'lot' ? 'lote' : 'CUB'} ${fvm.target.trim()} ${block ? 'bloqueado' : 'liberado'}.`)
  })

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Qualidade</div>
          <h1>Bloqueio e liberação</h1>
        </div>
        {!manage && <span className="badge">Somente a Qualidade bloqueia ou libera</span>}
      </div>

      <h2 className="sub">Bloqueios ativos ({blockedLots.length + blockedCoils.length})</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Alvo</th><th>Motivo</th><th>Por</th><th>Quando</th><th /></tr></thead>
          <tbody>
            {blockedLots.map((b) => (
              <tr key={'l' + b.lot}>
                <td><b>Lote <Link to={`/recall?q=${b.lot}`} className="mono">{b.lot}</Link></b> <span className="muted">· {b.cubs} CUBs</span></td><td>{b.reason}</td><td>{b.by ?? '—'}</td><td>{b.at ? fmtDateTime(b.at) : '—'}</td>
                <td className="actions">{manage && <button className="link" onClick={() => setRelease({ scope: 'lot', target: b.lot })}>Liberar lote</button>}</td>
              </tr>
            ))}
            {blockedCoils.map((c) => (
              <tr key={c.cub}>
                <td><b>CUB <Link to={`/cub/${c.cub}`} className="mono">{c.cub}</Link></b></td><td>{c.block_reason}{c.block_pending ? ' (em uso: a sobra volta bloqueada)' : ''}</td><td>{c.blocked_by ?? '—'}</td><td>{c.blocked_at ? fmtDateTime(c.blocked_at) : '—'}</td>
                <td className="actions">{manage && <button className="link" onClick={() => setRelease({ scope: 'cub', target: c.cub })}>Liberar CUB</button>}</td>
              </tr>
            ))}
            {!blockedLots.length && !blockedCoils.length && <tr><td colSpan={5} className="empty-row">Nada bloqueado no momento.</td></tr>}
          </tbody>
        </table>
      </div>
      {release && manage && (
        <div className="card panel wide mt">
          <h2>Liberar {release.scope === 'lot' ? 'lote' : 'CUB'} <span className="mono">{release.target}</span></h2>
          <BlockForm key={release.target} scope={release.scope} target={release.target} mode="unblock" onDone={() => setRelease(null)} />
        </div>
      )}

      {manage && (
        <>
          <div className="grid-2 mt">
            <div className="card panel wide">
              <h2>Bloquear</h2>
              <Seg options={[{ value: 'lot', label: 'Lote inteiro' }, { value: 'cub', label: 'Um CUB' }]} value={scope} onChange={(v) => { setScope(v); setTarget('') }} label="Alvo" />
              <label className="mt">
                <span className="eyebrow">{scope === 'lot' ? 'Lote do prestador (LS)' : 'CUB'}</span>
                <input className="mono" value={target} onChange={(e) => setTarget(e.target.value)} list={scope === 'lot' ? 'blk-lots' : undefined} placeholder={scope === 'lot' ? '8948' : 'CUB-2026-00300'} />
                <datalist id="blk-lots">{state.motherCoils.filter((m) => m.status !== 'BLOCKED').map((m) => <option key={m.id} value={m.slitter_lot} />)}</datalist>
              </label>
              {target.trim() && <BlockForm key={scope + target} scope={scope} target={scope === 'cub' ? target.trim().toUpperCase() : target.trim()} mode="block" />}
            </div>

            <div className="card panel wide fvm">
              <h2>Simular evento da FVM</h2>
              <p className="muted">Só demonstração: mostra como a integração futura se comportaria. A FVM faz o checklist e trata a não conformidade; este app só recebe o efeito (bloquear ou liberar).</p>
              <div className="fields two">
                <label><span className="eyebrow">Nº FVM</span><input className="mono" value={fvm.number} onChange={(e) => setFvm({ ...fvm, number: e.target.value })} /></label>
                <label><span className="eyebrow">Resultado</span>
                  <select value={fvm.result} onChange={(e) => setFvm({ ...fvm, result: e.target.value })}><option value="REPROVADA">Reprovada → bloqueia</option><option value="APROVADA">Aprovada → libera</option></select>
                </label>
                <label><span className="eyebrow">Alvo</span>
                  <select value={fvm.scope} onChange={(e) => setFvm({ ...fvm, scope: e.target.value })}><option value="lot">Lote</option><option value="cub">CUB</option></select>
                </label>
                <label><span className="eyebrow">{fvm.scope === 'lot' ? 'Lote' : 'CUB'}</span><input className="mono" value={fvm.target} onChange={(e) => setFvm({ ...fvm, target: e.target.value })} /></label>
              </div>
              {sim.error && <div className="err" role="alert">{sim.error}</div>}
              {simMsg && !sim.error && <p className="ok-msg">{simMsg}</p>}
              <button className="btn ghost" onClick={() => { setSimMsg(''); simulate() }} disabled={sim.busy}>Simular evento</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
