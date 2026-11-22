import { describe, expect, it } from 'vitest'
import type { Id } from '../shared/types'
import type { MatchRoster } from './contracts'
import { COURT_POSITIONS, POSITIONS, nextOpenPosition, splitLineupRoster, validateLineup } from './lineup'

const roster: MatchRoster[] = Array.from({ length: 9 }, (_, index) => ({
  id: `p-${index}` as Id<'MatchRoster'>,
  matchId: 'match' as Id<'Match'>,
  athleteId: `a-${index}` as Id<'Athlete'>,
  rosterMembershipId: `m-${index}` as Id<'RosterMembership'>,
  nameSnapshot: `Deportista ${index}`,
  jerseyNumberSnapshot: index + 1,
  calledUp: index !== 8,
  designatedLibero: index === 7,
}))
const starters = POSITIONS.map((position, index) => ({ position, playerId: roster[index]!.id }))

describe('alineación inicial', () => {
  it('preserva el orden de cada posición al confirmar y separa la banca y los líberos', () => {
    const lineup = validateLineup({ starters: [...starters].reverse(), initialService: 'opponent' }, roster)
    if (!lineup.ok) throw new Error(lineup.message)
    expect(lineup.value.initialService).toBe('opponent')
    expect(POSITIONS.map((position) => lineup.value.initialOrder[position])).toEqual(starters.map(({ playerId }) => playerId))
    expect(splitLineupRoster(roster, lineup.value.initialOrder)).toEqual({ bench: [roster[6]], liberos: [roster[7]] })
  })

  it.each([
    { choice: starters.slice(1), message: /exactamente seis/ },
    { choice: [...starters, { position: 7, playerId: roster[6]!.id }], message: /exactamente seis/ },
    { choice: [{ position: 2, playerId: roster[0]!.id }, ...starters.slice(1)], message: /cada posición/ },
    { choice: [{ position: 0, playerId: roster[0]!.id }, ...starters.slice(1)], message: /cada posición/ },
    { choice: [{ position: 1, playerId: roster[1]!.id }, ...starters.slice(1)], message: /una sola posición/ },
    { choice: [{ position: 1, playerId: roster[7]!.id }, ...starters.slice(1)], message: /líberos designados/ },
    { choice: [{ position: 1, playerId: roster[8]!.id }, ...starters.slice(1)], message: /convocados/ },
    { choice: [{ position: 1, playerId: 'otro-partido' as Id<'MatchRoster'> }, ...starters.slice(1)], message: /convocados/ },
  ])('rechaza una asignación inválida de titulares', ({ choice, message }) => {
    expect(validateLineup({ starters: choice, initialService: 'own' }, roster)).toMatchObject({ ok: false, message: expect.stringMatching(message) })
  })

  it('exige confirmar el servicio y rechaza valores fuera de los dos equipos', () => {
    for (const initialService of [null, '', 'visitante']) {
      expect(validateLineup({ starters, initialService }, roster)).toMatchObject({ ok: false, message: expect.stringContaining('saque inicial') })
    }
  })

  it('mantiene la orientación de la cancha y avanza a una posición libre', () => {
    expect(COURT_POSITIONS).toEqual([4, 3, 2, 5, 6, 1])
    expect(nextOpenPosition({ 1: roster[0]!.id, 2: roster[1]!.id }, 1)).toBe(3)
    expect(nextOpenPosition({ 6: roster[0]!.id }, 6)).toBe(1)
  })
})
