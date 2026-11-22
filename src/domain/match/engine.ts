import { technicalResult, type TechnicalAction } from '../actions/catalog'
import type { RulesSnapshot } from '../rules/contracts'
import type { Id, IsoTimestamp, Position, Positions, Score, Side } from '../shared/types'
import type { Match, MatchRoster, MatchSet, Rally, RotationSlot } from './contracts'
import type { EventBatch, MatchEvent } from './events'
import { POSITIONS, validateLineup, type LineupInput } from './lineup'

type EnginePhase = 'ALINEACION_SET' | 'LISTO_PARA_SAQUE' | 'JUGADA_EN_CURSO' | 'ENTRE_JUGADAS' | 'FIN_SET' | 'FIN_PARTIDO'
type SetNumber = MatchSet['number']

export interface SetProgress {
  readonly set: MatchSet
  readonly score: Score
  readonly serving: Side
  readonly rotation: Positions<RotationSlot>
  readonly latestRally: Rally | null
}

export interface MatchEngine {
  readonly matchId: Match['id']
  readonly roster: readonly MatchRoster[]
  readonly rules: RulesSnapshot
  readonly phase: EnginePhase
  readonly version: number
  readonly lastSequence: number
  readonly appliedOperations: readonly EventBatch['operationId'][]
  readonly sets: readonly SetProgress[]
  readonly setsWon: Score
  readonly winner: Side | null
}

type RallyReference = Readonly<{ rallyId: Rally['id'] }>
export type MatchCommand =
  | Readonly<{ type: 'start_set'; setId: MatchSet['id']; number: SetNumber; lineup: LineupInput }>
  | Readonly<{ type: 'record_action'; playerId: MatchRoster['id']; action: TechnicalAction } & RallyReference>
  | Readonly<{ type: 'award_point'; winner: Side } & RallyReference>

export interface OperationContext {
  readonly operationId: EventBatch['operationId']
  readonly expectedVersion: number
  readonly timestamp: IsoTimestamp
}

type ErrorCode = 'version_conflict' | 'invalid_phase' | 'invalid_set' | 'invalid_lineup'
  | 'stale_rally' | 'invalid_side' | 'invalid_action' | 'player_not_on_court' | 'invalid_server'

type Rejection = { status: 'rejected'; code: ErrorCode; message: string }
export type EngineResult =
  | Rejection
  | { status: 'already_applied'; state: MatchEngine }
  | { status: 'applied'; state: MatchEngine; batch: EventBatch }

export function createMatchEngine(
  match: Pick<Match, 'id' | 'version' | 'rulesSnapshot'>,
  roster: readonly MatchRoster[],
): MatchEngine {
  return {
    matchId: match.id,
    roster: roster.filter((player) => player.matchId === match.id && player.calledUp),
    rules: match.rulesSnapshot,
    phase: 'ALINEACION_SET',
    version: match.version,
    lastSequence: 0,
    appliedOperations: [],
    sets: [],
    setsWon: { own: 0, opponent: 0 },
    winner: null,
  }
}

const emptyScore: Score = { own: 0, opponent: 0 }
const incomingFrom: Positions<Position> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 1 }

function positions<T>(valueAt: (position: Position) => T): Positions<T> {
  return { 1: valueAt(1), 2: valueAt(2), 3: valueAt(3), 4: valueAt(4), 5: valueAt(5), 6: valueAt(6) }
}

function reject(code: ErrorCode, message: string): Rejection {
  return { status: 'rejected', code, message }
}

function addPoint(score: Score, side: Side): Score {
  return { ...score, [side]: score[side] + 1 }
}

export function currentSet(state: MatchEngine): SetProgress | undefined {
  return state.sets.at(-1)
}

function rallyForInput(progress: SetProgress): Rally {
  if (progress.latestRally?.status === 'open') return progress.latestRally
  const ordinal = progress.score.own + progress.score.opponent + 1
  return {
    id: JSON.stringify([progress.set.id, ordinal]) as Rally['id'],
    setId: progress.set.id,
    ordinal,
    initialService: progress.serving,
    status: 'open',
    winner: null,
  }
}

export function targetRallyId(state: MatchEngine): Rally['id'] | null {
  const progress = currentSet(state)
  return progress?.set.status === 'active' ? rallyForInput(progress).id : null
}

export function decidingSideChangeReached(state: MatchEngine): boolean {
  const progress = currentSet(state)
  const threshold = progress?.set.rulesSnapshot.format.decidingSetSideChangeAt
  return progress?.set.number === 3 && threshold != null && Math.max(progress.score.own, progress.score.opponent) >= threshold
}

function eventEnvelope(state: MatchEngine, context: OperationContext, setId: MatchSet['id'], offset: number) {
  return {
    schemaVersion: 1 as const,
    id: JSON.stringify([state.matchId, context.operationId, offset]) as Id<'MatchEvent'>,
    matchId: state.matchId,
    operationId: context.operationId,
    setId,
    sequence: state.lastSequence + offset,
    timestamp: context.timestamp,
  }
}

function accept(state: MatchEngine, context: OperationContext, events: readonly MatchEvent[]): EngineResult {
  return {
    status: 'applied',
    state: {
      ...state,
      version: state.version + 1,
      lastSequence: state.lastSequence + events.length,
      appliedOperations: [...state.appliedOperations, context.operationId],
    },
    batch: { matchId: state.matchId, operationId: context.operationId, expectedVersion: state.version, events },
  }
}

function startSet(state: MatchEngine, command: Extract<MatchCommand, { type: 'start_set' }>, context: OperationContext): EngineResult {
  if (state.phase !== 'ALINEACION_SET' && state.phase !== 'FIN_SET') {
    return reject('invalid_phase', 'Solo puedes iniciar el primer set o confirmar otro después de cerrar el anterior.')
  }
  if (command.number !== state.sets.length + 1 || state.sets.some(({ set }) => set.id === command.setId)) {
    return reject('invalid_set', 'Confirma el siguiente set con un identificador nuevo.')
  }
  const lineup = validateLineup(command.lineup, state.roster)
  if (!lineup.ok) return reject('invalid_lineup', lineup.message)
  const { initialOrder, initialService } = lineup.value
  const set: MatchSet = {
    id: command.setId,
    matchId: state.matchId,
    number: command.number,
    initialOrder,
    initialService,
    rulesSnapshot: state.rules,
    status: 'active',
    finalScore: null,
  }
  const progress: SetProgress = {
    set,
    score: emptyScore,
    serving: initialService,
    latestRally: null,
    rotation: positions((position) => {
      const id = initialOrder[position]
      return { slotId: position, startingPlayerId: id, rotationOwnerId: id, courtOccupantId: id }
    }),
  }
  const event: MatchEvent = {
    ...eventEnvelope(state, context, set.id, 1),
    type: 'set_started',
    payload: { initialOrder, initialService },
  }
  return accept({ ...state, sets: [...state.sets, progress], phase: 'LISTO_PARA_SAQUE' }, context, [event])
}

function replaceCurrentSet(state: MatchEngine, progress: SetProgress): readonly SetProgress[] {
  return [...state.sets.slice(0, -1), progress]
}

type ActionEvent = Extract<MatchEvent, { type: 'technical_action' }>

function finishRally(
  state: MatchEngine,
  progress: SetProgress,
  rally: Rally,
  winner: Side,
  context: OperationContext,
  action?: ActionEvent,
): EngineResult {
  const events: MatchEvent[] = action ? [action] : []
  events.push({
    ...eventEnvelope(state, context, progress.set.id, events.length + 1),
    type: 'point_awarded',
    payload: {
      rallyId: rally.id,
      winner,
      scoreBefore: progress.score,
      cause: action ? { kind: 'technical_action', eventId: action.id } : { kind: 'manual' },
    },
  })

  const score = addPoint(progress.score, winner)
  const other = winner === 'own' ? 'opponent' : 'own'
  const format = progress.set.rulesSnapshot.format
  const target = progress.set.number === 3 ? format.decidingSetTarget : format.regularSetTarget
  const closesSet = score[winner] >= target && score[winner] - score[other] >= format.minimumLead
  const completedRally: Rally = { ...rally, status: 'completed', winner }
  if (!closesSet) {
    const rotate = winner === 'own' && rally.initialService === 'opponent'
    const rotation = rotate ? positions((position) => progress.rotation[incomingFrom[position]]) : progress.rotation
    const next = { ...progress, score, rotation, serving: winner, latestRally: completedRally }
    return accept({ ...state, phase: 'ENTRE_JUGADAS', sets: replaceCurrentSet(state, next) }, context, events)
  }

  const closed: SetProgress = {
    ...progress,
    score,
    latestRally: completedRally,
    set: { ...progress.set, status: 'finished', finalScore: score },
  }
  const setsWon = addPoint(state.setsWon, winner)
  const closesMatch = setsWon[winner] === format.setsToWin
  events.push({
    ...eventEnvelope(state, context, progress.set.id, events.length + 1),
    type: 'set_finished',
    payload: { finalScore: score, winner },
  })
  return accept({
    ...state,
    phase: closesMatch ? 'FIN_PARTIDO' : 'FIN_SET',
    winner: closesMatch ? winner : null,
    setsWon,
    sets: replaceCurrentSet(state, closed),
  }, context, events)
}

function recordAction(
  state: MatchEngine,
  progress: SetProgress,
  rally: Rally,
  command: Extract<MatchCommand, { type: 'record_action' }>,
  context: OperationContext,
): EngineResult {
  const result = technicalResult(command.action)
  if (!result) return reject('invalid_action', 'La acción o el resultado no están en el catálogo.')
  if (!POSITIONS.some((position) => progress.rotation[position].courtOccupantId === command.playerId)) {
    return reject('player_not_on_court', 'Selecciona un deportista propio en cancha.')
  }
  if (command.action.action === 'serve' && (
    rally.initialService !== 'own' || progress.rotation[1].courtOccupantId !== command.playerId || progress.latestRally?.status === 'open'
  )) {
    return reject('invalid_server', 'El saque propio solo puede abrir la jugada y corresponde al ocupante de la posición 1.')
  }
  const event: ActionEvent = {
    ...eventEnvelope(state, context, progress.set.id, 1),
    type: 'technical_action',
    payload: { ...command.action, rallyId: rally.id, playerId: command.playerId },
  }
  if (result.pointWinner) return finishRally(state, progress, rally, result.pointWinner, context, event)

  return accept({
    ...state,
    phase: 'JUGADA_EN_CURSO',
    sets: replaceCurrentSet(state, { ...progress, latestRally: rally }),
  }, context, [event])
}

/** Una operación produce una sola transición y un lote atómico para el futuro repositorio. */
export function applyMatchCommand(state: MatchEngine, command: MatchCommand, context: OperationContext): EngineResult {
  if (state.appliedOperations.includes(context.operationId)) return { status: 'already_applied', state }
  if (context.expectedVersion !== state.version) return reject('version_conflict', 'El partido cambió. Usa la versión actual.')
  if (command.type === 'start_set') return startSet(state, command, context)

  const progress = currentSet(state)
  if (progress?.set.status !== 'active') return reject('invalid_phase', 'Primero confirma la alineación y el saque del set.')
  const rally = rallyForInput(progress)
  if (command.rallyId !== rally.id) return reject('stale_rally', 'La jugada cambió. Usa la jugada actual.')
  if (command.type === 'record_action') return recordAction(state, progress, rally, command, context)
  if (command.winner !== 'own' && command.winner !== 'opponent') return reject('invalid_side', 'Selecciona un equipo para adjudicar el punto.')
  return finishRally(state, progress, rally, command.winner, context)
}
