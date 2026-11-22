import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMembershipManagement } from '../../application/memberships/service'
import { createClubManagement } from '../../application/club/service'
import { createAthleteManagement } from '../../application/athletes/service'
import type { RosterMembership } from '../../domain/club/contracts'
import type { MembershipInput } from '../../domain/memberships/validation'
import { DexieMembershipRepository } from './membership-repository'
import { DexieClubRepository } from './club-repository'
import { DexieAthleteRepository } from './athlete-repository'
import { IrukaDatabase } from './database'

const databases: IrukaDatabase[] = []
let sequence = 0
function workspace(name = `iruka-memberships-${++sequence}`) {
  const db = new IrukaDatabase(name)
  databases.push(db)
  const repository = new DexieMembershipRepository(db)
  const management = createMembershipManagement(repository, () => `membership-${++sequence}`)
  const clubManagement = createClubManagement(new DexieClubRepository(db), () => `club-data-${++sequence}`)
  const athletes = createAthleteManagement(new DexieAthleteRepository(db), () => `person-${++sequence}`, () => '2026-11-21')
  return { db, repository, management, clubManagement, athletes }
}
const team14 = { name: 'Iruka Sub 14', branch: 'femenino', category: 'sub14' }
const team16 = { name: 'Iruka Sub 16', branch: 'femenino', category: 'sub16' }
async function configured() {
  const result = workspace()
  await result.clubManagement.saveClub('Club de prueba', null)
  const club = (await result.repository.read()).club!
  await result.clubManagement.saveSeason({ name: '2026', start: '2026-01-01', end: '2026-12-31' }, null)
  const season = (await result.repository.read()).seasons[0]!
  await result.clubManagement.saveTeam(team14, club, [season.id], null)
  await result.clubManagement.saveTeam(team16, club, [season.id], null)
  await result.athletes.save({ name: 'Álex Marín', birthDate: '2013-02-10', notes: '' }, null)
  const directory = await result.repository.read()
  const athlete = directory.athletes[0]!
  const firstTeam = directory.teams.find((team) => team.category === 'sub14')!
  const secondTeam = directory.teams.find((team) => team.category === 'sub16')!
  const firstRoster = directory.teamSeasons.find((link) => link.teamId === firstTeam.id)!
  const secondRoster = directory.teamSeasons.find((link) => link.teamId === secondTeam.id)!
  const input: MembershipInput = { athleteId: athlete.id, teamSeasonId: firstRoster.id, jerseyNumber: '5', usualRole: 'punta' }
  return { ...result, club, season, athlete, firstTeam, firstRoster, secondRoster, input }
}
async function addAnotherPerson(result: Awaited<ReturnType<typeof configured>>) {
  await result.athletes.save({ name: 'Sol Vega', birthDate: '', notes: '' }, null)
  return (await result.repository.read()).athletes.find((athlete) => athlete.id !== result.athlete.id)!
}
function editInput(membership: RosterMembership, jerseyNumber = String(membership.jerseyNumber)): MembershipInput {
  return { athleteId: membership.athleteId, teamSeasonId: membership.teamSeasonId, jerseyNumber, usualRole: membership.usualRole }
}
afterEach(async () => {
  vi.restoreAllMocks()
  const names = new Set(databases.map((db) => db.name))
  for (const db of databases.splice(0)) db.close()
  for (const name of names) await Dexie.delete(name)
})

describe('inscripciones por equipo y temporada', () => {
  it('migra desde v3 conservando todos los datos anteriores y sin insertar inscripciones ficticias', async () => {
    const old = new Dexie('iruka-memberships-upgrade')
    old.version(3).stores({
      appMetadata: '&key', clubs: '&id', teams: '&id, clubId, &[clubId+branch+category+nameKey]',
      seasons: '&id, &nameKey', teamSeasons: '&id, &[teamId+seasonId], teamId, seasonId', athletes: '&id, searchKey',
    })
    const records = {
      clubs: { id: 'local-club', name: 'Club existente', revision: 1 },
      teams: { id: 't', clubId: 'local-club', name: 'Sub 14', branch: 'femenino', category: 'sub14', active: true, revision: 1, nameKey: 'sub 14' },
      seasons: { id: 's', name: '2026', start: '2026-01-01', end: '2026-12-31', active: true, revision: 1, nameKey: '2026' },
      teamSeasons: { id: 'ts', teamId: 't', seasonId: 's', active: true },
      athletes: { id: 'a', name: 'Persona existente', notes: 'Conservar', active: true, revision: 1, searchKey: 'persona existente' },
    }
    for (const [table, record] of Object.entries(records)) await old.table(table).add(record)
    await old.table('appMetadata').bulkPut([{ key: 'schemaVersion', value: '3' }, { key: 'keep', value: 'conservar' }])
    old.close()
    const { db, repository } = workspace('iruka-memberships-upgrade')
    expect((await repository.read()).memberships).toEqual([])
    for (const [table, record] of Object.entries(records)) expect(await db.table(table).toArray()).toEqual([record])
    expect(await db.appMetadata.get('schemaVersion')).toEqual({ key: 'schemaVersion', value: '6' })
    expect(await db.appMetadata.get('keep')).toEqual({ key: 'keep', value: 'conservar' })
  })

  it('aceptación Hito 1: una persona en Sub 14 y Sub 16 con dorsales independientes y un solo perfil', async () => {
    const result = await configured()
    const profileBefore = await result.db.athletes.get(result.athlete.id)
    expect(await result.management.save(result.input, null)).toEqual({ ok: true })
    expect(await result.management.save({ ...result.input, teamSeasonId: result.secondRoster.id, jerseyNumber: '8' }, null)).toEqual({ ok: true })
    const directory = await result.repository.read()
    expect(directory.memberships).toHaveLength(2)
    expect(directory.memberships.map((membership) => membership.jerseyNumber).sort()).toEqual([5, 8])
    expect(new Set(directory.memberships.map((membership) => membership.athleteId))).toEqual(new Set([result.athlete.id]))
    expect(await result.db.athletes.count()).toBe(1)
    expect(await result.db.athletes.get(result.athlete.id)).toEqual(profileBefore)
    result.db.close()
    expect((await workspace(result.db.name).repository.read()).memberships).toEqual(directory.memberships)
  })

  it('no repite un dorsal activo en la misma plantilla, pero permite usarlo en otra', async () => {
    const result = await configured()
    const another = await addAnotherPerson(result)
    await result.management.save(result.input, null)
    expect(await result.management.save({ ...result.input, athleteId: another.id, jerseyNumber: '05' }, null)).toMatchObject({ ok: false, fields: { jerseyNumber: expect.any(String) } })
    expect(await result.management.save({ ...result.input, athleteId: another.id, teamSeasonId: result.secondRoster.id }, null)).toEqual({ ok: true })
    expect((await result.repository.read()).memberships).toHaveLength(2)
  })

  it('rechaza una segunda inscripción de la misma persona, incluso si la anterior está archivada', async () => {
    const result = await configured()
    await result.management.save(result.input, null)
    const original = (await result.repository.read()).memberships[0]!
    expect((await result.management.save({ ...result.input, jerseyNumber: '8' }, null)).ok).toBe(false)
    await result.management.setActive(original, false)
    expect(await result.management.save({ ...result.input, jerseyNumber: '8' }, null)).toMatchObject({ ok: false, message: expect.stringContaining('ya tiene una inscripción') })
    expect((await result.repository.read()).memberships).toHaveLength(1)
  })

  it('serializa dos conexiones que intentan reservar el mismo dorsal', async () => {
    const result = await configured()
    const another = await addAnotherPerson(result)
    const second = workspace(result.db.name)
    const outcomes = await Promise.all([
      result.management.save(result.input, null),
      second.management.save({ ...result.input, athleteId: another.id }, null),
    ])
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1)
    expect(outcomes.find((outcome) => !outcome.ok)).toMatchObject({ ok: false, message: expect.stringContaining('dorsal') })
    expect((await result.repository.read()).memberships).toHaveLength(1)
  })

  it('libera el dorsal al archivar y exige otro disponible al restaurar, conservando el ID', async () => {
    const result = await configured()
    const another = await addAnotherPerson(result)
    await result.management.save(result.input, null)
    const original = (await result.repository.read()).memberships[0]!
    await result.management.setActive(original, false)
    expect(await result.db.memberships.get(original.id)).not.toHaveProperty('activeJerseyNumber')
    await result.management.save({ ...result.input, athleteId: another.id }, null)
    const archived = (await result.repository.read()).memberships.find((membership) => membership.id === original.id)!
    expect((await result.management.setActive(archived, true)).ok).toBe(false)
    expect(await result.management.save(editInput(archived, '8'), archived)).toEqual({ ok: true })
    const edited = (await result.repository.read()).memberships.find((membership) => membership.id === original.id)!
    expect(edited.active).toBe(false)
    expect(await result.management.setActive(edited, true)).toEqual({ ok: true })
    expect((await result.repository.read()).memberships.find((membership) => membership.id === original.id)).toMatchObject({ id: original.id, jerseyNumber: 8, active: true, revision: 4 })
  })

  it('mantiene la inscripción y reserva del dorsal al archivar el perfil; permite archivar la inscripción', async () => {
    const result = await configured()
    const another = await addAnotherPerson(result)
    await result.management.save(result.input, null)
    const original = (await result.repository.read()).memberships[0]!
    await result.athletes.setActive(result.athlete, false)
    expect((await result.repository.read()).memberships[0]).toEqual(original)
    expect((await result.management.save({ ...result.input, athleteId: another.id }, null)).ok).toBe(false)
    expect((await result.management.save({ ...result.input, teamSeasonId: result.secondRoster.id }, null)).ok).toBe(false)
    expect(await result.management.setActive(original, false)).toEqual({ ok: true })
    const archived = (await result.repository.read()).memberships[0]!
    expect((await result.management.setActive(archived, true)).ok).toBe(false)
    expect(await result.management.save({ ...result.input, athleteId: another.id }, null)).toEqual({ ok: true })
  })

  it.each(['team', 'season', 'association'] as const)('bloquea altas y restauraciones con %s inactivo, sin impedir archivar', async (reference) => {
    const result = await configured()
    const another = await addAnotherPerson(result)
    await result.management.save(result.input, null)
    const original = (await result.repository.read()).memberships[0]!
    if (reference === 'team') await result.clubManagement.setTeamActive(result.firstTeam, false)
    if (reference === 'season') await result.clubManagement.setSeasonActive(result.season, false)
    if (reference === 'association') await result.clubManagement.saveTeam(team14, result.club, [], result.firstTeam)
    expect((await result.management.save({ ...result.input, athleteId: another.id, jerseyNumber: '8' }, null)).ok).toBe(false)
    expect((await result.management.save(editInput(original, '9'), original)).ok).toBe(false)
    expect(await result.management.setActive(original, false)).toEqual({ ok: true })
    const archived = (await result.repository.read()).memberships[0]!
    expect((await result.management.setActive(archived, true)).ok).toBe(false)
  })

  it('desvincular y volver a vincular la temporada conserva la plantilla y sus inscripciones', async () => {
    const result = await configured()
    await result.management.save(result.input, null)
    const original = (await result.repository.read()).memberships[0]!
    await result.clubManagement.saveTeam(team14, result.club, [], result.firstTeam)
    const updatedTeam = (await result.repository.read()).teams.find((team) => team.id === result.firstTeam.id)!
    await result.clubManagement.saveTeam(team14, result.club, [result.season.id], updatedTeam)
    const directory = await result.repository.read()
    expect(directory.teamSeasons.find((link) => link.id === result.firstRoster.id)?.active).toBe(true)
    expect(directory.memberships[0]).toEqual(original)
  })

  it('rechaza ediciones antiguas y cambios de persona o plantilla en una inscripción existente', async () => {
    const result = await configured()
    const another = await addAnotherPerson(result)
    await result.management.save(result.input, null)
    const original = (await result.repository.read()).memberships[0]!
    expect((await result.management.save({ ...result.input, athleteId: another.id }, original)).ok).toBe(false)
    expect((await result.management.save({ ...result.input, teamSeasonId: result.secondRoster.id }, original)).ok).toBe(false)
    expect(await result.management.save(editInput(original, '6'), original)).toEqual({ ok: true })
    expect(await result.management.save(editInput(original, '7'), original)).toMatchObject({ ok: false, message: expect.stringContaining('otra edición') })
    expect((await result.management.setActive(original, false)).ok).toBe(false)
    expect((await result.repository.read()).memberships[0]).toMatchObject({ id: original.id, jerseyNumber: 6, active: true })
  })

  it('no escribe datos inválidos y conserva el estado confirmado si falla el almacenamiento', async () => {
    const result = await configured()
    expect((await result.management.save({ ...result.input, jerseyNumber: '0' }, null)).ok).toBe(false)
    expect((await result.management.save({ ...result.input, athleteId: 'missing' }, null)).ok).toBe(false)
    const before = await result.repository.read()
    vi.spyOn(result.db.memberships, 'put').mockRejectedValueOnce(new Error('Cuota agotada'))
    expect(await result.management.save(result.input, null)).toMatchObject({ ok: false, message: expect.stringContaining('No se pudo guardar') })
    expect(await result.repository.read()).toEqual(before)
  })
})
