import Dexie, { type Table } from 'dexie'
import type { StorageHealthPort, StorageStatus } from '../../application/ports'
import type { Athlete, Club, Competition, CompetitionEntry, RosterMembership, Season, Team, TeamSeason } from '../../domain/club/contracts'
import type { Match, MatchRoster } from '../../domain/match/contracts'

export interface AppMetadata { key: string; value: string }

export type StoredTeam = Team & { nameKey: string }
export type StoredSeason = Season & { nameKey: string }
export type StoredAthlete = Athlete & { searchKey: string }
export type StoredMembership = RosterMembership & { activeJerseyNumber?: number }
export type StoredCompetition = Competition & { nameKey: string }

export class IrukaDatabase extends Dexie {
  appMetadata!: Table<AppMetadata, string>
  clubs!: Table<Club, Club['id']>
  teams!: Table<StoredTeam, Team['id']>
  seasons!: Table<StoredSeason, Season['id']>
  teamSeasons!: Table<TeamSeason, TeamSeason['id']>
  athletes!: Table<StoredAthlete, Athlete['id']>
  memberships!: Table<StoredMembership, RosterMembership['id']>
  competitions!: Table<StoredCompetition, Competition['id']>
  competitionEntries!: Table<CompetitionEntry, CompetitionEntry['id']>
  matches!: Table<Match, Match['id']>
  matchRosters!: Table<MatchRoster, MatchRoster['id']>

  constructor(name = 'irukadata') {
    super(name)
    this.version(1).stores({ appMetadata: '&key' })
    this.version(2).stores({
      clubs: '&id',
      teams: '&id, clubId, &[clubId+branch+category+nameKey]',
      seasons: '&id, &nameKey',
      teamSeasons: '&id, &[teamId+seasonId], teamId, seasonId',
    }).upgrade(async (transaction) => {
      await transaction.table('appMetadata').put({ key: 'schemaVersion', value: '2' })
    })
    this.version(3).stores({ athletes: '&id, searchKey' }).upgrade(async (transaction) => {
      await transaction.table('appMetadata').put({ key: 'schemaVersion', value: '3' })
    })
    this.version(4).stores({
      memberships: '&id, athleteId, teamSeasonId, &[teamSeasonId+athleteId], &[teamSeasonId+activeJerseyNumber]',
    }).upgrade(async (transaction) => {
      await transaction.table('appMetadata').put({ key: 'schemaVersion', value: '4' })
    })
    this.version(5).stores({
      competitions: '&id, seasonId, &[seasonId+nameKey]',
      competitionEntries: '&id, competitionId, teamSeasonId, &[competitionId+teamSeasonId]',
    }).upgrade(async (transaction) => {
      await transaction.table('appMetadata').put({ key: 'schemaVersion', value: '5' })
    })
    this.version(6).stores({ matches: '&id, competitionEntryId, scheduledAt' }).upgrade(async (transaction) => {
      await transaction.table('appMetadata').put({ key: 'schemaVersion', value: '6' })
    })
    this.version(7).stores({ matchRosters: '&id, matchId, &[matchId+athleteId]' }).upgrade(async (transaction) => {
      await transaction.table('appMetadata').put({ key: 'schemaVersion', value: '7' })
    })
  }
}

export function createStorageHealth(database: IrukaDatabase): StorageHealthPort {
  return {
    async check(): Promise<StorageStatus> {
      try {
        await database.transaction('rw', database.appMetadata, async () => {
          const version = await database.appMetadata.get('schemaVersion')
          if (!version) await database.appMetadata.add({ key: 'schemaVersion', value: String(database.verno) })
        })
        return 'ready'
      } catch {
        return 'unavailable'
      }
    },
  }
}
