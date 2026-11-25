import type { Match } from '../../domain/match/contracts'
import type { Id } from '../../domain/shared/types'
import type { LiveCommand, LiveMatchRepository, LiveResult } from './ports'

export function createLiveMatchManagement(repository: LiveMatchRepository, newId: () => string, now: () => string) {
  return {
    observe: repository.observe.bind(repository),
    async dispatch(match: Match, command: LiveCommand): Promise<LiveResult> {
      try {
        return await repository.dispatch(match.id, command, {
          operationId: newId() as Id<'Operation'>,
          expectedVersion: match.version,
          timestamp: now(),
        })
      } catch {
        return { ok: false, message: 'No se pudo guardar. El último estado confirmado se conserva. Vuelve a intentarlo.' }
      }
    },
  }
}

export type LiveMatchManagement = ReturnType<typeof createLiveMatchManagement>
