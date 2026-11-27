import { useState } from 'react'
import type { LiveCommand, LiveResult } from '../../application/live/ports'
import type { MatchRoster } from '../../domain/match/contracts'
import type { SetProgress } from '../../domain/match/engine'
import type { PlayerChangeSelection } from '../../domain/match/events'
import { liberoChangeBlocker, officialChangeBlocker, planLiberoReplacement, planOfficialRequest } from '../../domain/match/player-changes'
import { matchPlayerLabel } from './labels'

type Draft = { type: 'official'; grouped: boolean; selections: readonly PlayerChangeSelection[] } | { type: 'libero' }

interface Props {
  progress: SetProgress
  roster: readonly MatchRoster[]
  selected: MatchRoster | undefined
  busy: boolean
  technicalActive: boolean
  dispatch: (command: LiveCommand) => Promise<LiveResult>
  onOpen: () => void
  onSaved: (incomingId: MatchRoster['id'] | null) => void
}

export function LivePlayerChanges({ progress, roster, selected, busy, technicalActive, dispatch, onOpen, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const open = technicalActive ? null : draft
  const official = open?.type === 'official' ? open : null
  const pending = official?.selections ?? []
  const officialBlock = officialChangeBlocker(progress)
  const liberoBlock = liberoChangeBlocker(progress)
  const officialOptions = selected && !officialBlock ? roster.filter((player) =>
    planOfficialRequest(progress, roster, [...pending, { outgoingId: selected.id, incomingId: player.id }]).ok
  ) : []
  const liberoOptions = selected && !liberoBlock ? roster.filter((player) =>
    planLiberoReplacement(progress, roster, { outgoingId: selected.id, incomingId: player.id }).ok
  ) : []
  const onlyOfficialOption = !official && officialOptions.length === 1 ? officialOptions[0] : undefined
  const onlyLiberoOption = liberoOptions.length === 1 ? liberoOptions[0] : undefined
  const limit = progress.set.rulesSnapshot.officialSubstitutions.limitPerSet
  const players = new Map(roster.map((player) => [player.id, player]))
  const rallyOpen = progress.latestRally?.status === 'open'

  async function save(command: LiveCommand, incomingId: MatchRoster['id'] | null) {
    const result = await dispatch(command)
    if (result.ok) {
      setDraft(null)
      onSaved(incomingId)
    }
  }

  function chooseOfficial(incomingId: MatchRoster['id']) {
    if (!selected || !official) return
    const selections = [...pending, { outgoingId: selected.id, incomingId }]
    if (official.grouped) setDraft({ ...official, selections })
    else void save({ type: 'official_substitution', setId: progress.set.id, selections }, incomingId)
  }

  function chooseLibero(incomingId: MatchRoster['id']) {
    if (!selected) return
    void save({ type: 'libero_replacement', setId: progress.set.id, outgoingId: selected.id, incomingId }, incomingId)
  }

  return <section className="live-changes" aria-label="Cambios en cancha">
    <p className="live-change-count" aria-label="Cupo de cambios oficiales">
      Cambios oficiales <strong>{progress.changes.officialCount} / {limit}</strong>
    </p>
    <div className="live-actions live-change-controls">
      <button type="button" className="button secondary" disabled={busy || (!officialOptions.length && !pending.length)}
        aria-expanded={onlyOfficialOption ? undefined : Boolean(official)}
        onClick={() => {
          onOpen()
          if (onlyOfficialOption && selected) {
            const selections = [{ outgoingId: selected.id, incomingId: onlyOfficialOption.id }]
            void save({ type: 'official_substitution', setId: progress.set.id, selections }, onlyOfficialOption.id)
          } else setDraft(official ? null : { type: 'official', grouped: false, selections: [] })
        }}>
        Cambio oficial
        {onlyOfficialOption && <span className="live-result-point">Entra #{onlyOfficialOption.jerseyNumberSnapshot}</span>}
      </button>
      <button type="button" className="button secondary" disabled={busy || !liberoOptions.length}
        aria-expanded={onlyLiberoOption ? undefined : open?.type === 'libero'}
        onClick={() => {
          onOpen()
          if (onlyLiberoOption) chooseLibero(onlyLiberoOption.id)
          else setDraft(open?.type === 'libero' ? null : { type: 'libero' })
        }}>
        Reemplazo de líbero
        {onlyLiberoOption && <span className="live-result-point">Entra #{onlyLiberoOption.jerseyNumberSnapshot}</span>}
      </button>
    </div>
    {onlyOfficialOption && progress.changes.officialCount + 1 < limit &&
      <button type="button" className="button secondary live-group-toggle" disabled={busy} onClick={() => {
        onOpen()
        setDraft({ type: 'official', grouped: true, selections: [] })
      }}>Agrupar cambios oficiales</button>}
    {rallyOpen ? <p className="live-change-note">Termina la jugada antes de registrar cambios.</p> : <>
      {officialBlock && <p className="live-change-note">{officialBlock}</p>}
      {liberoBlock && <p className="live-change-note">{liberoBlock}</p>}
    </>}
    {official && <div className="live-change-picker">
      <label className="checkbox-label">
        <input type="checkbox" checked={official.grouped} disabled={busy} onChange={(event) =>
          setDraft({ type: 'official', grouped: event.target.checked, selections: [] })} />
        Agrupar cambios en una solicitud
      </label>
      {pending.length > 0 && <>
        <ul className="live-history" aria-label="Cambios por confirmar">
          {pending.map(({ outgoingId, incomingId }) => <li key={outgoingId}>Sale {matchPlayerLabel(players.get(outgoingId))} · Entra {matchPlayerLabel(players.get(incomingId))}</li>)}
        </ul>
        <button type="button" className="button" disabled={busy} onClick={() => {
          void save({ type: 'official_substitution', setId: progress.set.id, selections: pending }, null)
        }}>Confirmar {pending.length} {pending.length === 1 ? 'cambio' : 'cambios'} de la solicitud</button>
      </>}
      {officialOptions.length > 0
        ? <div className="live-actions live-change-options" role="group" aria-label="Entrantes para cambio oficial">
          {officialOptions.map((player) => <button key={player.id} type="button" className="button secondary" disabled={busy}
            onClick={() => chooseOfficial(player.id)}>Entra {matchPlayerLabel(player)}</button>)}
        </div>
        : <p className="live-change-note">Selecciona otra posición para añadir un cambio elegible o confirma la solicitud.</p>}
    </div>}
    {open?.type === 'libero' && liberoOptions.length > 1 &&
      <div className="live-actions live-change-options" role="group" aria-label="Entrantes para reemplazo de líbero">
        {liberoOptions.map((player) => <button key={player.id} type="button" className="button secondary" disabled={busy}
          onClick={() => chooseLibero(player.id)}>Entra {matchPlayerLabel(player)}</button>)}
      </div>}
    {(open || onlyOfficialOption || onlyLiberoOption) && !rallyOpen &&
      <p className="live-change-note">Registra el cambio con el balón fuera de juego y antes del saque.</p>}
  </section>
}
