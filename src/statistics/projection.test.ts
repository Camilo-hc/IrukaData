import { describe, expect, it } from 'vitest'
import type { TechnicalAction } from '../domain/actions/catalog'
import type { Category } from '../domain/club/contracts'
import type { Match, MatchRoster, MatchSet } from '../domain/match/contracts'
import type { MatchContext } from '../domain/match/context'
import { applyMatchCommand, createMatchEngine, targetRallyId, undoMatchOperation, type MatchCommand } from '../domain/match/engine'
import type { EventBatch } from '../domain/match/events'
import { POSITIONS } from '../domain/match/lineup'
import { reconstructMatch } from '../domain/match/replay'
import { DEFAULT_RULES_INPUT, validateRules } from '../domain/rules/configuration'
import type { Id } from '../domain/shared/types'
import type { RecordedMatch } from './contracts'
import { projectStatistics } from './projection'

const athleteId = 'athlete-shared' as Id<'Athlete'>

function fixture(category: Category, dorsal: number) {
  const checked = validateRules(DEFAULT_RULES_INPUT)
  if (!checked.ok) throw new Error('La prueba requiere reglas válidas.')
  const matchId = ('match-' + category) as Match['id']
  const teamId = ('team-' + category) as Id<'Team'>
  const entryId = ('entry-' + category) as Id<'CompetitionEntry'>
  const teamSeasonId = ('roster-' + category) as Id<'TeamSeason'>
  const seasonId = 'season-2026' as Id<'Season'>
  const competitionId = 'cup' as Id<'Competition'>
  const context: MatchContext = {
    entry: { id: entryId, competitionId, teamSeasonId, active: true },
    team: { id: teamId, clubId: 'local-club' as Id<'Club'>, name: category, branch: 'femenino', category, active: true, revision: 1 },
    season: { id: seasonId, name: '2026', start: '2026-01-01', end: '2026-12-31', active: true, revision: 1 },
    teamSeason: { id: teamSeasonId, teamId, seasonId, active: true },
    competition: { id: competitionId, seasonId, name: 'Copa Sur', kind: 'Copa', active: true, revision: 1 },
  }
  const match: Match = {
    id: matchId, competitionEntryId: entryId, opponentName: 'Club Costa', scheduledAt: '2026-11-26T15:30',
    venue: 'Gimnasio', location: 'local', stage: '', active: true, version: 1, phase: 'ALINEACION_SET', rulesSnapshot: checked.value,
  }
  const roster: MatchRoster[] = Array.from({ length: 8 }, (_, index) => ({
    id: (matchId + '-player-' + index) as MatchRoster['id'], matchId,
    athleteId: index === 0 ? athleteId : (matchId + '-athlete-' + index) as Id<'Athlete'>,
    rosterMembershipId: (matchId + '-member-' + index) as Id<'RosterMembership'>,
    nameSnapshot: index === 0 ? 'Álex Marín' : 'Deportista ' + index,
    jerseyNumberSnapshot: index === 0 ? dorsal : 10 + index,
    calledUp: true, designatedLibero: index === 7,
  }))
  const setId = (matchId + '-set-1') as MatchSet['id']
  let engine = createMatchEngine(match, roster)
  const log: EventBatch[] = []
  function operation() {
    return { operationId: ('op-' + engine.version) as Id<'Operation'>, expectedVersion: engine.version, timestamp: '2026-11-26T18:30:00.000Z' }
  }
  function run(command: MatchCommand) {
    const result = applyMatchCommand(engine, command, operation())
    if (result.status !== 'applied') throw new Error(result.status === 'rejected' ? result.message : 'Operación repetida.')
    engine = result.state
    log.push(result.batch)
  }
  run({ type: 'start_set', number: 1, setId, lineup: {
    starters: POSITIONS.map((position, index) => ({ position, playerId: roster[index]!.id })), initialService: 'own',
  } })
  return {
    roster,
    action(action: TechnicalAction) {
      run({ type: 'record_action', rallyId: targetRallyId(engine)!, playerId: roster[0]!.id, action })
    },
    temporaryPoint() {
      const before = engine
      run({ type: 'record_action', rallyId: targetRallyId(engine)!, playerId: roster[0]!.id, action: { action: 'attack', result: 'punto' } })
      const undo = undoMatchOperation(engine, before, log.at(-1)!, operation())
      if (undo.status !== 'applied') throw new Error('Se esperaba deshacer el punto.')
      engine = undo.state
      log.push(undo.batch)
    },
    manualPoint() { run({ type: 'award_point', rallyId: targetRallyId(engine)!, winner: 'own' }) },
    enterLibero() { run({ type: 'libero_replacement', setId, outgoingId: roster[4]!.id, incomingId: roster[7]!.id }) },
    record(): RecordedMatch {
      const persisted: Match = { ...match, phase: engine.phase, version: engine.version }
      const replayed = reconstructMatch(persisted, roster, match.version, log)
      return { match: persisted, context, roster, sets: replayed.state.sets, events: replayed.effective.flatMap(({ batch }) => batch.events) }
    },
  }
}

describe('estadísticas derivadas de partidos', () => {
  it('agrega una identidad en dos categorías y conserva los dorsales históricos de cada partido', () => {
    const first = fixture('sub14', 5)
    first.action({ action: 'serve', result: 'ace' })
    first.temporaryPoint()
    const second = fixture('sub16', 8)
    second.action({ action: 'block', result: 'punto' })
    second.manualPoint()
    const a = first.record()
    const b = second.record()
    const overall = projectStatistics([a, b, a], { athleteId })
    expect(overall.athletes).toHaveLength(1)
    expect(overall.athletes[0]).toMatchObject({
      athleteId, matchesPlayed: 2, setsPlayed: 2, aces: 1, winningBlocks: 1, attackAttempts: 0, attributedPoints: 2,
      attackEfficiency: null, receptionPositivePercentage: null,
    })
    expect(projectStatistics([a, b], { athleteId, category: 'sub16' }).athletes[0]).toMatchObject({
      matchesPlayed: 1, aces: 0, attributedPoints: 1,
    })
    expect(projectStatistics([a, b], { setId: b.sets[0]!.set.id }).teams).toHaveLength(1)
    expect(a.roster[0]?.jerseyNumberSnapshot).toBe(5)
    expect(b.roster[0]?.jerseyNumberSnapshot).toBe(8)
  })

  it('calcula denominadores, atribución y participación sin contar a la banca', () => {
    const game = fixture('sub16', 8)
    game.enterLibero()
    game.action({ action: 'serve', result: 'error' })
    game.action({ action: 'reception', result: 'perfecta' })
    game.action({ action: 'reception', result: 'regular' })
    game.action({ action: 'dig', result: 'controlada' })
    game.action({ action: 'attack', result: 'continuidad' })
    game.action({ action: 'attack', result: 'bloqueado_punto_rival' })
    game.action({ action: 'attack', result: 'punto' })
    const result = projectStatistics([game.record()], {})
    expect(result.athletes.find((row) => row.athleteId === athleteId)).toMatchObject({
      serveErrors: 1, receptionPositivePercentage: 0.5, receptionCounts: { perfecta: 1, regular: 1 },
      attackAttempts: 3, attackPoints: 1, attackErrors: 1, blockedAttacks: 1, attackEfficiency: 0, controlledDigs: 1, attributedPoints: 1,
    })
    expect(result.athletes.some((row) => row.athleteId === game.roster[6]?.athleteId)).toBe(false)
    expect(result.athletes.find((row) => row.athleteId === game.roster[7]?.athleteId)).toMatchObject({ setsPlayed: 1 })
    expect(result.teams[0]).toMatchObject({ matchesPlayed: 1, setsPlayed: 1, attributedPoints: 1 })
  })
})
