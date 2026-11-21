export type FieldErrors = Readonly<Partial<Record<'name' | 'branch' | 'category' | 'start' | 'end' | 'birthDate' | 'notes' | 'athleteId' | 'teamSeasonId' | 'jerseyNumber' | 'usualRole' | 'kind' | 'seasonId' | 'teamSeasonIds', string>>>
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

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
