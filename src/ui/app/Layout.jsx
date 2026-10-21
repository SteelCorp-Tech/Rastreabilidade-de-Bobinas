import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import Icon from '../components/Icon.jsx'
import { ROLES } from '../../domain/permissions.js'
import { MODULES } from './modules.js'
import { useProfile } from './ProfileContext.jsx'
import logo from '../../assets/steelcorp-logo.png'
import symbol from '../../assets/steelcorp-symbol.png'

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
        <span className="profile-meta">Gustavo Oliveira · {roleLabel}</span>
        <span className="avatar">{roleLabel.slice(0, 2).toUpperCase()}</span>
      </button>
    </div>
  )
}

export default function Layout() {
  const { canView } = useProfile()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const mainRef = useRef(null)
  const { pathname } = useLocation()
  // só a área de conteúdo rola; ao trocar de tela, volta ao topo
  useLayoutEffect(() => { mainRef.current?.scrollTo(0, 0) }, [pathname])
  // atalho do portal: "/" abre a busca universal (fora de campos de texto)
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      e.preventDefault()
      navigate('/consulta')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
  const items = MODULES.filter((m) => canView(m.view))
  const groups = [...new Set(items.map((m) => m.group))]
  const current = MODULES.filter((m) => (m.path === '/' ? pathname === '/' : pathname.startsWith(m.path))).sort((a, b) => b.path.length - a.path.length)[0]
  const title = current?.label ?? 'Bobinas'

  return (
    <div className="shell">
      <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
        <div className="brand">
          <img className="brand-full" src={logo} alt="Grupo SteelCorp" />
          <img className="brand-short" src={symbol} alt="SteelCorp" />
        </div>
        <nav className="nav" aria-label="Módulos">
          <div className="nav-group nav-title">Rastreabilidade · Bobinas</div>
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
      </aside>
      <div className="workspace">
        <header className="topbar">
          <b>{title}</b>
          <ProfileCard />
        </header>
        <main className="main" ref={mainRef}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
