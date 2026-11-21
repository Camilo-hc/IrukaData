import type { Branch, Category } from './contracts'
import { isCalendarDate, validateName, type Validation } from '../shared/validation'
export { normalizeName, nameKey, validateName } from '../shared/validation'
export type { FieldErrors, Validation } from '../shared/validation'

export const CATEGORIES: Readonly<Record<Category, string>> = {
  sub14: 'Sub 14', sub16: 'Sub 16', sub18: 'Sub 18', sub21: 'Sub 21', tc: 'TC',
}
export const BRANCHES: Readonly<Record<Branch, string>> = { femenino: 'Femenino', masculino: 'Masculino' }
export interface TeamInput { name: string; branch: string; category: string }
export interface SeasonInput { name: string; start: string; end: string }

export function validateTeam(input: TeamInput): Validation<{ name: string; branch: Branch; category: Category }> {
  const name = validateName(input.name)
  const fields = {
    ...(!name.ok ? name.fields : {}),
    ...(!Object.hasOwn(BRANCHES, input.branch) ? { branch: 'Selecciona una rama válida.' } : {}),
    ...(!Object.hasOwn(CATEGORIES, input.category) ? { category: 'Selecciona una categoría válida.' } : {}),
  }
  if (!name.ok || Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, value: { name: name.value, branch: input.branch as Branch, category: input.category as Category } }
}

export function validateSeason(input: SeasonInput): Validation<SeasonInput> {
  const name = validateName(input.name)
  const fields = {
    ...(!name.ok ? name.fields : {}),
    ...(!isCalendarDate(input.start) ? { start: 'Indica una fecha de inicio válida.' } : {}),
    ...(!isCalendarDate(input.end) ? { end: 'Indica una fecha de término válida.' } : {}),
  }
  if (!fields.start && !fields.end && input.start > input.end) fields.end = 'El término debe ser igual o posterior al inicio.'
  if (!name.ok || Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, value: { ...input, name: name.value } }
}
