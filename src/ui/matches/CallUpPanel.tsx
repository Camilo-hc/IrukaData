import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CallUpDirectory } from '../../application/matches/ports'
import type { MatchManagement } from '../../application/matches/service'
import { requiredLiberos, type CallUpSelection } from '../../domain/match/call-up'
import type { Match, MatchRoster } from '../../domain/match/contracts'
import { useSave } from '../shared/useSave'

type MembershipId = MatchRoster['rosterMembershipId']
type Selected = ReadonlyMap<MembershipId, boolean>

interface Props {
  match: Match
  teamSeasonId: string | undefined
  canEdit: boolean
  management: MatchManagement
}

export function CallUpPanel({ match, teamSeasonId, canEdit, management }: Props) {
  const [directory, setDirectory] = useState<CallUpDirectory | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [editorMatch, setEditorMatch] = useState<Match | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => management.observeCallUp(match.id, (value) => {
    setDirectory(value)
    setFailed(false)
  }, () => setFailed(true)), [management, match.id, attempt])

  const editable = canEdit && (match.phase === 'BORRADOR' || match.phase === 'CONVOCATORIA')
  const synchronized = directory?.matchVersion === match.version
  const roster = directory?.roster
  const candidates = directory?.candidates
  const canOpen = synchronized && Boolean(candidates?.length)

  return <section className="athlete-profile call-up-panel" aria-labelledby="call-up-title">
    <h2 id="call-up-title">Convocatoria</h2>
    {failed ? <div>
      <p role="alert">No se pudo leer la convocatoria de este dispositivo.</p>
      <button type="button" className="button secondary" onClick={() => {
        setFailed(false)
        setDirectory(null)
        setAttempt((value) => value + 1)
      }}>Reintentar</button>
    </div> : !directory ? <p role="status">Cargando convocatoria…</p> : <>
      {notice && <p role="status" className="notice">{notice}</p>}
      {editorMatch ? <CallUpEditor
        directory={directory}
        match={editorMatch}
        management={management}
        editable={editable}
        onCancel={() => setEditorMatch(null)}
        onSaved={(message) => {
          setEditorMatch(null)
          setNotice(message)
        }}
      /> : <>
        {roster?.length ? <ul className="call-up-grid" aria-label="Deportistas convocados">
          {[...roster].sort((a, b) => a.jerseyNumberSnapshot - b.jerseyNumberSnapshot).map((player) => <li className="call-up-person" key={player.id}>
            <span className="jersey">#{player.jerseyNumberSnapshot}</span>
            <strong>{player.nameSnapshot}</strong>
            {player.designatedLibero && <span className="record-status">Líbero</span>}
          </li>)}
        </ul> : <p>Aún no hay deportistas convocados.</p>}
        {editable && !candidates?.length && <p>Inscribe y activa deportistas en la plantilla del partido para preparar la convocatoria.</p>}
        {editable && <div className="form-actions">
          <button type="button" className="button" disabled={!canOpen} onClick={() => {
            setNotice('')
            setEditorMatch(match)
          }}>{roster?.length ? 'Editar convocatoria' : 'Preparar convocatoria'}</button>
          {teamSeasonId && <Link className="button secondary" to={`/plantillas/${encodeURIComponent(teamSeasonId)}`}>Ver plantilla</Link>}
        </div>}
      </>}
    </>}
  </section>
}

function CallUpEditor({ directory, match, management, editable, onCancel, onSaved }: {
  directory: CallUpDirectory
  match: Match
  management: MatchManagement
  editable: boolean
  onCancel: () => void
  onSaved: (message: string) => void
}) {
  const [selected, setSelected] = useState<Selected>(() => new Map(directory.roster.map((player) => [player.rosterMembershipId, player.designatedLibero])))
  const { busy, result, run, clearResult } = useSave(onSaved)
  const availableIds = new Set(directory.candidates.map((candidate) => candidate.membershipId))
  const savedByMembership = new Map(directory.roster.map((player) => [player.rosterMembershipId, player]))
  const choices = [
    ...directory.candidates.map((candidate) => {
      const saved = savedByMembership.get(candidate.membershipId)
      return {
        ...candidate,
        name: saved?.nameSnapshot ?? candidate.name,
        jerseyNumber: saved?.jerseyNumberSnapshot ?? candidate.jerseyNumber,
      }
    }),
    ...directory.roster.filter((player) => !availableIds.has(player.rosterMembershipId)).map((player) => ({
      membershipId: player.rosterMembershipId, name: player.nameSnapshot, jerseyNumber: player.jerseyNumberSnapshot,
    })),
  ].sort((a, b) => a.jerseyNumber - b.jerseyNumber || a.name.localeCompare(b.name, 'es'))
  const missing = [...selected.keys()].some((id) => !availableIds.has(id))
  const rules = match.rulesSnapshot.libero
  const liberos = [...selected.values()].filter(Boolean).length

  function select(id: MembershipId, value: boolean | undefined) {
    clearResult()
    setSelected((current) => {
      const next = new Map(current)
      if (value === undefined) next.delete(id)
      else next.set(id, value)
      return next
    })
  }

  return <form aria-label="Editar convocatoria del partido" onSubmit={(event) => {
    event.preventDefault()
    if (missing || !editable) return
    const selection = choices.flatMap((choice): CallUpSelection[] => {
      const libero = selected.get(choice.membershipId)
      return libero === undefined ? [] : [{ ...choice, libero }]
    })
    void run(() => management.saveCallUp(match, selection), 'Convocatoria guardada.')
  }}>
    <fieldset disabled={busy || !editable}>
      <legend>Deportistas de la plantilla</legend>
      <p>Selecciona al menos seis deportistas sin designación de líbero. El rol habitual de cada persona se conserva en la plantilla.</p>
      <p className="call-up-count" aria-live="polite">{selected.size} convocados · {liberos} líberos · mínimo {requiredLiberos(selected.size, rules)} y máximo {rules.maximumDesignated}</p>
      <ul className="call-up-grid">{choices.map((choice) => {
        const id = choice.membershipId
        const picked = selected.has(id)
        const available = availableIds.has(id)
        return <li className="call-up-person" key={id}>
          <button type="button" className="athlete-choice" aria-pressed={picked} disabled={!available && !picked}
            onClick={() => select(id, picked ? undefined : false)}>
            <span className="jersey">#{choice.jerseyNumber}</span>
            <strong>{choice.name}</strong>
          </button>
          {!available && <small>Inscripción o perfil inactivo</small>}
          {picked && available && <label className="checkbox-label">
            <input type="checkbox" checked={selected.get(id) === true} onChange={(event) => select(id, event.target.checked)}
              disabled={!selected.get(id) && liberos >= rules.maximumDesignated} aria-label={`Designar líbero a ${choice.name} #${choice.jerseyNumber}`} />
            Designar líbero
          </label>}
        </li>
      })}</ul>
      {match.phase === 'BORRADOR' && <p className="field-hint">Al guardar la convocatoria, quedan fijos los datos y las reglas del partido. Podrás ajustar la selección mientras siga en esta etapa.</p>}
    </fieldset>
    {missing && <div className="form-error">
      <p role="alert">Hay deportistas seleccionados que ya no están disponibles.</p>
      <button type="button" className="button secondary" disabled={busy || !editable} onClick={() => {
        clearResult()
        setSelected((current) => new Map([...current].filter(([id]) => availableIds.has(id))))
      }}>Quitar selecciones inactivas</button>
    </div>}
    {!editable && <p className="form-error" role="alert">El partido ya no permite guardar cambios en la convocatoria.</p>}
    {result && !result.ok && <p className="form-error" role="alert">{result.message}</p>}
    <div className="form-actions">
      <button type="submit" className="button" disabled={busy || missing || !editable}>{busy ? 'Guardando…' : 'Guardar convocatoria'}</button>
      <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
    </div>
  </form>
}
