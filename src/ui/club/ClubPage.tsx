import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Club, Season, Team } from '../../domain/club/contracts'
import { BRANCHES, CATEGORIES, nameKey } from '../../domain/club/validation'
import type { ClubManagement } from '../../application/club/service'
import { ClubForm, SeasonForm, TeamForm } from './ClubForms'
import { useClubCatalog } from './useClubCatalog'
import { useSave } from './useSave'

type Editor = { kind: 'club'; current: Club } | { kind: 'team'; current: Team | null } | { kind: 'season'; current: Season | null } | null

export function ClubPage({ section, management }: { section: 'teams' | 'seasons'; management: ClubManagement }) {
  const { catalog, failed, retry } = useClubCatalog(management)
  const [editor, setEditor] = useState<Editor>(null)
  const [notice, setNotice] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [filters, setFilters] = useState({ search: '', branch: '', category: '', seasonId: '' })
  const mutation = useSave(setNotice)
  const teamsSection = section === 'teams'
  const title = teamsSection ? 'Equipos' : 'Temporadas'
  const saved = (message: string) => { setEditor(null); setNotice(message) }

  if (failed) return <section className="page-heading"><h1>{title}</h1><p role="alert">No se pudieron leer los datos locales. Revisa si tu navegador permite almacenarlos y vuelve a intentarlo.</p><button className="button" onClick={retry}>Volver a intentar</button></section>
  if (!catalog) return <section className="page-heading"><h1>{title}</h1><p role="status">Cargando datos del club…</p></section>
  if (!catalog.club) return <section className="club-page"><div className="page-heading compact"><p className="eyebrow">COMIENZA CON TU CLUB</p><h1>{title}</h1></div><ClubForm management={management} current={null} onSaved={saved} /></section>

  const club = catalog.club
  const teams = catalog.teams.filter((team) => team.active !== showArchived
    && nameKey(team.name).includes(nameKey(filters.search))
    && (!filters.branch || team.branch === filters.branch)
    && (!filters.category || team.category === filters.category)
    && (!filters.seasonId || catalog.teamSeasons.some((link) => link.active && link.teamId === team.id && link.seasonId === filters.seasonId)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const seasons = catalog.seasons.filter((season) => season.active !== showArchived).sort((a, b) => b.start.localeCompare(a.start))

  return <section className="club-page">
    <div className="page-heading compact"><p className="eyebrow">{club.name}</p><div className="section-heading"><h1>{title}</h1><button className="button secondary" disabled={Boolean(editor) || mutation.busy} onClick={() => setEditor({ kind: 'club', current: club })}>Editar club</button></div><p className="lead">{teamsSection ? 'Organiza tus equipos por rama, categoría y temporada.' : 'Define las temporadas para organizar equipos e inscripciones.'}</p></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {mutation.result && !mutation.result.ok && <p className="form-error" role="alert">{mutation.result.message}</p>}
    {editor?.kind === 'club' && <ClubForm key={`club-${editor.current.revision}`} current={editor.current} management={management} onSaved={saved} onCancel={() => setEditor(null)} />}
    {editor?.kind === 'team' && <TeamForm key={editor.current?.id ?? 'new-team'} current={editor.current} club={club} catalog={catalog} management={management} onSaved={saved} onCancel={() => setEditor(null)} />}
    {editor?.kind === 'season' && <SeasonForm key={editor.current?.id ?? 'new-season'} current={editor.current} management={management} onSaved={saved} onCancel={() => setEditor(null)} />}
    <div className="catalog-toolbar"><button className="button" disabled={Boolean(editor) || mutation.busy} onClick={() => { setNotice(''); setEditor(teamsSection ? { kind: 'team', current: null } : { kind: 'season', current: null }) }}>{teamsSection ? 'Nuevo equipo' : 'Nueva temporada'}</button><Link className="text-link" to={teamsSection ? '/temporadas' : '/equipos'}>{teamsSection ? 'Gestionar temporadas' : 'Gestionar equipos'}</Link><label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Ver solo {teamsSection ? 'equipos archivados' : 'temporadas archivadas'}</label></div>
    {teamsSection && <div className="catalog-filters">
      <div className="field"><label htmlFor="filter-search">Buscar equipo</label><input id="filter-search" type="search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div>
      <div className="field"><label htmlFor="filter-branch">Filtrar por rama</label><select id="filter-branch" value={filters.branch} onChange={(event) => setFilters({ ...filters, branch: event.target.value })}><option value="">Todas las ramas</option>{Object.entries(BRANCHES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="field"><label htmlFor="filter-category">Filtrar por categoría</label><select id="filter-category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">Todas las categorías</option>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="field"><label htmlFor="filter-season">Filtrar por temporada</label><select id="filter-season" value={filters.seasonId} onChange={(event) => setFilters({ ...filters, seasonId: event.target.value })}><option value="">Todas las temporadas</option>{catalog.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{!season.active && ' (archivada)'}</option>)}</select></div>
    </div>}
    <p className="catalog-help">Archivar conserva los datos y sus asociaciones. Puedes restaurarlos desde la vista de archivados.</p>
    {teamsSection ? teams.length ? <div className="table-scroll"><table><caption className="sr-only">Equipos del club</caption><thead><tr><th scope="col">Equipo</th><th scope="col">Rama y categoría</th><th scope="col">Temporadas</th><th scope="col">Acciones</th></tr></thead><tbody>{teams.map((team) => {
      const assigned = catalog.teamSeasons.filter((link) => link.teamId === team.id && link.active)
      return <tr key={team.id}><th scope="row">{team.name}</th><td>{BRANCHES[team.branch]} · {CATEGORIES[team.category]}</td><td>{assigned.length ? assigned.map((link) => {
        const season = catalog.seasons.find((item) => item.id === link.seasonId)
        return season && <Link className="season-tag" key={link.id} to={`/plantillas/${encodeURIComponent(link.id)}`}>{season.name}{!season.active && ' (archivada)'}</Link>
      }) : 'Sin temporada'}</td><td><div className="row-actions">{team.active && <button className="button secondary" aria-label={`Editar equipo ${team.name}`} disabled={Boolean(editor) || mutation.busy} onClick={() => setEditor({ kind: 'team', current: team })}>Editar</button>}<button className="button secondary" aria-label={`${team.active ? 'Archivar' : 'Restaurar'} equipo ${team.name}`} disabled={Boolean(editor) || mutation.busy} onClick={() => { void mutation.run(() => management.setTeamActive(team, !team.active), team.active ? 'Equipo archivado. Sus datos se conservan.' : 'Equipo restaurado.') }}>{team.active ? 'Archivar' : 'Restaurar'}</button></div></td></tr>
    })}</tbody></table></div> : <div className="empty-state">No hay equipos para esta vista. {showArchived ? 'Los equipos archivados aparecerán aquí.' : 'Crea un equipo o ajusta los filtros.'}</div>
      : seasons.length ? <div className="table-scroll"><table><caption className="sr-only">Temporadas del club</caption><thead><tr><th scope="col">Temporada</th><th scope="col">Inicio</th><th scope="col">Término</th><th scope="col">Acciones</th></tr></thead><tbody>{seasons.map((season) => <tr key={season.id}><th scope="row">{season.name}</th><td>{season.start.split('-').reverse().join('-')}</td><td>{season.end.split('-').reverse().join('-')}</td><td><div className="row-actions">{season.active && <button className="button secondary" aria-label={`Editar temporada ${season.name}`} disabled={Boolean(editor) || mutation.busy} onClick={() => setEditor({ kind: 'season', current: season })}>Editar</button>}<button className="button secondary" aria-label={`${season.active ? 'Archivar' : 'Restaurar'} temporada ${season.name}`} disabled={Boolean(editor) || mutation.busy} onClick={() => { void mutation.run(() => management.setSeasonActive(season, !season.active), season.active ? 'Temporada archivada. Sus asociaciones se conservan.' : 'Temporada restaurada.') }}>{season.active ? 'Archivar' : 'Restaurar'}</button></div></td></tr>)}</tbody></table></div> : <div className="empty-state">{showArchived ? 'No hay temporadas archivadas.' : 'Todavía no hay temporadas. Crea la primera para asociar tus equipos.'}</div>}
  </section>
}
