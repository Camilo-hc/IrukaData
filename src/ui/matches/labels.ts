import type { MatchContext } from '../../domain/match/context'
import type { MatchPhase, MatchRoster } from '../../domain/match/contracts'
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
