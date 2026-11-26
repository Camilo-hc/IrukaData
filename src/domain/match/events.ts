import type { TechnicalAction } from '../actions/catalog'
import type { Match, MatchRoster, MatchSet, Rally } from './contracts'
import type { Id, IsoTimestamp, Position, Positions, Score, Side } from '../shared/types'

interface EventEnvelope {
  readonly schemaVersion: 1
  readonly id: Id<'MatchEvent'>
  readonly matchId: Match['id']
  readonly setId: MatchSet['id']
  readonly operationId: Id<'Operation'>
  readonly sequence: number
  readonly timestamp: IsoTimestamp
}
type Event<K extends string, P> = EventEnvelope & Readonly<{ type: K; payload: P }>

export interface PlayerChangeSelection {
  readonly outgoingId: MatchRoster['id']
  readonly incomingId: MatchRoster['id']
}

interface PlayerChange extends PlayerChangeSelection {
  readonly slotId: Position
  readonly position: Position
  readonly scoreBefore: Score
}

export type MatchEvent =
  | Event<'technical_action', TechnicalAction & Readonly<{ rallyId: Rally['id']; playerId: MatchRoster['id'] }>>
  | Event<'point_awarded', Readonly<{
      rallyId: Rally['id']; winner: Side; scoreBefore: Score
      cause: Readonly<{ kind: 'manual' }> | Readonly<{ kind: 'technical_action'; eventId: Id<'MatchEvent'> }>
    }>>
  | Event<'official_substitution', PlayerChange & Readonly<{ startingPlayerId: MatchRoster['id']; substitutePlayerId: MatchRoster['id'] }>>
  | Event<'libero_replacement', PlayerChange & Readonly<{
      liberoId: MatchRoster['id']; regularPlayerId: MatchRoster['id']
      direction: 'enter' | 'return' | 'libero_to_libero'
      completedRalliesBefore: number
    }>>
  | Event<'set_started', Readonly<{ initialOrder: Positions<MatchRoster['id']>; initialService: Side }>>
  | Event<'set_finished', Readonly<{ finalScore: Score; winner: Side }>>
  | Event<'correction', Readonly<{ targetOperationId: Id<'Operation'>; reason: string }>>

export interface EventBatch {
  readonly matchId: Match['id']
  readonly operationId: Id<'Operation'>
  readonly expectedVersion: number
  readonly events: readonly MatchEvent[]
}

export type OfficialSubstitutionEvent = Extract<MatchEvent, { type: 'official_substitution' }>
export type LiberoReplacementEvent = Extract<MatchEvent, { type: 'libero_replacement' }>
