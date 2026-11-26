import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAthleteManagement } from '../../application/athletes/service'
import { createClubManagement } from '../../application/club/service'
import { DexieAthleteRepository } from './athlete-repository'
import { DexieClubRepository } from './club-repository'
import { IrukaDatabase } from './database'

const databases: IrukaDatabase[] = []
let sequence = 0
function workspace(name = `iruka-athletes-${++sequence}`, today = () => '2026-11-21') {
  const db = new IrukaDatabase(name)
  databases.push(db)
  const repository = new DexieAthleteRepository(db)
  const management = createAthleteManagement(repository, () => `athlete-${++sequence}`, today)
  const clubManagement = createClubManagement(new DexieClubRepository(db), () => `club-entity-${++sequence}`)
  return { db, repository, management, clubManagement }
}
async function configured() {
  const result = workspace()
  await result.clubManagement.saveClub('Club de prueba', null)
  return result
}
afterEach(async () => {
  vi.restoreAllMocks()
  const names = new Set(databases.map((db) => db.name))
  for (const db of databases.splice(0)) db.close()
  for (const name of names) await Dexie.delete(name)
})
const input = { name: 'Álex Marín', birthDate: '2008-02-29', notes: 'Primera línea\nSegunda línea' }

describe('perfiles persistentes de deportistas', () => {
  it('migra desde v2 preservando club, equipos, temporadas, asociaciones y metadatos', async () => {
    const old = new Dexie('iruka-athletes-upgrade')
    old.version(2).stores({
      appMetadata: '&key', clubs: '&id', teams: '&id, clubId, &[clubId+branch+category+nameKey]',
      seasons: '&id, &nameKey', teamSeasons: '&id, &[teamId+seasonId], teamId, seasonId',
    })
    const club = { id: 'local-club', name: 'Club existente', revision: 1 }
    const team = { id: 'existing-team', clubId: club.id, name: 'Sub 16', branch: 'femenino', category: 'sub16', active: true, revision: 1, nameKey: 'sub 16' }
    const season = { id: 'existing-season', name: '2026', start: '2026-01-01', end: '2026-12-31', active: true, revision: 1, nameKey: '2026' }
    const link = { id: 'existing-link', teamId: team.id, seasonId: season.id, active: true }
    await old.table('clubs').add(club)
    await old.table('teams').add(team)
    await old.table('seasons').add(season)
    await old.table('teamSeasons').add(link)
    await old.table('appMetadata').bulkPut([{ key: 'schemaVersion', value: '2' }, { key: 'keep', value: 'conservar' }])
    old.close()
    const { db, repository } = workspace('iruka-athletes-upgrade')
    expect(await repository.read()).toEqual({ club, athletes: [] })
    expect(await db.teams.toArray()).toEqual([team])
    expect(await db.seasons.toArray()).toEqual([season])
    expect(await db.teamSeasons.toArray()).toEqual([link])
    expect(await db.appMetadata.get('schemaVersion')).toEqual({ key: 'schemaVersion', value: '9' })
    expect(await db.appMetadata.get('keep')).toEqual({ key: 'keep', value: 'conservar' })
  })

  it('exige configurar el club antes de crear perfiles', async () => {
    const { management, repository } = workspace()
    expect(await management.save(input, null)).toMatchObject({ ok: false, message: expect.stringContaining('Configura tu club') })
    expect((await repository.read()).athletes).toEqual([])
  })

  it('conserva la identidad, nacimiento y notas al cerrar y abrir otra conexión', async () => {
    const { management, repository, db } = await configured()
    expect(await management.save(input, null)).toEqual({ ok: true })
    const original = await repository.read()
    db.close()
    const reopened = workspace(db.name)
    expect(await reopened.repository.read()).toEqual(original)
    expect(original.athletes[0]).toMatchObject(input)
    expect(original.athletes[0]).not.toHaveProperty('searchKey')
  })

  it('editar y vaciar campos opcionales conserva el ID y elimina sus valores anteriores', async () => {
    const { management, repository, db } = await configured()
    await management.save(input, null)
    const original = (await repository.read()).athletes[0]!
    expect(await management.save({ name: 'Nombre corregido', birthDate: '', notes: '' }, original)).toEqual({ ok: true })
    const updated = (await repository.read()).athletes[0]!
    expect(updated).toEqual({ id: original.id, name: 'Nombre corregido', active: true, revision: 2 })
    expect(await db.athletes.get(original.id)).not.toHaveProperty('birthDate')
    expect(await db.athletes.get(original.id)).not.toHaveProperty('notes')
    expect(await db.athletes.count()).toBe(1)
  })

  it('permite homónimos con IDs distintos sin fusionarlos por nombre o nacimiento', async () => {
    const { management, repository } = await configured()
    await management.save(input, null)
    await management.save({ ...input, notes: 'Otra persona' }, null)
    const athletes = (await repository.read()).athletes
    expect(athletes).toHaveLength(2)
    expect(new Set(athletes.map((athlete) => athlete.id)).size).toBe(2)
    expect(athletes.map((athlete) => athlete.notes)).toContain('Otra persona')
  })

  it('archiva y restaura con el mismo ID sin permitir editar un perfil archivado', async () => {
    const { management, repository } = await configured()
    await management.save(input, null)
    const original = (await repository.read()).athletes[0]!
    expect(await management.setActive(original, false)).toEqual({ ok: true })
    const archived = (await repository.read()).athletes[0]!
    expect(archived).toMatchObject({ ...input, id: original.id, active: false, revision: 2 })
    expect((await management.save({ ...input, name: 'No debe cambiar' }, archived)).ok).toBe(false)
    expect(await management.setActive(archived, true)).toEqual({ ok: true })
    const restored = (await repository.read()).athletes
    expect(restored).toHaveLength(1)
    expect(restored[0]).toMatchObject({ ...input, id: original.id, active: true, revision: 3 })
    expect((await management.setActive(original, false)).ok).toBe(false)
  })

  it('solo confirma una de dos ediciones concurrentes basadas en la misma revisión', async () => {
    const { management, repository, db } = await configured()
    await management.save(input, null)
    const original = (await repository.read()).athletes[0]!
    const second = workspace(db.name)
    const results = await Promise.all([
      management.save({ ...input, name: 'Edición A' }, original),
      second.management.save({ ...input, name: 'Edición B' }, original),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toHaveLength(1)
    const saved = (await repository.read()).athletes[0]!
    expect(saved).toMatchObject({ id: original.id, revision: 2 })
    expect(['Edición A', 'Edición B']).toContain(saved.name)
  })

  it('conserva los datos confirmados si el guardado falla por almacenamiento', async () => {
    const { management, repository, db } = await configured()
    await management.save(input, null)
    const original = (await repository.read()).athletes[0]!
    vi.spyOn(db.athletes, 'put').mockRejectedValueOnce(new Error('Cuota agotada'))
    expect(await management.save({ ...input, notes: 'No se confirmó' }, original)).toMatchObject({ ok: false, message: expect.stringContaining('No se pudo guardar') })
    expect((await repository.read()).athletes).toEqual([original])
  })

  it('rechaza datos inválidos sin escribir y consulta el reloj en cada guardado', async () => {
    let today = '2026-11-21'
    const { management, repository, clubManagement } = workspace(undefined, () => today)
    await clubManagement.saveClub('Club de prueba', null)
    expect((await management.save({ ...input, name: '' }, null)).ok).toBe(false)
    expect((await management.save({ ...input, birthDate: '2026-11-22' }, null)).ok).toBe(false)
    expect((await repository.read()).athletes).toEqual([])
    today = '2026-11-22'
    expect(await management.save({ ...input, birthDate: '2026-11-22' }, null)).toEqual({ ok: true })
  })
})
