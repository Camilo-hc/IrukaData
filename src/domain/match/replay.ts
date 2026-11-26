import type { TechnicalAction } from '../actions/catalog'
import type { EventBatch, MatchEvent, OfficialSubstitutionEvent } from './events'
import { applyMatchCommand, undoMatchOperation, type MatchCommand, type MatchEngine } from './engine'
import { POSITIONS } from './lineup'

type ReplayResult =
  | { status: 'replayed'; state: MatchEngine }
  | { status: 'invalid_log'; batchNumber: number; message: string }

interface AppliedOperation {
  readonly batch: EventBatch
  readonly before: MatchEngine
}

export interface MatchTimeline {
  readonly state: MatchEngine
  readonly effective: readonly AppliedOperation[]
}

function commandFromEvents(state: MatchEngine, first: MatchEvent, events: readonly MatchEvent[]): MatchCommand | undefined {
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
      return undefined
    case 'official_substitution':
      return {
        type: 'official_substitution', setId: first.setId,
        selections: events
          .filter((event): event is OfficialSubstitutionEvent => event.type === 'official_substitution')
          .map(({ payload: { outgoingId, incomingId } }) => ({ outgoingId, incomingId })),
      }
    case 'libero_replacement': {
      const { outgoingId, incomingId } = first.payload
      return { type: 'libero_replacement', setId: first.setId, outgoingId, incomingId }
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
  const result = replayTimeline(initial, log)
  return result.status === 'replayed' ? { status: 'replayed', state: result.state } : result
}

export function replayTimeline(initial: MatchEngine, log: readonly EventBatch[]): ({ status: 'replayed' } & MatchTimeline) | Extract<ReplayResult, { status: 'invalid_log' }> {
  let state = initial
  const effective: AppliedOperation[] = []
  for (const [index, batch] of log.entries()) {
    const first = batch.events[0]
    if (!first || batch.matchId !== state.matchId) {
      return { status: 'invalid_log', batchNumber: index + 1, message: 'El lote está vacío o pertenece a otro partido.' }
    }
    const context = {
      operationId: batch.operationId,
      expectedVersion: batch.expectedVersion,
      timestamp: first.timestamp,
    }
    const command = commandFromEvents(state, first, batch.events)
    const target = effective.at(-1)
    const result = first.type === 'correction'
      ? target && undoMatchOperation(state, target.before, target.batch, context)
      : command && applyMatchCommand(state, command, context)
    if (!result) {
      return { status: 'invalid_log', batchNumber: index + 1, message: 'El lote comienza con un evento no admitido por el motor.' }
    }
    if (result.status !== 'applied' || comparableJson(result.batch.events) !== comparableJson(batch.events)) {
      return { status: 'invalid_log', batchNumber: index + 1, message: 'La secuencia o el resultado del lote no coincide con el estado del partido.' }
    }
    if (first.type === 'correction') effective.pop()
    else effective.push({ batch, before: state })
    state = result.state
  }
  return { status: 'replayed', state, effective }
}
