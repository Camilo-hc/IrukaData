import { useRef, useState } from 'react'
import type { LiveCommand, LiveResult, LiveView } from '../../application/live/ports'
import { ACTION_CATALOG, technicalResult, type TechnicalAction } from '../../domain/actions/catalog'
import type { MatchRoster, MatchSet } from '../../domain/match/contracts'
import { currentSet, decidingSideChangeReached, targetRallyId } from '../../domain/match/engine'
import type { MatchEvent } from '../../domain/match/events'
import { COURT_POSITIONS } from '../../domain/match/lineup'
import type { Side } from '../../domain/shared/types'
import { LineupEditor } from './LineupPanel'
import { MATCH_PHASES } from './labels'

type Action = keyof typeof ACTION_CATALOG

interface Props {
  view: Extract<LiveView, { status: 'started' }>
  ownName: string
  busy: boolean
  message: string
  dispatch: (command: LiveCommand) => Promise<LiveResult>
}

export function LiveMatchBoard({ view, ownName, busy, message, dispatch }: Props) {
  const { engine, recent, canUndo } = view
  const teams: Record<Side, string> = { own: ownName, opponent: view.match.opponentName }
  const [playerId, selectPlayer] = useState<MatchRoster['id'] | null>(null)
  const [action, selectAction] = useState<Action | null>(null)
  const [editor, setEditor] = useState<{ setId: MatchSet['id']; copy: boolean } | null>(null)
  const lastManualPoint = useRef(-Infinity)
  const progress = currentSet(engine)
  if (!progress) return <p role="alert">El partido todavía no tiene un set abierto.</p>

  const players = new Map(engine.roster.map((player) => [player.id, player]))
  const selected = playerId ? players.get(playerId) : undefined
  const rallyId = targetRallyId(engine)
  const canServe = progress.serving === 'own' && progress.rotation[1].courtOccupantId === playerId && engine.phase !== 'JUGADA_EN_CURSO'
  const entries = action && (action !== 'serve' || canServe) ? Object.entries(ACTION_CATALOG[action].results) : []
  const preparing = engine.phase === 'FIN_SET' && editor?.setId === progress.set.id
  const nextNumber = progress.set.number + 1
  const active = rallyId !== null && !busy
  const finishedSets = engine.sets.filter(({ set }) => set.status === 'finished')

  async function record(result: string) {
    if (!active || !rallyId || !playerId || !action) return
    const saved = await dispatch({ type: 'record_action', rallyId, playerId, action: { action, result } as TechnicalAction })
    if (saved.ok) selectAction(null)
  }

  function manualPoint(winner: Side, clickAt: number) {
    if (!active || !rallyId) return
    if (clickAt - lastManualPoint.current < 350) return
    lastManualPoint.current = clickAt
    selectAction(null)
    void dispatch({ type: 'award_point', rallyId, winner })
  }

  return <section className="live-board" aria-labelledby="live-title">
    <h2 id="live-title">Anotación en vivo</h2>
    <div className="live-scoreboard" role="group" aria-label="Marcador del set" aria-live="polite">
      <div className="live-scoreboard-heading">
        <strong>Set {progress.set.number}</strong>
        <span>{MATCH_PHASES[engine.phase]}</span>
      </div>
      {(['own', 'opponent'] as const).map((side) => <div key={side} className="live-side">
        <span className="live-team">{teams[side]}</span>
        <span className="live-points" aria-label={side === 'own' ? 'Puntos del equipo propio' : 'Puntos del rival'}>{progress.score[side]}</span>
        <span className="live-set-wins">Sets ganados {engine.setsWon[side]}</span>
      </div>)}
      {rallyId && <p className="live-serving">Saque <strong>{teams[progress.serving]}</strong></p>}
      {engine.winner && <p className="live-serving">Ganó <strong>{teams[engine.winner]}</strong></p>}
    </div>
    {message && !preparing && <p role="alert" className="form-error">{message}</p>}
    {rallyId && decidingSideChangeReached(engine) && <p className="live-side-change" role="status">Cambio de lado del tercer set. Mantén el orden de rotación.</p>}
    {finishedSets.length > 0 && <ul className="live-set-results" aria-label="Resultados por set">
      {finishedSets.map(({ set, score }) =>
        <li key={set.id}>Set {set.number} <strong>{score.own}–{score.opponent}</strong></li>)}
    </ul>}
    <div className="live-controls">
      {rallyId && <>
        <button type="button" className="button" disabled={!active} onClick={(event) => { if (event.detail < 2) manualPoint('own', event.timeStamp) }}>Punto propio</button>
        <button type="button" className="button secondary" disabled={!active} onClick={(event) => { if (event.detail < 2) manualPoint('opponent', event.timeStamp) }}>Punto rival</button>
      </>}
      <button type="button" className="button secondary" disabled={!canUndo || busy || preparing} onClick={(event) => {
        if (event.detail >= 2) return
        selectPlayer(null)
        selectAction(null)
        void dispatch({ type: 'undo' })
      }}>Deshacer</button>
      {busy && <span role="status">Guardando…</span>}
    </div>

    {rallyId && <div className="live-grid">
      <section className="live-panel" aria-labelledby="live-court-title">
        <h3 id="live-court-title">En cancha</h3>
        <div className="lineup-court" role="group" aria-label="Posiciones en cancha">
          <p className="lineup-net">Red</p>
          {COURT_POSITIONS.map((position) => {
            const player = players.get(progress.rotation[position].courtOccupantId)
            return <button
              key={position}
              type="button"
              className="lineup-slot"
              aria-pressed={playerId === player?.id}
              disabled={!player || busy}
              onClick={() => {
                if (!player) return
                selectPlayer(player.id)
                selectAction(null)
              }}
            >
              <span>Posición {position}</span>
              <strong className="jersey">#{player?.jerseyNumberSnapshot}</strong>
              <span>{player?.nameSnapshot}</span>
            </button>
          })}
        </div>
      </section>
      <section className="live-panel" aria-labelledby="live-actions-title">
        <h3 id="live-actions-title">Registrar acción</h3>
        <p className="live-player">{selected ? `#${selected.jerseyNumberSnapshot} ${selected.nameSnapshot}` : 'Selecciona un deportista en cancha.'}</p>
        <div className="live-actions" role="group" aria-label="Acciones técnicas">
          {(Object.keys(ACTION_CATALOG) as Action[]).map((key) => <button
            key={key}
            type="button"
            className="button secondary"
            disabled={!selected || busy || (key === 'serve' && !canServe)}
            aria-pressed={key === action}
            onClick={() => selectAction(key)}
          >{ACTION_CATALOG[key].label}</button>)}
        </div>
        {action && entries.length > 0 && <div className="live-actions live-results" role="group" aria-label={`Resultados de ${ACTION_CATALOG[action].label.toLowerCase()}`}>
          {entries.map(([key, definition]) => <button
            key={key}
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={(event) => { if (event.detail < 2) void record(key) }}
          >{definition.label}{definition.pointWinner && <span className="live-result-point">{definition.pointWinner === 'own' ? '+ propio' : '+ rival'}</span>}</button>)}
        </div>}
      </section>
    </div>}
    {engine.phase === 'FIN_SET' && <section className="live-panel" aria-labelledby="live-next-title">
      <h3 id="live-next-title">Alineación del set {nextNumber}</h3>
      {preparing ? <LineupEditor
        setLabel={`set ${nextNumber}`}
        initialOrder={editor.copy ? progress.set.initialOrder : undefined}
        initialService={undefined}
        roster={engine.roster}
        teams={teams}
        editable={!busy}
        successMessage={`Set ${nextNumber} listo para el saque.`}
        save={(lineup) => dispatch({ type: 'next_set', lineup })}
        onSaved={() => {
          setEditor(null)
          selectPlayer(null)
          selectAction(null)
        }}
        onCancel={() => setEditor(null)}
      /> : <div className="form-actions">
        <button type="button" className="button" disabled={busy} onClick={() => setEditor({ setId: progress.set.id, copy: false })}>Nueva alineación</button>
        <button type="button" className="button secondary" disabled={busy} onClick={() => setEditor({ setId: progress.set.id, copy: true })}>Copiar alineación inicial anterior</button>
      </div>}
    </section>}
    <section className="live-panel" aria-labelledby="live-recent-title">
      <h3 id="live-recent-title">Últimos registros</h3>
      <ul className="live-history" aria-label="Últimos registros">
        {recent.map((event) => <li key={event.id}>{eventLabel(event, players, teams, engine.sets.map(({ set }) => set))}</li>)}
      </ul>
    </section>
  </section>
}

function eventLabel(event: MatchEvent, players: ReadonlyMap<MatchRoster['id'], MatchRoster>, teams: Record<Side, string>, sets: readonly MatchSet[]) {
  const set = sets.find((item) => item.id === event.setId)
  switch (event.type) {
    case 'technical_action': {
      const player = players.get(event.payload.playerId)
      const name = player ? `#${player.jerseyNumberSnapshot} ${player.nameSnapshot}` : 'Deportista'
      return `${name} · ${ACTION_CATALOG[event.payload.action].label} · ${technicalResult(event.payload)?.label}`
    }
    case 'point_awarded':
      return `Punto para ${teams[event.payload.winner]}${event.payload.cause.kind === 'manual' ? ' · Manual' : ''}`
    case 'set_started':
      return `Inicio del set ${set?.number} · Saque de ${teams[event.payload.initialService]}`
    case 'set_finished':
      return `Fin del set ${set?.number} · ${event.payload.finalScore.own}–${event.payload.finalScore.opponent}`
    case 'correction':
      return 'Último registro deshecho'
    case 'official_substitution':
      return 'Sustitución oficial'
    case 'libero_replacement':
      return 'Reemplazo de líbero'
  }
}
