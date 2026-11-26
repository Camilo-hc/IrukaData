import { validateCallUp } from '../../domain/match/call-up'
import { POSITIONS, validateLineup } from '../../domain/match/lineup'
import { reconstructMatch } from '../../domain/match/replay'
import { canonicalJson } from '../../domain/shared/canonical-json'
import { nameKey } from '../../domain/shared/validation'
import { byMatch } from '../shared/by-match'
import type { BackupData } from './contracts'

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function unique(values: readonly unknown[], label: string) {
  ensure(new Set(values.map((value) => JSON.stringify(value))).size === values.length, 'Hay registros duplicados en ' + label + '.')
}

function index<T extends { id: string }>(rows: readonly T[], label: string): Map<T['id'], T> {
  const result = new Map(rows.map((row) => [row.id, row]))
  ensure(result.size === rows.length, 'Hay identificadores duplicados en ' + label + '.')
  return result
}

export function verifyBackupData(data: BackupData) {
  const clubs = index(data.clubs, 'clubes')
  const teams = index(data.teams, 'equipos')
  const seasons = index(data.seasons, 'temporadas')
  const teamSeasons = index(data.teamSeasons, 'plantillas')
  const athletes = index(data.athletes, 'deportistas')
  const memberships = index(data.memberships, 'inscripciones')
  const competitions = index(data.competitions, 'torneos')
  const entries = index(data.competitionEntries, 'participaciones')
  const matches = index(data.matches, 'partidos')
  index(data.matchRosters, 'convocatorias')
  index(data.matchSets, 'sets')
  ensure(clubs.size <= 1 && (clubs.size === 0 || clubs.has('local-club' as BackupData['clubs'][number]['id'])),
    'El formato de respaldo admite un solo club local.')
  ensure(clubs.size > 0 || (!teams.size && !seasons.size && !athletes.size), 'El respaldo no contiene el club de estos registros.')
  unique(data.teams.map((row) => [row.clubId, row.branch, row.category, nameKey(row.name)]), 'nombres de equipos')
  unique(data.seasons.map((row) => nameKey(row.name)), 'nombres de temporadas')
  unique(data.teamSeasons.map((row) => [row.teamId, row.seasonId]), 'plantillas por temporada')
  unique(data.memberships.map((row) => [row.teamSeasonId, row.athleteId]), 'inscripciones por deportista y plantilla')
  unique(data.memberships.filter((row) => row.active).map((row) => [row.teamSeasonId, row.jerseyNumber]), 'dorsales activos por plantilla')
  unique(data.competitions.map((row) => [row.seasonId, nameKey(row.name)]), 'torneos por temporada')
  unique(data.competitionEntries.map((row) => [row.competitionId, row.teamSeasonId]), 'participaciones en torneos')
  unique(data.matchRosters.map((row) => [row.matchId, row.athleteId]), 'deportistas por convocatoria')
  unique(data.matchSets.map((row) => [row.matchId, row.number]), 'números de set por partido')
  unique(data.liveSessions.map((row) => row.matchId), 'sesiones de partido')
  unique(data.liveBatches.map((row) => [row.matchId, row.expectedVersion]), 'versiones del historial')
  unique(data.liveBatches.map((row) => [row.matchId, row.operationId]), 'operaciones del historial')

  for (const team of data.teams) ensure(clubs.has(team.clubId), 'Hay un equipo sin club válido.')
  for (const season of data.seasons) ensure(season.start <= season.end, 'Hay una temporada con fechas invertidas.')
  for (const link of data.teamSeasons) ensure(teams.has(link.teamId) && seasons.has(link.seasonId), 'Hay una plantilla sin equipo o temporada válida.')
  for (const membership of data.memberships) {
    ensure(athletes.has(membership.athleteId) && teamSeasons.has(membership.teamSeasonId), 'Hay una inscripción sin deportista o plantilla válida.')
  }
  for (const competition of data.competitions) ensure(seasons.has(competition.seasonId), 'Hay un torneo sin temporada válida.')
  for (const entry of data.competitionEntries) {
    const competition = competitions.get(entry.competitionId)
    const link = teamSeasons.get(entry.teamSeasonId)
    ensure(competition && link && competition.seasonId === link.seasonId, 'Hay una participación con torneo y plantilla incompatibles.')
  }
  for (const player of data.matchRosters) {
    const match = matches.get(player.matchId)
    const entry = match && entries.get(match.competitionEntryId)
    const membership = memberships.get(player.rosterMembershipId)
    ensure(entry && membership && membership.athleteId === player.athleteId && membership.teamSeasonId === entry.teamSeasonId,
      'Hay una convocatoria con una inscripción o un partido incompatible.')
  }

  const sessions = new Map(data.liveSessions.map((row) => [row.matchId, row]))
  for (const set of data.matchSets) ensure(matches.has(set.matchId), 'Hay un set sin partido.')
  for (const session of data.liveSessions) ensure(matches.has(session.matchId), 'Hay una sesión sin partido.')
  for (const batch of data.liveBatches) ensure(sessions.has(batch.matchId), 'Hay eventos sin una sesión de partido.')
  const rosters = byMatch(data.matchRosters)
  const sets = byMatch(data.matchSets)
  const batches = byMatch(data.liveBatches)

  for (const match of data.matches) {
    const label = 'vs. ' + match.opponentName
    ensure(entries.has(match.competitionEntryId), 'Hay un partido sin participación en un torneo.')
    const libero = match.rulesSnapshot.libero
    ensure(libero.minimumDesignated <= libero.maximumDesignated &&
      (libero.twoRequiredAboveRosterSize === null || libero.maximumDesignated === 2), 'Hay reglas de líbero incompatibles en ' + label + '.')
    const roster = (rosters.get(match.id) ?? []).filter((player) => player.calledUp)
    if (match.phase !== 'BORRADOR') {
      ensure(roster.length > 0 && !validateCallUp(roster, libero), 'La convocatoria es inconsistente en ' + label + '.')
    } else ensure(!roster.length, 'Hay un borrador con una convocatoria confirmada en ' + label + '.')
    const storedSets = (sets.get(match.id) ?? []).sort((left, right) => left.number - right.number)
    const session = sessions.get(match.id)
    if (session) {
      const log = (batches.get(match.id) ?? []).sort((left, right) => left.expectedVersion - right.expectedVersion)
      let replayed
      try {
        replayed = reconstructMatch(match, roster, session.initialVersion, log)
      } catch {
        throw new Error('El historial no se pudo reconstruir en ' + label + '.')
      }
      ensure(canonicalJson(replayed.state.sets.map(({ set }) => set)) === canonicalJson(storedSets),
        'El historial y los sets guardados difieren en ' + label + '.')
    } else if (match.phase === 'LISTO_PARA_SAQUE') {
      const first = storedSets[0]
      ensure(storedSets.length === 1 && first?.number === 1 && first.status === 'pending' && first.finalScore === null &&
        canonicalJson(first.rulesSnapshot) === canonicalJson(match.rulesSnapshot), 'El set inicial es inconsistente en ' + label + '.')
      const lineup = { starters: POSITIONS.map((position) => ({ position, playerId: first.initialOrder[position] })), initialService: first.initialService }
      ensure(validateLineup(lineup, roster).ok, 'La alineación inicial es inválida en ' + label + '.')
    } else {
      ensure(!storedSets.length && ['BORRADOR', 'CONVOCATORIA', 'ALINEACION_SET'].includes(match.phase),
        'Faltan los registros de juego en ' + label + '.')
    }
  }
}
