import type { RosterMembership } from '../club/contracts'
import type { RulesSnapshot } from '../rules/contracts'
import type { MatchRoster } from './contracts'

export interface CallUpSelection {
  readonly membershipId: RosterMembership['id']
  readonly name: string
  readonly jerseyNumber: number
  readonly libero: boolean
}

export function requiredLiberos(total: number, rules: RulesSnapshot['libero']): number {
  const threshold = rules.twoRequiredAboveRosterSize
  return threshold !== null && total > threshold ? 2 : rules.minimumDesignated
}

export function validateCallUp(
  roster: readonly Pick<MatchRoster, 'athleteId' | 'jerseyNumberSnapshot' | 'designatedLibero'>[],
  rules: RulesSnapshot['libero'],
): string | null {
  if (new Set(roster.map((player) => player.athleteId)).size !== roster.length) {
    return 'Cada deportista puede figurar una sola vez en la convocatoria.'
  }
  if (new Set(roster.map((player) => player.jerseyNumberSnapshot)).size !== roster.length) {
    return 'Hay dorsales repetidos en la convocatoria. Revisa los dorsales guardados y los de la plantilla.'
  }
  const liberos = roster.filter((player) => player.designatedLibero).length
  if (liberos > rules.maximumDesignated) {
    return `Este partido permite un máximo de ${rules.maximumDesignated} líberos.`
  }
  const minimum = requiredLiberos(roster.length, rules)
  if (liberos < minimum) {
    return minimum === 1
      ? 'Las reglas del partido exigen al menos un líbero en la convocatoria.'
      : 'Las reglas del partido exigen dos líberos para esta convocatoria.'
  }
  if (roster.length - liberos < 6) {
    return 'Convoca al menos seis deportistas sin designación de líbero para poder preparar la alineación.'
  }
  return null
}
