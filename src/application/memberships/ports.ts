import type { Athlete, Club, RosterMembership, Season, Team, TeamSeason } from '../../domain/club/contracts'

export interface MembershipDirectory {
  readonly club: Club | null
  readonly athletes: readonly Athlete[]
  readonly teams: readonly Team[]
  readonly seasons: readonly Season[]
  readonly teamSeasons: readonly TeamSeason[]
  readonly memberships: readonly RosterMembership[]
}
export type MembershipErrorCode = 'conflict' | 'invalid_reference' | 'inactive_reference' | 'duplicate_membership' | 'jersey_taken' | 'unavailable'
export class MembershipError extends Error {
  constructor(readonly code: MembershipErrorCode) { super(code) }
}
export interface MembershipRepository {
  observe(next: (directory: MembershipDirectory) => void, error: () => void): () => void
  save(membership: RosterMembership, expectedRevision: number): Promise<void>
  setActive(membership: RosterMembership, active: boolean): Promise<void>
}
