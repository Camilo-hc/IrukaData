import { describe, expect, it } from 'vitest'
import { validateCompetition } from './validation'

const input = { name: '  Copa   Sur  ', kind: '  Liga  ', seasonId: 's', notes: '  Cancha A  ', teamSeasonIds: ['a', 'a', 'b'] }
describe('datos de torneos', () => {
  it('normaliza nombres y notas sin duplicar asociaciones', () => {
    expect(validateCompetition(input)).toEqual({ ok: true, value: { name: 'Copa Sur', kind: 'Liga', seasonId: 's', notes: 'Cancha A', teamSeasonIds: ['a', 'b'] } })
  })
  it.each([
    { name: '' }, { name: 'x'.repeat(101) }, { kind: '' }, { kind: 'x'.repeat(61) },
    { seasonId: '' }, { notes: 'x'.repeat(2001) }, { teamSeasonIds: [] }, { teamSeasonIds: [''] },
  ])('rechaza datos incompletos o fuera de los límites: %j', (change) => {
    expect(validateCompetition({ ...input, ...change }).ok).toBe(false)
  })
})
