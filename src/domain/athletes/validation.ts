import type { Athlete } from '../club/contracts'
import { isCalendarDate, validateName, type Validation } from '../shared/validation'

export interface AthleteInput { name: string; birthDate: string; notes: string }
export type AthleteDetails = Pick<Athlete, 'name' | 'birthDate' | 'notes'>

/** La fecha de referencia se inyecta; el dominio no consulta el reloj. */
export function validateAthlete(input: AthleteInput, today: string): Validation<AthleteDetails> {
  const name = validateName(input.name)
  const birthDate = input.birthDate.trim()
  const notes = input.notes.replace(/\r\n?/g, '\n').trim()
  const fields = {
    ...(!name.ok ? name.fields : {}),
    ...(birthDate && !isCalendarDate(birthDate) ? { birthDate: 'Indica una fecha de nacimiento válida.' } : {}),
    ...(birthDate && isCalendarDate(birthDate) && birthDate > today ? { birthDate: 'La fecha de nacimiento no puede ser futura.' } : {}),
    ...(notes.length > 2000 ? { notes: 'Usa un máximo de 2000 caracteres en las notas.' } : {}),
  }
  if (!name.ok || Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, value: {
    name: name.value,
    ...(birthDate ? { birthDate } : {}),
    ...(notes ? { notes } : {}),
  } }
}

/** Facilita buscar nombres con o sin tildes; no determina identidad. */
export function athleteSearchKey(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
}
