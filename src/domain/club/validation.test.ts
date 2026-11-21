import { describe, expect, it } from 'vitest'
import { validateName, validateSeason, validateTeam } from './validation'

describe('validaciones de equipos y temporadas', () => {
  it('normaliza espacios del nombre y rechaza un nombre vacío', () => {
    expect(validateName('  Club\t Iruka  ')).toEqual({ ok: true, value: 'Club Iruka' })
    expect(validateName(' \n ')).toMatchObject({ ok: false, fields: { name: expect.any(String) } })
  })

  it.each(['sub12', 'Sub 14', '__proto__'])('rechaza la categoría no prevista %s', (category) => {
    expect(validateTeam({ name: 'Equipo', branch: 'femenino', category }).ok).toBe(false)
  })

  it('no acepta ramas fuera de las dos previstas', () => {
    expect(validateTeam({ name: 'Equipo', branch: 'mixto', category: 'sub16' }).ok).toBe(false)
  })

  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '21-11-2026', ''])('rechaza la fecha imposible o no ISO %s', (start) => {
    expect(validateSeason({ name: 'Temporada', start, end: '2026-12-31' }).ok).toBe(false)
  })

  it('acepta un día bisiesto real y temporadas de un solo día', () => {
    expect(validateSeason({ name: 'Breve', start: '2024-02-29', end: '2024-02-29' }).ok).toBe(true)
  })

  it('rechaza un término anterior al inicio', () => {
    expect(validateSeason({ name: '2026', start: '2026-12-31', end: '2026-01-01' })).toMatchObject({ ok: false, fields: { end: expect.any(String) } })
  })
})
