import { liveQuery } from 'dexie'
import type { LiveCommand, LiveMatchRepository, LiveResult, LiveView } from '../../application/live/ports'
import type { Match, MatchSet } from '../../domain/match/contracts'
import { applyMatchCommand, createMatchEngine, currentSet, undoMatchOperation, type MatchEngine, type OperationContext } from '../../domain/match/engine'
import type { EventBatch } from '../../domain/match/events'
import { POSITIONS } from '../../domain/match/lineup'
import { replayTimeline, type MatchTimeline } from '../../domain/match/replay'
import type { IrukaDatabase } from './database'

interface LoadedMatch {
  readonly view: LiveView
  readonly timeline: MatchTimeline | null
  readonly log: readonly EventBatch[]
}

function startedView(match: Match, state: MatchEngine, effective: readonly EventBatch[], log: readonly EventBatch[]): LiveView {
  const activeIds = new Set(effective.map((batch) => batch.operationId))
  const recent = log
    .filter((batch) => activeIds.has(batch.operationId) || batch.events[0]?.type === 'correction')
    .flatMap((batch) => batch.events)
    .slice(-8)
    .reverse()
  return { status: 'started', match, engine: state, canUndo: effective.length > 1, recent }
}

export class DexieLiveMatchRepository implements LiveMatchRepository {
  constructor(private readonly db: IrukaDatabase) {}

  private tables() {
    const db = this.db
    return [db.matches, db.matchSets, db.matchRosters, db.liveSessions, db.liveBatches]
  }

  private async load(match: Match): Promise<LoadedMatch> {
    const db = this.db
    const session = await db.liveSessions.get(match.id)
    if (!session) {
      const firstSet = await db.matchSets.get({ matchId: match.id, number: 1 })
      const ready = match.active && match.phase === 'LISTO_PARA_SAQUE' && firstSet?.status === 'pending'
      const view: LiveView = ready ? { status: 'ready', match, firstSet } : { status: 'waiting', match }
      return { view, timeline: null, log: [] }
    }
    const [roster, log] = await Promise.all([
      db.matchRosters.where('matchId').equals(match.id).toArray(),
      db.liveBatches.where('matchId').equals(match.id).sortBy('expectedVersion'),
    ])
    const initial = createMatchEngine({ ...match, version: session.initialVersion }, roster)
    const timeline = replayTimeline(initial, log)
    if (timeline.status !== 'replayed' || !timeline.state.sets.length || timeline.state.version !== match.version || timeline.state.phase !== match.phase) {
      throw new Error('El historial local no reproduce el estado del partido.')
    }
    return {
      view: startedView(match, timeline.state, timeline.effective.map(({ batch }) => batch), log),
      timeline,
      log,
    }
  }

  async read(matchId: Match['id']): Promise<LiveView> {
    return this.db.transaction('r', this.tables(), async () => {
      const match = await this.db.matches.get(matchId)
      if (!match) throw new Error('El partido no está disponible.')
      return (await this.load(match)).view
    })
  }

  observe(matchId: Match['id'], next: (view: LiveView) => void, error: () => void): () => void {
    const subscription = liveQuery(() => this.read(matchId)).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }

  async dispatch(matchId: Match['id'], command: LiveCommand, context: OperationContext): Promise<LiveResult> {
    const db = this.db
    return db.transaction('rw', this.tables(), async () => {
      const match = await db.matches.get(matchId)
      if (!match) return { ok: false, message: 'El partido no está disponible.' }
      const { view, timeline, log } = await this.load(match)
      if (timeline?.state.appliedOperations.includes(context.operationId)) return { ok: true, view }
      if (match.version !== context.expectedVersion) {
        return { ok: false, message: 'El partido cambió en otra pestaña. Revisa el estado actualizado.', view }
      }
      if (!match.active) return { ok: false, message: 'El partido está archivado.', view }

      const result = command.type === 'begin_match'
        ? await this.begin(view, context)
        : this.continue(timeline, command, context)
      if (result.status !== 'applied') {
        return { ok: false, message: result.status === 'rejected' ? result.message : 'La operación ya se registró.', view }
      }
      if (command.type === 'begin_match') await db.liveSessions.add({ matchId, initialVersion: match.version })
      await db.liveBatches.add(result.batch)
      const updatedMatch = { ...match, phase: result.state.phase, version: result.state.version }
      const previous = currentSet(timeline?.state ?? result.state)
      if (previous && result.state.sets.length < (timeline?.state.sets.length ?? 0)) {
        await db.matchSets.delete(previous.set.id)
      }
      await db.matchSets.bulkPut(result.state.sets.map(({ set }) => set))
      await db.matches.put(updatedMatch)

      const effective = timeline?.effective.map(({ batch }) => batch) ?? []
      if (command.type === 'undo') effective.pop()
      else effective.push(result.batch)
      return { ok: true, view: startedView(updatedMatch, result.state, effective, [...log, result.batch]) }
    })
  }

  private async begin(view: LiveView, context: OperationContext) {
    if (view.status !== 'ready') {
      return { status: 'rejected', message: 'Confirma la alineación y el primer saque antes de iniciar la anotación.' } as const
    }
    const { match, firstSet } = view
    const roster = await this.db.matchRosters.where('matchId').equals(match.id).toArray()
    return applyMatchCommand(createMatchEngine(match, roster), {
      type: 'start_set',
      number: 1,
      setId: firstSet.id,
      lineup: {
        starters: POSITIONS.map((position) => ({ position, playerId: firstSet.initialOrder[position] })),
        initialService: firstSet.initialService,
      },
    }, context)
  }

  private continue(timeline: MatchTimeline | null, command: Exclude<LiveCommand, { type: 'begin_match' }>, context: OperationContext) {
    if (!timeline) return { status: 'rejected', message: 'Primero inicia la anotación del partido.' } as const
    const { state } = timeline
    if (command.type === 'undo') {
      const target = timeline.effective.at(-1)
      if (!target || timeline.effective.length < 2) {
        return { status: 'rejected', message: 'Todavía no hay registros que deshacer.' } as const
      }
      return undoMatchOperation(state, target.before, target.batch, context)
    }
    if (command.type === 'next_set') {
      const number = state.sets.length + 1
      if (state.phase !== 'FIN_SET' || (number !== 2 && number !== 3)) {
        return { status: 'rejected', message: 'Todavía no puedes preparar otro set.' } as const
      }
      return applyMatchCommand(state, {
        type: 'start_set', number, lineup: command.lineup,
        setId: JSON.stringify([state.matchId, number]) as MatchSet['id'],
      }, context)
    }
    return applyMatchCommand(state, command, context)
  }
}
