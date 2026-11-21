import type { Athlete, CompetitionEntry, RosterMembership } from '../club/contracts'
import type { RulesSnapshot } from '../rules/contracts'
import type { Id, IsoTimestamp, Position, Positions, Score, Side } from '../shared/types'

export type MatchPhase = 'BORRADOR' | 'CONVOCATORIA' | 'ALINEACION_SET' | 'LISTO_PARA_SAQUE'
  | 'JUGADA_EN_CURSO' | 'ENTRE_JUGADAS' | 'FIN_SET' | 'FIN_PARTIDO'

export interface Match {
  readonly id: Id<'Match'>
  readonly competitionEntryId: CompetitionEntry['id']
  readonly opponentName: string
  readonly scheduledAt: IsoTimestamp
  readonly venue: string
  readonly location: 'local' | 'visita' | 'neutral'
  readonly stage: string
  readonly rulesSnapshot: RulesSnapshot
  readonly phase: MatchPhase
  readonly version: number
}
export interface MatchRoster {
  readonly id: Id<'MatchRoster'>
  readonly matchId: Match['id']
  readonly athleteId: Athlete['id']
  readonly rosterMembershipId: RosterMembership['id']
  readonly nameSnapshot: string
  readonly jerseyNumberSnapshot: number
  readonly calledUp: boolean
  readonly designatedLibero: boolean
}
/** slotId es una casilla estable de la alineación; position es su posición actual. */
export interface RotationSlot {
  readonly slotId: Position
  readonly startingPlayerId: MatchRoster['id']
  readonly rotationOwnerId: MatchRoster['id']
  readonly courtOccupantId: MatchRoster['id']
}
export interface ActiveLiberoReplacement {
  readonly liberoId: MatchRoster['id']
  readonly regularPlayerId: MatchRoster['id']
  readonly slotId: Position
  readonly enteredAtPosition: Position
  readonly lastReplacementSequence: number
  readonly completedRalliesAtReplacement: number
}
export interface MatchSet {
  readonly id: Id<'Set'>
  readonly matchId: Match['id']
  readonly number: 1 | 2 | 3
  readonly initialOrder: Positions<MatchRoster['id']>
  readonly initialService: Side
  readonly rulesSnapshot: RulesSnapshot
  readonly status: 'pending' | 'active' | 'finished'
  readonly finalScore: Score | null
}
export interface Rally {
  readonly id: Id<'Rally'>
  readonly setId: MatchSet['id']
  readonly ordinal: number
  readonly initialService: Side
  readonly status: 'open' | 'completed'
  readonly winner: Side | null
}
