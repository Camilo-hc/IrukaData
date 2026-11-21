import { useState } from 'react'
import type { Club, Season, Team } from '../../domain/club/contracts'
import { BRANCHES, CATEGORIES } from '../../domain/club/validation'
import type { ClubCatalog } from '../../application/club/ports'
import type { ClubManagement, SaveResult } from '../../application/club/service'
import { useSave } from './useSave'

interface FormProps {
  management: ClubManagement
  onSaved: (message: string) => void
  onCancel?: () => void
}

function FormFeedback({ result }: { result: SaveResult | null }) {
  return result && !result.ok ? <p className="form-error" role="alert">{result.message}</p> : null
}
function FieldError({ id, error }: { id: string; error: string | undefined }) {
  return error ? <span className="field-error" id={id}>{error}</span> : null
}
function FormButtons({ busy, onCancel }: { busy: boolean; onCancel: (() => void) | undefined }) {
  return <div className="form-actions">
    <button type="submit" className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
    {onCancel && <button type="button" className="button secondary" onClick={onCancel} disabled={busy}>Cancelar</button>}
  </div>
}

export function ClubForm({ current, management, onSaved, onCancel }: FormProps & { current: Club | null }) {
  const [name, setName] = useState(current?.name ?? '')
  const { busy, result, run } = useSave(onSaved)
  const fields = result && !result.ok ? result.fields : undefined
  return <form className="editor-panel" aria-label={current ? 'Editar club' : 'Configurar club'} noValidate onSubmit={(event) => {
    event.preventDefault()
    void run(() => management.saveClub(name, current), current ? 'Nombre del club actualizado.' : 'Club guardado en este dispositivo.')
  }}>
    <h2>{current ? 'Editar club' : 'Configura tu club'}</h2>
    {!current && <p>Escribe el nombre de tu club para comenzar. Los datos de demostración permanecen separados.</p>}
    <fieldset disabled={busy}><div className="field"><label htmlFor="club-name">Nombre del club</label>
      <input id="club-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required autoComplete="organization" aria-invalid={Boolean(fields?.name)} aria-describedby="club-name-error" />
      <FieldError id="club-name-error" error={fields?.name} />
    </div><FormFeedback result={result} /><FormButtons busy={busy} onCancel={onCancel} /></fieldset>
  </form>
}

export function TeamForm({ current, club, catalog, management, onSaved, onCancel }: FormProps & { current: Team | null; club: Club; catalog: ClubCatalog }) {
  const [input, setInput] = useState({ name: current?.name ?? '', branch: current?.branch ?? 'femenino', category: current?.category ?? 'sub14' })
  const [seasonIds, setSeasonIds] = useState<readonly Season['id'][]>(() => catalog.teamSeasons.filter((link) => link.teamId === current?.id && link.active).map((link) => link.seasonId))
  const { busy, result, run } = useSave(onSaved)
  const fields = result && !result.ok ? result.fields : undefined
  const seasons = catalog.seasons.filter((season) => season.active || seasonIds.includes(season.id)).sort((a, b) => b.start.localeCompare(a.start))
  return <form className="editor-panel" aria-label={current ? 'Editar equipo' : 'Nuevo equipo'} noValidate onSubmit={(event) => {
    event.preventDefault()
    void run(() => management.saveTeam(input, club, seasonIds, current), current ? 'Equipo actualizado.' : 'Equipo guardado en este dispositivo.')
  }}>
    <h2>{current ? 'Editar equipo' : 'Nuevo equipo'}</h2>
    <fieldset disabled={busy}><div className="form-grid">
      <div className="field full-width"><label htmlFor="team-name">Nombre del equipo</label><input id="team-name" value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} maxLength={100} required aria-invalid={Boolean(fields?.name)} aria-describedby="team-name-error" /><FieldError id="team-name-error" error={fields?.name} /></div>
      <div className="field"><label htmlFor="team-branch">Rama</label><select id="team-branch" value={input.branch} onChange={(event) => setInput({ ...input, branch: event.target.value as typeof input.branch })}>{Object.entries(BRANCHES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><FieldError id="team-branch-error" error={fields?.branch} /></div>
      <div className="field"><label htmlFor="team-category">Categoría</label><select id="team-category" value={input.category} onChange={(event) => setInput({ ...input, category: event.target.value as typeof input.category })}>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><FieldError id="team-category-error" error={fields?.category} /></div>
    </div>
    <fieldset className="season-choices"><legend>Temporadas del equipo</legend><p>Un equipo puede participar en varias temporadas.</p>
      {seasons.length ? seasons.map((season) => <label className="checkbox-label" key={season.id}><input type="checkbox" checked={seasonIds.includes(season.id)} disabled={!season.active} onChange={(event) => setSeasonIds(event.target.checked ? [...seasonIds, season.id] : seasonIds.filter((id) => id !== season.id))} />{season.name}{!season.active && ' (archivada)'}</label>) : <p>Puedes crear el equipo ahora y asociarlo a una temporada después de crearla.</p>}
    </fieldset>
    <FormFeedback result={result} /><FormButtons busy={busy} onCancel={onCancel} /></fieldset>
  </form>
}

export function SeasonForm({ current, management, onSaved, onCancel }: FormProps & { current: Season | null }) {
  const [input, setInput] = useState({ name: current?.name ?? '', start: current?.start ?? '', end: current?.end ?? '' })
  const { busy, result, run } = useSave(onSaved)
  const fields = result && !result.ok ? result.fields : undefined
  return <form className="editor-panel" aria-label={current ? 'Editar temporada' : 'Nueva temporada'} noValidate onSubmit={(event) => {
    event.preventDefault()
    void run(() => management.saveSeason(input, current), current ? 'Temporada actualizada.' : 'Temporada guardada en este dispositivo.')
  }}>
    <h2>{current ? 'Editar temporada' : 'Nueva temporada'}</h2>
    <fieldset disabled={busy}><div className="form-grid">
      <div className="field full-width"><label htmlFor="season-name">Nombre de la temporada</label><input id="season-name" value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} maxLength={100} required aria-invalid={Boolean(fields?.name)} aria-describedby="season-name-error" /><FieldError id="season-name-error" error={fields?.name} /></div>
      <div className="field"><label htmlFor="season-start">Fecha de inicio</label><input id="season-start" type="date" value={input.start} onChange={(event) => setInput({ ...input, start: event.target.value })} required aria-invalid={Boolean(fields?.start)} aria-describedby="season-start-error" /><FieldError id="season-start-error" error={fields?.start} /></div>
      <div className="field"><label htmlFor="season-end">Fecha de término</label><input id="season-end" type="date" value={input.end} onChange={(event) => setInput({ ...input, end: event.target.value })} required aria-invalid={Boolean(fields?.end)} aria-describedby="season-end-error" /><FieldError id="season-end-error" error={fields?.end} /></div>
    </div><FormFeedback result={result} /><FormButtons busy={busy} onCancel={onCancel} /></fieldset>
  </form>
}
