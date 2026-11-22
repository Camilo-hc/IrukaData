import type { RosterMembership } from '../../domain/club/contracts'
import type { CallUpSelection } from '../../domain/match/call-up'
import type { LineupInput } from '../../domain/match/lineup'
import type { Match, MatchRoster, MatchSet } from '../../domain/match/contracts'
import type { CompetitionDirectory } from '../competitions/ports'

export interface MatchDirectory extends CompetitionDirectory { readonly matches: readonly Match[] }
export interface CallUpCandidate {
  readonly membershipId: RosterMembership['id']
  readonly name: string
  readonly jerseyNumber: number
}
export interface CallUpDirectory {
  readonly matchVersion: number | undefined
  readonly candidates: readonly CallUpCandidate[]
  readonly roster: readonly MatchRoster[]
  readonly firstSet: MatchSet | undefined
}
export type MatchErrorCode = 'conflict' | 'invalid_reference' | 'immutable_entry' | 'not_draft'
  | 'call_up_locked' | 'invalid_candidate' | 'invalid_call_up' | 'lineup_locked' | 'invalid_lineup' | 'unavailable'
export class MatchError extends Error {
  constructor(readonly code: MatchErrorCode, readonly detail?: string) { super(code) }
}
export interface MatchRepository {
  observe(next: (directory: MatchDirectory) => void, error: () => void): () => void
  observeCallUp(matchId: Match['id'], next: (directory: CallUpDirectory) => void, error: () => void): () => void
  save(match: Match, expectedVersion: number): Promise<void>
  setActive(match: Match, active: boolean): Promise<void>
  saveCallUp(matchId: Match['id'], expectedVersion: number, selection: readonly CallUpSelection[]): Promise<void>
  saveInitialLineup(matchId: Match['id'], expectedVersion: number, input: LineupInput): Promise<void>
}
