import { BRANCHES, CATEGORIES } from '../../domain/club/validation'
import { MATCH_LOCATIONS, isLocalDateTime } from '../../domain/match/validation'
import { ATHLETE_ROLES } from '../../domain/memberships/validation'
import { isCalendarDate } from '../../domain/shared/validation'
import type { BackupData, BackupDocument } from './contracts'
import { verifyBackupData } from './verify-data'

type Check = (value: unknown) => boolean
type Shape = Readonly<Record<string, Check>>
type JsonObject = Record<string, unknown>

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function shape(fields: Shape): Check {
  return (value) => object(value) && Object.keys(value).every((key) => Object.hasOwn(fields, key))
    && Object.entries(fields).every(([key, check]) => check(value[key]))
}

const isString = (value: unknown): value is string => typeof value === 'string'
const nonempty = (value: unknown) => isString(value) && value.trim().length > 0
const flag = (value: unknown) => typeof value === 'boolean'
const natural = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const positive = (value: unknown) => natural(value) && value !== 0
const date = (value: unknown) => isString(value) && isCalendarDate(value)
const localTime = (value: unknown) => isString(value) && isLocalDateTime(value)
const optional = (check: Check): Check => (value) => value === undefined || check(value)
const nullable = (check: Check): Check => (value) => value === null || check(value)
const oneOf = (...options: readonly unknown[]): Check => (value) => options.includes(value)
const assigned = { id: nonempty, active: flag }
const revision = { ...assigned, revision: positive }
const side = oneOf('own', 'opponent')
const timestamp = (value: unknown): value is string => isString(value) && isLocalDateTime(value.slice(0, 16))
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[0-5]\d(?:\.\d{3})?Z$/.test(value)

const rules = shape({
  schemaVersion: oneOf(1), profileId: nonempty, profileVersion: positive, label: nonempty,
  sources: (value) => Array.isArray(value) && value.every(nonempty),
  format: shape({
    setsToWin: oneOf(2), regularSetTarget: oneOf(25), decidingSetTarget: oneOf(15), minimumLead: oneOf(2),
    decidingSetSideChangeAt: nullable(positive),
  }),
  officialSubstitutions: shape({ limitPerSet: natural, reentryPolicy: oneOf('fivb_starter_pair') }),
  libero: shape({
    minimumDesignated: oneOf(0, 1, 2), maximumDesignated: oneOf(0, 1, 2),
    twoRequiredAboveRosterSize: nullable((value) => typeof value === 'number' && natural(value) && value >= 6),
    canServe: oneOf(false), completedRallyBetweenReplacements: oneOf(true),
  }),
  exceptionalProcedures: oneOf('unsupported'),
})

const matchEvent = shape({
  schemaVersion: oneOf(1), sequence: positive, timestamp, matchId: nonempty, setId: nonempty,
  id: nonempty, operationId: nonempty, payload: object,
  type: oneOf('technical_action', 'point_awarded', 'official_substitution', 'libero_replacement', 'set_started', 'set_finished', 'correction'),
})

const tables = {
  clubs: { id: nonempty, name: nonempty, revision: positive },
  teams: { ...revision, clubId: nonempty, name: nonempty, branch: oneOf(...Object.keys(BRANCHES)), category: oneOf(...Object.keys(CATEGORIES)) },
  seasons: { ...revision, name: nonempty, start: date, end: date },
  teamSeasons: { ...assigned, teamId: nonempty, seasonId: nonempty },
  athletes: { ...revision, name: nonempty, birthDate: optional(date), notes: optional(isString) },
  memberships: { ...revision, athleteId: nonempty, teamSeasonId: nonempty, jerseyNumber: positive, usualRole: oneOf(...Object.keys(ATHLETE_ROLES)) },
  competitions: { ...revision, name: nonempty, kind: nonempty, seasonId: nonempty, notes: optional(isString) },
  competitionEntries: { ...assigned, teamSeasonId: nonempty, competitionId: nonempty },
  matches: {
    ...assigned, version: positive, competitionEntryId: nonempty, opponentName: nonempty, scheduledAt: localTime, venue: nonempty,
    location: oneOf(...Object.keys(MATCH_LOCATIONS)), stage: isString, rulesSnapshot: rules,
    phase: oneOf('BORRADOR', 'CONVOCATORIA', 'ALINEACION_SET', 'LISTO_PARA_SAQUE', 'JUGADA_EN_CURSO', 'ENTRE_JUGADAS', 'FIN_SET', 'FIN_PARTIDO'),
  },
  matchRosters: {
    id: nonempty, matchId: nonempty, athleteId: nonempty, rosterMembershipId: nonempty, nameSnapshot: nonempty,
    jerseyNumberSnapshot: positive, calledUp: flag, designatedLibero: flag,
  },
  matchSets: {
    id: nonempty, matchId: nonempty, number: oneOf(1, 2, 3), initialOrder: shape({ 1: nonempty, 2: nonempty, 3: nonempty, 4: nonempty, 5: nonempty, 6: nonempty }),
    initialService: side, rulesSnapshot: rules, status: oneOf('pending', 'active', 'finished'), finalScore: nullable(shape({ own: natural, opponent: natural })),
  },
  liveSessions: { matchId: nonempty, initialVersion: positive },
  liveBatches: { matchId: nonempty, expectedVersion: positive, operationId: nonempty, events: (value: unknown) => Array.isArray(value) && value.length > 0 && value.every(matchEvent) },
} satisfies { [K in keyof BackupData]: { [Field in keyof BackupData[K][number]]-?: Check } }

export function readBackup(text: string): BackupDocument {
  let document: unknown
  try { document = JSON.parse(text) } catch { throw new Error('El archivo no contiene un JSON válido.') }
  if (!object(document) || document.format !== 'IrukaData' || document.version !== 1) {
    throw new Error('El archivo no tiene un formato o versión de respaldo de IrukaData compatible.')
  }
  const { exportedAt, data } = document
  if (!timestamp(exportedAt) || !object(data) || Object.keys(data).some((key) => !Object.hasOwn(tables, key))) {
    throw new Error('El encabezado o las tablas del respaldo no son válidos.')
  }
  for (const [table, fields] of Object.entries(tables)) {
    const rows = data[table]
    if (!Array.isArray(rows) || !rows.every(shape(fields))) {
      throw new Error('El respaldo tiene registros inválidos en «' + table + '».')
    }
  }
  const parsed = data as unknown as BackupData
  verifyBackupData(parsed)
  return { format: 'IrukaData', version: 1, exportedAt, data: parsed }
}
