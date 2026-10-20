import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import Icon from '../components/Icon.jsx'
import { ROLES } from '../../domain/permissions.js'
import { MODULES } from './modules.js'
import { useProfile } from './ProfileContext.jsx'

function ProfileCard() {
  const { role, setRole, roleLabel } = useProfile()
  const [open, setOpen] = useState(false)
  return (
    <div className="profile">
      {open && (
        <div className="profile-menu" role="menu">
          <span className="eyebrow">Simular perfil</span>
          {ROLES.map((r) => (
            <button
              key={r.id}
              role="menuitem"
              aria-current={r.id === role}
              onClick={() => {
                setRole(r.id)
                setOpen(false)
              }}
            >
              {r.label}
              {r.id === role && <span>●</span>}
            </button>
          ))}
        </div>
      )}
      <button className="profile-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="avatar">{roleLabel.slice(0, 2).toUpperCase()}</span>
        <span className="profile-meta">
          <b>Gustavo Oliveira</b>
          <small>{roleLabel}</small>
        </span>
        <Icon name="updown" size={16} />
      </button>
    </div>
  )
}

export default function Layout() {
  const { canView } = useProfile()
  const [collapsed, setCollapsed] = useState(false)
  const items = MODULES.filter((m) => canView(m.view))
  const groups = [...new Set(items.map((m) => m.group))]

  return (
    <div className="shell">
      <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
        <div className="brand">
          <b className="brand-full">
            Steel<span>Corp</span>
          </b>
          <b className="brand-short">
            S<span>C</span>
          </b>
          <small>BOBINAS</small>
        </div>
        <nav className="nav" aria-label="Módulos">
          {groups.map((g) => (
            <div key={g ?? 'topo'}>
              {g && <div className="nav-group">{g}</div>}
              {items
                .filter((m) => m.group === g)
                .map((m) => (
                  <NavLink key={m.path} to={m.path} end={m.path === '/'} title={m.label}>
                    <Icon name={m.icon} />
                    <span>{m.label}</span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <button className="collapse-btn" onClick={() => setCollapsed((v) => !v)}>
          <Icon name="chevrons" />
          <span>{collapsed ? 'Expandir menu' : 'Recolher menu'}</span>
        </button>
        <ProfileCard />
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
