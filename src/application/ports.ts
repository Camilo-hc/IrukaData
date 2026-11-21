import type { EventBatch, MatchEvent } from '../domain/match/events'
import type { Match } from '../domain/match/contracts'

export type StorageStatus = 'ready' | 'unavailable'
export interface StorageHealthPort { check(): Promise<StorageStatus> }

/** Puerto para hitos futuros. No existe implementación de partidos en Hito 0. */
export interface MatchEventRepository {
  read(matchId: Match['id']): Promise<readonly MatchEvent[]>
  /** Atómico: comprobar versión, deduplicar operationId y guardar todo o nada. */
  append(batch: EventBatch): Promise<AppendResult>
}
export type AppendResult =
  | Readonly<{ status: 'committed' | 'already_committed'; version: number }>
  | Readonly<{ status: 'version_conflict'; currentVersion: number }>
