import type { RosterMembership } from '../../domain/club/contracts'
import { validateMembership, type MembershipInput } from '../../domain/memberships/validation'
import type { Id } from '../../domain/shared/types'
import type { SaveResult } from '../shared/save-result'
import { MembershipError, type MembershipErrorCode, type MembershipRepository } from './ports'

const messages: Record<MembershipErrorCode, string> = {
  conflict: 'La inscripción cambió en otra edición. Cancela y abre de nuevo el formulario para usar la versión actual.',
  invalid_reference: 'La plantilla o el deportista ya no están disponibles. Revisa la selección.',
  inactive_reference: 'Para inscribir, editar o restaurar, deben estar activos el deportista, el equipo, la temporada y su asociación.',
  duplicate_membership: 'Este deportista ya tiene una inscripción en esta plantilla. Revisa las inscripciones activas y archivadas.',
  jersey_taken: 'Ese dorsal está ocupado por otra inscripción activa en esta plantilla.',
  unavailable: 'No se pudo guardar la inscripción en este dispositivo. Conserva el formulario y vuelve a intentarlo.',
}

export function createMembershipManagement(repository: MembershipRepository, newId: () => string) {
  async function persist(operation: () => Promise<void>): Promise<SaveResult> {
    try { await operation(); return { ok: true } }
    catch (error) {
      const code = error instanceof MembershipError ? error.code : 'unavailable'
      return { ok: false, message: messages[code], ...(code === 'jersey_taken' ? { fields: { jerseyNumber: messages[code] } } : {}) }
    }
  }
  return {
    observe: repository.observe.bind(repository),
    async save(input: MembershipInput, current: RosterMembership | null): Promise<SaveResult> {
      const result = validateMembership(input)
      if (!result.ok) return { ...result, message: 'Revisa el deportista, el dorsal y el rol habitual.' }
      const membership: RosterMembership = {
        ...result.value, id: current?.id ?? newId() as Id<'RosterMembership'>,
        active: current?.active ?? true, revision: (current?.revision ?? 0) + 1,
      }
      return persist(() => repository.save(membership, current?.revision ?? 0))
    },
    setActive: (membership: RosterMembership, active: boolean) => persist(() => repository.setActive(membership, active)),
  }
}
export type MembershipManagement = ReturnType<typeof createMembershipManagement>
