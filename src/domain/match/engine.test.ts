import { describe, expect, it } from 'vitest'
import type { TechnicalAction } from '../actions/catalog'
import { DEFAULT_RULES_INPUT, validateRules } from '../rules/configuration'
import type { Id, Side } from '../shared/types'
import type { MatchRoster, MatchSet, Rally } from './contracts'
import type { EventBatch } from './events'
import { applyMatchCommand, createMatchEngine, currentSet, decidingSideChangeReached, targetRallyId, type MatchCommand } from './engine'
import { POSITIONS } from './lineup'
import { replayMatch } from './replay'

const matchId = 'match-1' as Id<'Match'>
const outsiderMatchId = 'match-2' as Id<'Match'>
const roster: MatchRoster[] = Array.from({ length: 10 }, (_, index) => ({
  id: `player-${index + 1}` as MatchRoster['id'],
  matchId: index === 8 ? outsiderMatchId : matchId,
  athleteId: `athlete-${index + 1}` as Id<'Athlete'>,
  rosterMembershipId: `member-${index + 1}` as Id<'RosterMembership'>,
  nameSnapshot: `Deportista ${index + 1}`,
  jerseyNumberSnapshot: index + 1,
  calledUp: index !== 9,
  designatedLibero: index === 7,
}))
const regularOrder = POSITIONS.map((position, index) => ({ position, playerId: roster[index]!.id }))
const newOrder = POSITIONS.map((position, index) => ({ position, playerId: roster[6 - index]!.id }))

function setup(decidingSideChange = true) {
  const rules = validateRules({ ...DEFAULT_RULES_INPUT, decidingSideChange })
  if (!rules.ok) throw new Error('Las reglas de prueba deben ser válidas.')
  const initial = createMatchEngine({ id: matchId, version: 3, rulesSnapshot: rules.value }, roster)
  let state = initial
  let sequence = 0
  const log: EventBatch[] = []

  function newContext(expectedVersion = state.version) {
    sequence += 1
    return { operationId: `op-${sequence}` as Id<'Operation'>, expectedVersion, timestamp: '2026-11-22T14:00:00Z' }
  }

  function run(command: MatchCommand, context = newContext()) {
    const result = applyMatchCommand(state, command, context)
    if (result.status === 'applied') {
      state = result.state
      log.push(result.batch)
    }
    return result
  }

  function succeed(command: MatchCommand) {
    const result = run(command)
    if (result.status !== 'applied') throw new Error(result.status === 'rejected' ? result.message : 'Operación duplicada.')
    return result.batch
  }

  function rallyId() {
    const id = targetRallyId(state)
    if (!id) throw new Error('No hay jugada disponible.')
    return id
  }

  function start(number: MatchSet['number'], side: Side, starters = regularOrder) {
    return succeed({
      type: 'start_set', setId: `set-${number}` as MatchSet['id'], number,
      lineup: { starters, initialService: side },
    })
  }

  return {
    initial, log, newContext, run, start, rallyId,
    state: () => state,
    progress: () => currentSet(state)!,
    action: (number: number, action: TechnicalAction) =>
      succeed({ type: 'record_action', playerId: roster[number - 1]!.id, action, rallyId: rallyId() }),
    point: (winner: Side) => succeed({ type: 'award_point', winner, rallyId: rallyId() }),
  }
}

function finish(fixture: ReturnType<typeof setup>, winner: Side, loserScore: number, winnerScore: number) {
  const loser = winner === 'own' ? 'opponent' : 'own'
  for (let i = 0; i < loserScore; i += 1) {
    fixture.point(loser)
    fixture.point(winner)
  }
  for (let i = loserScore; i < winnerScore; i += 1) fixture.point(winner)
}

describe('motor puro de partido', () => {
  it('exige una primera alineación válida y un servicio confirmado antes de puntuar', () => {
    const fixture = setup()
    const { initial, run, state } = fixture
    expect(targetRallyId(initial)).toBeNull()
    expect(run({ type: 'award_point', winner: 'own', rallyId: 'sin-set' as Rally['id'] })).toMatchObject({ code: 'invalid_phase' })
    const first = { type: 'start_set', number: 1, setId: 'set-1' as MatchSet['id'] } as const
    expect(run({ ...first, number: 2, lineup: { starters: regularOrder, initialService: 'own' } })).toMatchObject({ code: 'invalid_set' })
    expect(run({ ...first, lineup: { starters: regularOrder.slice(1), initialService: 'own' } })).toMatchObject({ code: 'invalid_lineup' })
    expect(run({ ...first, lineup: { starters: regularOrder, initialService: null } })).toMatchObject({ code: 'invalid_lineup' })
    const outsiders = [roster[7]!, roster[8]!, roster[9]!]
    for (const outsider of outsiders) {
      const starters = [{ position: 1, playerId: outsider.id }, ...regularOrder.slice(1)]
      expect(run({ ...first, lineup: { starters, initialService: 'own' } })).toMatchObject({ code: 'invalid_lineup' })
    }
    expect(state()).toBe(initial)
  })

  it('registra varias acciones en una jugada y solo suma al registrar el resultado terminal', () => {
    const fixture = setup()
    fixture.start(1, 'opponent')
    const id = fixture.rallyId()
    const actions: TechnicalAction[] = [
      { action: 'reception', result: 'perfecta' }, { action: 'setting', result: 'precisa' },
      { action: 'attack', result: 'continuidad' }, { action: 'dig', result: 'controlada' },
      { action: 'setting', result: 'imprecisa' }, { action: 'attack', result: 'punto' },
    ]
    for (const action of actions.slice(0, -1)) {
      expect(fixture.action(1, action).events.map((event) => event.type)).toEqual(['technical_action'])
      expect(fixture.progress().score).toEqual({ own: 0, opponent: 0 })
      expect(fixture.state().phase).toBe('JUGADA_EN_CURSO')
      expect(fixture.rallyId()).toBe(id)
    }
    const [action, point] = fixture.action(1, actions.at(-1)!).events
    expect(action).toMatchObject({ type: 'technical_action', payload: { rallyId: id } })
    expect(point).toMatchObject({
      type: 'point_awarded',
      payload: { rallyId: id, winner: 'own', scoreBefore: { own: 0, opponent: 0 }, cause: { kind: 'technical_action', eventId: action!.id } },
    })
    expect(fixture.progress()).toMatchObject({ score: { own: 1, opponent: 0 }, latestRally: { id, status: 'completed', winner: 'own' } })
    expect(fixture.state().phase).toBe('ENTRE_JUGADAS')
    expect(fixture.rallyId()).not.toBe(id)
    expect(fixture.log.flatMap(({ events }) => events).map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it.each([
    { action: { action: 'serve', result: 'ace' }, winner: 'own' },
    { action: { action: 'serve', result: 'error' }, winner: 'opponent' },
    { action: { action: 'attack', result: 'error' }, winner: 'opponent' },
    { action: { action: 'block', result: 'punto' }, winner: 'own' },
  ] as const)('adjudica un solo punto según el catálogo para $action.action/$action.result', ({ action, winner }) => {
    const fixture = setup()
    fixture.start(1, 'own')
    const batch = fixture.action(1, action)
    expect(batch.events).toHaveLength(2)
    expect(batch.events[1]).toMatchObject({ type: 'point_awarded', payload: { winner } })
    expect(fixture.progress().score[winner]).toBe(1)
  })

  it('cierra por punto manual tanto una jugada abierta como una implícita', () => {
    const fixture = setup()
    fixture.start(1, 'opponent')
    fixture.action(1, { action: 'dig', result: 'sin_control' })
    const firstId = fixture.rallyId()
    expect(fixture.point('own').events).toMatchObject([{ type: 'point_awarded', payload: { rallyId: firstId, cause: { kind: 'manual' } } }])
    const secondId = fixture.rallyId()
    expect(fixture.point('opponent').events).toMatchObject([{ type: 'point_awarded', payload: { rallyId: secondId, cause: { kind: 'manual' } } }])
    expect(fixture.progress().score).toEqual({ own: 1, opponent: 1 })
  })

  it('rota hacia la posición 1 solo al recuperar el saque propio y conserva la identidad de las casillas', () => {
    const fixture = setup()
    fixture.start(1, 'opponent')
    const before = fixture.progress()
    fixture.point('opponent')
    expect(fixture.progress().rotation).toBe(before.rotation)
    fixture.point('own')
    const rotated = fixture.progress().rotation
    expect(POSITIONS.map((position) => rotated[position].slotId)).toEqual([2, 3, 4, 5, 6, 1])
    expect(rotated[1]).toEqual(before.rotation[2])
    expect(rotated[6]).toEqual(before.rotation[1])
    expect(fixture.progress().serving).toBe('own')
    fixture.point('own')
    expect(fixture.progress().rotation).toBe(rotated)
    fixture.point('opponent')
    expect(fixture.progress().rotation).toBe(rotated)
    expect(fixture.progress().serving).toBe('opponent')
    fixture.point('own')
    expect(POSITIONS.map((position) => fixture.progress().rotation[position].slotId)).toEqual([3, 4, 5, 6, 1, 2])
    expect(POSITIONS.map((position) => before.rotation[position].slotId)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('valida que quien ejecuta el saque propio ocupe la posición 1 y que registre el inicio de la jugada', () => {
    const fixture = setup()
    fixture.start(1, 'opponent')
    const cmd = { type: 'record_action', playerId: roster[0]!.id, action: { action: 'serve', result: 'ace' } } as const
    expect(fixture.run({ ...cmd, rallyId: fixture.rallyId() })).toMatchObject({ code: 'invalid_server' })
    fixture.point('own')
    expect(fixture.run({ ...cmd, rallyId: fixture.rallyId() })).toMatchObject({ code: 'invalid_server' })
    fixture.action(2, { action: 'serve', result: 'en_juego' })
    expect(fixture.run({ ...cmd, playerId: roster[1]!.id, rallyId: fixture.rallyId() })).toMatchObject({ code: 'invalid_server' })
    expect(fixture.run({
      type: 'record_action', playerId: roster[6]!.id, action: { action: 'attack', result: 'punto' }, rallyId: fixture.rallyId(),
    })).toMatchObject({ code: 'player_not_on_court' })
    const invalidAction = { action: 'serve', result: 'imposible' } as unknown as TechnicalAction
    expect(fixture.run({ ...cmd, action: invalidAction, rallyId: fixture.rallyId() })).toMatchObject({ code: 'invalid_action' })
  })

  it('ignora una reentrega y rechaza operaciones de versión o jugada antiguas', () => {
    const fixture = setup()
    fixture.start(1, 'own')
    const rallyId = fixture.rallyId()
    const command = { type: 'record_action', playerId: roster[0]!.id, action: { action: 'attack', result: 'punto' }, rallyId } as const
    const context = fixture.newContext()
    expect(fixture.run(command, context).status).toBe('applied')
    expect(fixture.run(command, context)).toMatchObject({ status: 'already_applied' })
    expect(fixture.run({ type: 'award_point', winner: 'opponent', rallyId }, fixture.newContext(context.expectedVersion))).toMatchObject({ code: 'version_conflict' })
    expect(fixture.run({ type: 'award_point', winner: 'opponent', rallyId })).toMatchObject({ code: 'stale_rally' })
    expect(fixture.progress().score).toEqual({ own: 1, opponent: 0 })
    expect(fixture.log).toHaveLength(2)
  })

  it.each([[25, 23], [26, 24], [29, 27]])('cierra un set regular %i–%i con ventaja de dos', (winnerScore, loserScore) => {
    const fixture = setup()
    fixture.start(1, 'own')
    finish(fixture, 'own', loserScore, winnerScore)
    expect(fixture.progress().set).toMatchObject({ status: 'finished', finalScore: { own: winnerScore, opponent: loserScore } })
    expect(fixture.state()).toMatchObject({ phase: 'FIN_SET', setsWon: { own: 1, opponent: 0 } })
    expect(targetRallyId(fixture.state())).toBeNull()
    expect(fixture.log.at(-1)?.events.map((event) => event.type)).toEqual(['point_awarded', 'set_finished'])
  })

  it('no rota al cerrar el set y empieza el segundo con un orden y servicio nuevos', () => {
    const fixture = setup()
    fixture.start(1, 'own')
    for (let point = 0; point < 24; point += 1) fixture.point('own')
    fixture.point('opponent')
    const before = fixture.progress().rotation
    fixture.action(1, { action: 'attack', result: 'punto' })
    expect(fixture.progress().rotation).toBe(before)
    expect(fixture.log.at(-1)?.events.map((event) => event.type)).toEqual(['technical_action', 'point_awarded', 'set_finished'])
    fixture.start(2, 'opponent', newOrder)
    expect(fixture.progress()).toMatchObject({ score: { own: 0, opponent: 0 }, serving: 'opponent', latestRally: null })
    expect(POSITIONS.map((position) => fixture.progress().rotation[position].startingPlayerId)).toEqual(newOrder.map(({ playerId }) => playerId))
    finish(fixture, 'own', 23, 25)
    expect(fixture.state()).toMatchObject({ phase: 'FIN_PARTIDO', winner: 'own', setsWon: { own: 2, opponent: 0 } })
    expect(fixture.run({
      type: 'start_set', setId: 'set-3' as MatchSet['id'], number: 3, lineup: { starters: regularOrder, initialService: 'own' },
    })).toMatchObject({ code: 'invalid_phase' })
  })

  it.each([[15, 13], [16, 14]])('resuelve el tercer set %i–%i y cierra el partido 2–1', (winnerScore, loserScore) => {
    const fixture = setup()
    fixture.start(1, 'own')
    finish(fixture, 'own', 23, 25)
    fixture.start(2, 'opponent')
    finish(fixture, 'opponent', 23, 25)
    fixture.start(3, 'opponent', newOrder)
    finish(fixture, 'opponent', loserScore, winnerScore)
    expect(fixture.progress().set.finalScore).toEqual({ own: loserScore, opponent: winnerScore })
    expect(fixture.state()).toMatchObject({ phase: 'FIN_PARTIDO', winner: 'opponent', setsWon: { own: 1, opponent: 2 } })
    const result = fixture.run({
      type: 'start_set', setId: 'set-4' as MatchSet['id'], number: 4 as MatchSet['number'],
      lineup: { starters: regularOrder, initialService: 'own' },
    })
    expect(result).toMatchObject({ code: 'invalid_phase' })
  })

  it.each([true, false])('informa el umbral del tercer set según el perfil configurado (%s)', (enabled) => {
    const fixture = setup(enabled)
    fixture.start(1, 'own')
    finish(fixture, 'own', 0, 25)
    expect(decidingSideChangeReached(fixture.state())).toBe(false)
    fixture.start(2, 'opponent')
    finish(fixture, 'opponent', 0, 25)
    fixture.start(3, 'own')
    for (let i = 0; i < 7; i += 1) fixture.point('own')
    expect(decidingSideChangeReached(fixture.state())).toBe(false)
    const rotation = fixture.progress().rotation
    fixture.point('own')
    expect(decidingSideChangeReached(fixture.state())).toBe(enabled)
    expect(fixture.progress().rotation).toBe(rotation)
  })

  it('reproduce el mismo historial y rechaza un lote alterado, duplicado o desordenado', () => {
    const fixture = setup()
    fixture.start(1, 'opponent')
    fixture.action(2, { action: 'reception', result: 'regular' })
    fixture.action(2, { action: 'attack', result: 'punto' })
    fixture.point('opponent')
    const copied: EventBatch[] = JSON.parse(JSON.stringify(fixture.log))
    expect(replayMatch(fixture.initial, copied)).toEqual({ status: 'replayed', state: fixture.state() })

    const [start, reception, terminal, manual] = copied
    const truncated = { ...terminal!, events: terminal!.events.slice(0, 1) }
    expect(replayMatch(fixture.initial, [start!, reception!, truncated, manual!])).toMatchObject({ status: 'invalid_log', batchNumber: 3 })
    expect(replayMatch(fixture.initial, [start!, reception!, reception!])).toMatchObject({ status: 'invalid_log', batchNumber: 3 })
    expect(replayMatch(fixture.initial, [start!, terminal!, reception!])).toMatchObject({ status: 'invalid_log', batchNumber: 2 })
  })
})
