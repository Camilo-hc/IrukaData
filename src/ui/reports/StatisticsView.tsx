import { Link } from 'react-router-dom'
import type { ReportDirectory } from '../../application/reports/service'
import type { PerformanceStatistics, StatisticsFilter } from '../../statistics/contracts'
import { participated, matchingRecord, projectStatistics } from '../../statistics/projection'
import { downloadText } from '../shared/download'

const percent = new Intl.NumberFormat('es-CL', { style: 'percent', maximumFractionDigits: 1 })

const columns: readonly { label: string; value: (stats: PerformanceStatistics) => number | string }[] = [
  { label: 'Partidos', value: (stats) => stats.matchesPlayed },
  { label: 'Sets', value: (stats) => stats.setsPlayed },
  { label: 'Puntos atribuidos', value: (stats) => stats.attributedPoints },
  { label: 'Aces', value: (stats) => stats.aces },
  { label: 'Errores de saque', value: (stats) => stats.serveErrors },
  { label: 'Intentos de ataque', value: (stats) => stats.attackAttempts },
  { label: 'Puntos de ataque', value: (stats) => stats.attackPoints },
  { label: 'Errores de ataque', value: (stats) => stats.attackErrors },
  { label: 'Ataques bloqueados', value: (stats) => stats.blockedAttacks },
  { label: 'Eficacia de ataque', value: (stats) => formatPercent(stats.attackEfficiency) },
  { label: 'Recepción perfecta', value: (stats) => stats.receptionCounts.perfecta },
  { label: 'Recepción positiva', value: (stats) => stats.receptionCounts.positiva },
  { label: 'Recepción regular', value: (stats) => stats.receptionCounts.regular },
  { label: 'Recepción negativa', value: (stats) => stats.receptionCounts.negativa },
  { label: 'Errores de recepción', value: (stats) => stats.receptionCounts.error },
  { label: '% recepción positiva', value: (stats) => formatPercent(stats.receptionPositivePercentage) },
  { label: 'Bloqueos ganadores', value: (stats) => stats.winningBlocks },
  { label: 'Defensas controladas', value: (stats) => stats.controlledDigs },
]

function formatPercent(value: number | null): string {
  return value === null ? '—' : percent.format(value)
}

interface Row { id: string; name: string; profile?: string; stats: PerformanceStatistics }

function StatisticsTable({ title, rows }: { title: string; rows: readonly Row[] }) {
  if (!rows.length) return null
  return <div className="table-scroll report-table" role="region" aria-label={title} tabIndex={0}>
    <table>
      <caption>{title}</caption>
      <thead><tr><th scope="col">Nombre</th>{columns.map(({ label }) => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{rows.map(({ id, name, profile, stats }) =>
        <tr key={id}><th scope="row">{profile ? <Link className="text-link" to={profile}>{name}</Link> : name}</th>
          {columns.map(({ label, value }) => <td key={label}>{value(stats)}</td>)}</tr>
      )}</tbody>
    </table>
  </div>
}

function csvText(value: string) {
  // Las planillas pueden interpretar nombres como fórmulas al abrir el CSV.
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

function exportStatistics(athletes: readonly Row[], teams: readonly Row[]) {
  const lines = [['Tipo', 'Nombre', ...columns.map(({ label }) => label)].map(csvText).join(';')]
  for (const [type, rows] of [['Deportista', athletes], ['Equipo', teams]] as const) {
    for (const row of rows) {
      const values = columns.map(({ value }) => {
        const entry = value(row.stats)
        return typeof entry === 'number' ? String(entry) : entry === '—' ? '' : '"' + entry + '"'
      })
      lines.push([csvText(type), csvText(row.name), ...values].join(';'))
    }
  }
  downloadText('irukadata-estadisticas.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8')
}

export function StatisticsView({ directory, filter }: { directory: ReportDirectory; filter: StatisticsFilter }) {
  const totals = projectStatistics(directory.records, filter)
  const byName = (left: Row, right: Row) => left.name.localeCompare(right.name, 'es') || left.id.localeCompare(right.id)
  const athletes = totals.athletes.map((stats): Row => ({
    id: stats.athleteId, profile: '/deportistas/' + encodeURIComponent(stats.athleteId), stats,
    name: directory.athletes.find(({ id }) => id === stats.athleteId)?.name ?? 'Deportista',
  })).sort(byName)
  const teams = totals.teams.map((stats): Row => ({
    id: stats.teamId, stats, name: directory.teams.find(({ id }) => id === stats.teamId)?.name ?? 'Equipo',
  })).sort(byName)
  if (!athletes.length && !teams.length) return <p className="empty-state">No hay participaciones registradas para estos filtros.</p>

  const athleteId = filter.athleteId
  const athleteMatches = athleteId ? directory.records.filter((record) =>
    matchingRecord(record, filter) && participated(record, athleteId, filter.setId)) : []
  return <>
    <div className="form-actions"><button type="button" className="button secondary" onClick={() => exportStatistics(athletes, teams)}>Descargar estadísticas CSV</button></div>
    <StatisticsTable title="Estadísticas por deportista" rows={athletes} />
    <StatisticsTable title="Estadísticas por equipo" rows={teams} />
    <p className="catalog-help">La eficacia de ataque resta los errores, incluidos los ataques bloqueados que dan punto al rival, y divide por los intentos. El porcentaje de recepción positiva cuenta recepciones perfectas y positivas sobre todas las registradas. El guion indica que no hay intentos evaluados.</p>
    {athleteMatches.length > 0 && <section aria-labelledby="stats-appearances">
      <h2 id="stats-appearances">Partidos del deportista</h2>
      <ul className="report-list" aria-label="Partidos del deportista">
        {athleteMatches.map(({ match, context, roster }) => {
          const player = roster.find((entry) => entry.athleteId === athleteId)
          return <li key={match.id}>
            <Link className="text-link" to={'/historial/' + encodeURIComponent(match.id)}>vs. {match.opponentName}</Link>
            <span>{context.team.name} · {context.competition.name}{player && ' · Dorsal #' + player.jerseyNumberSnapshot}</span>
          </li>
        })}
      </ul>
    </section>}
  </>
}
