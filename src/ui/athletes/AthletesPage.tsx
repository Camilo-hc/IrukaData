import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Athlete } from '../../domain/club/contracts'
import { athleteSearchKey } from '../../domain/athletes/validation'
import type { AthleteManagement } from '../../application/athletes/service'
import type { ClubManagement } from '../../application/club/service'
import { ClubForm } from '../club/ClubForms'
import { useSave } from '../shared/useSave'
import { AthleteForm } from './AthleteForm'
import { useAthleteDirectory } from './useAthleteDirectory'
import type { MembershipManagement } from '../../application/memberships/service'
import { AthleteMemberships } from '../memberships/AthleteMemberships'

interface Props { management: AthleteManagement; clubManagement: ClubManagement; membershipManagement: MembershipManagement }
function birthDateLabel(athlete: Athlete): string {
  return athlete.birthDate ? athlete.birthDate.split('-').reverse().join('-') : 'No registrada'
}

export function AthletesPage({ management, clubManagement, membershipManagement }: Props) {
  const { athleteId } = useParams<{ athleteId: string }>()
  const { directory, failed, retry } = useAthleteDirectory(management)
  const [editor, setEditor] = useState<Athlete | null | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [notice, setNotice] = useState('')
  const mutation = useSave(setNotice)
  function saved(message: string) {
    if (editor === null) { setSearch(''); setShowArchived(false) }
    setEditor(undefined)
    setNotice(message)
  }

  if (failed) return <section className="page-heading"><h1>Deportistas</h1><p role="alert">No se pudieron leer los perfiles locales. Revisa si tu navegador permite almacenarlos y vuelve a intentarlo.</p><button className="button" onClick={retry}>Volver a intentar</button></section>
  if (!directory) return <section className="page-heading"><h1>Deportistas</h1><p role="status">Cargando deportistas…</p></section>
  if (!directory.club) return <section className="club-page"><div className="page-heading compact"><p className="eyebrow">COMIENZA CON TU CLUB</p><h1>Deportistas</h1></div><ClubForm current={null} management={clubManagement} onSaved={saved} /></section>

  const profile = athleteId ? directory.athletes.find((athlete) => athlete.id === athleteId) : undefined
  if (athleteId && !profile) return <section className="page-heading"><h1>Deportista no encontrado</h1><p>No se encontró este perfil en los datos de este dispositivo.</p><Link className="button" to="/deportistas">Volver a deportistas</Link></section>
  const athletes = directory.athletes.filter((athlete) => athlete.active !== showArchived && athleteSearchKey(athlete.name).includes(athleteSearchKey(search)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || (a.birthDate ?? '').localeCompare(b.birthDate ?? '') || a.id.localeCompare(b.id))

  function archive(athlete: Athlete) {
    setNotice('')
    void mutation.run(() => management.setActive(athlete, !athlete.active), athlete.active ? 'Deportista archivado. Su perfil se conserva.' : 'Deportista restaurado.')
  }

  return <section className="club-page athlete-page">
    <div className="page-heading compact">
      <p className="eyebrow">{directory.club.name}</p>
      {profile && <Link className="text-link" to="/deportistas">Volver a deportistas</Link>}
      <h1>{profile ? profile.name : 'Deportistas'}</h1>
      <p className="lead">{profile ? 'Ficha del deportista' : 'Consulta y gestiona los perfiles de tu club.'}</p>
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {mutation.result && !mutation.result.ok && <p className="form-error" role="alert">{mutation.result.message}</p>}
    {editor !== undefined && <AthleteForm key={editor?.id ?? 'new-athlete'} current={editor} athletes={directory.athletes} management={management} onSaved={saved} onCancel={() => setEditor(undefined)} />}
    {profile ? <article className="athlete-profile" aria-label="Ficha del deportista">
      <div className="section-heading"><h2>Datos personales</h2><span className={`tag${profile.active ? '' : ' subtle'}`}>{profile.active ? 'Activo' : 'Archivado'}</span></div>
      <dl className="profile-fields"><div><dt>Nombre</dt><dd>{profile.name}</dd></div><div><dt>Fecha de nacimiento</dt><dd>{birthDateLabel(profile)}</dd></div><div className="full-width"><dt>Notas</dt><dd className="athlete-notes">{profile.notes ?? 'Sin notas.'}</dd></div></dl>
      <div className="form-actions">
        <Link className="button secondary" to={'/estadisticas?deportista=' + encodeURIComponent(profile.id)}>Ver estadísticas</Link>
        <Link className="button secondary" to={'/historial?deportista=' + encodeURIComponent(profile.id)}>Ver historial de partidos</Link>
        {profile.active && <button className="button" disabled={editor !== undefined || mutation.busy} onClick={() => { setNotice(''); setEditor(profile) }}>Editar perfil</button>}
        <button className="button secondary" disabled={editor !== undefined || mutation.busy} onClick={() => archive(profile)}>{profile.active ? 'Archivar deportista' : 'Restaurar deportista'}</button>
      </div>
      <p className="catalog-help">El dorsal pertenece a cada inscripción de equipo y temporada.</p>
      <AthleteMemberships athlete={profile} management={membershipManagement} />
    </article> : <>
      <div className="catalog-toolbar">
        <button className="button" disabled={editor !== undefined || mutation.busy} onClick={() => { setNotice(''); setEditor(null) }}>Nuevo deportista</button>
        <label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Ver solo deportistas archivados</label>
      </div>
      <div className="field athlete-search"><label htmlFor="athlete-search">Buscar deportista por nombre</label><input id="athlete-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <p className="catalog-help">Un perfil por persona. Archivar conserva su identidad y permite restaurarlo.</p>
      {athletes.length ? <div className="table-scroll"><table><caption className="sr-only">Deportistas del club</caption>
        <thead><tr><th scope="col">Deportista</th><th scope="col">Nacimiento</th><th scope="col">Acciones</th></tr></thead>
        <tbody>{athletes.map((athlete) => <tr key={athlete.id}>
          <th scope="row"><Link className="text-link" to={`/deportistas/${athlete.id}`}>{athlete.name}</Link></th>
          <td>{birthDateLabel(athlete)}</td>
          <td><div className="row-actions">
            {athlete.active && <button className="button secondary" aria-label={`Editar deportista ${athlete.name}`} disabled={editor !== undefined || mutation.busy} onClick={() => { setNotice(''); setEditor(athlete) }}>Editar</button>}
            <button className="button secondary" aria-label={`${athlete.active ? 'Archivar' : 'Restaurar'} deportista ${athlete.name}`} disabled={editor !== undefined || mutation.busy} onClick={() => archive(athlete)}>{athlete.active ? 'Archivar' : 'Restaurar'}</button>
          </div></td>
        </tr>)}</tbody>
      </table></div> : <div className="empty-state">{showArchived ? 'No hay deportistas archivados para esta búsqueda.' : 'No hay deportistas para esta búsqueda. Crea un perfil o ajusta el nombre.'}</div>}
    </>}
  </section>
}
