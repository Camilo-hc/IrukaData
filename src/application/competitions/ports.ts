import type { Competition, CompetitionEntry, TeamSeason } from '../../domain/club/contracts'
import type { ClubCatalog } from '../club/ports'

export interface CompetitionDirectory extends ClubCatalog {
  readonly competitions: readonly Competition[]
  readonly entries: readonly CompetitionEntry[]
}
export type CompetitionErrorCode = 'duplicate' | 'conflict' | 'invalid_reference' | 'immutable_season' | 'unavailable'
export class CompetitionError extends Error {
  constructor(readonly code: CompetitionErrorCode) { super(code) }
}
export interface CompetitionRepository {
  observe(next: (directory: CompetitionDirectory) => void, error: () => void): () => void
  save(competition: Competition, teamSeasonIds: readonly TeamSeason['id'][], expectedRevision: number): Promise<void>
  setActive(competition: Competition, active: boolean): Promise<void>
}
