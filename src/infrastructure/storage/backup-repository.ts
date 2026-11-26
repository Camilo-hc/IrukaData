import type { BackupData, BackupRepository } from '../../application/backup/contracts'
import { athleteSearchKey } from '../../domain/athletes/validation'
import { canonicalJson } from '../../domain/shared/canonical-json'
import { nameKey } from '../../domain/shared/validation'
import type { IrukaDatabase } from './database'

const LAST_EXPORT = 'lastBackupExport'

function withoutIndex<T extends object, K extends keyof T>(row: T, key: K): Omit<T, K> {
  const copy: Partial<T> = { ...row }
  delete copy[key]
  return copy as Omit<T, K>
}

export class DexieBackupRepository implements BackupRepository {
  constructor(private readonly database: IrukaDatabase) {}

  private tables() {
    const db = this.database
    return [
      db.clubs, db.teams, db.seasons, db.teamSeasons, db.athletes, db.memberships, db.competitions,
      db.competitionEntries, db.matches, db.matchRosters, db.matchSets, db.liveSessions, db.liveBatches,
    ]
  }

  private async readData(): Promise<BackupData> {
    const db = this.database
    const [clubs, teams, seasons, teamSeasons, athletes, memberships, competitions, competitionEntries,
      matches, matchRosters, matchSets, liveSessions, liveBatches] = await Promise.all([
      db.clubs.toArray(), db.teams.toArray(), db.seasons.toArray(), db.teamSeasons.toArray(), db.athletes.toArray(),
      db.memberships.toArray(), db.competitions.toArray(), db.competitionEntries.toArray(), db.matches.toArray(),
      db.matchRosters.toArray(), db.matchSets.toArray(), db.liveSessions.toArray(), db.liveBatches.toArray(),
    ])
    return {
      clubs, teams: teams.map((row) => withoutIndex(row, 'nameKey')), seasons: seasons.map((row) => withoutIndex(row, 'nameKey')),
      teamSeasons, athletes: athletes.map((row) => withoutIndex(row, 'searchKey')),
      memberships: memberships.map((row) => withoutIndex(row, 'activeJerseyNumber')),
      competitions: competitions.map((row) => withoutIndex(row, 'nameKey')),
      competitionEntries, matches, matchRosters, matchSets, liveSessions, liveBatches,
    }
  }

  read(): Promise<BackupData> {
    return this.database.transaction('r', this.tables(), () => this.readData())
  }

  async lastExport(): Promise<string | null> {
    return (await this.database.appMetadata.get(LAST_EXPORT))?.value ?? null
  }

  async markExported(at: string): Promise<void> {
    await this.database.appMetadata.put({ key: LAST_EXPORT, value: at })
  }

  async restore(data: BackupData, expected: string): Promise<boolean> {
    const db = this.database
    const tables = this.tables()
    return db.transaction('rw', tables, async () => {
      if (canonicalJson(await this.readData()) !== expected) return false
      await Promise.all(tables.map((table) => table.clear()))
      await Promise.all([
        db.clubs.bulkAdd([...data.clubs]),
        db.teams.bulkAdd(data.teams.map((team) => ({ ...team, nameKey: nameKey(team.name) }))),
        db.seasons.bulkAdd(data.seasons.map((season) => ({ ...season, nameKey: nameKey(season.name) }))),
        db.teamSeasons.bulkAdd([...data.teamSeasons]),
        db.athletes.bulkAdd(data.athletes.map((athlete) => ({ ...athlete, searchKey: athleteSearchKey(athlete.name) }))),
        db.memberships.bulkAdd(data.memberships.map((membership) => ({
          ...membership, ...(membership.active ? { activeJerseyNumber: membership.jerseyNumber } : {}),
        }))),
        db.competitions.bulkAdd(data.competitions.map((competition) => ({ ...competition, nameKey: nameKey(competition.name) }))),
        db.competitionEntries.bulkAdd([...data.competitionEntries]),
        db.matches.bulkAdd([...data.matches]),
        db.matchRosters.bulkAdd([...data.matchRosters]),
        db.matchSets.bulkAdd([...data.matchSets]),
        db.liveSessions.bulkAdd([...data.liveSessions]),
        db.liveBatches.bulkAdd([...data.liveBatches]),
      ])
      return true
    })
  }
}
