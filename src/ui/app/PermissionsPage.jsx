import { useEffect, useState } from 'react'
import Seg from '../components/Seg.jsx'
import { useAction } from '../components/useAction.js'
import { useProfile } from './ProfileContext.jsx'
import { useStore } from './StoreContext.jsx'
import { ACTIONS, LOCKED_ROLES, ROLES, VIEWS, effectivePermissions, hasOverride } from '../../domain/permissions.js'
import { resetRolePermissions, updateRolePermissions } from '../../domain/registryCommands.js'

const GROUPS = [...new Set(ACTIONS.map((a) => a.group))]

/** Tela do administrador: o que cada perfil enxerga e pode fazer. */
export default function PermissionsPage() {
  const { state, run } = useStore()
  const { can } = useProfile()
  const { error, busy, exec, clearError } = useAction()
  const editable = can('permissions.edit')
  const [role, setRole] = useState('PCP')
  const [actions, setActions] = useState([])
  const [views, setViews] = useState([])
  const [saved, setSaved] = useState('')

  const locked = LOCKED_ROLES.includes(role)
  const readOnlyActions = role === 'AUDITOR'
  const current = effectivePermissions(role, state.permissions)

  useEffect(() => {
    setActions(current.actions)
    setViews(current.views)
  }, [role, state.permissions]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSaved(''); clearError() }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (list, setList, id) => { setSaved(''); setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]) }
  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
  const dirty = !same(actions, current.actions) || !same(views, current.views)

  const save = () => exec(async () => {
    await run(updateRolePermissions, { role, actions, views })
    setSaved('Permissões salvas. Valem na hora para quem usa este perfil.')
  })
  const reset = () => exec(async () => {
    await run(resetRolePermissions, { role })
    setSaved('Perfil restaurado ao padrão.')
  })

  const roleOptions = ROLES.map((r) => ({ value: r.id, label: r.label + (hasOverride(r.id, state.permissions) ? ' •' : '') }))

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Sistema</div>
          <h1>Permissões dos perfis</h1>
          <p className="muted">Escolha um perfil e marque o que ele vê no menu e o que pode fazer. O ponto (•) indica perfil com alteração.</p>
        </div>
        {!editable && <span className="badge">Somente o administrador altera</span>}
      </div>

      <Seg options={roleOptions} value={role} onChange={setRole} label="Perfil" />

      <div className="perm-grid">
        <div className="card panel wide">
          <h2>Telas do menu</h2>
          {VIEWS.map((v) => {
            const on = views.includes(v.id)
            const fixed = v.fixed || v.adminOnly || locked
            return (
              <label key={v.id} className="check perm-row">
                <input type="checkbox" checked={on} disabled={!editable || fixed} onChange={() => toggle(views, setViews, v.id)} />
                <span><b>{v.label}</b>{v.fixed && <small className="muted"> sempre visível</small>}{v.adminOnly && <small className="muted"> só o administrador</small>}</span>
              </label>
            )
          })}
        </div>

        <div className="card panel wide">
          <h2>O que pode fazer</h2>
          {readOnlyActions && <p className="muted">O auditor é somente leitura: não recebe ações.</p>}
          {GROUPS.map((g) => (
            <div key={g} className="perm-group">
              <span className="eyebrow">{g}</span>
              {ACTIONS.filter((a) => a.group === g).map((a) => {
                const on = actions.includes(a.id)
                const fixed = a.adminOnly || locked || readOnlyActions
                return (
                  <label key={a.id} className="check perm-row">
                    <input type="checkbox" checked={locked || on} disabled={!editable || fixed} onChange={() => toggle(actions, setActions, a.id)} />
                    <span>{a.label}{a.adminOnly && !locked && <small className="muted"> só o administrador</small>}</span>
                  </label>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {locked && <p className="muted">O administrador sempre pode tudo; assim ninguém fica sem acesso às configurações.</p>}
      {error && <div className="err" role="alert">{error}</div>}
      {saved && <p className="ok-msg">{saved}</p>}
      {editable && !locked && (
        <div className="actions-row save-row">
          <button className="btn" onClick={save} disabled={busy || !dirty}>Salvar alterações</button>
          <button className="btn ghost" onClick={() => { setActions(current.actions); setViews(current.views); setSaved('') }} disabled={!dirty}>Descartar</button>
          {hasOverride(role, state.permissions) && <button className="btn ghost" onClick={reset} disabled={busy}>Restaurar padrão do perfil</button>}
        </div>
      )}
    </>
  )
}
