import type { Club, Season, Team } from '../../domain/club/contracts'
import { validateName, validateSeason, validateTeam, type SeasonInput, type TeamInput } from '../../domain/club/validation'
import type { Id } from '../../domain/shared/types'
import { CatalogError, type CatalogErrorCode, type ClubRepository } from './ports'

import type { SaveResult } from '../shared/save-result'
export type { SaveResult } from '../shared/save-result'
const messages: Record<CatalogErrorCode, string> = {
  duplicate_team: 'Ya existe un equipo con ese nombre, rama y categoría. Revisa también los archivados.',
  duplicate_season: 'Ya existe una temporada con ese nombre. Revisa también las archivadas.',
  conflict: 'Los datos cambiaron en otra edición. Cancela y abre de nuevo el formulario para usar la versión actual.',
  invalid_reference: 'El club o alguna temporada ya no está disponible. Revisa la selección.',
  unavailable: 'No se pudieron guardar los datos en este dispositivo. Conserva el formulario y vuelve a intentarlo.',
}

export function createClubManagement(repository: ClubRepository, newId: () => string) {
  async function persist(operation: () => Promise<void>): Promise<SaveResult> {
    try { await operation(); return { ok: true } }
    catch (error) { return { ok: false, message: messages[error instanceof CatalogError ? error.code : 'unavailable'] } }
  }
  return {
    observe: repository.observe.bind(repository),
    async saveClub(name: string, current: Club | null): Promise<SaveResult> {
      const result = validateName(name)
      if (!result.ok) return { ...result, message: 'Revisa el nombre del club.' }
      const club: Club = { id: current?.id ?? 'local-club' as Id<'Club'>, name: result.value, revision: (current?.revision ?? 0) + 1 }
      return persist(() => repository.saveClub(club, current?.revision ?? 0))
    },
    async saveTeam(input: TeamInput, club: Club, seasonIds: readonly Season['id'][], current: Team | null): Promise<SaveResult> {
      const result = validateTeam(input)
      if (!result.ok) return { ...result, message: 'Revisa los datos del equipo.' }
      const team: Team = {
        ...result.value, id: current?.id ?? newId() as Id<'Team'>, clubId: club.id,
        active: current?.active ?? true, revision: (current?.revision ?? 0) + 1,
      }
      return persist(() => repository.saveTeam(team, [...new Set(seasonIds)], current?.revision ?? 0))
    },
    async saveSeason(input: SeasonInput, current: Season | null): Promise<SaveResult> {
      const result = validateSeason(input)
      if (!result.ok) return { ...result, message: 'Revisa las fechas y el nombre de la temporada.' }
      const season: Season = {
        ...result.value, id: current?.id ?? newId() as Id<'Season'>,
        active: current?.active ?? true, revision: (current?.revision ?? 0) + 1,
      }
      return persist(() => repository.saveSeason(season, current?.revision ?? 0))
    },
    setTeamActive: (team: Team, active: boolean) => persist(() => repository.setTeamActive(team, active)),
    setSeasonActive: (season: Season, active: boolean) => persist(() => repository.setSeasonActive(season, active)),
  }
}
export type ClubManagement = ReturnType<typeof createClubManagement>
