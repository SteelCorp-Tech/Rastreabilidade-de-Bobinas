import { useEffect } from 'react'

/**
 * Janela sobre a tela. Fecha com Esc, com o botão ou clicando fora.
 * @param {{title: string, onClose: () => void, wide?: boolean, children: any, actions?: any}} props
 */
export default function Modal({ title, onClose, wide = false, children, actions }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="modal-actions">
            {actions}
            <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
