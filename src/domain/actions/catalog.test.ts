import { describe, expect, it } from 'vitest'
import { ACTION_CATALOG, type TechnicalAction } from './catalog'

describe('contrato del catálogo de acciones', () => {
  it('la secuencia de aceptación solo tiene intención terminal en el último ataque', () => {
    const sequence: readonly TechnicalAction[] = [
      { action: 'reception', result: 'positiva' },
      { action: 'setting', result: 'precisa' },
      { action: 'attack', result: 'continuidad' },
      { action: 'dig', result: 'controlada' },
      { action: 'setting', result: 'precisa' },
      { action: 'attack', result: 'punto' },
    ]
    const intentions = sequence.map(({ action, result }) => {
      const results: Readonly<Record<string, { readonly pointWinner: string | null }>> = ACTION_CATALOG[action].results
      return results[result]?.pointWinner
    })
    expect(intentions).toEqual([null, null, null, null, null, 'own'])
  })

  it('todos los errores y faltas adjudican al rival', () => {
    for (const action of Object.values(ACTION_CATALOG)) {
      for (const [result, definition] of Object.entries(action.results)) {
        if (/error|falta|punto_rival/.test(result)) expect(definition.pointWinner).toBe('opponent')
      }
    }
  })

  it('solo ace y acciones ganadoras pueden atribuir un punto propio', () => {
    for (const action of Object.values(ACTION_CATALOG)) {
      for (const [result, definition] of Object.entries(action.results)) {
        if (definition.pointWinner === 'own') expect(['ace', 'punto']).toContain(result)
      }
    }
  })

  it('una defensa sin control no se convierte en un error automático', () => {
    expect(ACTION_CATALOG.dig.results.sin_control.pointWinner).toBeNull()
  })
})
