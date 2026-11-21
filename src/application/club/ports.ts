import type { Club, Season, Team, TeamSeason } from '../../domain/club/contracts'

export interface ClubCatalog {
  readonly club: Club | null
  readonly teams: readonly Team[]
  readonly seasons: readonly Season[]
  readonly teamSeasons: readonly TeamSeason[]
}
export type CatalogErrorCode = 'duplicate_team' | 'duplicate_season' | 'conflict' | 'invalid_reference' | 'unavailable'
export class CatalogError extends Error {
  constructor(readonly code: CatalogErrorCode) { super(code) }
}
export interface ClubRepository {
  observe(next: (catalog: ClubCatalog) => void, error: () => void): () => void
  saveClub(club: Club, expectedRevision: number): Promise<void>
  saveTeam(team: Team, seasonIds: readonly Season['id'][], expectedRevision: number): Promise<void>
  saveSeason(season: Season, expectedRevision: number): Promise<void>
  setTeamActive(team: Team, active: boolean): Promise<void>
  setSeasonActive(season: Season, active: boolean): Promise<void>
}
