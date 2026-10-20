import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import { MODULES } from './modules.js'
import { useProfile } from './ProfileContext.jsx'

function saudacao(d) {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(d))
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function dataExtenso(d) {
  const fmt = (o) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(d)
  const dia = fmt({ weekday: 'long' }).split('-')[0]
  return `${dia} · ${fmt({ day: '2-digit' })} ${fmt({ month: 'short' }).replace('.', '')} ${fmt({ year: 'numeric' })}`
}

export default function Home() {
  const { canView } = useProfile()
  const now = new Date()
  const tiles = MODULES.filter((m) => m.view !== 'home' && canView(m.view))
  const groups = [...new Set(tiles.map((m) => m.group))]

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{dataExtenso(now)}</div>
          <h1>{saudacao(now)}, Gustavo.</h1>
        </div>
        <div className="card pending-card">
          <Icon name="alert" size={28} />
          <div>
            <b>Pendências de certificado</b>
            <small>Disponível quando houver dados (incremento 2)</small>
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g ?? 'topo'}>
          <div className="section-title">
            <h2>{g ?? 'Atalhos'}</h2>
            <span className="badge">{tiles.filter((m) => m.group === g).length}</span>
          </div>
          <div className="grid-tiles">
            {tiles
              .filter((m) => m.group === g)
              .map((m) => (
                <Link key={m.path} to={m.path} className="card tile">
                  <Icon name={m.icon} size={26} />
                  <h3>{m.label}</h3>
                  <p>{m.desc}</p>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </>
  )
}
