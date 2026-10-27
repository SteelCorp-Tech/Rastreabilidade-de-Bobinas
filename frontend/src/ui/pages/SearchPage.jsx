import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useStore } from '../app/StoreContext.jsx'
import { searchAll } from '@dominio/traceability.js'
import { COIL_STATUS } from '../labels.js'
import { fmtKg, fmtThickness } from '../format.js'

/** Busca universal: CUB, lote, NF, OP, obra, certificado, código ERP, dimensão. */
export default function SearchPage() {
  const { state } = useStore()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => { const t = setTimeout(() => setParams(q ? { q } : {}, { replace: true }), 250); return () => clearTimeout(t) }, [q, setParams])

  const results = useMemo(() => searchAll(state, q), [state, q])
  const coils = results.filter((r) => r.type === 'coil')
  const mothers = results.filter((r) => r.type === 'mother_coil')
  const projects = results.filter((r) => r.type === 'project')
  const uses = results.filter((r) => r.type === 'use')
  const coilById = (id) => state.coils.find((c) => c.id === id)
  const motherById = (id) => state.motherCoils.find((m) => m.id === id)
  const exactCub = coils.length === 1 ? coils[0] : null

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Consulta</div>
          <h1>Rastreabilidade</h1>
        </div>
      </div>
      <input
        ref={ref} className="search-lg" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
        placeholder="CUB, lote, NF, OP, obra, certificado, código ERP ou dimensão (0,95x166)" aria-label="Buscar"
      />
      <p className="muted small">Atalho: pressione / em qualquer tela para vir aqui. Pergunta que esta tela responde: de qual bobina mãe, lote e certificado saiu o aço da obra X, e quais obras consumiram um lote.</p>

      {!q.trim() && <div className="card placeholder">Digite acima para buscar. Ex.: <span className="mono">8948</span>, <span className="mono">CUB-2026-00300</span>, <span className="mono">0,95x166</span> ou o nome de uma obra.</div>}
      {q.trim() && !results.length && <div className="card placeholder">Nada encontrado para "{q}".</div>}
      {exactCub && <p><Link to={`/cub/${exactCub.label}`} className="btn link-btn">Abrir ficha de {exactCub.label}</Link></p>}

      {projects.length > 0 && (
        <section>
          <h2 className="sub">Obras ({projects.length})</h2>
          <div className="card table-wrap"><table><tbody>
            {projects.map((p) => (
              <tr key={p.id}><td><b>{p.label}</b></td><td className="actions"><Link className="link" to={`/dossie/obra/${encodeURIComponent(p.id)}`}>Ver de quais lotes e certificados saiu o aço</Link></td></tr>
            ))}
          </tbody></table></div>
        </section>
      )}

      {mothers.length > 0 && (
        <section>
          <h2 className="sub">Bobinas mãe / lotes ({mothers.length})</h2>
          <div className="card table-wrap"><table><tbody>
            {mothers.slice(0, 50).map((r) => {
              const m = motherById(r.id)
              return (
                <tr key={r.id}>
                  <td className="mono"><b>Lote {m.slitter_lot}</b></td><td>{m.supplier}</td>
                  <td className="mono">{fmtThickness(m.thickness)} × {m.width} {m.galvanization}</td>
                  <td className="mono">NF {m.supplier_invoice_number}</td><td className="mono">{m.certificate_number || <span className="badge warn">sem certificado</span>}</td>
                  <td className="actions"><Link className="link" to={`/bobinas-mae/${m.id}`}>Ficha</Link><Link className="link" to={`/recall?q=${encodeURIComponent(m.slitter_lot)}`}>Recall</Link></td>
                </tr>
              )
            })}
          </tbody></table></div>
        </section>
      )}

      {coils.length > 0 && (
        <section>
          <h2 className="sub">CUBs ({coils.length})</h2>
          <div className="card table-wrap"><table>
            <thead><tr><th>CUB</th><th>Lote</th><th>Material</th><th>Peso atual</th><th>Última obra</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {coils.slice(0, 100).map((r) => {
                const c = coilById(r.id)
                return (
                  <tr key={r.id}>
                    <td className="mono"><b>{c.cub}</b></td><td className="mono">{c.slitter_lot}</td>
                    <td className="mono">{fmtThickness(c.thickness)} × {c.width} {c.galvanization}</td><td className="mono">{fmtKg(c.current_weight)}</td>
                    <td>{c.last_project ?? '—'}</td><td><span className={`badge ${COIL_STATUS[c.status]?.tone ?? ''}`}>{COIL_STATUS[c.status]?.label}</span></td>
                    <td className="actions"><Link className="link" to={`/cub/${c.cub}`}>Ficha</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
          {coils.length > 100 && <p className="muted foot">Mostrando 100 de {coils.length}. Refine a busca.</p>}
        </section>
      )}

      {uses.length > 0 && (
        <section>
          <h2 className="sub">Usos ({uses.length})</h2>
          <div className="card table-wrap"><table><tbody>
            {uses.slice(0, 50).map((r) => {
              const u = state.uses.find((x) => x.id === r.id)
              const c = coilById(u.coil)
              return (
                <tr key={r.id}>
                  <td className="mono"><b>OP {u.production_order}</b></td><td>{u.project}</td><td className="mono">{c.cub}</td><td className="mono">{fmtKg(u.consumption)}</td>
                  <td className="actions"><Link className="link" to={`/cub/${c.cub}`}>Ficha do CUB</Link></td>
                </tr>
              )
            })}
          </tbody></table></div>
        </section>
      )}
    </>
  )
}
