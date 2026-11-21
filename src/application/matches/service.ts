import type { Match } from '../../domain/match/contracts'
import { validateMatch, type MatchInput } from '../../domain/match/validation'
import { validateRules, type RulesInput } from '../../domain/rules/configuration'
import type { Id } from '../../domain/shared/types'
import type { SaveResult } from '../shared/save-result'
import { MatchError, type MatchErrorCode, type MatchRepository } from './ports'

const messages: Record<MatchErrorCode, string> = {
  conflict: 'Los datos cambiaron en otra edición. Cancela y abre de nuevo el formulario para usar la versión actual.',
  invalid_reference: 'El torneo, equipo o temporada ya no está activo o su participación fue retirada. Reactiva las referencias antes de guardar.',
  immutable_entry: 'El equipo y el torneo de un partido existente no se pueden cambiar. Crea otro partido para una participación distinta.',
  not_draft: 'Solo se pueden editar, archivar o restaurar partidos en borrador.',
  unavailable: 'No se pudo guardar el partido en este dispositivo. Conserva el formulario y vuelve a intentarlo.',
}

export function createMatchManagement(repository: MatchRepository, newId: () => string) {
  async function persist(operation: () => Promise<void>): Promise<SaveResult> {
    try { await operation(); return { ok: true } }
    catch (error) { return { ok: false, message: messages[error instanceof MatchError ? error.code : 'unavailable'] } }
  }
  return {
    observe: repository.observe.bind(repository),
    async save(input: MatchInput, rulesInput: RulesInput, current: Match | null): Promise<SaveResult> {
      const details = validateMatch(input)
      const rules = validateRules(rulesInput)
      if (!details.ok || !rules.ok) return { ok: false, message: 'Revisa los datos del partido y sus reglas.', fields: { ...(!details.ok ? details.fields : {}), ...(!rules.ok ? rules.fields : {}) } }
      if (current && current.competitionEntryId !== details.value.competitionEntryId) return { ok: false, message: messages.immutable_entry }
      if (current && current.phase !== 'BORRADOR') return { ok: false, message: messages.not_draft }
      const match: Match = { ...details.value, id: current?.id ?? newId() as Id<'Match'>, rulesSnapshot: rules.value, phase: 'BORRADOR', active: current?.active ?? true, version: (current?.version ?? 0) + 1 }
      return persist(() => repository.save(match, current?.version ?? 0))
    },
    setActive: (match: Match, active: boolean) => persist(() => repository.setActive(match, active)),
  }
}
export type MatchManagement = ReturnType<typeof createMatchManagement>
