import { describe, expect, it } from 'vitest'
import type { Id } from '../shared/types'
import { validateCallUp } from './call-up'
import type { RulesSnapshot } from '../rules/contracts'

const rules: RulesSnapshot['libero'] = {
  minimumDesignated: 0,
  maximumDesignated: 2,
  twoRequiredAboveRosterSize: null,
  canServe: false,
  completedRallyBetweenReplacements: true,
}

function roster(total: number, liberos: number) {
  return Array.from({ length: total }, (_, index) => ({
    athleteId: `a-${index}` as Id<'Athlete'>,
    jerseyNumberSnapshot: index + 1,
    designatedLibero: index < liberos,
  }))
}

describe('validación de convocatoria', () => {
  it('exige seis deportistas regulares aunque se designen líberos', () => {
    expect(validateCallUp(roster(6, 0), rules)).toBeNull()
    expect(validateCallUp(roster(6, 1), rules)).toMatch(/al menos seis/)
    expect(validateCallUp(roster(8, 2), rules)).toBeNull()
  })

  it('aplica el mínimo y máximo del encuentro', () => {
    expect(validateCallUp(roster(7, 0), { ...rules, minimumDesignated: 1 })).toMatch(/al menos un líbero/)
    expect(validateCallUp(roster(7, 1), { ...rules, maximumDesignated: 0 })).toMatch(/máximo de 0/)
    expect(validateCallUp(roster(9, 3), rules)).toMatch(/máximo de 2/)
  })

  it('exige dos líberos solo cuando se supera el umbral configurado', () => {
    const threshold = { ...rules, twoRequiredAboveRosterSize: 12 }
    expect(validateCallUp(roster(12, 1), threshold)).toBeNull()
    expect(validateCallUp(roster(13, 1), threshold)).toMatch(/exigen dos líberos/)
    expect(validateCallUp(roster(13, 2), threshold)).toBeNull()
  })

  it('impide repetir personas y dorsales', () => {
    const players = roster(6, 0)
    expect(validateCallUp([...players, players[0]!], rules)).toMatch(/una sola vez/)
    expect(validateCallUp([...players, { ...players[0]!, athleteId: 'otra' as Id<'Athlete'> }], rules)).toMatch(/dorsales repetidos/)
  })
})
