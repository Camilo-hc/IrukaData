import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES_INPUT, rulesToInput, validateRules } from './configuration'

describe('reglas configuradas para un partido', () => {
  it('crea una variante de torneo al mejor de tres, sin presentarla como un perfil FIVB completo', () => {
    const result = validateRules(DEFAULT_RULES_INPUT)
    expect(result).toMatchObject({ ok: true, value: {
      profileId: 'irukadata-best-of-three-manual', format: { setsToWin: 2, regularSetTarget: 25, decidingSetTarget: 15, minimumLead: 2 },
      officialSubstitutions: { limitPerSet: 6 }, libero: { minimumDesignated: 0, maximumDesignated: 2, twoRequiredAboveRosterSize: null }, exceptionalProcedures: 'unsupported',
    } })
    if (result.ok) expect(rulesToInput(result.value)).toEqual(DEFAULT_RULES_INPUT)
  })
  it('permite límites de 0, 6 y 8 sin fijarlos como universales y conserva condiciones adicionales', () => {
    for (const limit of ['0', '6', '8']) {
      const input = { ...DEFAULT_RULES_INPUT, substitutionLimit: limit, minimumLiberos: '1', twoLiberosAbove: '12', decidingSideChange: false }
      const result = validateRules(input)
      expect(result.ok).toBe(true)
      if (result.ok) expect(rulesToInput(result.value)).toEqual(input)
    }
  })
  it.each([
    { substitutionLimit: '' }, { substitutionLimit: '-1' }, { substitutionLimit: '1.5' }, { substitutionLimit: '1e2' }, { substitutionLimit: '9007199254740992' },
    { minimumLiberos: '3' }, { maximumLiberos: '-1' }, { minimumLiberos: '2', maximumLiberos: '1' },
    { twoLiberosAbove: '5' }, { twoLiberosAbove: 'abc' }, { twoLiberosAbove: '12', maximumLiberos: '1' },
  ])('rechaza una configuración inválida: %j', (change) => {
    expect(validateRules({ ...DEFAULT_RULES_INPUT, ...change }).ok).toBe(false)
  })
})
