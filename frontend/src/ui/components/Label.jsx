import { QRCodeSVG } from 'qrcode.react'
import logo from '../../assets/steelcorp-logo.png'
import symbol from '../../assets/steelcorp-symbol.png'
import { fmtDate, fmtKg } from '../format.js'

const Field = ({ k, v }) => (
  <div className="l-field">
    <span className="l-k">{k}:</span>
    <b className="l-v">{v}</b>
  </div>
)

/**
 * Uma etiqueta de CUB, no modelo da etiqueta do Excel ("Gerador de etiqueta"): logo no topo, símbolo de fundo,
 * CUB e lote em destaque, campos em dois blocos. O QR carrega o CUB; o peso medido vai abaixo do QR.
 * `label` vem de buildLabel (domínio).
 */
export function Label({ label }) {
  const leftover = label.kind === 'LEFTOVER'
  return (
    <div className={'label' + (leftover ? ' leftover' : '')}>
      <img className="l-watermark" src={symbol} alt="" />
      <div className="l-head">
        <div className="l-id">
          {leftover && <span className="l-tag">SOBRA · {fmtDate(label.date)}</span>}
          <div className="l-cub">{label.cub}</div>
          <div className="l-specs">
            <div className="l-spec"><span className="l-k">LOTE</span><b>LS {label.lot}</b></div>
            <div className="l-spec"><span className="l-k">GALV.</span><b>{label.galvanization}</b></div>
            <div className="l-spec"><span className="l-k">DIM.</span><b>{label.dimension}</b></div>
          </div>
        </div>
        <div className="l-qr">
          <img className="l-logo" src={logo} alt="Grupo SteelCorp" />
          <QRCodeSVG value={label.qr} size={110} level="M" marginSize={0} />
          <div className="l-weight">{fmtKg(label.weight)}</div>
        </div>
      </div>
      <div className="l-cols">
        <div className="l-col">
          <Field k="CÓD MICROSYS" v={label.material || '—'} />
          <Field k="FORN." v={label.supplier} />
          <Field k="DATA RECEB." v={fmtDate(label.received_date)} />
        </div>
        <div className="l-col">
          <Field k="NF FORN." v={label.supplier_invoice || '—'} />
          <Field k="NF PRESTADOR" v={label.slitter_invoice || '—'} />
          <Field k="CERT. QUAL." v={label.certificate || '—'} />
        </div>
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
