import { Link } from 'react-router-dom'
import type { Athlete } from '../../domain/club/contracts'
import { BRANCHES, CATEGORIES } from '../../domain/club/validation'
import { ATHLETE_ROLES, resolveRoster, rosterIsActive } from '../../domain/memberships/validation'
import type { MembershipManagement } from '../../application/memberships/service'
import { useMembershipDirectory } from './useMembershipDirectory'

export function AthleteMemberships({ athlete, management }: { athlete: Athlete; management: MembershipManagement }) {
  const { directory, failed, retry } = useMembershipDirectory(management)
  if (failed) return <section className="profile-memberships"><h2>Inscripciones</h2><p role="alert">No se pudieron leer las inscripciones del deportista.</p><button className="button secondary" onClick={retry}>Volver a intentar</button></section>
  if (!directory) return <section className="profile-memberships"><h2>Inscripciones</h2><p>Cargando inscripciones…</p></section>
  const memberships = directory.memberships.filter((membership) => membership.athleteId === athlete.id)
  return <section className="profile-memberships" aria-label="Inscripciones del deportista"><div className="section-heading"><h2>Inscripciones</h2><Link className="text-link" to="/plantillas">Ver plantillas</Link></div>
    {memberships.length ? <div className="table-scroll"><table><caption className="sr-only">Equipos y dorsales del deportista</caption><thead><tr><th scope="col">Equipo</th><th scope="col">Temporada</th><th scope="col">Dorsal</th><th scope="col">Rol habitual</th><th scope="col">Estado</th></tr></thead><tbody>{memberships.map((membership) => {
      const context = resolveRoster(membership.teamSeasonId, directory.teamSeasons, directory.teams, directory.seasons)
      return <tr key={membership.id}><th scope="row">{context ? <><Link className="text-link" to={`/plantillas/${encodeURIComponent(context.teamSeason.id)}`}>{context.team.name}</Link><span className="record-status">{BRANCHES[context.team.branch]} · {CATEGORIES[context.team.category]}</span></> : 'Plantilla no disponible'}</th><td>{context?.season.name ?? 'No disponible'}</td><td className="jersey">#{membership.jerseyNumber}</td><td>{ATHLETE_ROLES[membership.usualRole]}</td><td>{membership.active ? 'Activa' : 'Archivada'}{context && !rosterIsActive(context) && <span className="record-status">Plantilla inactiva</span>}{!athlete.active && <span className="record-status">Deportista archivado</span>}</td></tr>
    })}</tbody></table></div> : <p>Este deportista todavía no tiene inscripciones. Elige una plantilla para incorporarlo a un equipo y temporada.</p>}
  </section>
}
