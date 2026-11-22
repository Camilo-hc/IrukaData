import type { RulesSnapshot } from './contracts'
import type { FieldErrors, Validation } from '../shared/validation'

export interface RulesInput {
  substitutionLimit: string
  minimumLiberos: string
  maximumLiberos: string
  twoLiberosAbove: string
  decidingSideChange: boolean
}
export const DEFAULT_RULES_INPUT: Readonly<RulesInput> = {
  substitutionLimit: '6', minimumLiberos: '0', maximumLiberos: '2', twoLiberosAbove: '', decidingSideChange: true,
}
export const RULE_SOURCES = [
  'https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf',
  'https://www.fivb.com/fivb-board-of-administration-approves-rule-tests-for-2026-competitions/',
] as const

function integer(value: string): number | null {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null
}

export function validateRules(input: RulesInput): Validation<RulesSnapshot> {
  const limit = integer(input.substitutionLimit)
  const minimum = integer(input.minimumLiberos)
  const maximum = integer(input.maximumLiberos)
  const threshold = input.twoLiberosAbove === '' ? null : integer(input.twoLiberosAbove)
  const fields: FieldErrors = {
    ...(limit === null ? { substitutionLimit: 'Indica un número entero no negativo de sustituciones.' } : {}),
    ...(minimum === null || minimum > 2 ? { minimumLiberos: 'El mínimo de líberos debe estar entre 0 y 2.' } : {}),
    ...(maximum === null || maximum > 2 || (minimum !== null && maximum < minimum) ? { maximumLiberos: 'El máximo debe estar entre 0 y 2 y ser igual o mayor al mínimo.' } : {}),
    ...(input.twoLiberosAbove !== '' && (threshold === null || threshold < 6 || maximum !== 2) ? { twoLiberosAbove: 'Usa un umbral entero de al menos 6 y permite un máximo de 2 líberos, o deja este campo vacío.' } : {}),
  }
  if (limit === null || minimum === null || maximum === null || Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, value: {
    schemaVersion: 1, profileId: 'irukadata-best-of-three-manual', profileVersion: 1,
    label: 'Reglas de torneo · mejor de tres', sources: [...RULE_SOURCES],
    format: { setsToWin: 2, regularSetTarget: 25, decidingSetTarget: 15, minimumLead: 2, decidingSetSideChangeAt: input.decidingSideChange ? 8 : null },
    officialSubstitutions: { limitPerSet: limit, reentryPolicy: 'fivb_starter_pair' },
    libero: { minimumDesignated: minimum as 0 | 1 | 2, maximumDesignated: maximum as 0 | 1 | 2, twoRequiredAboveRosterSize: threshold, canServe: false, completedRallyBetweenReplacements: true },
    exceptionalProcedures: 'unsupported',
  } }
}

export function rulesToInput(rules: RulesSnapshot): RulesInput {
  return {
    substitutionLimit: String(rules.officialSubstitutions.limitPerSet),
    minimumLiberos: String(rules.libero.minimumDesignated), maximumLiberos: String(rules.libero.maximumDesignated),
    twoLiberosAbove: rules.libero.twoRequiredAboveRosterSize === null ? '' : String(rules.libero.twoRequiredAboveRosterSize),
    decidingSideChange: rules.format.decidingSetSideChangeAt !== null,
  }
}
