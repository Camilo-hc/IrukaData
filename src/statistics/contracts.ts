import type { Athlete, Competition, CompetitionEntry, Season, Team, TeamSeason } from '../domain/club/contracts'
import type { Match, MatchRoster, MatchSet } from '../domain/match/contracts'
import type { MatchEvent } from '../domain/match/events'

export interface StatisticsFilter {
  readonly athleteId?: Athlete['id']
  readonly teamId?: Team['id']
  readonly seasonId?: Season['id']
  readonly competitionId?: Competition['id']
  readonly matchId?: Match['id']
  readonly setId?: MatchSet['id']
}
export interface AthleteStatistics {
  readonly athleteId: Athlete['id']
  readonly matchesPlayed: number
  readonly setsPlayed: number
  readonly aces: number
  readonly serveErrors: number
  readonly attackAttempts: number
  readonly attackPoints: number
  readonly attackErrors: number
  readonly attackEfficiency: number | null
  readonly receptionCounts: Readonly<Record<'perfecta' | 'positiva' | 'regular' | 'negativa' | 'error', number>>
  readonly receptionPositivePercentage: number | null
  readonly winningBlocks: number
  readonly controlledDigs: number
  readonly attributedPoints: number
}
export interface StatisticsSource {
  readonly events: readonly MatchEvent[]
  readonly matches: readonly Match[]
  readonly sets: readonly MatchSet[]
  readonly matchRosters: readonly MatchRoster[]
  readonly competitionEntries: readonly CompetitionEntry[]
  readonly teamSeasons: readonly TeamSeason[]
}
/** Firma documental del proyector futuro; sin cálculos implementados. */
export type StatisticsProjection = (
  source: StatisticsSource,
  filter: StatisticsFilter,
) => readonly AthleteStatistics[]
