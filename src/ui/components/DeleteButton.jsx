import { useState } from 'react'
import { useAction } from './useAction.js'

/**
 * Exclusão com confirmação em duas etapas. O botão "Excluir" abre o aviso; só "Confirmar exclusão" executa.
 * Se o domínio recusar (ex.: CUB já usado), a mensagem aparece aqui e nada é apagado.
 * @param {{label: string, warning: string, onDelete: () => Promise<void>}} props
 */
export default function DeleteButton({ label, warning, onDelete }) {
  const [open, setOpen] = useState(false)
  const { error, busy, exec, clearError } = useAction()

  const close = () => { setOpen(false); clearError() }
  const confirm = () => exec(async () => { await onDelete() })

  if (!open) return <button type="button" className="btn ghost danger" onClick={() => setOpen(true)}>{label}</button>
  return (
    <div className="delete-box" role="alertdialog" aria-label={label}>
      <p>{warning}</p>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="actions-row">
        <button type="button" className="btn danger-fill" onClick={confirm} disabled={busy}>Confirmar exclusão</button>
        <button type="button" className="btn ghost" onClick={close} disabled={busy}>Cancelar</button>
      </div>
    </div>
  )
}
