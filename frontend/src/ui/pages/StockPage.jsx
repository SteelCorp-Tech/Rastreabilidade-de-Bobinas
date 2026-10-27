import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import SortTh from '../components/SortTh.jsx'
import { useSort } from '../sortRows.js'
import Seg from '../components/Seg.jsx'
import { useAction } from '../components/useAction.js'
import { useProfile } from '../app/ProfileContext.jsx'
import { useStore } from '../app/StoreContext.jsx'
import { setStorageLocation } from '@dominio/commands.js'
import { stockBalanceByMaterial } from '@dominio/stock.js'
import { COIL_STATUS } from '../labels.js'
import { fmtKg, fmtThickness } from '../format.js'

function LocationCell({ coil, editable }) {
  const { run } = useStore()
  const { error, exec } = useAction()
  const [value, setValue] = useState(null)
  const done = (save) => {
    const v = value
    setValue(null)
    if (save && v !== (coil.storage_location ?? '')) exec(() => run(setStorageLocation, { cub: coil.cub, location: v }))
  }
  if (value === null) {
    const open = coil.status !== 'CONSUMED' && coil.status !== 'RETURNED'
    return editable && open
      ? <button className="link loc" onClick={() => setValue(coil.storage_location ?? '')}>{coil.storage_location || '+ posição'}</button>
      : <span>{coil.storage_location || '—'}</span>
  }
  return (
    <>
      <input
        className="loc-input" value={value} autoFocus onChange={(e) => setValue(e.target.value)} onBlur={() => done(true)}
        onKeyDown={(e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false) }} placeholder="Rua / prateleira" aria-label={`Posição de ${coil.cub}`}
      />
      {error && <span className="err-inline">{error}</span>}
    </>
  )
}

function Balance() {
  const { state } = useStore()
  const rows = stockBalanceByMaterial(state)
  const { rows: sorted, sort, toggle } = useSort(rows, {
    code: (r) => r.code, material: (r) => r.thickness * 100000 + r.width, count: (r) => r.available_count, weight: (r) => r.available_weight, blocked: (r) => r.blocked_count, inuse: (r) => r.in_use_count,
  })
  const total = rows.reduce((s, r) => s + r.available_weight, 0)
  return (
    <div className="card table-wrap fill">
      <table>
        <thead><tr><SortTh k="code" sort={sort} onSort={toggle}>Código ERP</SortTh><SortTh k="material" sort={sort} onSort={toggle}>Material</SortTh><SortTh k="count" sort={sort} onSort={toggle}>Disponível</SortTh><SortTh k="weight" sort={sort} onSort={toggle}>Peso disponível</SortTh><SortTh k="blocked" sort={sort} onSort={toggle}>Bloqueado</SortTh><SortTh k="inuse" sort={sort} onSort={toggle}>Em uso</SortTh></tr></thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.code}>
              <td className="mono"><b>{r.code}</b></td>
              <td className="mono">{fmtThickness(r.thickness)} × {r.width} {r.galvanization}{r.variants > 1 ? <small className="muted"> +{r.variants - 1} larg.</small> : null}</td>
              <td className="mono">{r.available_count}</td>
              <td className="mono">{fmtKg(r.available_weight)}</td>
              <td className="mono">{r.blocked_count ? <span className="badge bad">{r.blocked_count} · {fmtKg(r.blocked_weight)}</span> : '—'}</td>
              <td className="mono">{r.in_use_count || '—'}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="empty-row">Sem saldo.</td></tr>}
        </tbody>
        {rows.length > 0 && <tfoot><tr><td colSpan={3}>Total disponível</td><td className="mono"><b>{fmtKg(total)}</b></td><td colSpan={2} /></tr></tfoot>}
      </table>
    </div>
  )
}

export default function StockPage() {
  const { state } = useStore()
  const { can } = useProfile()
  const [view, setView] = useState('cubs')
  const [status, setStatus] = useState('IN_STOCK')
  const [q, setQ] = useState('')
  const [galv, setGalv] = useState('')
  const [thick, setThick] = useState('')

  const lastUseOf = useMemo(() => {
    const m = new Map()
    for (const u of state.uses) m.set(u.coil, u)
    return m
  }, [state.uses])
  const galvs = [...new Set(state.coils.map((c) => c.galvanization))].sort()
  const thicks = [...new Set(state.coils.map((c) => c.thickness))].sort((a, b) => a - b)
  const count = (s) => (s === 'all' ? state.coils.length : state.coils.filter((c) => c.status === s).length)
  const statusOptions = [
    { value: 'IN_STOCK', label: 'Em estoque' }, { value: 'IN_USE', label: 'Em uso' }, { value: 'BLOCKED', label: 'Bloqueados' },
    { value: 'CONSUMED', label: 'Consumidos' }, { value: 'RETURNED', label: 'Enviados' }, { value: 'all', label: 'Todos' },
  ].map((o) => ({ ...o, count: count(o.value) }))

  const needle = q.trim().toLowerCase()
  const rows = state.coils
    .filter((c) => (status === 'all' || c.status === status) && (!galv || c.galvanization === galv) && (!thick || c.thickness === Number(thick)))
    .filter((c) => !needle || [c.cub, c.slitter_lot, c.slitter_invoice_number, c.material, c.last_project, c.last_production_order, c.storage_location, `${c.thickness}x${c.width}`].some((v) => String(v ?? '').toLowerCase().replace(',', '.').includes(needle.replace(',', '.'))))
    .sort((a, b) => a.cub.localeCompare(b.cub))
  const { rows: sortedCoils, sort: coilSort, toggle: coilToggle } = useSort(rows, {
    cub: (c) => c.cub, lot: (c) => c.slitter_lot, code: (c) => c.material, material: (c) => c.thickness * 100000 + c.width, weight: (c) => c.current_weight,
    location: (c) => c.storage_location, project: (c) => c.last_project ?? lastUseOf.get(c.id)?.project, status: (c) => COIL_STATUS[c.status]?.label,
  })

  return (
    <div className="fit-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operação</div>
          <h1>Estoque de CUBs</h1>
        </div>
        <Seg options={[{ value: 'cubs', label: 'CUBs' }, { value: 'balance', label: 'Saldo por código ERP' }]} value={view} onChange={setView} label="Visão" />
      </div>

      {view === 'balance' ? <Balance /> : (
        <>
          <Seg options={statusOptions} value={status} onChange={setStatus} label="Situação" />
          <div className="filters">
            <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="CUB, lote, NF, código, obra, posição, 0,95x166…" aria-label="Buscar" />
            <select value={galv} onChange={(e) => setGalv(e.target.value)} aria-label="Galvanização"><option value="">Todas as galvanizações</option>{galvs.map((g) => <option key={g}>{g}</option>)}</select>
            <select value={thick} onChange={(e) => setThick(e.target.value)} aria-label="Espessura"><option value="">Todas as espessuras</option>{thicks.map((t) => <option key={t} value={t}>{fmtThickness(t)} mm</option>)}</select>
          </div>
          <div className="card table-wrap fill">
            <table>
              <thead><tr><SortTh k="cub" sort={coilSort} onSort={coilToggle}>CUB</SortTh><SortTh k="lot" sort={coilSort} onSort={coilToggle}>Lote</SortTh><SortTh k="code" sort={coilSort} onSort={coilToggle}>Código ERP</SortTh><SortTh k="material" sort={coilSort} onSort={coilToggle}>Material</SortTh><SortTh k="weight" sort={coilSort} onSort={coilToggle}>Peso atual</SortTh><SortTh k="location" sort={coilSort} onSort={coilToggle}>Posição</SortTh><SortTh k="project" sort={coilSort} onSort={coilToggle}>Última obra</SortTh><SortTh k="status" sort={coilSort} onSort={coilToggle}>Situação</SortTh></tr></thead>
              <tbody>
                {sortedCoils.slice(0, 300).map((c) => (
                  <tr key={c.id} className={c.status === 'CONSUMED' || c.status === 'RETURNED' ? 'dim' : ''}>
                    <td className="mono"><b>{c.cub}</b></td>
                    <td className="mono"><Link to={`/bobinas-mae/${c.mother_coil}`}>{c.slitter_lot}</Link></td>
                    <td className="mono">{c.material || <span className="badge warn">sem código</span>}</td>
                    <td className="mono">{fmtThickness(c.thickness)} × {c.width} {c.galvanization}</td>
                    <td className="mono">{fmtKg(c.current_weight)}{c.received_weight_estimated && c.use_count === 0 ? <small className="muted" title="Peso estimado pela fórmula do plano de corte"> est.</small> : null}</td>
                    <td><LocationCell coil={c} editable={can('stock.locate')} /></td>
                    <td>{c.last_project ?? (lastUseOf.get(c.id)?.project ?? '—')}</td>
                    <td><span className={`badge ${COIL_STATUS[c.status]?.tone ?? ''}`}>{COIL_STATUS[c.status]?.label ?? c.status}</span></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={8} className="empty-row">Nenhum CUB nesta visão.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted foot">{rows.length} CUBs{rows.length > 300 ? ' (mostrando 300; refine os filtros)' : ''}</p>
        </>
      )}
    </div>
  )
}
