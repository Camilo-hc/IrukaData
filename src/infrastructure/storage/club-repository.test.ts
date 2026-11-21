import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClubManagement } from '../../application/club/service'
import { createStorageHealth, IrukaDatabase } from './database'
import { DexieClubRepository } from './club-repository'

const databases: IrukaDatabase[] = []
let sequence = 0
function workspace(name = `iruka-club-${++sequence}`) {
  const db = new IrukaDatabase(name)
  databases.push(db)
  const repository = new DexieClubRepository(db)
  const management = createClubManagement(repository, () => `entity-${++sequence}`)
  return { db, repository, management }
}
async function configured() {
  const result = workspace()
  await result.management.saveClub('Club de prueba', null)
  const club = (await result.repository.read()).club!
  return { ...result, club }
}
afterEach(async () => {
  vi.restoreAllMocks()
  const names = new Set(databases.map((db) => db.name))
  for (const db of databases.splice(0)) db.close()
  for (const name of names) await Dexie.delete(name)
})
const seasonInput = { name: '2026', start: '2026-01-01', end: '2026-12-31' }
const teamInput = { name: 'Iruka Sub 16', branch: 'femenino', category: 'sub16' }

describe('gestión local de club, equipos y temporadas', () => {
  it('migra desde Hito 0 conservando metadatos y sin sembrar datos de demostración', async () => {
    const old = new Dexie('iruka-upgrade')
    old.version(1).stores({ appMetadata: '&key' })
    await old.table('appMetadata').bulkPut([{ key: 'schemaVersion', value: '1' }, { key: 'keep', value: 'conservar' }])
    old.close()
    const { db } = workspace('iruka-upgrade')
    expect(await createStorageHealth(db).check()).toBe('ready')
    expect(await db.appMetadata.get('schemaVersion')).toEqual({ key: 'schemaVersion', value: '2' })
    expect(await db.appMetadata.get('keep')).toEqual({ key: 'keep', value: 'conservar' })
    expect(await db.clubs.count()).toBe(0)
    expect(await db.teams.count()).toBe(0)
  })

  it('mantiene un solo club y permite editar su nombre conservando su identidad', async () => {
    const { management, repository, club } = await configured()
    expect((await management.saveClub('Otro club', null)).ok).toBe(false)
    expect(await management.saveClub('Nombre actualizado', club)).toEqual({ ok: true })
    expect((await repository.read()).club).toEqual({ ...club, name: 'Nombre actualizado', revision: 2 })
  })

  it('conserva el equipo, la temporada y la asociación al cerrar y reabrir', async () => {
    const { management, repository, db, club } = await configured()
    await management.saveSeason(seasonInput, null)
    const season = (await repository.read()).seasons[0]!
    expect(await management.saveTeam(teamInput, club, [season.id], null)).toEqual({ ok: true })
    const before = await repository.read()
    db.close()
    await db.open()
    expect(await repository.read()).toEqual(before)
    expect(before.teamSeasons).toHaveLength(1)
    expect(before.teams[0]).toMatchObject(teamInput)
  })

  it('rechaza fechas y categorías inválidas antes de escribir datos', async () => {
    const { management, repository, club } = await configured()
    expect((await management.saveSeason({ ...seasonInput, end: '2025-01-01' }, null)).ok).toBe(false)
    expect((await management.saveTeam({ ...teamInput, category: 'sub12' }, club, [], null)).ok).toBe(false)
    expect(await repository.read()).toMatchObject({ seasons: [], teams: [], teamSeasons: [] })
  })

  it('impide duplicados concurrentes entre dos conexiones sin impedir otra rama', async () => {
    const { db, management, repository, club } = await configured()
    const second = workspace(db.name)
    const outcomes = await Promise.all([
      management.saveTeam(teamInput, club, [], null),
      second.management.saveTeam({ ...teamInput, name: '  IRUKA   SUB 16  ' }, club, [], null),
    ])
    expect(outcomes.filter((result) => result.ok)).toHaveLength(1)
    expect(await repository.read()).toMatchObject({ teams: [expect.any(Object)] })
    expect(await management.saveTeam({ ...teamInput, branch: 'masculino' }, club, [], null)).toEqual({ ok: true })
    expect((await repository.read()).teams).toHaveLength(2)
  })

  it('evita duplicar temporadas por diferencias de espacios y mayúsculas', async () => {
    const { management, repository } = await configured()
    await management.saveSeason({ ...seasonInput, name: 'Temporada 2026' }, null)
    expect((await management.saveSeason({ ...seasonInput, name: '  TEMPORADA  2026 ' }, null)).ok).toBe(false)
    expect((await repository.read()).seasons).toHaveLength(1)
  })

  it('revierte toda la transacción si falla la creación de la asociación', async () => {
    const { management, repository, db, club } = await configured()
    await management.saveSeason(seasonInput, null)
    const season = (await repository.read()).seasons[0]!
    vi.spyOn(db.teamSeasons, 'add').mockRejectedValueOnce(new Error('Cuota agotada'))
    expect((await management.saveTeam(teamInput, club, [season.id], null)).ok).toBe(false)
    expect(await repository.read()).toMatchObject({ teams: [], teamSeasons: [] })
  })

  it('rechaza una edición desactualizada sin sobrescribir los cambios confirmados', async () => {
    const { management, repository, club } = await configured()
    await management.saveTeam(teamInput, club, [], null)
    const oldTeam = (await repository.read()).teams[0]!
    await management.saveTeam({ ...teamInput, name: 'Cambio confirmado' }, club, [], oldTeam)
    const conflict = await management.saveTeam({ ...teamInput, name: 'Edición antigua' }, club, [], oldTeam)
    expect(conflict).toMatchObject({ ok: false, message: expect.stringContaining('otra edición') })
    expect((await repository.read()).teams[0]?.name).toBe('Cambio confirmado')
  })

  it('archiva y restaura conservando IDs; desvincular y vincular reutiliza la plantilla', async () => {
    const { management, repository, club } = await configured()
    await management.saveSeason(seasonInput, null)
    const season = (await repository.read()).seasons[0]!
    await management.saveTeam(teamInput, club, [season.id], null)
    const original = await repository.read()
    const team = original.teams[0]!
    await management.setTeamActive(team, false)
    let current = await repository.read()
    expect(current.teams[0]).toMatchObject({ id: team.id, active: false })
    expect(current.teamSeasons).toEqual(original.teamSeasons)
    await management.setTeamActive(current.teams[0]!, true)
    current = await repository.read()
    await management.saveTeam(teamInput, club, [], current.teams[0]!)
    current = await repository.read()
    expect(current.teamSeasons[0]).toMatchObject({ id: original.teamSeasons[0]!.id, active: false })
    await management.saveTeam(teamInput, club, [season.id], current.teams[0]!)
    expect((await repository.read()).teamSeasons).toEqual(original.teamSeasons)
  })

  it('archiva una temporada manteniendo asociaciones y bloquea nuevas vinculaciones', async () => {
    const { management, repository, club } = await configured()
    await management.saveSeason(seasonInput, null)
    const season = (await repository.read()).seasons[0]!
    await management.saveTeam(teamInput, club, [season.id], null)
    const before = await repository.read()
    await management.setSeasonActive(season, false)
    expect((await repository.read()).teamSeasons).toEqual(before.teamSeasons)
    expect((await management.saveTeam({ ...teamInput, name: 'Equipo nuevo' }, club, [season.id], null)).ok).toBe(false)
    expect(await management.saveTeam({ ...teamInput, name: 'Equipo existente' }, club, [season.id], before.teams[0]!)).toEqual({ ok: true })
    const archived = (await repository.read()).seasons[0]!
    expect(await management.setSeasonActive(archived, true)).toEqual({ ok: true })
    expect((await repository.read()).seasons[0]).toMatchObject({ id: season.id, active: true })
  })
})
