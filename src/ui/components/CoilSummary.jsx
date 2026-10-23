import { Link } from 'react-router'
import Modal from './Modal.jsx'
import { COIL_STATUS } from '../labels.js'
import { fmtDate, fmtKg, fmtThickness } from '../format.js'

const Row = ({ k, children }) => (
  <div className="kv"><span className="eyebrow">{k}</span><div>{children || '—'}</div></div>
)

/** Resumo rápido de um CUB, numa janela. A ficha completa (cadeia de elos e bloqueio) fica em /cub/:cub. */
export default function CoilSummary({ coil, onClose }) {
  const st = COIL_STATUS[coil.status]
  return (
    <Modal
      title={coil.cub}
      onClose={onClose}
      actions={<Link to={`/cub/${coil.cub}`} className="btn link-btn">Abrir ficha completa</Link>}
    >
      <p><span className={`badge ${st?.tone ?? ''}`}>{st?.label ?? coil.status}</span></p>
      <Row k="Material"><span className="mono">{fmtThickness(coil.thickness)} mm × {coil.width} mm · {coil.galvanization}</span></Row>
      <Row k="Código ERP"><span className="mono">{coil.material}</span></Row>
      <Row k="Peso recebido"><span className="mono">{fmtKg(coil.received_weight)}</span></Row>
      <Row k="Peso atual"><span className="mono">{fmtKg(coil.current_weight)}</span></Row>
      <Row k="Posição">{coil.storage_location}</Row>
      <Row k="NF do prestador"><span className="mono">{coil.slitter_invoice_number}</span>{coil.received_date ? ` · recebida em ${fmtDate(coil.received_date)}` : ''}</Row>
      <Row k="Certificado"><span className="mono">{coil.certificate_number}</span></Row>
      <Row k="Usos">{coil.use_count ? <span className="mono">{coil.use_count} · consumo total {fmtKg(coil.cumulative_consumption)}</span> : 'Ainda sem uso'}</Row>
      {coil.last_project && <Row k="Última obra">{coil.last_project}{coil.last_production_order ? <span className="mono"> · OP {coil.last_production_order}</span> : ''}</Row>}
    </Modal>
  )
}
