import type { Position, Positions, Side } from '../shared/types'
import type { MatchRoster } from './contracts'

export const POSITIONS = [1, 2, 3, 4, 5, 6] as const
export const COURT_POSITIONS = [4, 3, 2, 5, 6, 1] as const

export interface StarterAssignment {
  readonly position: number
  readonly playerId: MatchRoster['id']
}

export interface LineupInput {
  readonly starters: readonly StarterAssignment[]
  readonly initialService: string | null
}

type ConfirmedLineup = { initialOrder: Positions<MatchRoster['id']>; initialService: Side }
type LineupValidation = { ok: true; value: ConfirmedLineup } | { ok: false; message: string }

export function validateLineup(input: LineupInput, roster: readonly MatchRoster[]): LineupValidation {
  const { starters, initialService } = input
  if (starters.length !== POSITIONS.length) {
    return { ok: false, message: 'Asigna exactamente seis titulares antes de confirmar.' }
  }
  const assignedPositions = new Set(starters.map((starter) => starter.position))
  if (!POSITIONS.every((position) => assignedPositions.has(position))) {
    return { ok: false, message: 'Usa cada posición del 1 al 6 una sola vez.' }
  }

  const calledUp = new Map(roster.filter((player) => player.calledUp).map((player) => [player.id, player]))
  const athletes = new Set<MatchRoster['athleteId']>()
  for (const { playerId } of starters) {
    const player = calledUp.get(playerId)
    if (!player) return { ok: false, message: 'La alineación solo puede incluir deportistas convocados para este partido.' }
    if (player.designatedLibero) return { ok: false, message: 'Los líberos designados no ocupan posiciones en la alineación inicial.' }
    if (athletes.has(player.athleteId)) return { ok: false, message: 'Cada deportista puede ocupar una sola posición.' }
    athletes.add(player.athleteId)
  }
  if (initialService !== 'own' && initialService !== 'opponent') {
    return { ok: false, message: 'Confirma qué equipo tiene el saque inicial.' }
  }
  const initialOrder = Object.fromEntries(starters.map(({ position, playerId }) => [position, playerId])) as Positions<MatchRoster['id']>
  return { ok: true, value: { initialOrder, initialService } }
}

export function splitLineupRoster(roster: readonly MatchRoster[], order: Partial<Positions<MatchRoster['id']>>) {
  const starters = new Set(Object.values(order))
  const calledUp = roster.filter((player) => player.calledUp)
  return {
    bench: calledUp.filter((player) => !player.designatedLibero && !starters.has(player.id)),
    liberos: calledUp.filter((player) => player.designatedLibero),
  }
}

export function nextOpenPosition(order: Partial<Positions<MatchRoster['id']>>, current: Position): Position {
  return POSITIONS.find((position) => position > current && !order[position])
    ?? POSITIONS.find((position) => !order[position])
    ?? current
}
