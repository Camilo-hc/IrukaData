import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { RosterMembership } from '../../domain/club/contracts'
import { BRANCHES, CATEGORIES } from '../../domain/club/validation'
import { ATHLETE_ROLES, resolveRoster, rosterIsActive } from '../../domain/memberships/validation'
import type { MembershipManagement } from '../../application/memberships/service'
import type { ClubManagement } from '../../application/club/service'
import { ClubForm } from '../club/ClubForms'
import { useSave } from '../shared/useSave'
import { MembershipForm } from './MembershipForm'
import { useMembershipDirectory } from './useMembershipDirectory'

interface Props { management: MembershipManagement; clubManagement: ClubManagement }

export function RostersPage(props: Props) {
  const { teamSeasonId } = useParams<{ teamSeasonId: string }>()
  return <RosterWorkspace key={teamSeasonId ?? 'index'} {...props} teamSeasonId={teamSeasonId} />
}

function RosterWorkspace({ management, clubManagement, teamSeasonId }: Props & { teamSeasonId: string | undefined }) {
  const { directory, failed, retry } = useMembershipDirectory(management)
  const [editor, setEditor] = useState<RosterMembership | null | undefined>(undefined)
  const [showArchived, setShowArchived] = useState(false)
  const [showInactiveRosters, setShowInactiveRosters] = useState(false)
  const [notice, setNotice] = useState('')
  const mutation = useSave(setNotice)
  function saved(message: string) { if (editor === null) setShowArchived(false); mutation.clearResult(); setEditor(undefined); setNotice(message) }

  if (failed) return <section className="page-heading"><h1>Plantillas</h1><p role="alert">No se pudieron leer las inscripciones locales.</p><button className="button" onClick={retry}>Volver a intentar</button></section>
  if (!directory) return <section className="page-heading"><h1>Plantillas</h1><p role="status">Cargando plantillas…</p></section>
  if (!directory.club) return <section className="club-page"><div className="page-heading compact"><h1>Plantillas</h1></div><ClubForm current={null} management={clubManagement} onSaved={saved} /></section>
  const context = teamSeasonId ? resolveRoster(teamSeasonId, directory.teamSeasons, directory.teams, directory.seasons) : undefined
  if (teamSeasonId && !context) return <section className="page-heading"><h1>Plantilla no encontrada</h1><p>No se encontró esta asociación de equipo y temporada en este dispositivo.</p><Link className="button" to="/plantillas">Volver a plantillas</Link></section>

  if (!context) {
    const rosters = directory.teamSeasons.map((link) => resolveRoster(link.id, directory.teamSeasons, directory.teams, directory.seasons))
      .filter((item) => item !== undefined)
      .filter((item) => showInactiveRosters || rosterIsActive(item))
      .sort((a, b) => b.season.start.localeCompare(a.season.start) || a.team.name.localeCompare(b.team.name, 'es'))
    return <section className="club-page"><div className="page-heading compact"><p className="eyebrow">{directory.club.name}</p><h1>Plantillas</h1><p className="lead">Elige un equipo y temporada para gestionar sus inscripciones.</p></div>
      <div className="catalog-toolbar"><Link className="button secondary" to="/equipos">Gestionar equipos</Link><label className="checkbox-label"><input type="checkbox" checked={showInactiveRosters} onChange={(event) => setShowInactiveRosters(event.target.checked)} />Incluir plantillas archivadas o desvinculadas</label></div>
      {rosters.length ? <div className="roster-grid">{rosters.map((item) => <Link className="roster-card" key={item.teamSeason.id} to={`/plantillas/${encodeURIComponent(item.teamSeason.id)}`}>
        <span className="tag subtle">{BRANCHES[item.team.branch]} · {CATEGORIES[item.team.category]}</span><h2>{item.team.name}</h2><p>{item.season.name}</p><span>{rosterIsActive(item) ? 'Activa' : 'Archivada o desvinculada'} · {directory.memberships.filter((membership) => membership.teamSeasonId === item.teamSeason.id && membership.active).length} inscripciones activas</span>
      </Link>)}</div> : <div className="empty-state">No hay plantillas para esta vista. Asocia un equipo a una temporada desde Equipos.</div>}
    </section>
  }

  const active = rosterIsActive(context)
  const memberships = directory.memberships.filter((membership) => membership.teamSeasonId === context.teamSeason.id && membership.active !== showArchived)
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber || a.id.localeCompare(b.id))
  return <section className="club-page">
    <div className="page-heading compact"><p className="eyebrow">{directory.club.name}</p><Link className="text-link" to="/plantillas">Volver a plantillas</Link><h1>{context.team.name}</h1><p className="lead">Plantel · {context.season.name}</p><Link className="text-link" to={`/torneos?plantilla=${encodeURIComponent(context.teamSeason.id)}`}>Ver torneos de esta plantilla</Link><span className="tag subtle">{BRANCHES[context.team.branch]} · {CATEGORIES[context.team.category]}</span></div>
    {!active && <p className="notice">Esta plantilla está archivada o desvinculada. Puedes consultar y archivar inscripciones. Para inscribir, editar o restaurar, reactiva el equipo, la temporada y su asociación.</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {mutation.result && !mutation.result.ok && <p className="form-error" role="alert">{mutation.result.message}</p>}
    {editor !== undefined && <MembershipForm key={editor?.id ?? 'new-membership'} current={editor} context={context} directory={directory} management={management} onSaved={saved} onCancel={() => setEditor(undefined)} />}
    <div className="catalog-toolbar"><button className="button" disabled={!active || editor !== undefined || mutation.busy} onClick={() => { mutation.clearResult(); setNotice(''); setEditor(null) }}>Inscribir deportista</button><label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Ver solo inscripciones archivadas</label></div>
    <p className="catalog-help">Cada dorsal se reserva mientras la inscripción esté activa, aunque se archive el perfil. Archivar la inscripción libera el dorsal; restaurarla exige que esté disponible.</p>
    {memberships.length ? <div className="table-scroll"><table><caption className="sr-only">Inscripciones de la plantilla</caption><thead><tr><th scope="col">Dorsal</th><th scope="col">Deportista</th><th scope="col">Rol habitual</th><th scope="col">Acciones</th></tr></thead><tbody>{memberships.map((membership) => {
      const athlete = directory.athletes.find((item) => item.id === membership.athleteId)
      const canEdit = active && Boolean(athlete?.active)
      return <tr key={membership.id}><td className="jersey">#{membership.jerseyNumber}</td><th scope="row">{athlete ? <Link className="text-link" to={`/deportistas/${athlete.id}`}>{athlete.name}</Link> : 'Perfil no disponible'}{athlete && !athlete.active && <span className="record-status">Deportista archivado</span>}</th><td>{ATHLETE_ROLES[membership.usualRole]}</td><td><div className="row-actions">
        <button className="button secondary" disabled={!canEdit || editor !== undefined || mutation.busy} aria-label={`Editar inscripción de ${athlete?.name ?? 'perfil no disponible'}`} onClick={() => { mutation.clearResult(); setNotice(''); setEditor(membership) }}>Editar</button>
        <button className="button secondary" disabled={editor !== undefined || mutation.busy || (!membership.active && !canEdit)} aria-label={`${membership.active ? 'Archivar' : 'Restaurar'} inscripción de ${athlete?.name ?? 'perfil no disponible'}`} onClick={() => { setNotice(''); void mutation.run(() => management.setActive(membership, !membership.active), membership.active ? 'Inscripción archivada. El dorsal queda disponible.' : 'Inscripción restaurada.') }}>{membership.active ? 'Archivar' : 'Restaurar'}</button>
      </div></td></tr>
    })}</tbody></table></div> : <div className="empty-state">{showArchived ? 'No hay inscripciones archivadas en esta plantilla.' : 'Todavía no hay inscripciones activas en esta plantilla.'}</div>}
  </section>
}
