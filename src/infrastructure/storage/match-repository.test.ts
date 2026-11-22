import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMatchManagement } from '../../application/matches/service'
import { createClubManagement } from '../../application/club/service'
import { createCompetitionManagement } from '../../application/competitions/service'
import { DEFAULT_RULES_INPUT, rulesToInput, validateRules } from '../../domain/rules/configuration'
import type { Match } from '../../domain/match/contracts'
import type { CallUpSelection } from '../../domain/match/call-up'
import { POSITIONS, type LineupInput } from '../../domain/match/lineup'
import type { Id } from '../../domain/shared/types'
import { DexieClubRepository } from './club-repository'
import { DexieCompetitionRepository } from './competition-repository'
import { DexieMatchRepository } from './match-repository'
import { IrukaDatabase } from './database'

const databases: IrukaDatabase[] = []
let sequence = 0
function workspace(name = `iruka-matches-${++sequence}`) {
  const db = new IrukaDatabase(name)
  databases.push(db)
  const repository = new DexieMatchRepository(db)
  const management = createMatchManagement(repository, () => `match-${++sequence}`)
  const clubManagement = createClubManagement(new DexieClubRepository(db), () => `club-data-${++sequence}`)
  const competitions = createCompetitionManagement(new DexieCompetitionRepository(db), () => `competition-${++sequence}`)
  return { db, repository, management, clubManagement, competitions }
}
const teamInput = { name: 'Iruka Sub 16', branch: 'femenino', category: 'sub16' }
async function configured() {
  const result = workspace()
  await result.clubManagement.saveClub('Club de prueba', null)
  const club = (await result.repository.read()).club!
  await result.clubManagement.saveSeason({ name: '2026', start: '2026-01-01', end: '2026-12-31' }, null)
  const season = (await result.repository.read()).seasons[0]!
  await result.clubManagement.saveTeam(teamInput, club, [season.id], null)
  await result.clubManagement.saveTeam({ ...teamInput, name: 'Iruka Sub 14', category: 'sub14' }, club, [season.id], null)
  let directory = await result.repository.read()
  const team = directory.teams.find((item) => item.category === 'sub16')!
  const link = directory.teamSeasons.find((item) => item.teamId === team.id)!
  const competitionInput = { name: 'Copa Sur', kind: 'Copa', seasonId: season.id, notes: '', teamSeasonIds: directory.teamSeasons.map((item) => item.id) }
  await result.competitions.save(competitionInput, null)
  await result.competitions.save({ ...competitionInput, name: 'Liga Regional' }, null)
  directory = await result.repository.read()
  const competition = directory.competitions.find((item) => item.name === 'Copa Sur')!
  const entry = directory.entries.find((item) => item.competitionId === competition.id && item.teamSeasonId === link.id)!
  const otherEntry = directory.entries.find((item) => item.competitionId !== competition.id && item.teamSeasonId === link.id)!
  const input = { competitionEntryId: entry.id, opponentName: 'Club Costa', scheduledAt: '2026-11-21T19:30', venue: 'Gimnasio Norte', location: 'local', stage: 'Jornada 1' }
  return { ...result, club, season, team, link, competition, entry, otherEntry, input, competitionInput }
}
function editInput(match: Match) {
  return { competitionEntryId: match.competitionEntryId, opponentName: match.opponentName, scheduledAt: match.scheduledAt, venue: match.venue, location: match.location, stage: match.stage }
}
afterEach(async () => {
  vi.restoreAllMocks()
  const names = new Set(databases.map((db) => db.name))
  for (const db of databases.splice(0)) db.close()
  for (const name of names) await Dexie.delete(name)
})

describe('partidos asociados a torneos', () => {
  it('migra desde v7 conservando partidos, reglas, convocatorias y tablas anteriores', async () => {
    const old = new Dexie('iruka-matches-upgrade')
    old.version(7).stores({
      appMetadata: '&key', clubs: '&id', teams: '&id, clubId, &[clubId+branch+category+nameKey]',
      seasons: '&id, &nameKey', teamSeasons: '&id, &[teamId+seasonId], teamId, seasonId', athletes: '&id, searchKey',
      memberships: '&id, athleteId, teamSeasonId, &[teamSeasonId+athleteId], &[teamSeasonId+activeJerseyNumber]',
      competitions: '&id, seasonId, &[seasonId+nameKey]', competitionEntries: '&id, competitionId, teamSeasonId, &[competitionId+teamSeasonId]',
      matches: '&id, competitionEntryId, scheduledAt',
      matchRosters: '&id, matchId, &[matchId+athleteId]',
    })
    const rules = validateRules(DEFAULT_RULES_INPUT)
    if (!rules.ok) throw new Error('El perfil de prueba debe ser válido.')
    const records = {
      clubs: { id: 'local-club', name: 'Club existente', revision: 1 },
      teams: { id: 't', clubId: 'local-club', name: 'Sub 16', branch: 'femenino', category: 'sub16', active: true, revision: 1, nameKey: 'sub 16' },
      seasons: { id: 's', name: '2026', start: '2026-01-01', end: '2026-12-31', active: true, revision: 1, nameKey: '2026' },
      teamSeasons: { id: 'ts', teamId: 't', seasonId: 's', active: true },
      athletes: { id: 'a', name: 'Persona existente', active: true, revision: 1, searchKey: 'persona existente' },
      memberships: { id: 'm', athleteId: 'a', teamSeasonId: 'ts', jerseyNumber: 5, activeJerseyNumber: 5, usualRole: 'punta', active: true, revision: 1 },
      competitions: { id: 'c', name: 'Copa Sur', nameKey: 'copa sur', kind: 'Copa', seasonId: 's', active: true, revision: 1 },
      competitionEntries: { id: 'e', competitionId: 'c', teamSeasonId: 'ts', active: true },
      matches: {
        id: 'm1', competitionEntryId: 'e', opponentName: 'Club Costa', scheduledAt: '2026-11-21T19:30',
        venue: 'Gimnasio Norte', location: 'local', stage: '', phase: 'CONVOCATORIA', active: true,
        version: 2, rulesSnapshot: rules.value,
      },
      matchRosters: { id: 'r', matchId: 'm1', athleteId: 'a', rosterMembershipId: 'm', nameSnapshot: 'Persona existente', jerseyNumberSnapshot: 5, calledUp: true, designatedLibero: false },
    }
    for (const [table, record] of Object.entries(records)) await old.table(table).add(record)
    await old.table('appMetadata').bulkPut([{ key: 'schemaVersion', value: '7' }, { key: 'keep', value: 'conservar' }])
    old.close()
    const { db, repository } = workspace('iruka-matches-upgrade')
    expect((await repository.read()).matches).toEqual([records.matches])
    expect(await db.matchSets.count()).toBe(0)
    for (const [table, record] of Object.entries(records)) expect(await db.table(table).toArray()).toEqual([record])
    expect(await db.appMetadata.get('schemaVersion')).toEqual({ key: 'schemaVersion', value: '8' })
    expect(await db.appMetadata.get('keep')).toEqual({ key: 'keep', value: 'conservar' })
  })

  it('crea un borrador vinculado al equipo y torneo, lo recupera y no crea personas rivales', async () => {
    const result = await configured()
    expect(await result.management.save(result.input, DEFAULT_RULES_INPUT, null)).toEqual({ ok: true })
    const directory = await result.repository.read()
    expect(directory.matches).toHaveLength(1)
    expect(directory.matches[0]).toMatchObject({ ...result.input, phase: 'BORRADOR', active: true, version: 1 })
    expect(await result.db.athletes.count()).toBe(0)
    result.db.close()
    expect((await workspace(result.db.name).repository.read()).matches).toEqual(directory.matches)
  })

  it('conserva reglas independientes por partido y permite repetir rival y horario', async () => {
    const result = await configured()
    const rules = { ...DEFAULT_RULES_INPUT, substitutionLimit: '8', minimumLiberos: '1', twoLiberosAbove: '12' }
    await result.management.save(result.input, rules, null)
    rules.substitutionLimit = '0'
    await result.management.save(result.input, rules, null)
    const matches = (await result.repository.read()).matches
    expect(matches).toHaveLength(2)
    expect(matches.map((match) => match.rulesSnapshot.officialSubstitutions.limitPerSet).sort()).toEqual([0, 8])
    expect(new Set(matches.map((match) => match.id)).size).toBe(2)
  })

  it('edita fecha, sede y reglas del borrador con el mismo ID sin afectar otro partido', async () => {
    const result = await configured()
    await result.management.save(result.input, DEFAULT_RULES_INPUT, null)
    await result.management.save({ ...result.input, opponentName: 'Otro rival' }, DEFAULT_RULES_INPUT, null)
    const original = (await result.repository.read()).matches.find((match) => match.opponentName === 'Club Costa')!
    const other = (await result.repository.read()).matches.find((match) => match.id !== original.id)!
    expect((await result.management.save({ ...editInput(original), scheduledAt: '2026-12-01T18:00', venue: 'Cancha B' }, { ...DEFAULT_RULES_INPUT, substitutionLimit: '8' }, original)).ok).toBe(true)
    const matches = (await result.repository.read()).matches
    expect(matches.find((match) => match.id === original.id)).toMatchObject({ id: original.id, version: 2, scheduledAt: '2026-12-01T18:00', venue: 'Cancha B', rulesSnapshot: { officialSubstitutions: { limitPerSet: 8 } } })
    expect(matches.find((match) => match.id === other.id)).toEqual(other)
  })

  it('no permite trasladar un partido a otro equipo o torneo', async () => {
    const result = await configured()
    await result.management.save(result.input, DEFAULT_RULES_INPUT, null)
    const original = (await result.repository.read()).matches[0]!
    expect((await result.management.save({ ...result.input, competitionEntryId: result.otherEntry.id }, DEFAULT_RULES_INPUT, original)).ok).toBe(false)
    await expect(result.repository.save({ ...original, competitionEntryId: result.otherEntry.id, version: 2 }, 1)).rejects.toMatchObject({ code: 'immutable_entry' })
    expect((await result.repository.read()).matches[0]).toEqual(original)
  })

  it.each(['competition', 'team', 'season', 'teamSeason', 'entry'] as const)('bloquea altas y ediciones con %s inactivo, permite archivar y exige referencias activas al restaurar', async (reference) => {
    const result = await configured()
    await result.management.save(result.input, DEFAULT_RULES_INPUT, null)
    const original = (await result.repository.read()).matches[0]!
    if (reference === 'competition') await result.competitions.setActive(result.competition, false)
    if (reference === 'team') await result.clubManagement.setTeamActive(result.team, false)
    if (reference === 'season') await result.clubManagement.setSeasonActive(result.season, false)
    if (reference === 'teamSeason') await result.clubManagement.saveTeam(teamInput, result.club, [], result.team)
    if (reference === 'entry') await result.competitions.save({ ...result.competitionInput, teamSeasonIds: result.competitionInput.teamSeasonIds.filter((id) => id !== result.link.id) }, result.competition)
    expect((await result.repository.read()).matches[0]).toEqual(original)
    expect((await result.management.save(result.input, DEFAULT_RULES_INPUT, null)).ok).toBe(false)
    expect((await result.management.save(result.input, DEFAULT_RULES_INPUT, original)).ok).toBe(false)
    expect((await result.management.setActive(original, false)).ok).toBe(true)
    const archived = (await result.repository.read()).matches[0]!
    expect((await result.management.setActive(archived, true)).ok).toBe(false)
    expect(archived).toMatchObject({ id: original.id, active: false, rulesSnapshot: original.rulesSnapshot })
  })

  it('restaura el borrador con sus reglas y misma identidad', async () => {
    const result = await configured()
    await result.management.save(result.input, DEFAULT_RULES_INPUT, null)
    const original = (await result.repository.read()).matches[0]!
    await result.management.setActive(original, false)
    const archived = (await result.repository.read()).matches[0]!
    expect((await result.management.save(result.input, DEFAULT_RULES_INPUT, archived)).ok).toBe(false)
    expect((await result.management.setActive(archived, true)).ok).toBe(true)
    expect((await result.repository.read()).matches[0]).toEqual({ ...original, version: 3 })
  })

  it('serializa dos ediciones concurrentes y no deja que el archivo antiguo sobrescriba el partido', async () => {
    const result = await configured()
    await result.management.save(result.input, DEFAULT_RULES_INPUT, null)
    const original = (await result.repository.read()).matches[0]!
    const second = workspace(result.db.name)
    const outcomes = await Promise.all([
      result.management.save({ ...result.input, venue: 'Cancha A' }, DEFAULT_RULES_INPUT, original),
      second.management.save({ ...result.input, venue: 'Cancha B' }, DEFAULT_RULES_INPUT, original),
    ])
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1)
    expect(outcomes.find((outcome) => !outcome.ok)).toMatchObject({ message: expect.stringContaining('otra edición') })
    expect((await second.management.setActive(original, false)).ok).toBe(false)
    expect((await result.repository.read()).matches[0]).toMatchObject({ id: original.id, active: true, version: 2 })
  })

  it('rechaza participaciones ausentes o inconsistentes, sin crear registros huérfanos', async () => {
    const result = await configured()
    expect((await result.management.save({ ...result.input, competitionEntryId: 'missing' }, DEFAULT_RULES_INPUT, null)).ok).toBe(false)
    await result.db.teamSeasons.update(result.link.id, { seasonId: 'different-season' as typeof result.season.id })
    expect((await result.management.save(result.input, DEFAULT_RULES_INPUT, null)).ok).toBe(false)
    expect((await result.repository.read()).matches).toHaveLength(0)
  })

  it('no modifica ni archiva encuentros que ya salieron de borrador', async () => {
    const result = await configured()
    await result.management.save(result.input, DEFAULT_RULES_INPUT, null)
    const original = (await result.repository.read()).matches[0]!
    await result.db.matches.update(original.id, { phase: 'CONVOCATORIA' })
    const current = (await result.repository.read()).matches[0]!
    expect((await result.management.save(editInput(current), rulesToInput(current.rulesSnapshot), current)).ok).toBe(false)
    expect((await result.management.save(editInput(original), DEFAULT_RULES_INPUT, original)).ok).toBe(false)
    expect((await result.management.setActive(current, false)).ok).toBe(false)
    expect((await result.repository.read()).matches[0]).toEqual(current)
  })

  it('conserva reglas y estado confirmado si hay datos inválidos o falla el almacenamiento', async () => {
    const result = await configured()
    expect((await result.management.save({ ...result.input, scheduledAt: '2026-02-30T12:00' }, DEFAULT_RULES_INPUT, null)).ok).toBe(false)
    expect((await result.management.save(result.input, { ...DEFAULT_RULES_INPUT, substitutionLimit: '-1' }, null)).ok).toBe(false)
    await result.management.save(result.input, DEFAULT_RULES_INPUT, null)
    const original = (await result.repository.read()).matches[0]!
    vi.spyOn(result.db.matches, 'put').mockRejectedValueOnce(new Error('Cuota agotada'))
    expect(await result.management.save({ ...result.input, venue: 'No guardar' }, DEFAULT_RULES_INPUT, original)).toMatchObject({ ok: false, message: expect.stringContaining('No se pudo guardar') })
    expect((await result.repository.read()).matches[0]).toEqual(original)
  })
})

async function withCallUp() {
  const result = await configured()
  await result.management.save(result.input, { ...DEFAULT_RULES_INPUT, minimumLiberos: '1' }, null)
  const match = (await result.repository.read()).matches[0]!
  const otherTeam = (await result.repository.read()).teamSeasons.find((link) => link.id !== result.link.id)!
  for (let number = 1; number <= 10; number++) {
    const athleteId = `athlete-${number}` as Id<'Athlete'>
    await result.db.athletes.add({ id: athleteId, name: `Deportista ${number}`, active: number !== 9, revision: 1, searchKey: `deportista ${number}` })
    await result.db.memberships.add({
      id: `membership-${number}` as Id<'RosterMembership'>,
      athleteId,
      teamSeasonId: number === 10 ? otherTeam.id : result.link.id,
      jerseyNumber: number,
      ...(number === 8 ? {} : { activeJerseyNumber: number }),
      active: number !== 8,
      usualRole: number === 1 ? 'libero' : 'sin_definir',
      revision: 1,
    })
  }
  const selection: CallUpSelection[] = (await result.repository.readCallUp(match.id)).candidates
    .map((candidate) => ({ ...candidate, libero: candidate.jerseyNumber === 7 }))
  return { ...result, match, selection }
}

describe('convocatoria por plantilla', () => {
  it('filtra perfiles y vínculos inactivos y excluye deportistas de otra plantilla', async () => {
    const { repository, management, match, selection } = await withCallUp()
    expect(selection.map((player) => player.jerseyNumber)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const number of [8, 9, 10]) {
      const outsider = { membershipId: `membership-${number}` as Id<'RosterMembership'>, name: `Deportista ${number}`, jerseyNumber: number, libero: false }
      expect(await management.saveCallUp(match, [...selection, outsider])).toMatchObject({ ok: false })
    }
    expect((await repository.readCallUp(match.id)).roster).toEqual([])
  })

  it('guarda plantel, fase y designaciones, con fotos de nombre y dorsal independientes de la plantilla', async () => {
    const { db, repository, management, match, selection } = await withCallUp()
    expect(await management.saveCallUp(match, selection)).toEqual({ ok: true })
    const saved = (await repository.read()).matches[0]!
    const original = (await repository.readCallUp(match.id)).roster
    expect(saved).toMatchObject({ phase: 'CONVOCATORIA', version: 2 })
    expect(original).toHaveLength(7)
    expect(original.filter((player) => player.designatedLibero).map((player) => player.jerseyNumberSnapshot)).toEqual([7])
    await db.athletes.update('athlete-1' as Id<'Athlete'>, { name: 'Nombre corregido' })
    await db.memberships.update('membership-1' as Id<'RosterMembership'>, { jerseyNumber: 18, activeJerseyNumber: 18 })
    expect(await management.saveCallUp(saved, selection)).toEqual({ ok: true })
    db.close()
    expect((await workspace(db.name).repository.readCallUp(match.id)).roster).toEqual(original)
  })

  it('rechaza un candidato que cambió durante la selección y una versión desactualizada del partido', async () => {
    const { db, repository, management, match, selection } = await withCallUp()
    await db.memberships.update('membership-1' as Id<'RosterMembership'>, { jerseyNumber: 18, activeJerseyNumber: 18 })
    expect(await management.saveCallUp(match, selection)).toMatchObject({ ok: false, message: expect.stringContaining('Cambió un perfil o una inscripción') })
    const updated = selection.map((player) => player.jerseyNumber === 1 ? { ...player, jerseyNumber: 18 } : player)
    const other = workspace(db.name)
    const outcomes = await Promise.all([management.saveCallUp(match, updated), other.management.saveCallUp(match, updated)])
    expect(outcomes).toContainEqual({ ok: true })
    expect(outcomes).toContainEqual({ ok: false, message: expect.stringContaining('otra edición') })
    expect((await repository.readCallUp(match.id)).roster).toHaveLength(7)
    expect((await repository.read()).matches[0]?.version).toBe(2)
  })

  it('revierte las filas de la convocatoria si falla la actualización de fase', async () => {
    const { db, repository, management, match, selection } = await withCallUp()
    vi.spyOn(db.matches, 'put').mockRejectedValueOnce(new Error('Cuota agotada'))
    expect(await management.saveCallUp(match, selection)).toMatchObject({ ok: false })
    expect(await db.matchRosters.count()).toBe(0)
    expect((await repository.read()).matches[0]).toEqual(match)
  })

  it('bloquea cambios cuando la alineación ya comenzó o cuando el torneo se archiva', async () => {
    const { db, repository, management, competitions, competition, match, selection } = await withCallUp()
    await competitions.setActive(competition, false)
    expect(await management.saveCallUp(match, selection)).toMatchObject({ ok: false, message: expect.stringContaining('torneo') })
    await db.matches.update(match.id, { phase: 'ALINEACION_SET' })
    expect(await management.saveCallUp(match, selection)).toMatchObject({ ok: false, message: expect.stringContaining('no permite editar la convocatoria') })
    expect((await repository.readCallUp(match.id)).roster).toEqual([])
  })
})

async function withConfirmedCallUp() {
  const fixture = await withCallUp()
  expect(await fixture.management.saveCallUp(fixture.match, fixture.selection)).toEqual({ ok: true })
  const match = (await fixture.repository.read()).matches[0]!
  const { roster } = await fixture.repository.readCallUp(match.id)
  const regulars = roster.filter((player) => !player.designatedLibero)
  const input: LineupInput = {
    starters: POSITIONS.map((position, index) => ({ position, playerId: regulars[index]!.id })),
    initialService: 'own',
  }
  return { ...fixture, draft: fixture.match, match, input, roster }
}

describe('confirmación del primer set', () => {
  it('persiste el primer set pendiente, su servicio y reglas, y cierra la convocatoria', async () => {
    const { db, match, input, selection, repository, management } = await withConfirmedCallUp()
    expect(await management.saveInitialLineup(match, input)).toEqual({ ok: true })
    const confirmed = (await repository.read()).matches[0]!
    const { firstSet } = await repository.readCallUp(match.id)
    expect(confirmed).toMatchObject({ phase: 'LISTO_PARA_SAQUE', version: 3 })
    expect(firstSet).toMatchObject({
      matchId: match.id, number: 1, status: 'pending', initialService: 'own', finalScore: null,
      initialOrder: Object.fromEntries(input.starters.map(({ position, playerId }) => [position, playerId])),
      rulesSnapshot: match.rulesSnapshot,
    })
    expect(await management.saveCallUp(confirmed, selection)).toMatchObject({ ok: false, message: expect.stringContaining('no permite editar') })
    db.close()
    expect((await workspace(db.name).repository.readCallUp(match.id)).firstSet).toEqual(firstSet)
  })

  it('rechaza la confirmación desde un borrador o con titulares inválidos y conserva el estado', async () => {
    const { db, draft, match, input, roster, repository, management } = await withConfirmedCallUp()
    await db.matches.put(draft)
    expect((await management.saveInitialLineup(draft, input)).ok).toBe(false)
    await db.matches.put(match)
    const playerId = roster.find((player) => player.designatedLibero)!.id
    const invalid = { ...input, starters: [{ position: 1, playerId }, ...input.starters.slice(1)] }
    expect(await management.saveInitialLineup(match, invalid)).toMatchObject({ ok: false, message: expect.stringContaining('líberos designados') })
    expect((await repository.read()).matches[0]).toEqual(match)
    expect(await db.matchSets.count()).toBe(0)
  })

  it('serializa confirmaciones simultáneas y corrige el mismo set mientras sigue pendiente', async () => {
    const { db, match, input, repository, management } = await withConfirmedCallUp()
    const { management: other } = workspace(db.name)
    const outcomes = await Promise.all([
      management.saveInitialLineup(match, input),
      other.saveInitialLineup(match, { ...input, initialService: 'opponent' }),
    ])
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1)
    expect(outcomes.find((outcome) => !outcome.ok)).toMatchObject({ message: expect.stringContaining('otra edición') })
    const saved = (await repository.read()).matches[0]!
    const original = (await repository.readCallUp(match.id)).firstSet!
    const side = original.initialService === 'own' ? 'opponent' : 'own'
    expect(await management.saveInitialLineup(saved, { ...input, initialService: side })).toEqual({ ok: true })
    expect(await db.matchSets.count()).toBe(1)
    expect((await repository.readCallUp(match.id)).firstSet).toMatchObject({ id: original.id, initialService: side })
  })

  it('revierte la escritura si falla el cambio de fase y protege un set ya iniciado', async () => {
    const { db, match, input, repository, management } = await withConfirmedCallUp()
    vi.spyOn(db.matches, 'put').mockRejectedValueOnce(new Error('Cuota agotada'))
    expect((await management.saveInitialLineup(match, input)).ok).toBe(false)
    expect(await db.matchSets.count()).toBe(0)
    expect((await repository.read()).matches[0]).toEqual(match)
    expect((await management.saveInitialLineup(match, input)).ok).toBe(true)
    const firstSet = (await repository.readCallUp(match.id)).firstSet!
    await db.matchSets.update(firstSet.id, { status: 'active' })
    const current = (await repository.read()).matches[0]!
    expect((await management.saveInitialLineup(current, { ...input, initialService: 'opponent' })).ok).toBe(false)
    expect((await repository.readCallUp(match.id)).firstSet).toMatchObject({ status: 'active', initialService: 'own' })
  })
})
