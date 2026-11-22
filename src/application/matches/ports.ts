import type { Match } from '../../domain/match/contracts'
import type { CompetitionDirectory } from '../competitions/ports'

export interface MatchDirectory extends CompetitionDirectory { readonly matches: readonly Match[] }
export type MatchErrorCode = 'conflict' | 'invalid_reference' | 'immutable_entry' | 'not_draft' | 'unavailable'
export class MatchError extends Error {
  constructor(readonly code: MatchErrorCode) { super(code) }
}
export interface MatchRepository {
  observe(next: (directory: MatchDirectory) => void, error: () => void): () => void
  save(match: Match, expectedVersion: number): Promise<void>
  setActive(match: Match, active: boolean): Promise<void>
}
