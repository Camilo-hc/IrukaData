import { describe, expect, it } from 'vitest'
import { athleteSearchKey, validateAthlete } from './validation'

const today = '2026-11-21'
const emptyOptional = { name: '  Álex   Marín  ', birthDate: '', notes: '' }

describe('datos personales del deportista', () => {
  it('normaliza el nombre y omite los campos opcionales vacíos', () => {
    expect(validateAthlete(emptyOptional, today)).toEqual({ ok: true, value: { name: 'Álex Marín' } })
    expect(validateAthlete({ ...emptyOptional, name: ' \t ' }, today)).toMatchObject({ ok: false, fields: { name: expect.any(String) } })
  })

  it.each(['2026-02-29', '2008-04-31', '0000-01-01', '21-11-2008', '2008-1-01'])('rechaza el nacimiento inválido %s', (birthDate) => {
    expect(validateAthlete({ ...emptyOptional, birthDate }, today)).toMatchObject({ ok: false, fields: { birthDate: expect.any(String) } })
  })

  it('acepta el nacimiento en un día bisiesto válido y en la fecha de referencia', () => {
    expect(validateAthlete({ ...emptyOptional, birthDate: '2008-02-29' }, today).ok).toBe(true)
    expect(validateAthlete({ ...emptyOptional, birthDate: today }, today).ok).toBe(true)
  })

  it('rechaza un nacimiento futuro usando la referencia inyectada', () => {
    expect(validateAthlete({ ...emptyOptional, birthDate: '2026-11-22' }, today)).toMatchObject({ ok: false, fields: { birthDate: expect.stringContaining('futura') } })
  })

  it('conserva párrafos de las notas y controla su longitud', () => {
    expect(validateAthlete({ ...emptyOptional, notes: '  Primera línea\r\nSegunda línea  ' }, today)).toMatchObject({ ok: true, value: { notes: 'Primera línea\nSegunda línea' } })
    expect(validateAthlete({ ...emptyOptional, notes: 'a'.repeat(2000) }, today).ok).toBe(true)
    expect(validateAthlete({ ...emptyOptional, notes: 'a'.repeat(2001) }, today)).toMatchObject({ ok: false, fields: { notes: expect.any(String) } })
  })

  it('permite buscar con diferencias de tildes, espacios o mayúsculas', () => {
    expect(athleteSearchKey('  ÁLEX   Marín ')).toBe(athleteSearchKey('alex marin'))
  })
})
