import type { Athlete, Club, Competition, CompetitionEntry, RosterMembership, Season, Team, TeamSeason } from '../../domain/club/contracts'
import type { Match, MatchRoster, MatchSet } from '../../domain/match/contracts'
import type { EventBatch } from '../../domain/match/events'
import type { LiveSession } from '../live/ports'

export interface BackupData {
  readonly clubs: readonly Club[]
  readonly teams: readonly Team[]
  readonly seasons: readonly Season[]
  readonly teamSeasons: readonly TeamSeason[]
  readonly athletes: readonly Athlete[]
  readonly memberships: readonly RosterMembership[]
  readonly competitions: readonly Competition[]
  readonly competitionEntries: readonly CompetitionEntry[]
  readonly matches: readonly Match[]
  readonly matchRosters: readonly MatchRoster[]
  readonly matchSets: readonly MatchSet[]
  readonly liveSessions: readonly LiveSession[]
  readonly liveBatches: readonly EventBatch[]
}

export interface BackupDocument {
  readonly format: 'IrukaData'
  readonly version: 1
  readonly exportedAt: string
  readonly data: BackupData
}

export interface BackupRepository {
  read(): Promise<BackupData>
  lastExport(): Promise<string | null>
  markExported(at: string): Promise<void>
  restore(data: BackupData, expected: string): Promise<boolean>
}
