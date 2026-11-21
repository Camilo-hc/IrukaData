import Dexie, { type Table } from 'dexie'
import type { StorageHealthPort, StorageStatus } from '../../application/ports'
import type { Athlete, Club, Season, Team, TeamSeason } from '../../domain/club/contracts'

export interface AppMetadata { key: string; value: string }

export type StoredTeam = Team & { nameKey: string }
export type StoredSeason = Season & { nameKey: string }
export type StoredAthlete = Athlete & { searchKey: string }

export class IrukaDatabase extends Dexie {
  appMetadata!: Table<AppMetadata, string>
  clubs!: Table<Club, Club['id']>
  teams!: Table<StoredTeam, Team['id']>
  seasons!: Table<StoredSeason, Season['id']>
  teamSeasons!: Table<TeamSeason, TeamSeason['id']>
  athletes!: Table<StoredAthlete, Athlete['id']>

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
