import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { MatchManagement } from '../../application/matches/service'
import type { Match } from '../../domain/match/contracts'
import { participationIsActive, resolveMatchContext } from '../../domain/match/context'
import { MATCH_LOCATIONS } from '../../domain/match/validation'
import { nameKey } from '../../domain/shared/validation'
import { MatchForm } from './MatchForm'
import { CallUpPanel } from './CallUpPanel'
import { formatMatchDate, MATCH_PHASES, participationLabel } from './labels'
import { RulesSummary } from './RulesFields'
import { useMatchDirectory } from './useMatchDirectory'
import { useSave } from '../shared/useSave'

export function MatchesPage({ management }: { management: MatchManagement }) {
  const { competitionId, matchId } = useParams<{ competitionId: string; matchId: string }>()
  return <MatchWorkspace key={matchId ?? competitionId ?? 'all'} management={management} competitionId={competitionId} matchId={matchId} />
}
function MatchWorkspace({ management, competitionId, matchId }: { management: MatchManagement; competitionId: string | undefined; matchId: string | undefined }) {
  const { directory, failed, retry } = useMatchDirectory(management)
  const [editor, setEditor] = useState<{ current: Match | null } | null>(null)
  const [notice, setNotice] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [filters, setFilters] = useState({ search: '', seasonId: '', competitionId: '', teamSeasonId: '' })
  const mutation = useSave(setNotice)
  function open(current: Match | null) { setNotice(''); mutation.clearResult(); setEditor({ current }) }
  if (failed) return <section className="page-heading"><h1>Partidos</h1><p role="alert">No se pudieron leer los partidos de este dispositivo.</p><button className="button" onClick={retry}>Volver a intentar</button></section>
  if (!directory) return <section className="page-heading"><h1>Partidos</h1><p role="status">Cargando partidos…</p></section>
  const references = directory
  const competition = directory.competitions.find((item) => item.id === competitionId)
  const selected = directory.matches.find((item) => item.id === matchId)
  if ((competitionId && !competition) || (matchId && !selected)) return <section className="page-heading"><h1>{matchId ? 'Partido no encontrado' : 'Torneo no encontrado'}</h1><p>No se encontró este registro en el dispositivo.</p><Link className="button" to="/partidos">Ver partidos</Link></section>
  const selectedContext = selected && resolveMatchContext(selected.competitionEntryId, directory)
  const contexts = directory.entries.map((entry) => resolveMatchContext(entry.id, directory)).filter((context) => context !== undefined)
  const canCreate = contexts.some((context) => participationIsActive(context) && (!competitionId || context.competition.id === competitionId))
  const matches = directory.matches.filter((match) => {
    const context = resolveMatchContext(match.competitionEntryId, directory)
    return match.active !== showArchived && (!competitionId || context?.competition.id === competitionId)
      && nameKey(`${match.opponentName} ${match.stage}`).includes(nameKey(filters.search))
      && (!filters.seasonId || context?.season.id === filters.seasonId)
      && (!filters.competitionId || context?.competition.id === filters.competitionId)
      && (!filters.teamSeasonId || context?.teamSeason.id === filters.teamSeasonId)
  }).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id))

  function actions(match: Match) {
    const available = participationIsActive(resolveMatchContext(match.competitionEntryId, references))
    const disabled = Boolean(editor) || mutation.busy || match.phase !== 'BORRADOR'
    return <div className="row-actions">{match.active && <button className="button secondary" aria-label={`Editar partido contra ${match.opponentName}`} disabled={disabled || !available} onClick={() => open(match)}>Editar</button>}<button className="button secondary" aria-label={`${match.active ? 'Archivar' : 'Restaurar'} partido contra ${match.opponentName}`} disabled={disabled || (!match.active && !available)} onClick={() => { void mutation.run(() => management.setActive(match, !match.active), match.active ? 'Partido archivado. Sus datos se conservan.' : 'Partido restaurado.') }}>{match.active ? 'Archivar' : 'Restaurar'}</button></div>
  }
  return <section className="club-page">
    <div className="page-heading compact"><p className="eyebrow">{directory.club?.name ?? 'IRUKADATA'}{competition && ` · ${competition.name}`}</p>
      {selected ? <><Link className="text-link" to={selectedContext ? `/torneos/${selectedContext.competition.id}/partidos` : '/partidos'}>Volver a partidos</Link><h1>vs. {selected.opponentName}</h1><p className="lead">{selectedContext ? participationLabel(selectedContext) : 'Participación no disponible'}</p><span className="tag">{MATCH_PHASES[selected.phase]}{!selected.active && ' · Archivado'}</span></> : <><h1>Partidos</h1><p className="lead">Programa los encuentros de tus equipos y conserva las reglas de cada partido.</p></>}
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {mutation.result && !mutation.result.ok && <p className="form-error" role="alert">{mutation.result.message}</p>}
    {editor && <MatchForm key={editor.current?.id ?? 'new'} current={editor.current} competitionId={competitionId} directory={directory} management={management} onSaved={(message) => { if (!editor.current) setShowArchived(false); setEditor(null); setNotice(message) }} onCancel={() => setEditor(null)} />}
    {selected ? <>
      {!participationIsActive(selectedContext) && <p className="notice">El torneo, equipo, temporada o su asociación están inactivos. Los datos se conservan; reactiva las referencias para editar o restaurar este partido.</p>}
      <article className="athlete-profile"><dl className="profile-fields"><div><dt>Fecha y hora de la sede</dt><dd>{formatMatchDate(selected.scheduledAt)}</dd></div><div><dt>Sede</dt><dd>{selected.venue}</dd></div><div><dt>Condición</dt><dd>{MATCH_LOCATIONS[selected.location]}</dd></div><div><dt>Fase o jornada</dt><dd>{selected.stage || 'Sin indicar'}</dd></div></dl>{actions(selected)}<RulesSummary rules={selected.rulesSnapshot} /></article>
      <CallUpPanel
        key={selected.id}
        match={selected}
        teamSeasonId={selectedContext?.teamSeason.id}
        canEdit={selected.active && !editor && !mutation.busy && participationIsActive(selectedContext)}
        management={management}
      />
    </> : <>
      <div className="catalog-toolbar"><button className="button" disabled={Boolean(editor) || mutation.busy || !canCreate} onClick={() => open(null)}>Nuevo partido</button><Link className="text-link" to="/torneos">Ver torneos</Link><label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Ver solo partidos archivados</label></div>
      {!canCreate && <p className="notice">Para crear partidos necesitas un torneo y una participación activos, con equipo y temporada activos.</p>}
      <div className="catalog-filters">
        <div className="field"><label htmlFor="match-search">Buscar rival o jornada</label><input id="match-search" type="search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div>
        <div className="field"><label htmlFor="match-season-filter">Filtrar partidos por temporada</label><select id="match-season-filter" value={filters.seasonId} onChange={(event) => setFilters({ ...filters, seasonId: event.target.value })}><option value="">Todas las temporadas</option>{directory.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></div>
        <div className="field"><label htmlFor="match-competition-filter">Filtrar partidos por torneo</label><select id="match-competition-filter" value={competitionId ?? filters.competitionId} disabled={Boolean(competitionId)} onChange={(event) => setFilters({ ...filters, competitionId: event.target.value })}><option value="">Todos los torneos</option>{directory.competitions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="field"><label htmlFor="match-team-filter">Filtrar partidos por plantilla</label><select id="match-team-filter" value={filters.teamSeasonId} onChange={(event) => setFilters({ ...filters, teamSeasonId: event.target.value })}><option value="">Todas las plantillas</option>{directory.teamSeasons.map((link) => <option key={link.id} value={link.id}>{directory.teams.find((team) => team.id === link.teamId)?.name} · {directory.seasons.find((season) => season.id === link.seasonId)?.name}</option>)}</select></div>
      </div>
      {matches.length ? <div className="match-grid">{matches.map((match) => {
        const context = resolveMatchContext(match.competitionEntryId, directory)
        return <article className="match-card" key={match.id}><span className="tag subtle">{MATCH_PHASES[match.phase]}</span><h2><Link className="text-link" to={`/partidos/${match.id}`}>vs. {match.opponentName}</Link></h2><p>{context ? participationLabel(context) : 'Participación no disponible'}</p><p><time dateTime={match.scheduledAt}>{formatMatchDate(match.scheduledAt)}</time><br />{match.venue} · {MATCH_LOCATIONS[match.location]}{match.stage && ` · ${match.stage}`}</p>{!participationIsActive(context) && <p className="record-status">Torneo o participación inactivos</p>}{actions(match)}</article>
      })}</div> : <div className="empty-state">No hay partidos para esta vista. {showArchived ? 'Los borradores archivados aparecerán aquí.' : 'Crea un partido o ajusta los filtros.'}</div>}
    </>}
  </section>
}
