import { QRCodeSVG } from 'qrcode.react'
import { fmtDate, fmtKg } from '../format.js'

/** Uma etiqueta de CUB. O QR carrega o CUB. `label` vem de buildLabel (domínio). */
export function Label({ label }) {
  const leftover = label.kind === 'LEFTOVER'
  return (
    <div className={'label' + (leftover ? ' leftover' : '')}>
      <div className="l-main">
        <div className="l-cub mono">{label.cub}</div>
        {leftover && <div className="l-tag">SOBRA · {fmtDate(label.date)}</div>}
        <dl className="l-fields">
          <dt>LOTE</dt><dd className="mono">LS {label.lot}</dd>
          <dt>CÓD. MICROSYS</dt><dd className="mono">{label.material || '—'}</dd>
          <dt>FORN.</dt><dd>{label.supplier}</dd>
          <dt>GALV.</dt><dd className="mono">{label.galvanization}</dd>
          <dt>DIM. (E X L)</dt><dd className="mono">{label.dimension}</dd>
          <dt>NF FORN.</dt><dd className="mono">{label.supplier_invoice || '—'}</dd>
          <dt>NF PRESTADOR</dt><dd className="mono">{label.slitter_invoice || '—'}</dd>
          <dt>RECEB.</dt><dd className="mono">{fmtDate(label.received_date)}</dd>
          <dt>CERT. QUAL.</dt><dd className="mono">{label.certificate || '—'}</dd>
        </dl>
      </div>
      <div className="l-side">
        <QRCodeSVG value={label.qr} size={104} level="M" marginSize={0} />
        <div className="l-weight mono">{fmtKg(label.weight)}</div>
      </div>
    </div>
  )
}

/** Folha de etiquetas: A4 em 2 colunas, ou térmica 100×50 mm, uma por página. */
export default function LabelSheet({ labels, layout = 'A4' }) {
  return (
    <div className={'label-area ' + (layout === 'THERMAL' ? 'thermal' : 'a4')}>
      {labels.map((l) => <Label key={l.cub + l.kind + l.date} label={l} />)}
    </div>
  )
}
