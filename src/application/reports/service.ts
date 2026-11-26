import type { Athlete } from '../../domain/club/contracts'
import type { Match, MatchRoster } from '../../domain/match/contracts'
import { resolveMatchContext, type MatchReferences } from '../../domain/match/context'
import type { EventBatch, MatchEvent } from '../../domain/match/events'
import { reconstructMatch } from '../../domain/match/replay'
import type { RecordedMatch } from '../../statistics/contracts'
import type { LiveSession } from '../live/ports'
import { byMatch } from '../shared/by-match'

export interface ReportSource extends MatchReferences {
  readonly athletes: readonly Athlete[]
  readonly matches: readonly Match[]
  readonly rosters: readonly MatchRoster[]
  readonly sessions: readonly LiveSession[]
  readonly batches: readonly EventBatch[]
}

export interface ReportRepository {
  observe(next: (source: ReportSource) => void, error: () => void): () => void
}

export interface MatchReport extends RecordedMatch {
  readonly history: readonly { event: MatchEvent; reverted: boolean }[]
}

export interface ReportDirectory extends MatchReferences {
  readonly athletes: readonly Athlete[]
  readonly records: readonly MatchReport[]
  readonly unavailableMatches: readonly Match['id'][]
}

function createDirectory(source: ReportSource): ReportDirectory {
  const { athletes, competitions, entries, seasons, teams, teamSeasons } = source
  const records: MatchReport[] = []
  const unavailableMatches: Match['id'][] = []
  const matches = new Map(source.matches.map((match) => [match.id, match]))
  const rosters = byMatch(source.rosters)
  const batches = byMatch(source.batches)
  for (const session of source.sessions) {
    const id = session.matchId
    const match = matches.get(id)
    const context = match && resolveMatchContext(match.competitionEntryId, source)
    if (!match || !context) {
      unavailableMatches.push(id)
      continue
    }
    try {
      const roster = (rosters.get(id) ?? []).filter((player) => player.calledUp)
      const log = (batches.get(id) ?? []).sort((left, right) => left.expectedVersion - right.expectedVersion)
      const timeline = reconstructMatch(match, roster, session.initialVersion, log)
      const effective = new Set(timeline.effective.map(({ batch }) => batch.operationId))
      const events = timeline.effective.flatMap(({ batch }) => batch.events)
      const history = log.flatMap((batch) => batch.events.map((event) => ({
        event, reverted: event.type !== 'correction' && !effective.has(batch.operationId),
      })))
      records.push({ match, context, roster, events, history, sets: timeline.state.sets })
    } catch {
      unavailableMatches.push(id)
    }
  }
  records.sort((left, right) => right.match.scheduledAt.localeCompare(left.match.scheduledAt) || left.match.id.localeCompare(right.match.id))
  return { athletes, competitions, entries, seasons, teams, teamSeasons, records, unavailableMatches }
}

export function createReportManagement(repository: ReportRepository) {
  return {
    observe(next: (directory: ReportDirectory) => void, error: () => void) {
      return repository.observe((source) => next(createDirectory(source)), error)
    },
  }
}

export type ReportManagement = ReturnType<typeof createReportManagement>
