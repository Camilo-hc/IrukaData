import type { Athlete, Category, Competition, Season, Team } from '../domain/club/contracts'
import type { MatchContext } from '../domain/match/context'
import type { Match, MatchRoster, MatchSet } from '../domain/match/contracts'
import type { SetProgress } from '../domain/match/engine'
import type { MatchEvent } from '../domain/match/events'

export interface StatisticsFilter {
  readonly athleteId?: Athlete['id']
  readonly teamId?: Team['id']
  readonly category?: Category
  readonly seasonId?: Season['id']
  readonly competitionId?: Competition['id']
  readonly matchId?: Match['id']
  readonly setId?: MatchSet['id']
}
export interface PerformanceStatistics {
  readonly matchesPlayed: number
  readonly setsPlayed: number
  readonly aces: number
  readonly serveErrors: number
  readonly attackAttempts: number
  readonly attackPoints: number
  readonly attackErrors: number
  readonly blockedAttacks: number
  readonly attackEfficiency: number | null
  readonly receptionCounts: Readonly<Record<'perfecta' | 'positiva' | 'regular' | 'negativa' | 'error', number>>
  readonly receptionPositivePercentage: number | null
  readonly winningBlocks: number
  readonly controlledDigs: number
  readonly attributedPoints: number
}
export interface AthleteStatistics extends PerformanceStatistics {
  readonly athleteId: Athlete['id']
}
export interface TeamStatistics extends PerformanceStatistics {
  readonly teamId: Team['id']
}
export interface RecordedMatch {
  readonly match: Match
  readonly context: MatchContext
  readonly events: readonly MatchEvent[]
  readonly sets: readonly SetProgress[]
  readonly roster: readonly MatchRoster[]
}
