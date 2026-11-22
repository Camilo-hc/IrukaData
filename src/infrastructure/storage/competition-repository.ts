import { liveQuery } from 'dexie'
import { CompetitionError, type CompetitionDirectory, type CompetitionRepository } from '../../application/competitions/ports'
import type { Competition, TeamSeason } from '../../domain/club/contracts'
import { nameKey } from '../../domain/shared/validation'
import type { Id } from '../../domain/shared/types'
import { DexieClubRepository } from './club-repository'
import type { IrukaDatabase, StoredCompetition } from './database'

function model(row: StoredCompetition): Competition {
  return { id: row.id, name: row.name, kind: row.kind, seasonId: row.seasonId, ...(row.notes ? { notes: row.notes } : {}), active: row.active, revision: row.revision }
}
function checkRevision(current: Competition | undefined, expected: number) {
  if ((current?.revision ?? 0) !== expected) throw new CompetitionError('conflict')
}

export class DexieCompetitionRepository implements CompetitionRepository {
  constructor(private readonly database: IrukaDatabase) {}

  async read(): Promise<CompetitionDirectory> {
    const db = this.database
    return db.transaction('r', [db.clubs, db.teams, db.seasons, db.teamSeasons, db.competitions, db.competitionEntries], async () => {
      const [catalog, competitions, entries] = await Promise.all([
        new DexieClubRepository(db).read(), db.competitions.toArray(), db.competitionEntries.toArray(),
      ])
      return { ...catalog, competitions: competitions.map(model), entries }
    })
  }

  observe(next: (directory: CompetitionDirectory) => void, error: () => void): () => void {
    const subscription = liveQuery(() => this.read()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }

  async save(competition: Competition, teamSeasonIds: readonly TeamSeason['id'][], expectedRevision: number) {
    const db = this.database
    try {
      await db.transaction('rw', [db.seasons, db.teams, db.teamSeasons, db.competitions, db.competitionEntries], async () => {
        const current = await db.competitions.get(competition.id)
        checkRevision(current, expectedRevision)
        if (current && !current.active) throw new CompetitionError('conflict')
        if (current && current.seasonId !== competition.seasonId) throw new CompetitionError('immutable_season')
        if (!(await db.seasons.get(competition.seasonId))?.active || !teamSeasonIds.length) throw new CompetitionError('invalid_reference')
        const entries = await db.competitionEntries.where('competitionId').equals(competition.id).toArray()
        for (const id of teamSeasonIds) {
          const link = await db.teamSeasons.get(id)
          const team = link && await db.teams.get(link.teamId)
          const retained = entries.some((entry) => entry.teamSeasonId === id && entry.active)
          if (!link || !team || link.seasonId !== competition.seasonId || (!retained && (!link.active || !team.active))) throw new CompetitionError('invalid_reference')
        }
        await db.competitions.put({ ...competition, nameKey: nameKey(competition.name) })
        for (const entry of entries) await db.competitionEntries.put({ ...entry, active: teamSeasonIds.includes(entry.teamSeasonId) })
        for (const teamSeasonId of new Set(teamSeasonIds)) {
          if (!entries.some((entry) => entry.teamSeasonId === teamSeasonId)) {
            await db.competitionEntries.add({ id: `${competition.id}:${teamSeasonId}` as Id<'CompetitionEntry'>, competitionId: competition.id, teamSeasonId, active: true })
          }
        }
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'ConstraintError') throw new CompetitionError('duplicate')
      throw error
    }
  }

  async setActive(competition: Competition, active: boolean) {
    const db = this.database
    await db.transaction('rw', [db.competitions, db.seasons], async () => {
      const current = await db.competitions.get(competition.id)
      checkRevision(current, competition.revision)
      if (!current) throw new CompetitionError('conflict')
      if (active && !(await db.seasons.get(current.seasonId))?.active) throw new CompetitionError('invalid_reference')
      await db.competitions.put({ ...current, active, revision: current.revision + 1 })
    })
  }
}
