import type { CompetitionEntry } from '../club/contracts'
import type { Match } from './contracts'
import { isCalendarDate, normalizeName, type FieldErrors, type Validation } from '../shared/validation'

export const MATCH_LOCATIONS = { local: 'Local', visita: 'Visita', neutral: 'Neutral' } as const
export interface MatchInput {
  competitionEntryId: string
  opponentName: string
  scheduledAt: string
  venue: string
  location: string
  stage: string
}
export type MatchDetails = Pick<Match, 'competitionEntryId' | 'opponentName' | 'scheduledAt' | 'venue' | 'location' | 'stage'>

export function isLocalDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value) && isCalendarDate(value.slice(0, 10))
}

export function validateMatch(input: MatchInput): Validation<MatchDetails> {
  const opponentName = normalizeName(input.opponentName)
  const venue = normalizeName(input.venue)
  const stage = normalizeName(input.stage)
  const fields: FieldErrors = {
    ...(!input.competitionEntryId ? { competitionEntryId: 'Selecciona un equipo participante del torneo.' } : {}),
    ...(!opponentName || opponentName.length > 100 ? { opponentName: 'Indica el nombre del rival, de hasta 100 caracteres.' } : {}),
    ...(!isLocalDateTime(input.scheduledAt) ? { scheduledAt: 'Indica una fecha y hora local válidas.' } : {}),
    ...(!venue || venue.length > 160 ? { venue: 'Indica una sede de hasta 160 caracteres.' } : {}),
    ...(!Object.hasOwn(MATCH_LOCATIONS, input.location) ? { location: 'Selecciona local, visita o neutral.' } : {}),
    ...(stage.length > 100 ? { stage: 'Usa un máximo de 100 caracteres para fase o jornada.' } : {}),
  }
  if (Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, value: {
    competitionEntryId: input.competitionEntryId as CompetitionEntry['id'], opponentName,
    scheduledAt: input.scheduledAt, venue, location: input.location as Match['location'], stage,
  } }
}
