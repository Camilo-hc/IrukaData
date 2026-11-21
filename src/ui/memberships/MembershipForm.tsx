import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RosterMembership } from '../../domain/club/contracts'
import { athleteSearchKey } from '../../domain/athletes/validation'
import { ATHLETE_ROLES, type RosterContext } from '../../domain/memberships/validation'
import type { MembershipDirectory } from '../../application/memberships/ports'
import type { MembershipManagement } from '../../application/memberships/service'
import { useSave } from '../shared/useSave'

interface Props {
  current: RosterMembership | null
  context: RosterContext
  directory: MembershipDirectory
  management: MembershipManagement
  onSaved: (message: string) => void
  onCancel: () => void
}

export function MembershipForm({ current, context, directory, management, onSaved, onCancel }: Props) {
  const [input, setInput] = useState({ athleteId: current?.athleteId ?? '', teamSeasonId: context.teamSeason.id, jerseyNumber: current ? String(current.jerseyNumber) : '', usualRole: current?.usualRole ?? 'sin_definir' })
  const [search, setSearch] = useState('')
  const initialInput = useRef<HTMLInputElement>(null)
  useEffect(() => { initialInput.current?.focus() }, [])
  const { busy, result, run } = useSave(onSaved)
  const fields = result && !result.ok ? result.fields : undefined
  const selected = directory.athletes.find((athlete) => athlete.id === input.athleteId)
  const candidates = directory.athletes.filter((athlete) => athlete.active
    && athleteSearchKey(athlete.name).includes(athleteSearchKey(search))
    && !directory.memberships.some((membership) => membership.athleteId === athlete.id && membership.teamSeasonId === context.teamSeason.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || (a.birthDate ?? '').localeCompare(b.birthDate ?? ''))

  return <form className="editor-panel" aria-label={current ? 'Editar inscripción' : 'Inscribir deportista'} noValidate onSubmit={(event) => {
    event.preventDefault()
    void run(() => management.save(input, current), current ? 'Inscripción actualizada.' : 'Deportista inscrito en esta plantilla.')
  }}>
    <h2>{current ? 'Editar inscripción' : 'Inscribir deportista'}</h2>
    <p>{context.team.name} · {context.season.name}</p>
    <fieldset disabled={busy}>
      {current ? <p>Deportista: <strong>{selected?.name ?? 'Perfil no disponible'}</strong></p> : <fieldset className="athlete-selector">
        <legend>Selecciona un deportista existente</legend>
        <div className="field"><label htmlFor="candidate-search">Buscar deportista para inscribir</label><input id="candidate-search" ref={initialInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="athlete-candidates">{candidates.map((athlete) => <button type="button" className="athlete-choice" key={athlete.id} aria-pressed={input.athleteId === athlete.id} onClick={() => setInput({ ...input, athleteId: athlete.id })}>
          <strong>{athlete.name}</strong><span>{athlete.birthDate ? `Nacimiento: ${athlete.birthDate.split('-').reverse().join('-')}` : 'Nacimiento no registrado'}</span>
        </button>)}</div>
        {!candidates.length && <p>No hay perfiles disponibles para esta búsqueda. Puedes <Link className="text-link" to="/deportistas">gestionar deportistas</Link> o revisar las inscripciones archivadas.</p>}
        {selected && <p className="selection-summary">Seleccionado: <strong>{selected.name}</strong>{!selected.active && ' · Perfil archivado'}</p>}
        {fields?.athleteId && <p className="field-error">{fields.athleteId}</p>}
      </fieldset>}
      <div className="form-grid">
        <div className="field"><label htmlFor="membership-jersey">Dorsal</label><input id="membership-jersey" ref={current ? initialInput : undefined} type="text" inputMode="numeric" value={input.jerseyNumber} onChange={(event) => setInput({ ...input, jerseyNumber: event.target.value })} required autoComplete="off" aria-invalid={Boolean(fields?.jerseyNumber)} aria-describedby={fields?.jerseyNumber ? 'membership-jersey-error' : undefined} />{fields?.jerseyNumber && <span id="membership-jersey-error" className="field-error">{fields.jerseyNumber}</span>}</div>
        <div className="field"><label htmlFor="membership-role">Rol habitual</label><select id="membership-role" value={input.usualRole} onChange={(event) => setInput({ ...input, usualRole: event.target.value as typeof input.usualRole })}>{Object.entries(ATHLETE_ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{fields?.usualRole && <span className="field-error">{fields.usualRole}</span>}</div>
      </div>
      <p className="catalog-help">El dorsal pertenece a esta inscripción. El rol habitual no designa líbero para un partido.</p>
      {current && !current.active && <p className="notice">La inscripción seguirá archivada al guardar. Después puedes restaurarla con un dorsal disponible.</p>}
      {result && !result.ok && <p className="form-error" role="alert">{result.message}</p>}
      <div className="form-actions"><button type="submit" className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button></div>
    </fieldset>
  </form>
}
