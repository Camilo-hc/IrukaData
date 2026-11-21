import { liveQuery } from 'dexie'
import { CatalogError, type ClubCatalog, type ClubRepository } from '../../application/club/ports'
import type { Club, Season, Team } from '../../domain/club/contracts'
import { nameKey } from '../../domain/club/validation'
import type { Id } from '../../domain/shared/types'
import type { IrukaDatabase, StoredSeason, StoredTeam } from './database'

function checkRevision(current: { revision: number } | undefined, expected: number) {
  if ((current?.revision ?? 0) !== expected) throw new CatalogError('conflict')
}
function teamModel(row: StoredTeam): Team {
  return { id: row.id, clubId: row.clubId, name: row.name, branch: row.branch, category: row.category, active: row.active, revision: row.revision }
}
function seasonModel(row: StoredSeason): Season {
  return { id: row.id, name: row.name, start: row.start, end: row.end, active: row.active, revision: row.revision }
}

export class DexieClubRepository implements ClubRepository {
  constructor(private readonly database: IrukaDatabase) {}

  async read(): Promise<ClubCatalog> {
    const db = this.database
    return db.transaction('r', [db.clubs, db.teams, db.seasons, db.teamSeasons], async () => {
      const [clubs, teams, seasons, teamSeasons] = await Promise.all([
        db.clubs.toArray(), db.teams.toArray(), db.seasons.toArray(), db.teamSeasons.toArray(),
      ])
      return { club: clubs[0] ?? null, teams: teams.map(teamModel), seasons: seasons.map(seasonModel), teamSeasons }
    })
  }

  observe(next: (catalog: ClubCatalog) => void, error: () => void): () => void {
    const subscription = liveQuery(() => this.read()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }

  async saveClub(club: Club, expectedRevision: number) {
    const db = this.database
    await db.transaction('rw', db.clubs, async () => {
      const current = await db.clubs.get(club.id)
      checkRevision(current, expectedRevision)
      if (!current && await db.clubs.count() !== 0) throw new CatalogError('conflict')
      await db.clubs.put(club)
    })
  }

  async saveTeam(team: Team, seasonIds: readonly Season['id'][], expectedRevision: number) {
    const db = this.database
    try {
      await db.transaction('rw', [db.clubs, db.teams, db.seasons, db.teamSeasons], async () => {
        const current = await db.teams.get(team.id)
        checkRevision(current, expectedRevision)
        if (current && (!current.active || current.clubId !== team.clubId)) throw new CatalogError('conflict')
        if (!await db.clubs.get(team.clubId)) throw new CatalogError('invalid_reference')
        const links = await db.teamSeasons.where('teamId').equals(team.id).toArray()
        for (const seasonId of seasonIds) {
          const season = await db.seasons.get(seasonId)
          const existing = links.find((link) => link.seasonId === seasonId)
          if (!season || (!season.active && !existing?.active)) throw new CatalogError('invalid_reference')
        }
        await db.teams.put({ ...team, nameKey: nameKey(team.name) })
        // Desvincular no borra la identidad de una plantilla ni sus futuras referencias.
        for (const link of links) {
          await db.teamSeasons.put({ ...link, active: seasonIds.includes(link.seasonId) })
        }
        for (const seasonId of seasonIds) {
          if (!links.some((link) => link.seasonId === seasonId)) {
            await db.teamSeasons.add({
              id: `${team.id}:${seasonId}` as Id<'TeamSeason'>,
              teamId: team.id, seasonId, active: true,
            })
          }
        }
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'ConstraintError') throw new CatalogError('duplicate_team')
      throw error
    }
  }

  async saveSeason(season: Season, expectedRevision: number) {
    const db = this.database
    try {
      await db.transaction('rw', [db.clubs, db.seasons], async () => {
        const current = await db.seasons.get(season.id)
        checkRevision(current, expectedRevision)
        if (current && !current.active) throw new CatalogError('conflict')
        if (await db.clubs.count() !== 1) throw new CatalogError('invalid_reference')
        await db.seasons.put({ ...season, nameKey: nameKey(season.name) })
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'ConstraintError') throw new CatalogError('duplicate_season')
      throw error
    }
  }

  async setTeamActive(team: Team, active: boolean) {
    const db = this.database
    await db.transaction('rw', db.teams, async () => {
      const current = await db.teams.get(team.id)
      checkRevision(current, team.revision)
      if (!current) throw new CatalogError('conflict')
      await db.teams.put({ ...current, active, revision: current.revision + 1 })
    })
  }

  async setSeasonActive(season: Season, active: boolean) {
    const db = this.database
    await db.transaction('rw', db.seasons, async () => {
      const current = await db.seasons.get(season.id)
      checkRevision(current, season.revision)
      if (!current) throw new CatalogError('conflict')
      await db.seasons.put({ ...current, active, revision: current.revision + 1 })
    })
  }
}
