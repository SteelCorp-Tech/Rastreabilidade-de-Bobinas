import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import FileField from '../components/FileField.jsx'
import { useAction } from '../components/useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { DEFAULT_CONFIG } from '../../domain/config.js'
import { registerMotherCoil } from '../../domain/commands.js'
import { deleteAttachment, putAttachment } from '../../persistence/attachmentStore.js'
import { parseDecimal } from '../format.js'

const EMPTY = {
  slitter_lot: '', mill_coil_number: '', supplier: '', mill: '', purchase_order_ref: '', supplier_invoice_number: '', supplier_invoice_date: '',
  thickness: '', width: '1200', galvanization: 'Z275', net_weight: '', slitter_entry_date: '', slitter_job_ref: '', certificate_number: '',
}

export default function MotherCoilForm() {
  const { state, run } = useStore()
  const { can } = useProfile()
  const navigate = useNavigate()
  const { error, busy, exec } = useAction()
  const [f, setF] = useState(EMPTY)
  const [certFile, setCertFile] = useState(null)
  const [invoiceFile, setInvoiceFile] = useState(null)
  const required = { ...DEFAULT_CONFIG, ...state.config }.certificate_required
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const galvs = [...new Set(['Z275', 'Z350', ...state.materials.map((m) => m.galvanization)])].sort()
  const active = (list) => list.filter((i) => i.active !== false)

  if (!can('motherCoil.create')) {
    return <div className="card placeholder">O perfil atual não pode registrar bobinas mãe. Troque para Almoxarifado.</div>
  }

  const submit = (e) => {
    e.preventDefault()
    exec(async () => {
      const saved = []
      try {
        const cert = certFile ? await putAttachment(certFile) : null
        if (cert) saved.push(cert.id)
        const inv = invoiceFile ? await putAttachment(invoiceFile) : null
        if (inv) saved.push(inv.id)
        const mc = await run(registerMotherCoil, {
          ...f,
          thickness: parseDecimal(f.thickness),
          width: parseDecimal(f.width),
          net_weight: parseDecimal(f.net_weight),
          certificate_file: cert,
          invoice_file: inv,
        })
        navigate(`/bobinas-mae/${mc.id}`)
      } catch (err) {
        await Promise.all(saved.map((id) => deleteAttachment(id).catch(() => {}))) // recusado: não deixa anexo órfão
        throw err
      }
    })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação · <Link to="/bobinas-mae">Bobinas mãe</Link></div>
          <h1>Nova bobina mãe</h1>
        </div>
      </div>
      <form className="card panel wide" onSubmit={submit}>
        <h2>Origem</h2>
        <div className="fields three">
          <label><span className="eyebrow">Lote do prestador (LS) *</span><input className="mono" value={f.slitter_lot} onChange={set('slitter_lot')} autoFocus /></label>
          <label><span className="eyebrow">Nº da bobina na usina</span><input className="mono" value={f.mill_coil_number} onChange={set('mill_coil_number')} /></label>
          <label><span className="eyebrow">Pedido de compra</span><input className="mono" value={f.purchase_order_ref} onChange={set('purchase_order_ref')} /></label>
          <label><span className="eyebrow">Fornecedor *</span>
            <select value={f.supplier} onChange={set('supplier')}><option value="">Selecione…</option>{active(state.suppliers).map((s) => <option key={s.id}>{s.name}</option>)}</select>
          </label>
          <label><span className="eyebrow">Usina</span>
            <select value={f.mill} onChange={set('mill')}><option value="">—</option>{active(state.mills).map((s) => <option key={s.id}>{s.name}</option>)}</select>
          </label>
          <label><span className="eyebrow">OP do prestador</span><input className="mono" value={f.slitter_job_ref} onChange={set('slitter_job_ref')} /></label>
          <label><span className="eyebrow">NF do fornecedor *</span><input className="mono" value={f.supplier_invoice_number} onChange={set('supplier_invoice_number')} /></label>
          <label><span className="eyebrow">Data da NF</span><input type="date" value={f.supplier_invoice_date} onChange={set('supplier_invoice_date')} /></label>
          <label><span className="eyebrow">Entrada no prestador</span><input type="date" value={f.slitter_entry_date} onChange={set('slitter_entry_date')} /></label>
        </div>

        <h2>Material</h2>
        <div className="fields three">
          <label><span className="eyebrow">Espessura (mm) *</span><input className="mono" inputMode="decimal" value={f.thickness} onChange={set('thickness')} placeholder="0,95" /></label>
          <label><span className="eyebrow">Largura (mm) *</span><input className="mono" inputMode="numeric" value={f.width} onChange={set('width')} /></label>
          <label><span className="eyebrow">Galvanização *</span><select value={f.galvanization} onChange={set('galvanization')}>{galvs.map((g) => <option key={g}>{g}</option>)}</select></label>
          <label><span className="eyebrow">Peso líquido (kg) *</span><input className="mono" inputMode="decimal" value={f.net_weight} onChange={set('net_weight')} placeholder="12195" /></label>
        </div>

        <h2>Certificado de qualidade{required ? ' (obrigatório)' : ''}</h2>
        <p className="muted">
          A validação do certificado é feita fora do sistema; aqui ficam o número e o arquivo, que provam que ele existe.
          {!required && ' A exigência está desligada: sem certificado, a bobina entra marcada "sem certificado" e aparece nas pendências.'}
        </p>
        <div className="fields two">
          <label><span className="eyebrow">Número do certificado{required && ' *'}</span><input className="mono" value={f.certificate_number} onChange={set('certificate_number')} /></label>
          <FileField label="Arquivo do certificado (PDF ou imagem)" required={required} value={certFile} onChange={setCertFile} />
        </div>
        <div className="fields two">
          <FileField label="Arquivo da NF do fornecedor (opcional)" value={invoiceFile} onChange={setInvoiceFile} />
        </div>

        {error && <div className="err" role="alert">{error}</div>}
        <div className="actions-row">
          <button className="btn" disabled={busy}>Registrar bobina mãe</button>
          <Link to="/bobinas-mae" className="btn ghost link-btn">Cancelar</Link>
        </div>
      </form>
    </>
  )
}
