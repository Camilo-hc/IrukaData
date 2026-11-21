import type { Athlete } from '../../domain/club/contracts'
import { validateAthlete, type AthleteInput } from '../../domain/athletes/validation'
import type { Id } from '../../domain/shared/types'
import type { SaveResult } from '../shared/save-result'
import { AthleteError, type AthleteErrorCode, type AthleteRepository } from './ports'

const messages: Record<AthleteErrorCode, string> = {
  conflict: 'Este perfil cambió en otra edición. Cancela y abre de nuevo el formulario para usar la versión actual.',
  club_missing: 'Configura tu club antes de guardar deportistas.',
  unavailable: 'No se pudo guardar el perfil en este dispositivo. Conserva el formulario y vuelve a intentarlo.',
}

export function createAthleteManagement(repository: AthleteRepository, newId: () => string, today: () => string) {
  async function persist(operation: () => Promise<void>): Promise<SaveResult> {
    try { await operation(); return { ok: true } }
    catch (error) { return { ok: false, message: messages[error instanceof AthleteError ? error.code : 'unavailable'] } }
  }
  return {
    observe: repository.observe.bind(repository),
    async save(input: AthleteInput, current: Athlete | null): Promise<SaveResult> {
      const result = validateAthlete(input, today())
      if (!result.ok) return { ...result, message: 'Revisa los datos del deportista.' }
      const athlete: Athlete = {
        ...result.value,
        id: current?.id ?? newId() as Id<'Athlete'>,
        active: current?.active ?? true,
        revision: (current?.revision ?? 0) + 1,
      }
      return persist(() => repository.save(athlete, current?.revision ?? 0))
    },
    setActive: (athlete: Athlete, active: boolean) => persist(() => repository.setActive(athlete, active)),
  }
}
export type AthleteManagement = ReturnType<typeof createAthleteManagement>
