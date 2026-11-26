import type { Position } from '../shared/types'
import type { ActiveLiberoReplacement, MatchRoster } from './contracts'
import type { SetProgress } from './engine'
import type { LiberoReplacementEvent, OfficialSubstitutionEvent, PlayerChangeSelection } from './events'
import { POSITIONS } from './lineup'

export interface CourtChanges {
  readonly officialCount: number
  readonly lastOfficialRequestAt: number | null
  readonly substitutionPartners: Readonly<Partial<Record<Position, MatchRoster['id']>>>
  readonly activeLibero: ActiveLiberoReplacement | null
  readonly lastLiberoReplacementAt: number | null
}

export const INITIAL_COURT_CHANGES: CourtChanges = {
  officialCount: 0,
  lastOfficialRequestAt: null,
  substitutionPartners: {},
  activeLibero: null,
  lastLiberoReplacementAt: null,
}

type Plan<T> = { ok: true; value: T } | { ok: false; message: string }
type PlayerId = MatchRoster['id']

function changeWindow(progress: SetProgress): string | null {
  if (progress.set.status !== 'active') return 'Confirma la alineación del set antes de registrar cambios.'
  if (progress.latestRally?.status === 'open') return 'Termina la jugada antes de registrar cambios.'
  return null
}

export function officialChangeBlocker(progress: SetProgress): string | null {
  const window = changeWindow(progress)
  if (window) return window
  if (progress.changes.officialCount >= progress.set.rulesSnapshot.officialSubstitutions.limitPerSet) {
    return 'Se alcanzó el límite de sustituciones oficiales de este set.'
  }
  if (progress.changes.lastOfficialRequestAt === progress.completedRallies) {
    return 'Debe completarse una jugada antes de otra solicitud de cambio oficial.'
  }
  return null
}

export function liberoChangeBlocker(progress: SetProgress): string | null {
  const window = changeWindow(progress)
  if (window) return window
  if (progress.set.rulesSnapshot.libero.completedRallyBetweenReplacements &&
      progress.changes.lastLiberoReplacementAt === progress.completedRallies) {
    return 'Debe completarse una jugada antes de otro reemplazo de líbero.'
  }
  return null
}

function occupantPosition(progress: SetProgress, id: PlayerId): Position | undefined {
  return POSITIONS.find((position) => progress.rotation[position].courtOccupantId === id)
}

function liberoPositionAllowed(progress: SetProgress, position: Position): boolean {
  return position === 5 || position === 6 || (position === 1 && progress.serving !== 'own')
}

export function liberoReturnRequired(progress: SetProgress): boolean {
  const active = progress.changes.activeLibero
  if (!active || progress.set.status !== 'active') return false
  const position = occupantPosition(progress, active.liberoId)
  return position !== undefined && !liberoPositionAllowed(progress, position)
}

export function planOfficialRequest(
  progress: SetProgress,
  roster: readonly MatchRoster[],
  selections: readonly PlayerChangeSelection[],
): Plan<readonly OfficialSubstitutionEvent['payload'][]> {
  const blocked = officialChangeBlocker(progress)
  if (blocked) return { ok: false, message: blocked }
  if (!selections.length) return { ok: false, message: 'Selecciona al menos un cambio oficial.' }
  if (progress.changes.officialCount + selections.length > progress.set.rulesSnapshot.officialSubstitutions.limitPerSet) {
    return { ok: false, message: 'La solicitud supera el cupo de cambios oficiales de este set.' }
  }

  const byId = new Map(roster.map((player) => [player.id, player]))
  const starters = Object.values(progress.set.initialOrder)
  const usedSubstitutes = new Set(Object.values(progress.changes.substitutionPartners))
  const outgoingSlots = new Set<Position>()
  const payloads: OfficialSubstitutionEvent['payload'][] = []
  for (const { outgoingId, incomingId } of selections) {
    const position = occupantPosition(progress, outgoingId)
    const incoming = byId.get(incomingId)
    if (position === undefined || !incoming?.calledUp || incoming.designatedLibero || occupantPosition(progress, incomingId) !== undefined) {
      return { ok: false, message: 'Selecciona un deportista en cancha y un suplente o titular elegible fuera de ella.' }
    }
    const { slotId, startingPlayerId, rotationOwnerId } = progress.rotation[position]
    if (rotationOwnerId !== outgoingId) {
      return { ok: false, message: 'Debe volver el deportista regular vinculado al líbero antes del cambio oficial en esa posición.' }
    }
    if (outgoingSlots.has(slotId)) return { ok: false, message: 'Cada posición admite un solo cambio por solicitud.' }

    const isReentry = rotationOwnerId !== startingPlayerId
    const substitutePlayerId = isReentry ? outgoingId : incomingId
    if (isReentry ? incomingId !== startingPlayerId
      : progress.changes.substitutionPartners[slotId] || starters.includes(incomingId) || usedSubstitutes.has(incomingId)) {
      return { ok: false, message: 'Cada suplente entra una vez por una sola pareja y solo puede salir por su titular original.' }
    }
    usedSubstitutes.add(substitutePlayerId)
    outgoingSlots.add(slotId)
    payloads.push({ outgoingId, incomingId, slotId, position, startingPlayerId, substitutePlayerId, scoreBefore: progress.score })
  }
  return { ok: true, value: payloads }
}

export function planLiberoReplacement(
  progress: SetProgress,
  roster: readonly MatchRoster[],
  { outgoingId, incomingId }: PlayerChangeSelection,
): Plan<LiberoReplacementEvent['payload']> {
  const blocked = liberoChangeBlocker(progress)
  if (blocked) return { ok: false, message: blocked }
  const position = occupantPosition(progress, outgoingId)
  const incoming = roster.find((player) => player.id === incomingId && player.calledUp)
  if (position === undefined || !incoming || occupantPosition(progress, incomingId) !== undefined) {
    return { ok: false, message: 'Selecciona un deportista en cancha y uno elegible fuera de ella.' }
  }
  const { slotId, rotationOwnerId } = progress.rotation[position]
  const active = progress.changes.activeLibero
  const returning = active?.liberoId === outgoingId && incomingId === active.regularPlayerId
  if (!returning && (!incoming.designatedLibero || (active && active.liberoId !== outgoingId))) {
    return { ok: false, message: 'Solo puede haber un líbero en cancha. Su salida corresponde al regular vinculado o al otro líbero designado.' }
  }
  if (!returning && !liberoPositionAllowed(progress, position)) {
    return { ok: false, message: 'El líbero solo puede ocupar una posición zaguera que no esté al saque.' }
  }
  return {
    ok: true,
    value: {
      outgoingId, incomingId, slotId, position, scoreBefore: progress.score,
      liberoId: returning ? outgoingId : incomingId,
      regularPlayerId: rotationOwnerId,
      direction: returning ? 'return' : active ? 'libero_to_libero' : 'enter',
      completedRalliesBefore: progress.completedRallies,
    },
  }
}
