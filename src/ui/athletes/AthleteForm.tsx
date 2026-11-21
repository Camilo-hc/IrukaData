import { useEffect, useRef, useState } from 'react'
import type { Athlete } from '../../domain/club/contracts'
import { athleteSearchKey } from '../../domain/athletes/validation'
import type { AthleteManagement } from '../../application/athletes/service'
import { useSave } from '../shared/useSave'

interface Props {
  current: Athlete | null
  athletes: readonly Athlete[]
  management: AthleteManagement
  onSaved: (message: string) => void
  onCancel: () => void
}

export function AthleteForm({ current, athletes, management, onSaved, onCancel }: Props) {
  const [input, setInput] = useState({ name: current?.name ?? '', birthDate: current?.birthDate ?? '', notes: current?.notes ?? '' })
  const nameInput = useRef<HTMLInputElement>(null)
  const birthDateInput = useRef<HTMLInputElement>(null)
  const [incompleteBirthDate, setIncompleteBirthDate] = useState(false)
  useEffect(() => { nameInput.current?.focus() }, [])
  const { busy, result, run } = useSave(onSaved)
  const fields = result && !result.ok ? result.fields : undefined
  const birthDateError = incompleteBirthDate ? 'Completa una fecha válida o deja todos sus campos vacíos.' : fields?.birthDate
  const matches = current === null && athleteSearchKey(input.name)
    ? athletes.filter((athlete) => athleteSearchKey(athlete.name) === athleteSearchKey(input.name)) : []

  return <form className="editor-panel" aria-label={current ? 'Editar deportista' : 'Nuevo deportista'} noValidate onSubmit={(event) => {
    event.preventDefault()
    if (birthDateInput.current?.validity.badInput) {
      setIncompleteBirthDate(true)
      birthDateInput.current.focus()
      return
    }
    setIncompleteBirthDate(false)
    void run(() => management.save(input, current), current ? 'Perfil del deportista actualizado.' : 'Deportista guardado en este dispositivo.')
  }}>
    <h2>{current ? 'Editar deportista' : 'Nuevo deportista'}</h2>
    <fieldset disabled={busy}>
      <div className="form-grid">
        <div className="field full-width">
          <label htmlFor="athlete-name">Nombre del deportista</label>
          <input id="athlete-name" ref={nameInput} value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} maxLength={100} required autoComplete="name" aria-invalid={Boolean(fields?.name)} aria-describedby={fields?.name ? 'athlete-name-error' : undefined} />
          {fields?.name && <span id="athlete-name-error" className="field-error">{fields.name}</span>}
        </div>
        <div className="field full-width">
          <label htmlFor="athlete-birth-date">Fecha de nacimiento (opcional)</label>
          <input id="athlete-birth-date" ref={birthDateInput} type="date" value={input.birthDate} onChange={(event) => { setIncompleteBirthDate(false); setInput({ ...input, birthDate: event.target.value }) }} autoComplete="bday" aria-invalid={Boolean(birthDateError)} aria-describedby={birthDateError ? 'athlete-birth-date-error' : undefined} />
          {birthDateError && <span id="athlete-birth-date-error" className="field-error" role={incompleteBirthDate ? 'alert' : undefined}>{birthDateError}</span>}
        </div>
        <div className="field full-width">
          <label htmlFor="athlete-notes">Notas (opcional)</label>
          <textarea id="athlete-notes" value={input.notes} onChange={(event) => setInput({ ...input, notes: event.target.value })} maxLength={2000} rows={4} aria-invalid={Boolean(fields?.notes)} aria-describedby={`athlete-notes-help${fields?.notes ? ' athlete-notes-error' : ''}`} />
          <span id="athlete-notes-help" className="field-hint">Hasta 2000 caracteres. Puedes dejar este campo vacío.</span>
          {fields?.notes && <span id="athlete-notes-error" className="field-error">{fields.notes}</span>}
        </div>
      </div>
      {matches.length > 0 && <aside className="notice" aria-label="Perfiles con el mismo nombre">
        <p>Ya hay perfiles con este nombre. Revisa los existentes antes de crear otro; las personas con el mismo nombre pueden tener perfiles distintos.</p>
        <ul>{matches.map((athlete) => <li key={athlete.id}>{athlete.name} · {athlete.birthDate ? athlete.birthDate.split('-').reverse().join('-') : 'Nacimiento no registrado'}{!athlete.active && ' · Archivado'}</li>)}</ul>
      </aside>}
      {result && !result.ok && <p className="form-error" role="alert">{result.message}</p>}
      <div className="form-actions">
        <button type="submit" className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
      </div>
    </fieldset>
  </form>
}
