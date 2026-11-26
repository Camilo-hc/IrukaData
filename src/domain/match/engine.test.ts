import { describe, expect, it } from 'vitest'
import type { TechnicalAction } from '../actions/catalog'
import { DEFAULT_RULES_INPUT, validateRules } from '../rules/configuration'
import type { Id, Side } from '../shared/types'
import type { MatchRoster, MatchSet, Rally } from './contracts'
import type { EventBatch } from './events'
import { applyMatchCommand, createMatchEngine, currentSet, decidingSideChangeReached, targetRallyId, undoMatchOperation, type MatchCommand } from './engine'
import { POSITIONS } from './lineup'
import { liberoReturnRequired } from './player-changes'
import { replayMatch } from './replay'

const matchId = 'match-1' as Id<'Match'>
const outsiderMatchId = 'match-2' as Id<'Match'>
const roster: MatchRoster[] = Array.from({ length: 13 }, (_, index) => ({
  id: `player-${index + 1}` as MatchRoster['id'],
  matchId: index === 8 ? outsiderMatchId : matchId,
  athleteId: `athlete-${index + 1}` as Id<'Athlete'>,
  rosterMembershipId: `member-${index + 1}` as Id<'RosterMembership'>,
  nameSnapshot: `Deportista ${index + 1}`,
  jerseyNumberSnapshot: index + 1,
  calledUp: index !== 9,
  designatedLibero: index === 7 || index === 10,
}))
const regularOrder = POSITIONS.map((position, index) => ({ position, playerId: roster[index]!.id }))
const newOrder = POSITIONS.map((position, index) => ({ position, playerId: roster[6 - index]!.id }))

function setup(decidingSideChange = true, substitutionLimit = '6') {
  const rules = validateRules({ ...DEFAULT_RULES_INPUT, decidingSideChange, substitutionLimit })
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
    initial, log, newContext, run, start, rallyId, succeed,
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

function change(outgoing: number, incoming: number) {
  return { outgoingId: roster[outgoing - 1]!.id, incomingId: roster[incoming - 1]!.id }
}

describe('cambios de posiciones en cancha', () => {
  it('aplica una solicitud oficial como un lote atómico y cuenta cada pareja contra el cupo', () => {
    const fixture = setup(true, '3')
    fixture.start(1, 'opponent')
    const before = fixture.state()
    const request = { type: 'official_substitution', setId: fixture.progress().set.id } as const
    expect(fixture.run({ ...request, selections: [change(2, 7), change(5, 7)] })).toMatchObject({ code: 'invalid_change' })
    expect(fixture.run({ ...request, selections: [change(2, 7), change(2, 12)] })).toMatchObject({ code: 'invalid_change' })
    expect(fixture.run({ ...request, selections: [change(2, 8)] })).toMatchObject({ code: 'invalid_change' })
    expect(fixture.state()).toBe(before)
    const batch = fixture.succeed({ ...request, selections: [change(2, 7), change(5, 12)] })
    expect(batch.events).toMatchObject([
      { sequence: 2, type: 'official_substitution', payload: { ...change(2, 7), slotId: 2, position: 2, scoreBefore: { own: 0, opponent: 0 } } },
      { sequence: 3, type: 'official_substitution', payload: { ...change(5, 12), slotId: 5, position: 5, scoreBefore: { own: 0, opponent: 0 } } },
    ])
    expect(fixture.progress()).toMatchObject({ score: { own: 0, opponent: 0 }, completedRallies: 0, serving: 'opponent', changes: { officialCount: 2 } })
    expect(fixture.run({ ...request, selections: [change(3, 13)] })).toMatchObject({ message: /completarse una jugada/ })
    fixture.point('own')
    expect(fixture.progress().rotation[1]).toMatchObject({ slotId: 2, startingPlayerId: roster[1]!.id, rotationOwnerId: roster[6]!.id })
    expect(fixture.run({ ...request, selections: [change(7, 2), change(12, 5)] })).toMatchObject({ message: /supera el cupo/ })
    expect(fixture.run({ ...request, selections: [change(7, 13)] })).toMatchObject({ message: /titular original/ })
    fixture.succeed({ ...request, selections: [change(7, 2)] })
    expect(fixture.progress().rotation[1]).toMatchObject({ slotId: 2, rotationOwnerId: roster[1]!.id, courtOccupantId: roster[1]!.id })
    expect(fixture.progress().changes.officialCount).toBe(3)
    for (let i = 1; i < 25; i += 1) fixture.point('own')
    expect(fixture.run({ ...request, selections: [change(12, 5)] })).toMatchObject({ code: 'invalid_phase' })
    fixture.start(2, 'opponent')
    expect(fixture.progress().changes).toMatchObject({ officialCount: 0, substitutionPartners: {}, activeLibero: null })
    expect(fixture.run({ ...request, selections: [change(2, 7)] })).toMatchObject({ code: 'invalid_set' })
    expect(fixture.run({ ...request, setId: fixture.progress().set.id, selections: [change(2, 7)] }).status).toBe('applied')
    expect(replayMatch(fixture.initial, fixture.log)).toEqual({ status: 'replayed', state: fixture.state() })
  })

  it('retiene el vínculo de la pareja oficial tras el retorno y rechaza una segunda entrada o salida', () => {
    const fixture = setup(true, '8')
    fixture.start(1, 'own')
    const request = { type: 'official_substitution', setId: fixture.progress().set.id } as const
    fixture.succeed({ ...request, selections: [change(2, 7)] })
    fixture.action(1, { action: 'serve', result: 'en_juego' })
    expect(fixture.run({ ...request, selections: [change(7, 2)] })).toMatchObject({ message: /Termina la jugada/ })
    fixture.point('own')
    fixture.succeed({ ...request, selections: [change(7, 2)] })
    fixture.point('own')
    expect(fixture.run({ ...request, selections: [change(3, 7)] })).toMatchObject({ code: 'invalid_change' })
    expect(fixture.run({ ...request, selections: [change(2, 12)] })).toMatchObject({ code: 'invalid_change' })
    expect(fixture.progress().changes.officialCount).toBe(2)
  })

  it('exige que el regular retorne al llegar el líbero a la delantera y conserva los vínculos al alternar designados', () => {
    const fixture = setup()
    fixture.start(1, 'opponent')
    const setId = fixture.progress().set.id
    const replace = (outgoing: number, incoming: number) =>
      fixture.run({ type: 'libero_replacement', setId, ...change(outgoing, incoming) })
    const serving = fixture.progress().serving
    expect(replace(2, 8)).toMatchObject({ code: 'invalid_change' })
    expect(replace(5, 7)).toMatchObject({ code: 'invalid_change' })
    expect(replace(5, 8)).toMatchObject({
      status: 'applied', batch: { events: [{ payload: { ...change(5, 8), direction: 'enter', regularPlayerId: roster[4]!.id, completedRalliesBefore: 0 } }] },
    })
    expect(fixture.progress()).toMatchObject({ score: { own: 0, opponent: 0 }, serving, rotation: { 5: { slotId: 5, rotationOwnerId: roster[4]!.id, courtOccupantId: roster[7]!.id } } })
    expect(replace(8, 5)).toMatchObject({ message: /completarse una jugada/ })
    expect(fixture.run({ type: 'official_substitution', setId, selections: [change(8, 7)] })).toMatchObject({ message: /regular vinculado/ })
    expect(fixture.run({ type: 'record_action', rallyId: fixture.rallyId(), playerId: roster[7]!.id, action: { action: 'block', result: 'punto' } })).toMatchObject({ code: 'invalid_libero_action' })
    fixture.action(8, { action: 'dig', result: 'controlada' })
    expect(replace(8, 5)).toMatchObject({ message: /Termina la jugada/ })
    fixture.point('own')
    expect(fixture.progress().rotation[4]).toMatchObject({ slotId: 5, courtOccupantId: roster[7]!.id })
    expect(liberoReturnRequired(fixture.progress())).toBe(true)
    expect(fixture.run({ type: 'award_point', winner: 'opponent', rallyId: fixture.rallyId() })).toMatchObject({ code: 'libero_return_required' })
    expect(replace(8, 11)).toMatchObject({ code: 'invalid_change' })
    expect(replace(8, 7)).toMatchObject({ code: 'invalid_change' })
    expect(replace(8, 5)).toMatchObject({ status: 'applied', batch: { events: [{ payload: { direction: 'return', slotId: 5, position: 4 } }] } })
    expect(liberoReturnRequired(fixture.progress())).toBe(false)
    expect(replace(6, 11)).toMatchObject({ message: /completarse una jugada/ })
    fixture.point('opponent')
    expect(replace(6, 11)).toMatchObject({ status: 'applied' })
    fixture.point('opponent')
    expect(replace(1, 8)).toMatchObject({ code: 'invalid_change' })
    expect(replace(11, 8)).toMatchObject({ status: 'applied', batch: { events: [{ payload: { direction: 'libero_to_libero', slotId: 6, position: 5, regularPlayerId: roster[5]!.id } }] } })
    expect(fixture.progress()).toMatchObject({ score: { own: 1, opponent: 2 }, changes: { officialCount: 0, activeLibero: { liberoId: roster[7]!.id, regularPlayerId: roster[5]!.id } } })
    expect(replayMatch(fixture.initial, fixture.log)).toEqual({ status: 'replayed', state: fixture.state() })
  })

  it('deshace toda una solicitud oficial y vuelve a habilitar sus parejas y su cupo', () => {
    const fixture = setup()
    fixture.start(1, 'own')
    const before = fixture.state()
    const request = { type: 'official_substitution', setId: fixture.progress().set.id, selections: [change(2, 7), change(3, 12)] } as const
    const batch = fixture.succeed(request)
    const undo = undoMatchOperation(fixture.state(), before, batch, fixture.newContext())
    if (undo.status !== 'applied') throw new Error('Se esperaba deshacer la solicitud.')
    expect(currentSet(undo.state)).toEqual(currentSet(before))
    expect(replayMatch(fixture.initial, [...fixture.log, undo.batch])).toEqual({ status: 'replayed', state: undo.state })
    expect(applyMatchCommand(undo.state, request, fixture.newContext(undo.state.version)).status).toBe('applied')
  })
})
