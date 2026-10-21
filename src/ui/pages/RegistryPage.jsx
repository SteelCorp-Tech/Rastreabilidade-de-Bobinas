import { useMemo, useState } from 'react'
import Seg from '../components/Seg.jsx'
import { useAction } from '../components/useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { REGISTRY_KINDS, saveMaterial, saveRegistryItem, setMaterialActive, setRegistryActive } from '../../domain/registryCommands.js'
import { fmtThickness, parseDecimal } from '../format.js'

const TABS = [
  { value: 'suppliers', label: 'Fornecedores' },
  { value: 'mills', label: 'Usinas' },
  { value: 'projects', label: 'Obras' },
  { value: 'machines', label: 'Perfiladeiras' },
  { value: 'materials', label: 'Catálogo de materiais' },
]

const StatusBadge = ({ active }) => <span className={'badge ' + (active === false ? 'off' : '')}>{active === false ? 'Inativo' : 'Ativo'}</span>

function SimpleRegistry({ kind }) {
  const { state, run } = useStore()
  const { can } = useProfile()
  const { error, busy, exec, clearError } = useAction()
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [q, setQ] = useState('')
  const editable = can('registry.edit')
  const label = REGISTRY_KINDS[kind].label
  const rows = state[kind].filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))

  const reset = () => { setEditing(null); setName(''); setCode(''); clearError() }
  const submit = (e) => {
    e.preventDefault()
    exec(async () => {
      await run(saveRegistryItem, { kind, id: editing, name, code })
      reset()
    })
  }

  return (
    <>
      {editable && (
        <form className="card form-row" onSubmit={submit}>
          <label>
            <span className="eyebrow">{label}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Nome do ${label.toLowerCase()}`} />
          </label>
          <label>
            <span className="eyebrow">Código externo (opcional)</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="mono" />
          </label>
          <button className="btn" disabled={busy}>{editing ? 'Salvar' : 'Adicionar'}</button>
          {editing && <button type="button" className="btn ghost" onClick={reset}>Cancelar</button>}
        </form>
      )}
      {error && <div className="err" role="alert">{error}</div>}
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar" />
      <div className="card table-wrap fill">
        <table>
          <thead><tr><th>Nome</th><th>Código externo</th><th>Situação</th>{editable && <th />}</tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={i.active === false ? 'dim' : ''}>
                <td>{i.name}</td>
                <td className="mono">{i.code || '—'}</td>
                <td><StatusBadge active={i.active} /></td>
                {editable && (
                  <td className="actions">
                    <button className="link" onClick={() => { setEditing(i.id); setName(i.name); setCode(i.code ?? ''); clearError() }}>Editar</button>
                    <button className="link" onClick={() => exec(() => run(setRegistryActive, { kind, id: i.id, active: i.active === false }))}>
                      {i.active === false ? 'Reativar' : 'Inativar'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="empty-row">Nenhum registro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Catalog() {
  const { state, run } = useStore()
  const { can } = useProfile()
  const { error, busy, exec, clearError } = useAction()
  const editable = can('registry.edit')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ code: '', galvanization: 'Z275', thickness: '', width: '' })
  const [q, setQ] = useState('')
  const [galv, setGalv] = useState('')
  const [thick, setThick] = useState('')
  const galvs = useMemo(() => [...new Set(state.materials.map((m) => m.galvanization))].sort(), [state.materials])
  const thicks = useMemo(() => [...new Set(state.materials.map((m) => m.thickness))].sort((a, b) => a - b), [state.materials])
  const rows = state.materials
    .filter((m) => (!q || m.code.includes(q.trim()) || String(m.width) === q.trim()) && (!galv || m.galvanization === galv) && (!thick || m.thickness === Number(thick)))
    .sort((a, b) => a.thickness - b.thickness || a.width - b.width)
  const codes = new Set(state.materials.map((m) => m.code)).size
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const reset = () => { setEditing(null); setForm({ code: '', galvanization: 'Z275', thickness: '', width: '' }); clearError() }

  const submit = (e) => {
    e.preventDefault()
    exec(async () => {
      await run(saveMaterial, { id: editing, code: form.code, galvanization: form.galvanization, thickness: parseDecimal(form.thickness), width: parseDecimal(form.width) })
      reset()
    })
  }

  return (
    <>
      <p className="muted">
        Cada linha liga (espessura, largura exata, galvanização) a um código ERP. A largura varia alguns mm dentro da tolerância, por isso vários registros podem apontar para o mesmo código. {state.materials.length} linhas, {codes} códigos.
      </p>
      {editable && (
        <form className="card form-row" onSubmit={submit}>
          <label><span className="eyebrow">Código ERP</span><input className="mono" value={form.code} onChange={set('code')} /></label>
          <label><span className="eyebrow">Galvanização</span>
            <select value={form.galvanization} onChange={set('galvanization')}>{['Z275', 'Z350', ...galvs.filter((g) => !['Z275', 'Z350'].includes(g))].map((g) => <option key={g}>{g}</option>)}</select>
          </label>
          <label><span className="eyebrow">Espessura (mm)</span><input inputMode="decimal" className="mono" value={form.thickness} onChange={set('thickness')} placeholder="0,95" /></label>
          <label><span className="eyebrow">Largura (mm)</span><input inputMode="numeric" className="mono" value={form.width} onChange={set('width')} placeholder="166" /></label>
          <button className="btn" disabled={busy}>{editing ? 'Salvar' : 'Adicionar'}</button>
          {editing && <button type="button" className="btn ghost" onClick={reset}>Cancelar</button>}
        </form>
      )}
      {error && <div className="err" role="alert">{error}</div>}
      <div className="filters">
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código ou largura…" aria-label="Buscar" />
        <select value={galv} onChange={(e) => setGalv(e.target.value)} aria-label="Galvanização"><option value="">Todas as galvanizações</option>{galvs.map((g) => <option key={g}>{g}</option>)}</select>
        <select value={thick} onChange={(e) => setThick(e.target.value)} aria-label="Espessura"><option value="">Todas as espessuras</option>{thicks.map((t) => <option key={t} value={t}>{fmtThickness(t)} mm</option>)}</select>
      </div>
      <div className="card table-wrap fill">
        <table>
          <thead><tr><th>Código ERP</th><th>Espessura</th><th>Largura</th><th>Galvanização</th><th>Situação</th>{editable && <th />}</tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={m.active === false ? 'dim' : ''}>
                <td className="mono">{m.code}</td>
                <td className="mono">{fmtThickness(m.thickness)} mm</td>
                <td className="mono">{m.width} mm</td>
                <td>{m.galvanization}</td>
                <td><StatusBadge active={m.active} /></td>
                {editable && (
                  <td className="actions">
                    <button className="link" onClick={() => { setEditing(m.id); setForm({ code: m.code, galvanization: m.galvanization, thickness: String(m.thickness).replace('.', ','), width: String(m.width) }); clearError() }}>Editar</button>
                    <button className="link" onClick={() => exec(() => run(setMaterialActive, { id: m.id, active: m.active === false }))}>{m.active === false ? 'Reativar' : 'Inativar'}</button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="empty-row">Nenhuma linha.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function RegistryPage() {
  const { state } = useStore()
  const { can, roleLabel } = useProfile()
  const [tab, setTab] = useState('suppliers')
  const options = TABS.map((t) => ({ ...t, count: state[t.value].length }))
  return (
    <div className="fit-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Sistema</div>
          <h1>Cadastros</h1>
        </div>
        {!can('registry.edit') && <span className="badge">Somente leitura · {roleLabel}</span>}
      </div>
      <Seg options={options} value={tab} onChange={setTab} label="Cadastros" />
      <div className="tab-body">{tab === 'materials' ? <Catalog /> : <SimpleRegistry key={tab} kind={tab} />}</div>
    </div>
  )
}
