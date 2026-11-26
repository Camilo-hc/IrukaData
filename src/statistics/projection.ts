import type { TechnicalAction } from '../domain/actions/catalog'
import type { Athlete } from '../domain/club/contracts'
import type { Match, MatchSet } from '../domain/match/contracts'
import type { MatchEvent } from '../domain/match/events'
import type { AthleteStatistics, PerformanceStatistics, RecordedMatch, StatisticsFilter, TeamStatistics } from './contracts'

export function participantsBySet(record: RecordedMatch): ReadonlyMap<MatchSet['id'], ReadonlySet<Athlete['id']>> {
  const players = new Map(record.roster.map((player) => [player.id, player.athleteId]))
  const sets = new Map<MatchSet['id'], Set<Athlete['id']>>()
  for (const { set } of record.sets) sets.set(set.id, new Set())
  for (const event of record.events) {
    const ids = event.type === 'set_started' ? Object.values(event.payload.initialOrder)
      : event.type === 'official_substitution' || event.type === 'libero_replacement' ? [event.payload.incomingId] : []
    const participants = sets.get(event.setId)
    for (const id of ids) {
      const athleteId = players.get(id)
      if (athleteId) participants?.add(athleteId)
    }
  }
  return sets
}

export function matchingRecord(record: RecordedMatch, filter: StatisticsFilter): boolean {
  const { team, season, competition } = record.context
  return (!filter.teamId || filter.teamId === team.id)
    && (!filter.category || filter.category === team.category)
    && (!filter.seasonId || filter.seasonId === season.id)
    && (!filter.competitionId || filter.competitionId === competition.id)
    && (!filter.matchId || filter.matchId === record.match.id)
    && (!filter.setId || record.sets.some(({ set }) => set.id === filter.setId))
}

export function participated(record: RecordedMatch, athleteId: Athlete['id'], setId?: MatchSet['id']): boolean {
  return [...participantsBySet(record)].some(([id, athletes]) => (!setId || id === setId) && athletes.has(athleteId))
}

function emptyTotals() {
  return {
    matches: new Set<Match['id']>(),
    sets: new Set<MatchSet['id']>(),
    aces: 0, serveErrors: 0, attackAttempts: 0, attackPoints: 0, attackErrors: 0, blockedAttacks: 0,
    receptionCounts: { perfecta: 0, positiva: 0, regular: 0, negativa: 0, error: 0 },
    winningBlocks: 0, controlledDigs: 0, attributedPoints: 0,
  }
}
type Totals = ReturnType<typeof emptyTotals>
type ActionEvent = Extract<MatchEvent, { type: 'technical_action' }>

function addAction(totals: Totals, action: TechnicalAction) {
  switch (action.action) {
    case 'serve':
      if (action.result === 'ace') totals.aces += 1
      if (action.result === 'error') totals.serveErrors += 1
      break
    case 'attack':
      totals.attackAttempts += 1
      if (action.result === 'punto') totals.attackPoints += 1
      if (action.result === 'error' || action.result === 'bloqueado_punto_rival') totals.attackErrors += 1
      if (action.result === 'bloqueado_punto_rival') totals.blockedAttacks += 1
      break
    case 'reception':
      totals.receptionCounts[action.result] += 1
      break
    case 'block':
      if (action.result === 'punto') totals.winningBlocks += 1
      break
    case 'dig':
      if (action.result === 'controlada') totals.controlledDigs += 1
  }
}

function finalize({ matches, sets, ...counts }: Totals): PerformanceStatistics {
  const { attackPoints, attackErrors, attackAttempts, receptionCounts } = counts
  const receptions = Object.values(receptionCounts).reduce((sum, count) => sum + count, 0)
  return {
    ...counts, matchesPlayed: matches.size, setsPlayed: sets.size,
    attackEfficiency: attackAttempts ? (attackPoints - attackErrors) / attackAttempts : null,
    receptionPositivePercentage: receptions ? (receptionCounts.perfecta + receptionCounts.positiva) / receptions : null,
  }
}

function getTotals<K>(group: Map<K, Totals>, id: K): Totals {
  const totals = group.get(id) ?? emptyTotals()
  group.set(id, totals)
  return totals
}

export function projectStatistics(source: readonly RecordedMatch[], filter: StatisticsFilter): {
  readonly athletes: readonly AthleteStatistics[]
  readonly teams: readonly TeamStatistics[]
} {
  const athletes = new Map<Athlete['id'], Totals>()
  const teams = new Map<RecordedMatch['context']['team']['id'], Totals>()
  const unique = new Map(source.map((record) => [record.match.id, record]))
  for (const record of unique.values()) {
    if (!matchingRecord(record, filter)) continue
    const team = filter.athleteId ? undefined : getTotals(teams, record.context.team.id)
    const setTotals = new Map<MatchSet['id'], Map<Athlete['id'], Totals>>()
    for (const [setId, participants] of participantsBySet(record)) {
      if (filter.setId && setId !== filter.setId) continue
      team?.matches.add(record.match.id)
      team?.sets.add(setId)
      const participating = new Map<Athlete['id'], Totals>()
      for (const athleteId of participants) {
        if (filter.athleteId && filter.athleteId !== athleteId) continue
        const individual = getTotals(athletes, athleteId)
        individual.matches.add(record.match.id)
        individual.sets.add(setId)
        participating.set(athleteId, individual)
      }
      setTotals.set(setId, participating)
    }

    const playerIds = new Map(record.roster.map((player) => [player.id, player.athleteId]))
    const actions = new Map<ActionEvent['id'], ActionEvent>()
    for (const event of record.events) {
      const playing = setTotals.get(event.setId)
      if (!playing) continue
      if (event.type === 'technical_action') {
        actions.set(event.id, event)
        const athlete = playerIds.get(event.payload.playerId)
        const individual = athlete && playing.get(athlete)
        if (individual) addAction(individual, event.payload)
        if (team) addAction(team, event.payload)
      }
      if (event.type === 'point_awarded' && event.payload.winner === 'own' && event.payload.cause.kind === 'technical_action') {
        const action = actions.get(event.payload.cause.eventId)
        if (!action || action.setId !== event.setId || action.payload.rallyId !== event.payload.rallyId) continue
        const athlete = playerIds.get(action.payload.playerId)
        const individual = athlete && playing.get(athlete)
        if (individual) individual.attributedPoints += 1
        if (team) team.attributedPoints += 1
      }
    }
  }
  return {
    athletes: [...athletes].map(([athleteId, totals]) => ({ athleteId, ...finalize(totals) })),
    teams: [...teams].map(([teamId, totals]) => ({ teamId, ...finalize(totals) })),
  }
}
