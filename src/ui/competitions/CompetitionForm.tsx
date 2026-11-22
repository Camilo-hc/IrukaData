import { useState } from 'react'
import type { CompetitionDirectory } from '../../application/competitions/ports'
import type { CompetitionManagement } from '../../application/competitions/service'
import type { Competition } from '../../domain/club/contracts'
import { useSave } from '../shared/useSave'
import { teamSeasonLabel } from './labels'

export function CompetitionForm({ directory, management, current, onSaved, onCancel }: {
  directory: CompetitionDirectory
  management: CompetitionManagement
  current: Competition | null
  onSaved: (message: string) => void
  onCancel: () => void
}) {
  const [input, setInput] = useState({
    name: current?.name ?? '', kind: current?.kind ?? 'Torneo', seasonId: current?.seasonId ?? '', notes: current?.notes ?? '',
    teamSeasonIds: directory.entries.filter((entry) => entry.competitionId === current?.id && entry.active).map((entry) => entry.teamSeasonId as string),
  })
  const { busy, result, run } = useSave(onSaved)
  const fields = result && !result.ok ? result.fields : undefined
  const seasons = directory.seasons.filter((season) => season.active || season.id === input.seasonId)
  const links = directory.teamSeasons.filter((link) => link.seasonId === input.seasonId && (
    (link.active && directory.teams.some((team) => team.id === link.teamId && team.active)) || input.teamSeasonIds.includes(link.id)
  )).sort((a, b) => teamSeasonLabel(directory, a).localeCompare(teamSeasonLabel(directory, b), 'es'))

  return <form className="editor-panel" aria-label={current ? 'Editar torneo' : 'Nuevo torneo'} noValidate onSubmit={(event) => {
    event.preventDefault()
    void run(() => management.save(input, current), current ? 'Torneo actualizado.' : 'Torneo guardado en este dispositivo.')
  }}>
    <h2>{current ? 'Editar torneo' : 'Nuevo torneo'}</h2>
    <fieldset disabled={busy}>
      <div className="form-grid">
        <div className="field full-width"><label htmlFor="competition-name">Nombre del torneo</label><input id="competition-name" value={input.name} maxLength={100} required onChange={(event) => setInput({ ...input, name: event.target.value })} aria-invalid={Boolean(fields?.name)} aria-describedby="competition-name-error" /><span className="field-error" id="competition-name-error">{fields?.name}</span></div>
        <div className="field"><label htmlFor="competition-kind">Tipo de competición</label><input id="competition-kind" value={input.kind} maxLength={60} required onChange={(event) => setInput({ ...input, kind: event.target.value })} aria-invalid={Boolean(fields?.kind)} aria-describedby="competition-kind-error" /><span className="field-error" id="competition-kind-error">{fields?.kind}</span></div>
        <div className="field"><label htmlFor="competition-season">Temporada del torneo</label><select id="competition-season" value={input.seasonId} required disabled={Boolean(current)} onChange={(event) => setInput({ ...input, seasonId: event.target.value, teamSeasonIds: [] })} aria-invalid={Boolean(fields?.seasonId)} aria-describedby="competition-season-error competition-season-hint"><option value="">Selecciona una temporada</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{!season.active && ' (archivada)'}</option>)}</select><span className="field-error" id="competition-season-error">{fields?.seasonId}</span><span className="field-hint" id="competition-season-hint">La temporada se conserva después de crear el torneo.</span></div>
        <div className="field full-width"><label htmlFor="competition-notes">Notas del torneo (opcional)</label><textarea id="competition-notes" value={input.notes} maxLength={2000} onChange={(event) => setInput({ ...input, notes: event.target.value })} aria-invalid={Boolean(fields?.notes)} aria-describedby="competition-notes-error" /><span className="field-error" id="competition-notes-error">{fields?.notes}</span></div>
      </div>
      <fieldset className="season-choices" aria-describedby="competition-teams-error"><legend>Equipos participantes</legend><p>Selecciona al menos un equipo de esta temporada. Un equipo puede participar en varios torneos.</p>
        {links.length ? links.map((link) => {
          const available = link.active && directory.teams.some((team) => team.id === link.teamId && team.active)
          return <label className="checkbox-label" key={link.id}><input type="checkbox" checked={input.teamSeasonIds.includes(link.id)} onChange={(event) => setInput({ ...input, teamSeasonIds: event.target.checked ? [...input.teamSeasonIds, link.id] : input.teamSeasonIds.filter((id) => id !== link.id) })} />{teamSeasonLabel(directory, link)}{!available && ' (asociación no disponible; puedes retirarla)'}</label>
        }) : <p>{input.seasonId ? 'No hay equipos activos asociados a esta temporada. Asócialos desde Equipos.' : 'Selecciona una temporada para ver sus equipos.'}</p>}
        <span className="field-error" id="competition-teams-error">{fields?.teamSeasonIds}</span>
      </fieldset>
      {result && !result.ok && <p className="form-error" role="alert">{result.message}</p>}
      <div className="form-actions"><button className="button" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar torneo'}</button><button className="button secondary" type="button" disabled={busy} onClick={onCancel}>Cancelar</button></div>
    </fieldset>
  </form>
}
