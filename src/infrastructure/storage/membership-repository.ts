import { liveQuery } from 'dexie'
import { MembershipError, type MembershipDirectory, type MembershipRepository } from '../../application/memberships/ports'
import type { RosterMembership } from '../../domain/club/contracts'
import { rosterIsActive } from '../../domain/memberships/validation'
import type { IrukaDatabase, StoredMembership } from './database'

function membershipModel(row: StoredMembership): RosterMembership {
  return { id: row.id, athleteId: row.athleteId, teamSeasonId: row.teamSeasonId, jerseyNumber: row.jerseyNumber, usualRole: row.usualRole, active: row.active, revision: row.revision }
}
function storedMembership(membership: RosterMembership): StoredMembership {
  return { ...membership, ...(membership.active ? { activeJerseyNumber: membership.jerseyNumber } : {}) }
}

export class DexieMembershipRepository implements MembershipRepository {
  constructor(private readonly database: IrukaDatabase) {}

  async read(): Promise<MembershipDirectory> {
    const db = this.database
    return db.transaction('r', [db.clubs, db.athletes, db.teams, db.seasons, db.teamSeasons, db.memberships], async () => {
      const [clubs, athletes, teams, seasons, teamSeasons, memberships] = await Promise.all([
        db.clubs.toArray(), db.athletes.toArray(), db.teams.toArray(), db.seasons.toArray(), db.teamSeasons.toArray(), db.memberships.toArray(),
      ])
      return { club: clubs[0] ?? null, athletes, teams, seasons, teamSeasons, memberships: memberships.map(membershipModel) }
    })
  }

  observe(next: (directory: MembershipDirectory) => void, error: () => void): () => void {
    const subscription = liveQuery(() => this.read()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }

  private async requireActiveReferences(membership: RosterMembership) {
    const db = this.database
    const link = await db.teamSeasons.get(membership.teamSeasonId)
    const athlete = await db.athletes.get(membership.athleteId)
    if (!link || !athlete) throw new MembershipError('invalid_reference')
    const [team, season, clubs] = await Promise.all([db.teams.get(link.teamId), db.seasons.get(link.seasonId), db.clubs.toArray()])
    if (!team || !season || clubs.length !== 1 || team.clubId !== clubs[0]?.id) throw new MembershipError('invalid_reference')
    if (!rosterIsActive({ teamSeason: link, team, season }) || !athlete.active) throw new MembershipError('inactive_reference')
  }

  private async requireAvailableJersey(membership: RosterMembership) {
    if (!membership.active) return
    const occupied = await this.database.memberships.where('[teamSeasonId+activeJerseyNumber]')
      .equals([membership.teamSeasonId, membership.jerseyNumber]).first()
    if (occupied && occupied.id !== membership.id) throw new MembershipError('jersey_taken')
  }

  async save(membership: RosterMembership, expectedRevision: number) {
    const db = this.database
    await db.transaction('rw', [db.clubs, db.athletes, db.teams, db.seasons, db.teamSeasons, db.memberships], async () => {
      const current = await db.memberships.get(membership.id)
      if ((current?.revision ?? 0) !== expectedRevision) throw new MembershipError('conflict')
      if (current && (current.athleteId !== membership.athleteId || current.teamSeasonId !== membership.teamSeasonId)) throw new MembershipError('invalid_reference')
      await this.requireActiveReferences(membership)
      const existing = await db.memberships.where('[teamSeasonId+athleteId]').equals([membership.teamSeasonId, membership.athleteId]).first()
      if (existing && existing.id !== membership.id) throw new MembershipError('duplicate_membership')
      await this.requireAvailableJersey(membership)
      await db.memberships.put(storedMembership(membership))
    })
  }

  async setActive(membership: RosterMembership, active: boolean) {
    const db = this.database
    await db.transaction('rw', [db.clubs, db.athletes, db.teams, db.seasons, db.teamSeasons, db.memberships], async () => {
      const current = await db.memberships.get(membership.id)
      if (!current || current.revision !== membership.revision) throw new MembershipError('conflict')
      const updated = { ...membershipModel(current), active, revision: current.revision + 1 }
      if (active) await this.requireActiveReferences(updated)
      await this.requireAvailableJersey(updated)
      await db.memberships.put(storedMembership(updated))
    })
  }
}
