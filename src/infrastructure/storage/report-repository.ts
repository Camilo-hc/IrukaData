import { liveQuery } from 'dexie'
import type { ReportRepository, ReportSource } from '../../application/reports/service'
import type { IrukaDatabase } from './database'

export class DexieReportRepository implements ReportRepository {
  constructor(private readonly database: IrukaDatabase) {}

  private read(): Promise<ReportSource> {
    const db = this.database
    return db.transaction('r', [
      db.athletes, db.teams, db.seasons, db.teamSeasons, db.competitions, db.competitionEntries,
      db.matches, db.matchRosters, db.liveSessions, db.liveBatches,
    ], async () => {
      const [athletes, teams, seasons, teamSeasons, competitions, entries, matches, rosters, sessions, batches] = await Promise.all([
        db.athletes.toArray(), db.teams.toArray(), db.seasons.toArray(), db.teamSeasons.toArray(), db.competitions.toArray(),
        db.competitionEntries.toArray(), db.matches.toArray(), db.matchRosters.toArray(), db.liveSessions.toArray(), db.liveBatches.toArray(),
      ])
      return { athletes, teams, seasons, teamSeasons, competitions, entries, matches, rosters, sessions, batches }
    })
  }

  observe(next: (source: ReportSource) => void, error: () => void) {
    const subscription = liveQuery(() => this.read()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
}
