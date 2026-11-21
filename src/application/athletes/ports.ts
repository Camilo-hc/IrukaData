import type { Athlete, Club } from '../../domain/club/contracts'

export interface AthleteDirectory {
  readonly club: Club | null
  readonly athletes: readonly Athlete[]
}
export type AthleteErrorCode = 'conflict' | 'club_missing' | 'unavailable'
export class AthleteError extends Error {
  constructor(readonly code: AthleteErrorCode) { super(code) }
}
export interface AthleteRepository {
  observe(next: (directory: AthleteDirectory) => void, error: () => void): () => void
  save(athlete: Athlete, expectedRevision: number): Promise<void>
  setActive(athlete: Athlete, active: boolean): Promise<void>
}
