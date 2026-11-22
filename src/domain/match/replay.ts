import type { TechnicalAction } from '../actions/catalog'
import type { EventBatch, MatchEvent } from './events'
import { applyMatchCommand, type MatchCommand, type MatchEngine } from './engine'
import { POSITIONS } from './lineup'

type ReplayResult =
  | { status: 'replayed'; state: MatchEngine }
  | { status: 'invalid_log'; batchNumber: number; message: string }

function commandFromEvents(state: MatchEngine, first: MatchEvent): MatchCommand | undefined {
  switch (first.type) {
    case 'set_started': {
      const number = state.sets.length + 1
      if (number !== 1 && number !== 2 && number !== 3) return undefined
      return {
        type: 'start_set',
        setId: first.setId,
        number,
        lineup: {
          starters: POSITIONS.map((position) => ({ position, playerId: first.payload.initialOrder[position] })),
          initialService: first.payload.initialService,
        },
      }
    }
    case 'technical_action': {
      const { action, result, rallyId, playerId } = first.payload
      return { type: 'record_action', action: { action, result } as TechnicalAction, rallyId, playerId }
    }
    case 'point_awarded':
      if (first.payload.cause.kind === 'manual') {
        return { type: 'award_point', rallyId: first.payload.rallyId, winner: first.payload.winner }
      }
  }
}

// IndexedDB y los respaldos pueden entregar claves en órdenes distintos.
function comparableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(Object.keys(item).sort().map((key) => [key, (item as Record<string, unknown>)[key]]))
  })
}

/** Reconstruye desde la versión inicial del partido y sus lotes, en orden. */
export function replayMatch(initial: MatchEngine, log: readonly EventBatch[]): ReplayResult {
  let state = initial
  for (const [index, batch] of log.entries()) {
    const first = batch.events[0]
    if (!first || batch.matchId !== state.matchId) {
      return { status: 'invalid_log', batchNumber: index + 1, message: 'El lote está vacío o pertenece a otro partido.' }
    }
    const command = commandFromEvents(state, first)
    if (!command) {
      return { status: 'invalid_log', batchNumber: index + 1, message: 'El lote comienza con un evento no admitido por el motor.' }
    }
    const result = applyMatchCommand(state, command, {
      operationId: batch.operationId,
      expectedVersion: batch.expectedVersion,
      timestamp: first.timestamp,
    })
    if (result.status !== 'applied' || comparableJson(result.batch.events) !== comparableJson(batch.events)) {
      return { status: 'invalid_log', batchNumber: index + 1, message: 'La secuencia o el resultado del lote no coincide con el estado del partido.' }
    }
    state = result.state
  }
  return { status: 'replayed', state }
}
