import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import type { StorageHealthPort, StorageStatus } from '../application/ports'
import { demoAthletes, demoClub, demoMemberships, demoSeason, demoTeams, demoTeamSeasons } from '../demo/data'

function Home() {
  return <>
    <div className="page-heading"><p className="eyebrow">TU CLUB, EN TU DISPOSITIVO</p>
      <h1>Todo comienza<br />con un buen equipo.</h1>
      <p className="lead">Equipos, partidos y estadísticas de vóleibol.<br className="wide-only" /> Una base local para acompañarte dentro y fuera de la cancha.</p>
      <Link className="button" to="/demostracion">Explorar datos de ejemplo</Link>
    </div>
    <section className="foundation" aria-labelledby="foundation-title">
      <div className="section-heading"><div><p className="eyebrow">ESTADO DEL PROYECTO</p><h2 id="foundation-title">Los cimientos están listos</h2></div><span className="tag">Hito 0</span></div>
      <p>Esta versión prepara la aplicación. La gestión de equipos y el registro de partidos se incorporarán en los siguientes hitos, previa aprobación.</p>
      <div className="feature-grid">
        <article><h3>En tu dispositivo</h3><p>Base preparada para trabajar sin conexión después de la primera carga de la versión compilada.</p></article>
        <article><h3>Un perfil por persona</h3><p>Datos de ejemplo con inscripciones en distintas categorías y dorsales independientes.</p></article>
        <article><h3>La cancha como prioridad</h3><p>El futuro panel reunirá acciones, cambios oficiales y líbero en una misma pantalla.</p></article>
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

export function App({ storageHealth }: { storageHealth: StorageHealthPort }) {
  const [storage, setStorage] = useState<StorageStatus | 'checking'>('checking')
  useEffect(() => {
    let active = true
    void storageHealth.check().then(
      (result) => { if (active) setStorage(result) },
      () => { if (active) setStorage('unavailable') },
    )
    return () => { active = false }
  }, [storageHealth])

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <header className="app-header"><Link className="brand" to="/" aria-label="IrukaData, inicio"><img src="/icon.svg" alt="" width="42" height="42" /><span>Iruka<span className="brand-light">Data</span></span></Link><nav aria-label="Navegación principal"><NavLink to="/" end>Inicio</NavLink><NavLink to="/demostracion">Demostración</NavLink></nav><span className="local-label">Vóleibol · Local</span></header>
    <main id="main-content"><Routes><Route path="/" element={<Home />} /><Route path="/demostracion" element={<Demo />} /><Route path="*" element={<div className="page-heading"><h1>Página no encontrada</h1><Link className="button" to="/">Volver al inicio</Link></div>} /></Routes></main>
    <footer><span>IrukaData <span className="footer-divider">/</span> Hito 0 · Estructura inicial</span><span role="status" className={storage === 'unavailable' ? 'storage-warning' : ''}>{storage === 'ready' ? 'Almacenamiento local disponible' : storage === 'checking' ? 'Comprobando almacenamiento local…' : 'Almacenamiento local no disponible. No se pueden guardar datos.'}</span></footer>
  </div>
}
