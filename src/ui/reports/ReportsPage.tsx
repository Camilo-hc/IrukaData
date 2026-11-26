import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { ReportDirectory, ReportManagement } from '../../application/reports/service'
import { CATEGORIES } from '../../domain/club/validation'
import type { StatisticsFilter } from '../../statistics/contracts'
import { StatisticsView } from './StatisticsView'
import { HistoryDetail, HistoryList } from './HistoryView'
import { formatMatchDate } from '../matches/labels'

type Option = { id: string; label: string }

function SelectFilter({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: readonly Option[]; onChange: (value: string) => void
}) {
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value} disabled={!options.length} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todos</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>
}

function useReportDirectory(management: ReportManagement) {
  const [state, setState] = useState<{ directory: ReportDirectory | null; failed: boolean }>({ directory: null, failed: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const unsubscribe = management.observe(
      (directory) => { if (active) setState({ directory, failed: false }) },
      () => { if (active) setState({ directory: null, failed: true }) },
    )
    return () => { active = false; unsubscribe() }
  }, [management, attempt])
  return { ...state, retry: () => { setState({ directory: null, failed: false }); setAttempt((value) => value + 1) } }
}

function namedOptions(items: readonly { id: string; name: string }[]): Option[] {
  return items.map(({ id, name }) => ({ id, label: name })).sort((left, right) => left.label.localeCompare(right.label, 'es'))
}

function filterFromParams(params: URLSearchParams): StatisticsFilter {
  const athlete = params.get('deportista')
  const team = params.get('equipo')
  const category = params.get('categoria')
  const season = params.get('temporada')
  const competition = params.get('torneo')
  const match = params.get('partido')
  const set = params.get('set')
  return {
    ...(athlete ? { athleteId: athlete as NonNullable<StatisticsFilter['athleteId']> } : {}),
    ...(team ? { teamId: team as NonNullable<StatisticsFilter['teamId']> } : {}),
    ...(category && Object.hasOwn(CATEGORIES, category) ? { category: category as keyof typeof CATEGORIES } : {}),
    ...(season ? { seasonId: season as NonNullable<StatisticsFilter['seasonId']> } : {}),
    ...(competition ? { competitionId: competition as NonNullable<StatisticsFilter['competitionId']> } : {}),
    ...(match ? { matchId: match as NonNullable<StatisticsFilter['matchId']> } : {}),
    ...(match && set ? { setId: set as NonNullable<StatisticsFilter['setId']> } : {}),
  }
}

export function ReportsPage({ kind, management }: { kind: 'statistics' | 'history'; management: ReportManagement }) {
  const { matchId } = useParams<{ matchId: string }>()
  const [params, setParams] = useSearchParams()
  const { directory, failed, retry } = useReportDirectory(management)
  const title = kind === 'statistics' ? 'Estadísticas' : 'Historial de partidos'
  if (failed) return <section className="page-heading"><h1>{title}</h1><p role="alert">No se pudo leer el registro local.</p><button className="button" onClick={retry}>Volver a intentar</button></section>
  if (!directory) return <section className="page-heading"><h1>{title}</h1><p role="status">Cargando partidos registrados…</p></section>
  if (matchId) {
    const report = directory.records.find(({ match }) => match.id === matchId)
    if (report) return <HistoryDetail key={matchId} report={report} />
    return <section className="page-heading"><h1>Historial no disponible</h1><p>No se pudo reconstruir un historial para este partido.</p><Link className="button" to="/historial">Volver al historial</Link></section>
  }

  const filter = filterFromParams(params)
  const selectedMatch = directory.records.find(({ match }) => match.id === filter.matchId)
  const filters: readonly { id: string; label: string; options: readonly Option[] }[] = [
    { id: 'deportista', label: 'Deportista', options: namedOptions(directory.athletes) },
    { id: 'equipo', label: 'Equipo', options: namedOptions(directory.teams) },
    { id: 'categoria', label: 'Categoría', options: Object.entries(CATEGORIES).map(([id, label]) => ({ id, label })) },
    { id: 'temporada', label: 'Temporada', options: namedOptions(directory.seasons) },
    { id: 'torneo', label: 'Torneo', options: namedOptions(directory.competitions) },
    { id: 'partido', label: 'Partido', options: directory.records.map(({ match, context }) => ({
      id: match.id, label: `${context.team.name} vs. ${match.opponentName} · ${formatMatchDate(match.scheduledAt)}`,
    })) },
  ]
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'partido') next.delete('set')
    setParams(next, { replace: true })
  }
  return <section className="club-page report-page">
    <div className="page-heading compact">
      <h1>{title}</h1>
      <p className="lead">{kind === 'statistics' ? 'Consulta el rendimiento registrado de tus equipos y deportistas.' : 'Consulta el marcador, la convocatoria y las acciones de cada encuentro.'}</p>
    </div>
    {directory.unavailableMatches.length > 0 && <p className="notice" role="alert">Hay partidos cuyo historial local no se pudo reconstruir. El resto de los registros sigue disponible.</p>}
    <div className="catalog-filters report-filters">
      {filters.map(({ id, label, options }) => <SelectFilter key={id} id={id} label={label} options={options} value={params.get(id) ?? ''} onChange={(value) => setFilter(id, value)} />)}
      {selectedMatch && <SelectFilter id="set" label="Set" options={selectedMatch.sets.map(({ set }) => ({ id: set.id, label: 'Set ' + set.number }))}
        value={params.get('set') ?? ''} onChange={(value) => setFilter('set', value)} />}
    </div>
    {params.size > 0 && <div className="form-actions"><button type="button" className="button secondary" onClick={() => setParams({}, { replace: true })}>Limpiar filtros</button></div>}
    {kind === 'statistics' ? <StatisticsView directory={directory} filter={filter} /> : <HistoryList directory={directory} filter={filter} />}
  </section>
}
