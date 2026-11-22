import { liveQuery } from 'dexie'
import { MatchError, type CallUpDirectory, type MatchDirectory, type MatchRepository } from '../../application/matches/ports'
import type { TeamSeason } from '../../domain/club/contracts'
import { validateCallUp, type CallUpSelection } from '../../domain/match/call-up'
import type { Match, MatchRoster } from '../../domain/match/contracts'
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

  private async readCandidates(teamSeasonId: TeamSeason['id']) {
    const db = this.database
    const memberships = await db.memberships.where('teamSeasonId').equals(teamSeasonId).filter((item) => item.active).toArray()
    const athletes = await db.athletes.bulkGet(memberships.map((item) => item.athleteId))
    return memberships.flatMap((membership, index) => {
      const athlete = athletes[index]
      return athlete?.active ? [{
        membershipId: membership.id,
        athleteId: athlete.id,
        name: athlete.name,
        jerseyNumber: membership.jerseyNumber,
      }] : []
    })
  }

  async readCallUp(matchId: Match['id']): Promise<CallUpDirectory> {
    const db = this.database
    return db.transaction('r', [db.matches, db.competitionEntries, db.athletes, db.memberships, db.matchRosters], async () => {
      const match = await db.matches.get(matchId)
      const entry = match && await db.competitionEntries.get(match.competitionEntryId)
      const roster = await db.matchRosters.where('matchId').equals(matchId).toArray()
      const candidates = entry ? await this.readCandidates(entry.teamSeasonId) : []
      return { matchVersion: match?.version, candidates, roster: roster.filter((player) => player.calledUp) }
    })
  }

  observeCallUp(matchId: Match['id'], next: (directory: CallUpDirectory) => void, error: () => void): () => void {
    const subscription = liveQuery(() => this.readCallUp(matchId)).subscribe({ next, error })
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
    return context
  }

  async saveCallUp(matchId: Match['id'], expectedVersion: number, selection: readonly CallUpSelection[]) {
    const db = this.database
    await db.transaction('rw', [
      db.matches, db.matchRosters, db.memberships, db.athletes, db.competitionEntries,
      db.competitions, db.teamSeasons, db.teams, db.seasons,
    ], async () => {
      const match = await db.matches.get(matchId)
      if (!match) throw new MatchError('conflict')
      checkVersion(match, expectedVersion)
      if (!match.active || (match.phase !== 'BORRADOR' && match.phase !== 'CONVOCATORIA')) {
        throw new MatchError('call_up_locked')
      }
      const context = await this.requireActiveParticipation(match.competitionEntryId)
      const candidates = await this.readCandidates(context.teamSeason.id)
      const byMembership = new Map(candidates.map((candidate) => [candidate.membershipId, candidate]))
      const previous = await db.matchRosters.where('matchId').equals(matchId).toArray()
      const byAthlete = new Map(previous.map((player) => [player.athleteId, player]))

      const selected = selection.map((choice): MatchRoster => {
        const candidate = byMembership.get(choice.membershipId)
        if (!candidate) throw new MatchError('invalid_candidate')
        const original = byAthlete.get(candidate.athleteId)
        const retained = original?.calledUp && original.rosterMembershipId === candidate.membershipId
        const name = retained ? original.nameSnapshot : candidate.name
        const jerseyNumber = retained ? original.jerseyNumberSnapshot : candidate.jerseyNumber
        if (choice.name !== name || choice.jerseyNumber !== jerseyNumber) throw new MatchError('invalid_candidate')
        return {
          id: original?.id ?? JSON.stringify([matchId, candidate.athleteId]) as MatchRoster['id'],
          matchId,
          athleteId: candidate.athleteId,
          rosterMembershipId: candidate.membershipId,
          nameSnapshot: name,
          jerseyNumberSnapshot: jerseyNumber,
          calledUp: true,
          designatedLibero: choice.libero,
        }
      })
      const error = validateCallUp(selected, match.rulesSnapshot.libero)
      if (error) throw new MatchError('invalid_call_up', error)

      const selectedIds = new Set(selected.map((player) => player.id))
      const removed = previous.filter((player) => player.calledUp && !selectedIds.has(player.id))
      await db.matchRosters.bulkPut([
        ...selected,
        ...removed.map((player) => ({ ...player, calledUp: false, designatedLibero: false })),
      ])
      await db.matches.put({ ...match, phase: 'CONVOCATORIA', version: match.version + 1 })
    })
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
