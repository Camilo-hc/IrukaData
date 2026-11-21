import type { Branch, Category } from './contracts'

export const CATEGORIES: Readonly<Record<Category, string>> = {
  sub14: 'Sub 14', sub16: 'Sub 16', sub18: 'Sub 18', sub21: 'Sub 21', tc: 'TC',
}
export const BRANCHES: Readonly<Record<Branch, string>> = { femenino: 'Femenino', masculino: 'Masculino' }
export interface TeamInput { name: string; branch: string; category: string }
export interface SeasonInput { name: string; start: string; end: string }
export type FieldErrors = Readonly<Partial<Record<'name' | 'branch' | 'category' | 'start' | 'end', string>>>
export type Validation<T> = { ok: true; value: T } | { ok: false; fields: FieldErrors }

export function normalizeName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ')
}
export function nameKey(name: string): string { return normalizeName(name).toLowerCase() }

export function validateName(value: string): Validation<string> {
  const name = normalizeName(value)
  if (!name) return { ok: false, fields: { name: 'Escribe un nombre.' } }
  if (name.length > 100) return { ok: false, fields: { name: 'Usa un máximo de 100 caracteres.' } }
  return { ok: true, value: name }
}

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

function isCalendarDate(value: string): boolean {
  // Validación de calendario sin reloj ni zona horaria del dispositivo.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
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
