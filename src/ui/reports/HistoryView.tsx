import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { MatchReport, ReportDirectory } from '../../application/reports/service'
import type { StatisticsFilter } from '../../statistics/contracts'
import { matchingRecord, participated } from '../../statistics/projection'
import { formatMatchDate, MATCH_PHASES, matchEventLabel, participationLabel } from '../matches/labels'

export function HistoryList({ directory, filter }: { directory: ReportDirectory; filter: StatisticsFilter }) {
  const athlete = filter.athleteId
  const records = directory.records.filter((record) => matchingRecord(record, filter)
    && (!athlete || participated(record, athlete, filter.setId)))
  if (!records.length) return <p className="empty-state">No hay partidos registrados para estos filtros.</p>
  return <div className="match-grid">
    {records.map(({ match, context, sets }) => <article key={match.id} className="match-card">
      <span className="tag subtle">{MATCH_PHASES[match.phase]}</span>
      <h2><Link className="text-link" to={'/historial/' + encodeURIComponent(match.id)}>vs. {match.opponentName}</Link></h2>
      <p>{participationLabel(context)}<br /><time dateTime={match.scheduledAt}>{formatMatchDate(match.scheduledAt)}</time></p>
      <p>Sets {sets.map(({ score }) => `${score.own}–${score.opponent}`).join(' · ')}</p>
    </article>)}
  </div>
}

export function HistoryDetail({ report }: { report: MatchReport }) {
  const { match, context, roster, sets, history } = report
  const [setId, setSetId] = useState('')
  const events = history.filter(({ event }) => !setId || event.setId === setId)
  const players = new Map(roster.map((player) => [player.id, player]))
  const matchSets = sets.map(({ set }) => set)
  const teams = { own: context.team.name, opponent: match.opponentName }
  return <section className="club-page report-page">
    <div className="page-heading compact">
      <Link className="text-link" to="/historial">Volver al historial</Link>
      <h1>vs. {match.opponentName}</h1>
      <p className="lead">{participationLabel(context)}</p>
      <p><time dateTime={match.scheduledAt}>{formatMatchDate(match.scheduledAt)}</time> · {match.venue}</p>
      <span className="tag">{MATCH_PHASES[match.phase]}</span>
    </div>
    <section className="live-panel" aria-labelledby="history-sets">
      <h2 id="history-sets">Marcador por set</h2>
      <ul className="live-set-results">
        {sets.map(({ set, score }) => <li key={set.id}>Set {set.number} <strong>{score.own}–{score.opponent}</strong>{set.status === 'active' && ' · En curso'}</li>)}
      </ul>
    </section>
    <details className="live-panel history-roster">
      <summary>Convocatoria guardada</summary>
      <ul className="report-list" aria-label="Convocatoria guardada">
        {[...roster].sort((left, right) => left.jerseyNumberSnapshot - right.jerseyNumberSnapshot).map((player) => <li key={player.id}>
          <strong className="jersey">#{player.jerseyNumberSnapshot}</strong> {player.nameSnapshot}{player.designatedLibero && ' · Líbero'}
        </li>)}
      </ul>
    </details>
    <section className="live-panel" aria-labelledby="history-events">
      <h2 id="history-events">Acciones y cambios</h2>
      <div className="field report-set-filter">
        <label htmlFor="history-set">Set del historial</label>
        <select id="history-set" value={setId} onChange={(event) => setSetId(event.target.value)}>
          <option value="">Todos los sets</option>
          {sets.map(({ set }) => <option key={set.id} value={set.id}>Set {set.number}</option>)}
        </select>
      </div>
      <ol className="live-history history-events" aria-label="Registros en orden de anotación">
        {events.map(({ event, reverted }) => <li key={event.id}>
          <span className="history-sequence" aria-label={'Registro ' + event.sequence}>{event.sequence}</span>
          <span>{matchEventLabel(event, players, teams, matchSets)}</span>
          {reverted && <span className="tag subtle">Deshecho</span>}
        </li>)}
      </ol>
    </section>
  </section>
}
