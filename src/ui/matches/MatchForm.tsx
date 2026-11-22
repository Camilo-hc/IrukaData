import { useEffect, useRef, useState } from 'react'
import type { MatchDirectory } from '../../application/matches/ports'
import type { MatchManagement } from '../../application/matches/service'
import type { Match } from '../../domain/match/contracts'
import { participationIsActive, resolveMatchContext } from '../../domain/match/context'
import { MATCH_LOCATIONS, type MatchInput } from '../../domain/match/validation'
import { DEFAULT_RULES_INPUT, rulesToInput } from '../../domain/rules/configuration'
import { useSave } from '../shared/useSave'
import { participationLabel } from './labels'
import { RulesFields } from './RulesFields'

export function MatchForm({ current, competitionId, directory, management, onSaved, onCancel }: {
  current: Match | null
  competitionId: string | undefined
  directory: MatchDirectory
  management: MatchManagement
  onSaved: (message: string) => void
  onCancel: () => void
}) {
  const contexts = directory.entries.map((entry) => resolveMatchContext(entry.id, directory))
    .filter((context) => context !== undefined)
    .filter((context) => context.entry.id === current?.competitionEntryId || (participationIsActive(context) && (!competitionId || context.competition.id === competitionId)))
    .sort((a, b) => participationLabel(a).localeCompare(participationLabel(b), 'es'))
  const [input, setInput] = useState<MatchInput>({
    competitionEntryId: current?.competitionEntryId ?? (contexts.length === 1 ? contexts[0]!.entry.id : ''),
    opponentName: current?.opponentName ?? '', scheduledAt: current?.scheduledAt ?? '', venue: current?.venue ?? '', location: current?.location ?? 'neutral', stage: current?.stage ?? '',
  })
  const [rules, setRules] = useState(current ? rulesToInput(current.rulesSnapshot) : { ...DEFAULT_RULES_INPUT })
  const nameInput = useRef<HTMLInputElement>(null)
  useEffect(() => { nameInput.current?.focus() }, [])
  const { busy, result, run } = useSave(onSaved)
  const fields = result && !result.ok ? result.fields : undefined
  const context = resolveMatchContext(input.competitionEntryId, directory)
  return <form className="editor-panel match-editor" aria-label={current ? 'Editar partido' : 'Nuevo partido'} noValidate onSubmit={(event) => {
    event.preventDefault()
    void run(() => management.save(input, rules, current), current ? 'Partido actualizado.' : 'Partido guardado en borrador.')
  }}>
    <h2>{current ? 'Editar partido' : 'Nuevo partido'}</h2>
    <fieldset disabled={busy}>
      <div className="form-grid">
        <div className="field full-width"><label htmlFor="match-entry">Equipo y torneo</label><select id="match-entry" value={input.competitionEntryId} disabled={Boolean(current)} required onChange={(event) => setInput({ ...input, competitionEntryId: event.target.value })} aria-invalid={Boolean(fields?.competitionEntryId)} aria-describedby="match-entry-error"><option value="">Selecciona una participación</option>{contexts.map((item) => <option key={item.entry.id} value={item.entry.id}>{participationLabel(item)}</option>)}</select><span id="match-entry-error" className="field-error">{fields?.competitionEntryId}</span>{context && <span className="field-hint">{context.team.name} · {context.competition.name} · Temporada {context.season.name}</span>}</div>
        <div className="field"><label htmlFor="match-opponent">Nombre del rival</label><input id="match-opponent" ref={nameInput} value={input.opponentName} maxLength={100} required onChange={(event) => setInput({ ...input, opponentName: event.target.value })} aria-invalid={Boolean(fields?.opponentName)} aria-describedby="match-opponent-error" /><span id="match-opponent-error" className="field-error">{fields?.opponentName}</span></div>
        <div className="field"><label htmlFor="match-date">Fecha y hora local del partido</label><input id="match-date" type="datetime-local" step={60} value={input.scheduledAt} required onChange={(event) => setInput({ ...input, scheduledAt: event.target.value })} aria-invalid={Boolean(fields?.scheduledAt)} aria-describedby="match-date-error match-date-help" /><span id="match-date-error" className="field-error">{fields?.scheduledAt}</span><span className="field-hint" id="match-date-help">Indica la hora de la sede. Se conserva tal como la ingreses.</span></div>
        <div className="field"><label htmlFor="match-venue">Sede del partido</label><input id="match-venue" value={input.venue} maxLength={160} required onChange={(event) => setInput({ ...input, venue: event.target.value })} aria-invalid={Boolean(fields?.venue)} aria-describedby="match-venue-error" /><span id="match-venue-error" className="field-error">{fields?.venue}</span></div>
        <div className="field"><label htmlFor="match-location">Condición del equipo</label><select id="match-location" value={input.location} onChange={(event) => setInput({ ...input, location: event.target.value })} aria-invalid={Boolean(fields?.location)} aria-describedby="match-location-error">{Object.entries(MATCH_LOCATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span id="match-location-error" className="field-error">{fields?.location}</span></div>
        <div className="field full-width"><label htmlFor="match-stage">Fase o jornada (opcional)</label><input id="match-stage" value={input.stage} maxLength={100} onChange={(event) => setInput({ ...input, stage: event.target.value })} aria-invalid={Boolean(fields?.stage)} aria-describedby="match-stage-error" /><span id="match-stage-error" className="field-error">{fields?.stage}</span></div>
      </div>
      <RulesFields input={rules} onChange={setRules} fields={fields} />
      {result && !result.ok && <p className="form-error" role="alert">{result.message}</p>}
      <div className="form-actions"><button type="submit" className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar partido'}</button><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button></div>
    </fieldset>
  </form>
}
