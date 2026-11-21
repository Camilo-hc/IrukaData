import { describe, expect, it } from 'vitest'
import { validateMembership } from './validation'

const input = { athleteId: 'person', teamSeasonId: 'roster', jerseyNumber: '5', usualRole: 'punta' }

describe('datos de una inscripción', () => {
  it('normaliza el dorsal sin imponer un máximo reglamentario universal', () => {
    expect(validateMembership({ ...input, jerseyNumber: ' 005 ' })).toMatchObject({ ok: true, value: { jerseyNumber: 5 } })
    expect(validateMembership({ ...input, jerseyNumber: '99' }).ok).toBe(true)
  })
  it.each(['', '0', '-1', '2.5', '1e2', '5x', 'Infinity', '9007199254740992'])('rechaza el dorsal no válido %s', (jerseyNumber) => {
    expect(validateMembership({ ...input, jerseyNumber })).toMatchObject({ ok: false, fields: { jerseyNumber: expect.any(String) } })
  })
  it('requiere un perfil existente y una plantilla seleccionada', () => {
    expect(validateMembership({ ...input, athleteId: '', teamSeasonId: '' })).toMatchObject({ ok: false, fields: { athleteId: expect.any(String), teamSeasonId: expect.any(String) } })
  })
  it('rechaza roles desconocidos y conserva líbero como rol habitual', () => {
    expect(validateMembership({ ...input, usualRole: '__proto__' }).ok).toBe(false)
    expect(validateMembership({ ...input, usualRole: 'libero' })).toMatchObject({ ok: true, value: { usualRole: 'libero' } })
  })
})
