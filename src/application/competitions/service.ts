import type { Competition, Season, TeamSeason } from '../../domain/club/contracts'
import { validateCompetition, type CompetitionInput } from '../../domain/competitions/validation'
import type { Id } from '../../domain/shared/types'
import type { SaveResult } from '../shared/save-result'
import { CompetitionError, type CompetitionErrorCode, type CompetitionRepository } from './ports'

const messages: Record<CompetitionErrorCode, string> = {
  duplicate: 'Ya existe un torneo con ese nombre en la temporada. Revisa también los archivados.',
  conflict: 'Los datos cambiaron en otra edición. Cancela y abre de nuevo el formulario para usar la versión actual.',
  invalid_reference: 'La temporada o algún equipo ya no está disponible. Revisa que pertenezcan a la misma temporada y estén activos.',
  immutable_season: 'La temporada de un torneo existente no se puede cambiar. Crea otro torneo para una temporada distinta.',
  unavailable: 'No se pudo guardar el torneo en este dispositivo. Conserva el formulario y vuelve a intentarlo.',
}

export function createCompetitionManagement(repository: CompetitionRepository, newId: () => string) {
  async function persist(operation: () => Promise<void>): Promise<SaveResult> {
    try { await operation(); return { ok: true } }
    catch (error) { return { ok: false, message: messages[error instanceof CompetitionError ? error.code : 'unavailable'] } }
  }
  return {
    observe: repository.observe.bind(repository),
    async save(input: CompetitionInput, current: Competition | null): Promise<SaveResult> {
      const result = validateCompetition(input)
      if (!result.ok) return { ...result, message: 'Revisa los datos del torneo y sus equipos.' }
      if (current && current.seasonId !== result.value.seasonId) return { ok: false, message: messages.immutable_season }
      const { name, kind, seasonId, notes, teamSeasonIds } = result.value
      const competition: Competition = {
        id: current?.id ?? newId() as Id<'Competition'>, name, kind, seasonId: seasonId as Season['id'],
        ...(notes ? { notes } : {}), active: current?.active ?? true, revision: (current?.revision ?? 0) + 1,
      }
      return persist(() => repository.save(competition, teamSeasonIds as TeamSeason['id'][], current?.revision ?? 0))
    },
    setActive: (competition: Competition, active: boolean) => persist(() => repository.setActive(competition, active)),
  }
}
export type CompetitionManagement = ReturnType<typeof createCompetitionManagement>
