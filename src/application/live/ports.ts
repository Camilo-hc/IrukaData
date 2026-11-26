import type { Match, MatchSet } from '../../domain/match/contracts'
import type { MatchCommand, MatchEngine, OperationContext } from '../../domain/match/engine'
import type { MatchEvent } from '../../domain/match/events'
import type { LineupInput } from '../../domain/match/lineup'

export type LiveCommand = Exclude<MatchCommand, { type: 'start_set' }>
  | { type: 'begin_match' }
  | { type: 'next_set'; lineup: LineupInput }
  | { type: 'undo' }

export interface LiveSession {
  readonly matchId: Match['id']
  readonly initialVersion: number
}

export type LiveView =
  | { status: 'waiting'; match: Match }
  | { status: 'ready'; match: Match; firstSet: MatchSet }
  | { status: 'started'; match: Match; engine: MatchEngine; recent: readonly MatchEvent[]; canUndo: boolean }

export type LiveResult = { ok: true; view: LiveView } | { ok: false; message: string; view?: LiveView }

export interface LiveMatchRepository {
  observe(matchId: Match['id'], next: (view: LiveView) => void, error: () => void): () => void
  dispatch(matchId: Match['id'], command: LiveCommand, context: OperationContext): Promise<LiveResult>
}
