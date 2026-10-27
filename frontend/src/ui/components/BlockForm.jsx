import { useState } from 'react'
import { useAction } from './useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { blockCoilCmd, blockLot, unblockCoilCmd, unblockLot } from '@dominio/commands.js'

/**
 * Bloqueio ou liberação com motivo obrigatório (Qualidade). `scope`: 'cub' ou 'lot'; `target`: CUB ou lote.
 * Em lote, bloqueia a mãe e todos os CUBs com saldo; um CUB em uso bloqueia ao fechar o uso.
 */
export default function BlockForm({ scope, target, mode, onDone }) {
  const { run } = useStore()
  const { can } = useProfile()
  const { error, busy, exec } = useAction()
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')
  if (!can('block.manage')) return null
  const label = mode === 'block' ? 'Bloquear' : 'Liberar'
  const submit = (e) => {
    e.preventDefault()
    exec(async () => {
      const cmd = scope === 'lot' ? (mode === 'block' ? blockLot : unblockLot) : mode === 'block' ? blockCoilCmd : unblockCoilCmd
      const out = await run(cmd, scope === 'lot' ? { slitter_lot: target, reason } : { cub: target, reason })
      const n = out?.blocked_cubs?.length ?? out?.released_cubs?.length
      setMsg(`${scope === 'lot' ? 'Lote' : 'CUB'} ${target} ${mode === 'block' ? 'bloqueado' : 'liberado'}${n != null ? ` (${n} CUBs)` : ''}.`)
      setReason('')
      onDone?.()
    })
  }
  return (
    <form className="block-form" onSubmit={submit}>
      <label>
        <span className="eyebrow">Motivo do {mode === 'block' ? 'bloqueio' : 'desbloqueio'} *</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === 'block' ? 'Ex.: suspeita de descamação' : 'Ex.: laudo aprovado'} />
      </label>
      <button className={'btn' + (mode === 'block' ? ' danger-fill' : '')} disabled={busy}>{label} {scope === 'lot' ? 'lote' : 'CUB'}</button>
      {error && <div className="err" role="alert">{error}</div>}
      {msg && <p className="ok-msg">{msg}</p>}
    </form>
  )
}
