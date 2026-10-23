import { useEffect, useState } from 'react'
import { useAction } from '../components/useAction.js'
import { useProfile } from './ProfileContext.jsx'
import { useStore } from './StoreContext.jsx'
import { DEFAULT_CONFIG } from '../../domain/config.js'
import { formatCub } from '../../domain/cub.js'
import { updateConfig } from '../../domain/registryCommands.js'
import { parseDecimal } from '../format.js'

export default function SettingsPage() {
  const { can } = useProfile()
  const { state, restoreSeed, run } = useStore()
  const editable = can('settings.edit')
  const cfg = { ...DEFAULT_CONFIG, ...state.config }
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [restored, setRestored] = useState(false)
  const { error, busy, exec } = useAction()

  const toForm = (c) => ({
    weight_limit: String(c.weight_limit).replace('.', ','),
    trim_min_mm: c.trim_min_mm == null ? '' : String(c.trim_min_mm).replace('.', ','),
    trim_max_mm: c.trim_max_mm == null ? '' : String(c.trim_max_mm).replace('.', ','),
    mass_tolerance_pct: String(c.mass_tolerance_pct).replace('.', ','),
    cub_prefix: c.cub_prefix,
    cub_digits: String(c.cub_digits),
    certificate_required: c.certificate_required,
    label_layout: c.label_layout,
  })
  useEffect(() => { setForm(toForm({ ...DEFAULT_CONFIG, ...state.config })) }, [state.config])
  if (!form) return null
  const set = (k) => (e) => { setSaved(false); setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }) }

  const submit = (e) => {
    e.preventDefault()
    exec(async () => {
      await run(updateConfig, {
        weight_limit: parseDecimal(form.weight_limit),
        trim_min_mm: form.trim_min_mm.trim() === '' ? null : parseDecimal(form.trim_min_mm),
        trim_max_mm: form.trim_max_mm.trim() === '' ? null : parseDecimal(form.trim_max_mm),
        mass_tolerance_pct: parseDecimal(form.mass_tolerance_pct),
        cub_prefix: form.cub_prefix.trim().toUpperCase(),
        cub_digits: Number(form.cub_digits),
        certificate_required: form.certificate_required,
        label_layout: form.label_layout,
      })
      setSaved(true)
    })
  }

  const counts = [
    ['Bobinas mãe', state.motherCoils.length],
    ['CUBs', state.coils.length],
    ['Entregas', state.deliveries.length],
    ['Usos', state.uses.length],
    ['Eventos de auditoria', state.auditLog.length],
  ]
  const preview = formatCub(2026, 576, { cub_prefix: form.cub_prefix.trim().toUpperCase() || 'CUB', cub_digits: Number(form.cub_digits) || 5 })

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Sistema</div>
          <h1>Configurações</h1>
        </div>
        {!editable && <span className="badge">Somente o administrador altera</span>}
      </div>

      <form className="card panel" onSubmit={submit}>
        <h2>Regras</h2>
        <div className="fields">
          <label>
            <span className="eyebrow">Limite de peso por bobina (kg)</span>
            <input className="mono" inputMode="decimal" value={form.weight_limit} onChange={set('weight_limit')} disabled={!editable} />
            <small className="muted">Peso máximo no desbobinador; define em quantas bobinas cada tira é dividida.</small>
          </label>
          <div className="fields two">
            <label>
              <span className="eyebrow">Refilo mínimo do plano (mm)</span>
              <input className="mono" inputMode="decimal" value={form.trim_min_mm} onChange={set('trim_min_mm')} disabled={!editable} />
            </label>
            <label>
              <span className="eyebrow">Refilo máximo do plano (mm)</span>
              <input className="mono" inputMode="decimal" value={form.trim_max_mm} onChange={set('trim_max_mm')} disabled={!editable} />
            </label>
          </div>
          <small className="muted">Todo plano de corte precisa deixar uma sobra lateral dentro dessa faixa. Em branco, a regra fica desligada.</small>
          <label>
            <span className="eyebrow">Tolerância do balanço de massa (%)</span>
            <input className="mono" inputMode="decimal" value={form.mass_tolerance_pct} onChange={set('mass_tolerance_pct')} disabled={!editable} />
            <small className="muted">Diferença aceita entre o peso líquido da mãe e CUBs mais refilo.</small>
          </label>
          <label className="check">
            <input type="checkbox" checked={form.certificate_required} onChange={set('certificate_required')} disabled={!editable} />
            <span>
              <b>Certificado obrigatório ao registrar a bobina mãe</b>
              <small className="muted">Desligado, a bobina entra marcada "sem certificado" e aparece nas pendências.</small>
            </span>
          </label>
        </div>

        <h2>CUB e etiqueta</h2>
        <div className="fields two">
          <label>
            <span className="eyebrow">Prefixo do CUB</span>
            <input className="mono" value={form.cub_prefix} onChange={set('cub_prefix')} disabled={!editable} maxLength={6} />
          </label>
          <label>
            <span className="eyebrow">Dígitos do sequencial</span>
            <input className="mono" inputMode="numeric" value={form.cub_digits} onChange={set('cub_digits')} disabled={!editable} />
          </label>
        </div>
        <p className="muted">Próximo CUB seria <b className="mono">{preview}</b>. A mudança vale só para CUBs novos; os já emitidos não mudam.</p>
        <label>
          <span className="eyebrow">Layout da etiqueta</span>
          <select value={form.label_layout} onChange={set('label_layout')} disabled={!editable}>
            <option value="A4">Folha A4, 2 colunas</option>
            <option value="THERMAL">Etiqueta térmica 100×50 mm</option>
          </select>
        </label>

        {error && <div className="err" role="alert">{error}</div>}
        {saved && <p className="ok-msg">Configurações salvas.</p>}
        {editable && <button className="btn save-btn" disabled={busy}>Salvar</button>}
      </form>

      <div className="card panel">
        <h2>Dados de exemplo</h2>
        <p className="muted">
          Gerados da planilha de controle (amostra de lotes com peso e largura da mãe). Os pesos dos CUBs são estimados pela fórmula do plano de corte.
        </p>
        <ul className="stat-list">
          {counts.map(([k, v]) => (
            <li key={k}><span>{k}</span><b className="mono">{v}</b></li>
          ))}
        </ul>
        <button
          className="btn"
          disabled={!can('seed.restore')}
          title={can('seed.restore') ? '' : 'Somente o administrador'}
          onClick={async () => {
            if (!window.confirm('Restaurar os dados de exemplo? O que foi lançado nesta máquina será substituído. A auditoria é mantida.')) return
            await restoreSeed()
            setRestored(true)
          }}
        >
          Restaurar dados de exemplo
        </button>
        {restored && <p className="ok-msg">Dados restaurados.</p>}
      </div>
    </>
  )
}
