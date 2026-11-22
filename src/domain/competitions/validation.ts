import { normalizeName, validateName, type FieldErrors, type Validation } from '../shared/validation'

export interface CompetitionInput {
  name: string
  kind: string
  seasonId: string
  notes: string
  teamSeasonIds: readonly string[]
}

export function validateCompetition(input: CompetitionInput): Validation<CompetitionInput> {
  const name = validateName(input.name)
  const kind = normalizeName(input.kind)
  const notes = input.notes.trim()
  const fields: FieldErrors = {
    ...(!name.ok ? name.fields : {}),
    ...(!kind || kind.length > 60 ? { kind: 'Indica un tipo de competición de hasta 60 caracteres.' } : {}),
    ...(!input.seasonId ? { seasonId: 'Selecciona una temporada.' } : {}),
    ...(notes.length > 2000 ? { notes: 'Usa un máximo de 2000 caracteres.' } : {}),
    ...(!input.teamSeasonIds.length || input.teamSeasonIds.some((id) => !id) ? { teamSeasonIds: 'Selecciona al menos un equipo de la temporada.' } : {}),
  }
  if (!name.ok || Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, value: { ...input, name: name.value, kind, notes, teamSeasonIds: [...new Set(input.teamSeasonIds)] } }
}
