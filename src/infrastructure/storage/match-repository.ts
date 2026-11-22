import { liveQuery } from 'dexie'
import { MatchError, type MatchDirectory, type MatchRepository } from '../../application/matches/ports'
import type { Match } from '../../domain/match/contracts'
import { participationIsActive, resolveMatchContext } from '../../domain/match/context'
import { DexieCompetitionRepository } from './competition-repository'
import type { IrukaDatabase } from './database'

function checkVersion(current: Match | undefined, expected: number) {
  if ((current?.version ?? 0) !== expected) throw new MatchError('conflict')
}

export class DexieMatchRepository implements MatchRepository {
  constructor(private readonly database: IrukaDatabase) {}

  async read(): Promise<MatchDirectory> {
    const db = this.database
    return db.transaction('r', [db.clubs, db.teams, db.seasons, db.teamSeasons, db.competitions, db.competitionEntries, db.matches], async () => {
      const [directory, matches] = await Promise.all([new DexieCompetitionRepository(db).read(), db.matches.toArray()])
      return { ...directory, matches }
    })
  }

  observe(next: (directory: MatchDirectory) => void, error: () => void): () => void {
    const subscription = liveQuery(() => this.read()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }

  private async requireActiveParticipation(entryId: Match['competitionEntryId']) {
    const db = this.database
    const entry = await db.competitionEntries.get(entryId)
    const competition = entry && await db.competitions.get(entry.competitionId)
    const link = entry && await db.teamSeasons.get(entry.teamSeasonId)
    const team = link && await db.teams.get(link.teamId)
    const season = competition && await db.seasons.get(competition.seasonId)
    const context = resolveMatchContext(entryId, {
      entries: entry ? [entry] : [], competitions: competition ? [competition] : [],
      teamSeasons: link ? [link] : [], teams: team ? [team] : [], seasons: season ? [season] : [],
    })
    if (!participationIsActive(context)) throw new MatchError('invalid_reference')
  }

  async save(match: Match, expectedVersion: number) {
    const db = this.database
    await db.transaction('rw', [db.matches, db.competitionEntries, db.competitions, db.teamSeasons, db.teams, db.seasons], async () => {
      const current = await db.matches.get(match.id)
      checkVersion(current, expectedVersion)
      if (match.version !== expectedVersion + 1 || !match.active || (current && !current.active)) throw new MatchError('conflict')
      if (match.phase !== 'BORRADOR' || (current && current.phase !== 'BORRADOR')) throw new MatchError('not_draft')
      if (current && current.competitionEntryId !== match.competitionEntryId) throw new MatchError('immutable_entry')
      await this.requireActiveParticipation(match.competitionEntryId)
      await db.matches.put(match)
    })
  }

  async setActive(match: Match, active: boolean) {
    const db = this.database
    await db.transaction('rw', [db.matches, db.competitionEntries, db.competitions, db.teamSeasons, db.teams, db.seasons], async () => {
      const current = await db.matches.get(match.id)
      checkVersion(current, match.version)
      if (!current) throw new MatchError('conflict')
      if (current.phase !== 'BORRADOR') throw new MatchError('not_draft')
      if (active) await this.requireActiveParticipation(current.competitionEntryId)
      await db.matches.put({ ...current, active, version: current.version + 1 })
    })
  }
}
