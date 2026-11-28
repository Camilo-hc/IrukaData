import type { LiveMatchManagement } from '../application/live/service'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import type { StorageHealthPort, StorageStatus } from '../application/ports'
import type { ClubManagement } from '../application/club/service'
import { ClubPage } from './club/ClubPage'
import type { AthleteManagement } from '../application/athletes/service'
import { AthletesPage } from './athletes/AthletesPage'
import type { MembershipManagement } from '../application/memberships/service'
import { RostersPage } from './memberships/RostersPage'
import type { CompetitionManagement } from '../application/competitions/service'
import { CompetitionsPage } from './competitions/CompetitionsPage'
import type { MatchManagement } from '../application/matches/service'
import { MatchesPage } from './matches/MatchesPage'
import type { ReportManagement } from '../application/reports/service'
import type { BackupManagement } from '../application/backup/service'
import { demoAthletes, demoClub, demoMemberships, demoSeason, demoTeams, demoTeamSeasons } from '../demo/data'

const ReportsPage = lazy(async () => ({ default: (await import('./reports/ReportsPage')).ReportsPage }))
const BackupPage = lazy(async () => ({ default: (await import('./backup/BackupPage')).BackupPage }))

function Home() {
  return <>
    <div className="page-heading"><p className="eyebrow">TU CLUB, EN TU DISPOSITIVO</p>
      <h1>Todo comienza<br />con un buen equipo.</h1>
      <p className="lead">Equipos, partidos y estadísticas de vóleibol.<br className="wide-only" /> Una base local para acompañarte dentro y fuera de la cancha.</p>
      <div className="form-actions"><Link className="button" to="/equipos">Gestionar equipos</Link><Link className="button secondary" to="/deportistas">Gestionar deportistas</Link><Link className="button secondary" to="/plantillas">Gestionar plantillas</Link><Link className="button secondary" to="/torneos">Gestionar torneos</Link><Link className="button secondary" to="/partidos">Gestionar partidos</Link><Link className="button secondary" to="/demostracion">Explorar datos de ejemplo</Link></div>
    </div>
    <section className="foundation" aria-labelledby="foundation-title">
      <div className="section-heading"><div><p className="eyebrow">PREPARA TU TEMPORADA</p><h2 id="foundation-title">Organiza tu club</h2></div><span className="tag">Gestión local</span></div>
      <p>Organiza las plantillas y los torneos de tu club, prepara partidos y registra acciones desde la cancha. Los datos se guardan en este dispositivo.</p>
      <div className="feature-grid">
        <article><h3>Equipos por categoría</h3><p>Organiza equipos masculinos y femeninos desde Sub 14 hasta TC, sin mezclar la demostración con tus datos.</p></article>
        <article><h3>Un perfil, varias plantillas</h3><p>Inscribe a cada deportista en sus equipos y temporadas con dorsales independientes, conservando una sola ficha personal.</p></article>
        <article><h3>Anotación en vivo</h3><p>Registra acciones y puntos en la ficha del partido. Puedes retomar el juego sin conexión.</p></article>
      </div>
    </section>
  </>
}

function Demo() {
  return <>
    <div className="page-heading compact"><p className="eyebrow">DEMOSTRACIÓN · SOLO LECTURA</p><h1>Conoce la base<br />de tu equipo.</h1><p className="lead">{demoClub.name} · {demoSeason.name}</p></div>
    <div className="notice">Todos los nombres y equipos son ficticios. Estos ejemplos no se guardan como datos del club.</div>
    <section aria-labelledby="teams-title"><div className="section-heading"><h2 id="teams-title">Equipos de ejemplo</h2><span>{demoTeams.length} equipos</span></div>
      <div className="team-grid">{demoTeams.map((team) => <article className="team-card" key={team.id}><span className="tag subtle">{team.branch === 'femenino' ? 'Femenino' : 'Masculino'}</span><h3>{team.name}</h3><p>{demoSeason.name}</p><span className="team-monogram" aria-hidden="true">{team.category === 'tc' ? 'TC' : team.category.slice(3)}</span></article>)}</div>
    </section>
    <section className="memberships" aria-labelledby="memberships-title"><h2 id="memberships-title">Una persona, distintas inscripciones</h2><p>El dorsal pertenece a cada inscripción; el perfil de la persona es único.</p>
      <div className="table-scroll"><table><caption className="sr-only">Inscripciones ficticias por equipo y dorsal</caption><thead><tr><th scope="col">Deportista</th><th scope="col">Equipo</th><th scope="col">Dorsal</th></tr></thead><tbody>{demoMemberships.map((membership) => {
        const athlete = demoAthletes.find((item) => item.id === membership.athleteId)
        const teamSeason = demoTeamSeasons.find((item) => item.id === membership.teamSeasonId)
        const team = demoTeams.find((item) => item.id === teamSeason?.teamId)
        return <tr key={membership.id}><td>{athlete?.name}</td><td>{team?.name}</td><td><span className="jersey">#{membership.jerseyNumber}</span></td></tr>
      })}</tbody></table></div>
    </section>
  </>
}

interface AppProps {
  storageHealth: StorageHealthPort
  clubManagement: ClubManagement
  athleteManagement: AthleteManagement
  membershipManagement: MembershipManagement
  competitionManagement: CompetitionManagement
  matchManagement: MatchManagement
  liveMatchManagement: LiveMatchManagement
  reportManagement: ReportManagement
  backupManagement: BackupManagement
}

export function App({ storageHealth, clubManagement, athleteManagement, membershipManagement, competitionManagement, matchManagement, liveMatchManagement, reportManagement, backupManagement }: AppProps) {
  const [storage, setStorage] = useState<StorageStatus | 'checking'>('checking')
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    let active = true
    void storageHealth.check().then(
      (result) => { if (active) setStorage(result) },
      () => { if (active) setStorage('unavailable') },
    )
    return () => { active = false }
  }, [storageHealth])

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault()
      main.current?.focus()
    }}>Saltar al contenido</a>
    <header className="app-header">
      <Link className="brand" to="/" aria-label="IrukaData, inicio"><img src="/icon.svg" alt="" width="42" height="42" /><span>Iruka<span className="brand-light">Data</span></span></Link>
      <nav aria-label="Navegación principal">
        <NavLink to="/" end>Inicio</NavLink>
        <NavLink to="/equipos">Equipos</NavLink>
        <NavLink to="/temporadas">Temporadas</NavLink>
        <NavLink to="/deportistas">Deportistas</NavLink>
        <NavLink to="/plantillas">Plantillas</NavLink>
        <NavLink to="/torneos">Torneos</NavLink>
        <NavLink to="/partidos">Partidos</NavLink>
        <NavLink to="/historial">Historial</NavLink>
        <NavLink to="/estadisticas">Estadísticas</NavLink>
        <NavLink to="/respaldos">Respaldos</NavLink>
        <NavLink to="/demostracion">Demostración</NavLink>
      </nav>
      <span className="local-label">Vóleibol · Local</span>
    </header>
    <main id="main-content" ref={main} tabIndex={-1}>
      <Suspense fallback={<p className="page-heading" role="status">Cargando página…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/equipos" element={<ClubPage key="teams" section="teams" management={clubManagement} />} />
          <Route path="/temporadas" element={<ClubPage key="seasons" section="seasons" management={clubManagement} />} />
          <Route path="/deportistas" element={<AthletesPage key="athletes" management={athleteManagement} clubManagement={clubManagement} membershipManagement={membershipManagement} />} />
          <Route path="/deportistas/:athleteId" element={<AthletesPage key="athlete-profile" management={athleteManagement} clubManagement={clubManagement} membershipManagement={membershipManagement} />} />
          <Route path="/plantillas" element={<RostersPage management={membershipManagement} clubManagement={clubManagement} />} />
          <Route path="/plantillas/:teamSeasonId" element={<RostersPage management={membershipManagement} clubManagement={clubManagement} />} />
          <Route path="/torneos" element={<CompetitionsPage management={competitionManagement} />} />
          <Route path="/partidos" element={<MatchesPage management={matchManagement} liveManagement={liveMatchManagement} />} />
          <Route path="/partidos/:matchId" element={<MatchesPage management={matchManagement} liveManagement={liveMatchManagement} />} />
          <Route path="/torneos/:competitionId/partidos" element={<MatchesPage management={matchManagement} liveManagement={liveMatchManagement} />} />
          <Route path="/estadisticas" element={<ReportsPage kind="statistics" management={reportManagement} />} />
          <Route path="/historial" element={<ReportsPage kind="history" management={reportManagement} />} />
          <Route path="/historial/:matchId" element={<ReportsPage kind="history" management={reportManagement} />} />
          <Route path="/respaldos" element={<BackupPage management={backupManagement} />} />
          <Route path="/demostracion" element={<Demo />} />
          <Route path="*" element={<div className="page-heading"><h1>Página no encontrada</h1><Link className="button" to="/">Volver al inicio</Link></div>} />
        </Routes>
      </Suspense>
    </main>
    <footer><span>IrukaData <span className="footer-divider">/</span> Gestión local de vóleibol</span><span role="status" className={storage === 'unavailable' ? 'storage-warning' : ''}>{storage === 'ready' ? 'Almacenamiento local disponible' : storage === 'checking' ? 'Comprobando almacenamiento local…' : 'Almacenamiento local no disponible. No se pueden guardar datos.'}</span></footer>
  </div>
}
