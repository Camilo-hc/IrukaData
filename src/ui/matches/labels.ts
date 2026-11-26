import { ACTION_CATALOG, technicalResult } from '../../domain/actions/catalog'
import type { MatchEvent } from '../../domain/match/events'
import type { Side } from '../../domain/shared/types'
import type { MatchContext } from '../../domain/match/context'
import type { MatchPhase, MatchRoster, MatchSet } from '../../domain/match/contracts'
import { BRANCHES, CATEGORIES } from '../../domain/club/validation'

export function participationLabel(context: MatchContext): string {
  return `${context.competition.name} · ${context.team.name} · ${BRANCHES[context.team.branch]} · ${CATEGORIES[context.team.category]} · ${context.season.name}`
}
export function formatMatchDate(value: string): string {
  const [date, time] = value.split('T')
  return `${date?.split('-').reverse().join('-')} · ${time}`
}
export function matchPlayerLabel(player: MatchRoster | undefined): string {
  return player ? `#${player.jerseyNumberSnapshot} ${player.nameSnapshot}` : 'Deportista'
}

export const MATCH_PHASES: Readonly<Record<MatchPhase, string>> = {
  BORRADOR: 'Borrador', CONVOCATORIA: 'Convocatoria', ALINEACION_SET: 'Alineación de set', LISTO_PARA_SAQUE: 'Listo para saque',
  JUGADA_EN_CURSO: 'Jugada en curso', ENTRE_JUGADAS: 'Entre jugadas', FIN_SET: 'Fin de set', FIN_PARTIDO: 'Finalizado',
}

export function matchEventLabel(event: MatchEvent, players: ReadonlyMap<MatchRoster['id'], MatchRoster>, teams: Record<Side, string>, sets: readonly MatchSet[]) {
  const set = sets.find((item) => item.id === event.setId)
  const setLabel = set ? 'set ' + set.number : 'set'
  switch (event.type) {
    case 'technical_action': {
      const player = players.get(event.payload.playerId)
      const name = matchPlayerLabel(player)
      return `${name} · ${ACTION_CATALOG[event.payload.action].label} · ${technicalResult(event.payload)?.label}`
    }
    case 'point_awarded':
      return `Punto para ${teams[event.payload.winner]}${event.payload.cause.kind === 'manual' ? ' · Manual' : ''}`
    case 'set_started':
      return `Inicio del ${setLabel} · Saque de ${teams[event.payload.initialService]}`
    case 'set_finished':
      return `Fin del ${setLabel} · ${event.payload.finalScore.own}–${event.payload.finalScore.opponent}`
    case 'correction':
      return 'Último registro deshecho'
    case 'official_substitution':
    case 'libero_replacement': {
      const type = event.type === 'official_substitution' ? 'Sustitución oficial' : 'Reemplazo de líbero'
      const { outgoingId, incomingId, position, scoreBefore } = event.payload
      const outgoing = players.get(outgoingId)
      const incoming = players.get(incomingId)
      return `${type} · Sale ${matchPlayerLabel(outgoing)} · Entra ${matchPlayerLabel(incoming)} · ${set ? 'Set ' + set.number + ', ' : ''}${scoreBefore.own}–${scoreBefore.opponent}, posición ${position}`
    }
  }
}
