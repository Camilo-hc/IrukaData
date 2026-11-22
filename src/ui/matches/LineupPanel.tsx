import { useRef, useState } from 'react'
import type { CallUpDirectory } from '../../application/matches/ports'
import type { MatchManagement } from '../../application/matches/service'
import type { Match, MatchRoster, MatchSet } from '../../domain/match/contracts'
import { COURT_POSITIONS, POSITIONS, nextOpenPosition, splitLineupRoster } from '../../domain/match/lineup'
import type { Position, Positions, Side } from '../../domain/shared/types'
import { useSave } from '../shared/useSave'

type Order = Partial<Positions<MatchRoster['id']>>

interface PanelProps {
  match: Match
  teamName: string
  directory: CallUpDirectory
  canEdit: boolean
  management: MatchManagement
}

export function LineupPanel({ match, teamName, directory, canEdit, management }: PanelProps) {
  const [editor, setEditor] = useState<{ match: Match; firstSet: MatchSet | undefined } | null>(null)
  const [notice, setNotice] = useState('')
  const { firstSet, roster } = directory
  const preparing = match.phase === 'CONVOCATORIA' || match.phase === 'ALINEACION_SET'
  const correcting = match.phase === 'LISTO_PARA_SAQUE' && firstSet?.status === 'pending'
  const editable = canEdit && (preparing || correcting) && (!firstSet || firstSet.status === 'pending')
  const teams: Record<Side, string> = { own: teamName, opponent: match.opponentName }

  if (match.phase === 'BORRADOR' && !firstSet) return null
  return <section className="athlete-profile lineup-panel" aria-labelledby="lineup-title">
    <h2 id="lineup-title">Alineación inicial · Set 1</h2>
    {notice && <p role="status" className="notice">{notice}</p>}
    {editor ? <LineupEditor
      match={editor.match}
      firstSet={editor.firstSet}
      roster={roster}
      teams={teams}
      management={management}
      editable={editable}
      onCancel={() => setEditor(null)}
      onSaved={(message) => {
        setNotice(message)
        setEditor(null)
      }}
    /> : <>
      {firstSet ? <>
        <p>Primer saque <strong>{teams[firstSet.initialService]}</strong></p>
        <div className="lineup-court" role="group" aria-label="Posiciones confirmadas">
          <p className="lineup-net">Red</p>
          {COURT_POSITIONS.map((position) => <div className="lineup-slot" role="group" aria-label={`Posición ${position}`} key={position}>
            <span>Posición {position}</span>
            <PlayerMark player={roster.find((player) => player.id === firstSet.initialOrder[position])} />
          </div>)}
        </div>
        <LineupReserves roster={roster} order={firstSet.initialOrder} />
      </> : <p>Asigna las seis posiciones y registra el primer servicio.</p>}
      {editable && <button type="button" className="button" disabled={directory.matchVersion !== match.version} onClick={() => {
        setNotice('')
        setEditor({ match, firstSet })
      }}>{firstSet ? 'Corregir alineación' : 'Preparar alineación'}</button>}
    </>}
  </section>
}

function LineupEditor({ match, firstSet, roster, teams, management, editable, onCancel, onSaved }: {
  match: Match
  firstSet: MatchSet | undefined
  roster: readonly MatchRoster[]
  teams: Record<Side, string>
  management: MatchManagement
  editable: boolean
  onCancel: () => void
  onSaved: (message: string) => void
}) {
  const [position, setPosition] = useState<Position>(1)
  const [order, setOrder] = useState<Order>(() => firstSet?.initialOrder ?? {})
  const [service, setService] = useState<Side | null>(() => firstSet?.initialService ?? null)
  const slotRefs = useRef<Partial<Record<Position, HTMLButtonElement>>>({})
  const { busy, result, run, clearResult } = useSave(onSaved)
  const assigned = new Set(Object.values(order))
  const regulars = roster.filter((player) => player.calledUp && !player.designatedLibero)
    .sort((a, b) => a.jerseyNumberSnapshot - b.jerseyNumberSnapshot)

  function assign(playerId: MatchRoster['id']) {
    if (assigned.has(playerId)) return
    const next = { ...order, [position]: playerId }
    const target = nextOpenPosition(next, position)
    setOrder(next)
    setPosition(target)
    slotRefs.current[target]?.focus({ preventScroll: true })
    clearResult()
  }

  return <form aria-label="Preparar alineación del primer set" onSubmit={(event) => {
    event.preventDefault()
    if (!editable) return
    const starters = POSITIONS.flatMap((slot) => {
      const playerId = order[slot]
      return playerId ? [{ position: slot, playerId }] : []
    })
    void run(() => management.saveInitialLineup(match, { starters, initialService: service }), 'Alineación y servicio guardados. Set 1 listo para el saque.')
  }}>
    <fieldset disabled={busy || !editable}>
      <legend className="sr-only">Titulares y primer saque</legend>
      <p>Selecciona una posición de la cancha y luego la tarjeta del titular.</p>
      <p aria-live="polite" className="call-up-count">{assigned.size} de 6 posiciones asignadas · Posición seleccionada: {position}</p>
      <div className="lineup-court" role="group" aria-label="Asignar posiciones">
        <p className="lineup-net">Red</p>
        {COURT_POSITIONS.map((slot) => <button
          type="button"
          className="lineup-slot"
          key={slot}
          ref={(element) => { if (element) slotRefs.current[slot] = element }}
          aria-pressed={slot === position}
          onClick={() => setPosition(slot)}
        >
          <span>Posición {slot}</span>
          <PlayerMark player={roster.find((player) => player.id === order[slot])} />
        </button>)}
      </div>
      {order[position] && <button type="button" className="button secondary lineup-clear" onClick={() => {
        const next = { ...order }
        delete next[position]
        setOrder(next)
        clearResult()
        slotRefs.current[position]?.focus()
      }}>Quitar titular de posición {position}</button>}
      <ul className="call-up-grid" aria-label="Convocados elegibles como titulares">
        {regulars.map((player) => <li key={player.id}>
          <button className="athlete-choice lineup-choice" type="button" disabled={assigned.has(player.id)} onClick={() => assign(player.id)}>
            <span className="jersey">#{player.jerseyNumberSnapshot}</span>
            <strong>{player.nameSnapshot}</strong>
            {assigned.has(player.id) && <span>Titular asignado</span>}
          </button>
        </li>)}
      </ul>
      <LineupReserves roster={roster} order={order} />
      <fieldset className="lineup-service">
        <legend>¿Quién saca primero?</legend>
        {(['own', 'opponent'] as const).map((side) => <label key={side} className="checkbox-label">
          <input type="radio" name="initial-service" value={side} checked={side === service} onChange={() => {
            setService(side)
            clearResult()
          }} />
          {teams[side]} {side === 'own' ? '(equipo propio)' : '(rival)'}
        </label>)}
      </fieldset>
    </fieldset>
    {!editable && <p className="form-error" role="alert">El partido ya no permite guardar esta alineación.</p>}
    {result && !result.ok && <p className="form-error" role="alert">{result.message}</p>}
    <div className="form-actions">
      <button type="submit" className="button" disabled={!editable || busy}>{busy ? 'Guardando…' : 'Confirmar alineación y saque'}</button>
      <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
    </div>
  </form>
}

function PlayerMark({ player }: { player: MatchRoster | undefined }) {
  if (!player) return <span className="record-status">Sin asignar</span>
  return <>
    <strong className="jersey">#{player.jerseyNumberSnapshot}</strong>
    <span>{player.nameSnapshot}</span>
  </>
}

function LineupReserves({ roster, order }: { roster: readonly MatchRoster[]; order: Order }) {
  const { bench, liberos } = splitLineupRoster(roster, order)
  return <div className="lineup-reserves">
    <div>
      <h3>Banca</h3>
      {bench.length ? <ul aria-label="Banca">{bench.map((player) => <li key={player.id}><PlayerMark player={player} /></li>)}</ul> : <p>Sin suplentes.</p>}
    </div>
    <div>
      <h3>Líberos</h3>
      {liberos.length ? <ul aria-label="Líberos designados">{liberos.map((player) => <li key={player.id}><PlayerMark player={player} /></li>)}</ul> : <p>Sin líberos designados.</p>}
    </div>
  </div>
}
