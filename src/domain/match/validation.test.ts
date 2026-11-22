import { describe, expect, it } from 'vitest'
import { isLocalDateTime, validateMatch } from './validation'

const input = { competitionEntryId: 'e', opponentName: '  Club   Costa ', scheduledAt: '2026-11-21T19:30', venue: ' Gimnasio  Norte ', location: 'local', stage: ' Jornada  1 ' }
describe('datos de un partido', () => {
  it('normaliza textos y conserva la fecha y hora de la sede exactamente', () => {
    expect(validateMatch(input)).toEqual({ ok: true, value: { ...input, opponentName: 'Club Costa', venue: 'Gimnasio Norte', stage: 'Jornada 1' } })
  })
  it('permite partidos ya jugados o reprogramados fuera de las fechas de temporada sin inferir elegibilidad', () => {
    expect(validateMatch({ ...input, scheduledAt: '2024-02-29T00:00', stage: '' }).ok).toBe(true)
  })
  it.each(['2026-02-29T12:00', '2026-11-31T12:00', '0000-01-01T12:00', '2026-11-21', '2026-11-21T24:00', '2026-11-21T12:60', '2026-11-21T12:00Z', '2026-11-21T12:00:00'])('rechaza fecha u hora inválidas: %s', (value) => {
    expect(isLocalDateTime(value)).toBe(false)
  })
  it.each([
    { competitionEntryId: '' }, { opponentName: '' }, { opponentName: 'x'.repeat(101) },
    { venue: '' }, { venue: 'x'.repeat(161) }, { location: 'otro' }, { stage: 'x'.repeat(101) },
  ])('rechaza datos inválidos: %j', (change) => {
    expect(validateMatch({ ...input, ...change }).ok).toBe(false)
  })
})
