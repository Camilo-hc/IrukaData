import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { CompetitionManagement } from '../../application/competitions/service'
import type { Competition } from '../../domain/club/contracts'
import { nameKey } from '../../domain/shared/validation'
import { CompetitionForm } from './CompetitionForm'
import { teamSeasonLabel } from './labels'
import { useCompetitionDirectory } from './useCompetitionDirectory'
import { useSave } from '../shared/useSave'

export function CompetitionsPage({ management }: { management: CompetitionManagement }) {
  const { directory, failed, retry } = useCompetitionDirectory(management)
  const [editor, setEditor] = useState<{ current: Competition | null } | null>(null)
  const [notice, setNotice] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [filters, setFilters] = useState({ search: '', seasonId: '' })
  const [params, setParams] = useSearchParams()
  const teamSeasonId = params.get('plantilla') ?? ''
  const mutation = useSave(setNotice)
  function open(current: Competition | null) { setNotice(''); mutation.clearResult(); setEditor({ current }) }

  if (failed) return <section className="page-heading"><h1>Torneos</h1><p role="alert">No se pudieron leer los torneos de este dispositivo.</p><button className="button" onClick={retry}>Volver a intentar</button></section>
  if (!directory) return <section className="page-heading"><h1>Torneos</h1><p role="status">Cargando torneos…</p></section>
  if (!directory.club) return <section className="page-heading"><h1>Torneos</h1><p>Configura tu club, una temporada y sus equipos para comenzar.</p><Link className="button" to="/equipos">Gestionar equipos</Link></section>

  const competitions = directory.competitions.filter((competition) => competition.active !== showArchived
    && nameKey(competition.name).includes(nameKey(filters.search))
    && (!filters.seasonId || competition.seasonId === filters.seasonId)
    && (!teamSeasonId || directory.entries.some((entry) => entry.competitionId === competition.id && entry.teamSeasonId === teamSeasonId && entry.active)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const hasTeams = directory.teamSeasons.some((link) => link.active && directory.seasons.some((season) => season.id === link.seasonId && season.active) && directory.teams.some((team) => team.id === link.teamId && team.active))

  return <section className="club-page">
    <div className="page-heading compact"><p className="eyebrow">{directory.club.name}</p><h1>Torneos</h1><p className="lead">Organiza las competiciones de tus equipos por temporada.</p></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {mutation.result && !mutation.result.ok && <p className="form-error" role="alert">{mutation.result.message}</p>}
    {editor && <CompetitionForm key={editor.current?.id ?? 'new'} current={editor.current} directory={directory} management={management} onSaved={(message) => { setEditor(null); setNotice(message) }} onCancel={() => setEditor(null)} />}
    <div className="catalog-toolbar"><button className="button" disabled={Boolean(editor) || mutation.busy || !hasTeams} onClick={() => open(null)}>Nuevo torneo</button><Link className="text-link" to="/equipos">Gestionar equipos</Link><label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Ver solo torneos archivados</label></div>
    {!hasTeams && <p className="notice">Crea una temporada activa y asígnale al menos un equipo activo para añadir torneos.</p>}
    <div className="catalog-filters competition-filters">
      <div className="field"><label htmlFor="competition-search">Buscar torneo</label><input id="competition-search" type="search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div>
      <div className="field"><label htmlFor="competition-season-filter">Filtrar torneos por temporada</label><select id="competition-season-filter" value={filters.seasonId} onChange={(event) => setFilters({ ...filters, seasonId: event.target.value })}><option value="">Todas las temporadas</option>{directory.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{!season.active && ' (archivada)'}</option>)}</select></div>
      <div className="field"><label htmlFor="competition-team-filter">Filtrar torneos por equipo y temporada</label><select id="competition-team-filter" value={teamSeasonId} onChange={(event) => setParams(event.target.value ? { plantilla: event.target.value } : {})}><option value="">Todos los equipos</option>{directory.teamSeasons.map((link) => <option key={link.id} value={link.id}>{teamSeasonLabel(directory, link)} · {directory.seasons.find((season) => season.id === link.seasonId)?.name}{!link.active && ' (desvinculado)'}</option>)}</select></div>
    </div>
    <p className="catalog-help">Archivar conserva el torneo y sus equipos asociados. Los partidos y las alineaciones se incorporarán en próximas entregas.</p>
    {competitions.length ? <div className="table-scroll competition-table"><table><caption className="sr-only">Torneos del club</caption><thead><tr><th scope="col">Torneo</th><th scope="col">Temporada</th><th scope="col">Equipos participantes</th><th scope="col">Acciones</th></tr></thead><tbody>{competitions.map((competition) => {
      const season = directory.seasons.find((item) => item.id === competition.seasonId)
      const entries = directory.entries.filter((entry) => entry.competitionId === competition.id && entry.active)
      return <tr key={competition.id}><th scope="row">{competition.name}<span className="record-status">{competition.kind}</span>{competition.notes && <p className="competition-notes">{competition.notes}</p>}</th><td data-label="Temporada">{season?.name}{season && !season.active && <span className="record-status">Temporada archivada</span>}</td><td data-label="Equipos participantes">{entries.map((entry) => {
        const link = directory.teamSeasons.find((item) => item.id === entry.teamSeasonId)
        const available = link?.active && directory.teams.some((team) => team.id === link.teamId && team.active)
        return link && <div key={entry.id}><Link className="text-link" to={`/plantillas/${encodeURIComponent(link.id)}`}>{teamSeasonLabel(directory, link)}</Link>{!available && <span className="record-status">Equipo archivado o temporada desvinculada</span>}</div>
      })}</td><td data-label="Acciones"><div className="row-actions">{competition.active && <button className="button secondary" aria-label={`Editar torneo ${competition.name}`} disabled={Boolean(editor) || mutation.busy || !season?.active} onClick={() => open(competition)}>Editar</button>}<button className="button secondary" aria-label={`${competition.active ? 'Archivar' : 'Restaurar'} torneo ${competition.name}`} disabled={Boolean(editor) || mutation.busy || (!competition.active && !season?.active)} onClick={() => { void mutation.run(() => management.setActive(competition, !competition.active), competition.active ? 'Torneo archivado. Sus asociaciones se conservan.' : 'Torneo restaurado.') }}>{competition.active ? 'Archivar' : 'Restaurar'}</button></div></td></tr>
    })}</tbody></table></div> : <div className="empty-state">No hay torneos para esta vista. {showArchived ? 'Los torneos archivados aparecerán aquí.' : 'Crea un torneo o ajusta los filtros.'}</div>}
  </section>
}
