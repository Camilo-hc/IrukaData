import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCompetitionManagement } from '../../application/competitions/service'
import { createClubManagement } from '../../application/club/service'
import type { Competition } from '../../domain/club/contracts'
import { DexieClubRepository } from './club-repository'
import { DexieCompetitionRepository } from './competition-repository'
import { IrukaDatabase } from './database'

const databases: IrukaDatabase[] = []
let sequence = 0
function workspace(name = `iruka-competitions-${++sequence}`) {
  const db = new IrukaDatabase(name)
  databases.push(db)
  const repository = new DexieCompetitionRepository(db)
  const management = createCompetitionManagement(repository, () => `competition-${++sequence}`)
  const clubManagement = createClubManagement(new DexieClubRepository(db), () => `club-data-${++sequence}`)
  return { db, repository, management, clubManagement }
}
const teamInput = { name: 'Iruka Sub 16', branch: 'femenino', category: 'sub16' }
async function configured() {
  const result = workspace()
  expect((await result.clubManagement.saveClub('Club de prueba', null)).ok).toBe(true)
  const club = (await result.repository.read()).club!
  await result.clubManagement.saveSeason({ name: '2026', start: '2026-01-01', end: '2026-12-31' }, null)
  await result.clubManagement.saveSeason({ name: '2027', start: '2027-01-01', end: '2027-12-31' }, null)
  const seasons = (await result.repository.read()).seasons
  const season = seasons.find((item) => item.name === '2026')!
  const otherSeason = seasons.find((item) => item.name === '2027')!
  await result.clubManagement.saveTeam(teamInput, club, [season.id, otherSeason.id], null)
  await result.clubManagement.saveTeam({ ...teamInput, name: 'Iruka Sub 14', category: 'sub14' }, club, [season.id], null)
  const directory = await result.repository.read()
  const team = directory.teams.find((item) => item.category === 'sub16')!
  const first = directory.teamSeasons.find((link) => link.teamId === team.id && link.seasonId === season.id)!
  const second = directory.teamSeasons.find((link) => link.teamId !== team.id)!
  const differentSeason = directory.teamSeasons.find((link) => link.seasonId === otherSeason.id)!
  const input = { name: 'Copa Sur', kind: 'Torneo', seasonId: season.id, notes: 'Cancha A', teamSeasonIds: [first.id, second.id] }
  return { ...result, club, season, otherSeason, team, first, second, differentSeason, input }
}
function editInput(competition: Competition, teamSeasonIds: readonly string[]) {
  return { name: competition.name, kind: competition.kind, seasonId: competition.seasonId, notes: competition.notes ?? '', teamSeasonIds }
}
afterEach(async () => {
  vi.restoreAllMocks()
  const names = new Set(databases.map((db) => db.name))
  for (const db of databases.splice(0)) db.close()
  for (const name of names) await Dexie.delete(name)
})

describe('torneos y equipos participantes', () => {
  it('migra desde v4 conservando club, plantillas, perfiles, dorsales y metadatos', async () => {
    const old = new Dexie('iruka-competitions-upgrade')
    old.version(4).stores({
      appMetadata: '&key', clubs: '&id', teams: '&id, clubId, &[clubId+branch+category+nameKey]',
      seasons: '&id, &nameKey', teamSeasons: '&id, &[teamId+seasonId], teamId, seasonId', athletes: '&id, searchKey',
      memberships: '&id, athleteId, teamSeasonId, &[teamSeasonId+athleteId], &[teamSeasonId+activeJerseyNumber]',
    })
    const records = {
      clubs: { id: 'local-club', name: 'Club existente', revision: 1 },
      teams: { id: 't', clubId: 'local-club', name: 'Sub 16', branch: 'femenino', category: 'sub16', active: true, revision: 1, nameKey: 'sub 16' },
      seasons: { id: 's', name: '2026', start: '2026-01-01', end: '2026-12-31', active: true, revision: 1, nameKey: '2026' },
      teamSeasons: { id: 'ts', teamId: 't', seasonId: 's', active: true },
      athletes: { id: 'a', name: 'Persona existente', active: true, revision: 1, searchKey: 'persona existente' },
      memberships: { id: 'm', athleteId: 'a', teamSeasonId: 'ts', jerseyNumber: 5, activeJerseyNumber: 5, usualRole: 'punta', active: true, revision: 1 },
    }
    for (const [table, record] of Object.entries(records)) await old.table(table).add(record)
    await old.table('appMetadata').bulkPut([{ key: 'schemaVersion', value: '4' }, { key: 'keep', value: 'conservar' }])
    old.close()
    const { db, repository } = workspace('iruka-competitions-upgrade')
    expect(await repository.read()).toMatchObject({ competitions: [], entries: [] })
    for (const [table, record] of Object.entries(records)) expect(await db.table(table).toArray()).toEqual([record])
    expect(await db.appMetadata.toArray()).toEqual(expect.arrayContaining([{ key: 'schemaVersion', value: '8' }, { key: 'keep', value: 'conservar' }]))
  })

  it('un torneo reúne equipos de la misma temporada y un equipo participa en varios torneos', async () => {
    const result = await configured()
    expect(await result.management.save(result.input, null)).toEqual({ ok: true })
    expect(await result.management.save({ ...result.input, name: 'Liga Regional', teamSeasonIds: [result.first.id] }, null)).toEqual({ ok: true })
    const directory = await result.repository.read()
    expect(directory.competitions).toHaveLength(2)
    expect(directory.entries).toHaveLength(3)
    expect(directory.entries.filter((entry) => entry.teamSeasonId === result.first.id)).toHaveLength(2)
    result.db.close()
    expect((await workspace(result.db.name).repository.read()).entries).toEqual(directory.entries)
  })

  it('retirar y recuperar un equipo conserva el ID de su participación', async () => {
    const result = await configured()
    await result.management.save(result.input, null)
    let directory = await result.repository.read()
    const original = directory.entries.find((entry) => entry.teamSeasonId === result.second.id)!
    await result.management.save({ ...result.input, teamSeasonIds: [result.first.id] }, directory.competitions[0]!)
    directory = await result.repository.read()
    expect(directory.entries.find((entry) => entry.id === original.id)?.active).toBe(false)
    await result.management.save(result.input, directory.competitions[0]!)
    directory = await result.repository.read()
    expect(directory.entries).toHaveLength(2)
    expect(directory.entries.find((entry) => entry.id === original.id)).toEqual(original)
  })

  it('no admite equipos de otra temporada, referencias ausentes ni torneos sin equipos', async () => {
    const result = await configured()
    for (const ids of [[result.differentSeason.id], ['missing'], []]) {
      expect((await result.management.save({ ...result.input, teamSeasonIds: ids }, null)).ok).toBe(false)
    }
    expect((await result.repository.read()).competitions).toHaveLength(0)
    expect((await result.repository.read()).entries).toHaveLength(0)
  })

  it('conserva la temporada y rechaza cambios de identidad durante la edición', async () => {
    const result = await configured()
    await result.management.save(result.input, null)
    const current = (await result.repository.read()).competitions[0]!
    expect((await result.management.save({ ...result.input, seasonId: result.otherSeason.id, teamSeasonIds: [result.differentSeason.id] }, current)).ok).toBe(false)
    await expect(result.repository.save({ ...current, seasonId: result.otherSeason.id, revision: 2 }, [result.differentSeason.id], 1)).rejects.toMatchObject({ code: 'immutable_season' })
    expect((await result.repository.read()).competitions[0]).toEqual(current)
  })

  it('archivar y restaurar conserva la identidad del torneo y sus participaciones', async () => {
    const result = await configured()
    await result.management.save(result.input, null)
    const before = await result.repository.read()
    const current = before.competitions[0]!
    await result.management.setActive(current, false)
    const archived = (await result.repository.read()).competitions[0]!
    expect((await result.management.save(result.input, archived)).ok).toBe(false)
    expect(await result.management.setActive(archived, true)).toEqual({ ok: true })
    const after = await result.repository.read()
    expect(after.entries).toEqual(before.entries)
    expect(after.competitions[0]).toEqual({ ...current, revision: 3 })
  })

  it('rechaza nombres duplicados en una temporada, incluidos los archivados, pero permite otra temporada', async () => {
    const result = await configured()
    await result.management.save(result.input, null)
    const current = (await result.repository.read()).competitions[0]!
    await result.management.setActive(current, false)
    expect(await result.management.save({ ...result.input, name: '  COPA   SUR  ' }, null)).toMatchObject({ ok: false, message: expect.stringContaining('Ya existe') })
    expect((await result.management.save({ ...result.input, seasonId: result.otherSeason.id, teamSeasonIds: [result.differentSeason.id] }, null)).ok).toBe(true)
  })

  it('serializa dos conexiones que crean el mismo torneo sin dejar participaciones huérfanas', async () => {
    const result = await configured()
    const second = workspace(result.db.name)
    const outcomes = await Promise.all([result.management.save(result.input, null), second.management.save(result.input, null)])
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1)
    expect((await result.repository.read()).competitions).toHaveLength(1)
    expect((await result.repository.read()).entries).toHaveLength(2)
  })

  it('una edición desactualizada no sobrescribe el torneo ni sus equipos', async () => {
    const result = await configured()
    await result.management.save(result.input, null)
    const current = (await result.repository.read()).competitions[0]!
    const second = workspace(result.db.name)
    expect((await result.management.save({ ...result.input, name: 'Nombre confirmado', teamSeasonIds: [result.first.id] }, current)).ok).toBe(true)
    expect(await second.management.save({ ...result.input, name: 'Edición antigua' }, current)).toMatchObject({ ok: false, message: expect.stringContaining('otra edición') })
    expect((await second.management.setActive(current, false)).ok).toBe(false)
    const after = await result.repository.read()
    expect(after.competitions[0]?.name).toBe('Nombre confirmado')
    expect(after.entries.filter((entry) => entry.active)).toHaveLength(1)
  })

  it.each(['team', 'association'] as const)('preserva una participación con %s inactivo sin permitir nuevas altas ni reactivaciones', async (reference) => {
    const result = await configured()
    await result.management.save(result.input, null)
    const before = await result.repository.read()
    if (reference === 'team') await result.clubManagement.setTeamActive(result.team, false)
    else await result.clubManagement.saveTeam(teamInput, result.club, [result.otherSeason.id], result.team)
    expect((await result.repository.read()).entries).toEqual(before.entries)
    expect((await result.management.save({ ...result.input, name: 'Otro torneo', teamSeasonIds: [result.first.id] }, null)).ok).toBe(false)
    expect((await result.management.save({ ...result.input, notes: 'Edición conservando asociaciones' }, before.competitions[0]!)).ok).toBe(true)
    let current = (await result.repository.read()).competitions[0]!
    expect((await result.management.save(editInput(current, [result.second.id]), current)).ok).toBe(true)
    current = (await result.repository.read()).competitions[0]!
    expect((await result.management.save(editInput(current, [result.first.id, result.second.id]), current)).ok).toBe(false)
  })

  it('archivar la temporada conserva los torneos, bloquea ediciones y restauraciones pero permite archivarlos', async () => {
    const result = await configured()
    await result.management.save(result.input, null)
    const before = await result.repository.read()
    await result.clubManagement.setSeasonActive(result.season, false)
    const current = before.competitions[0]!
    expect((await result.management.save(result.input, current)).ok).toBe(false)
    expect((await result.management.save({ ...result.input, name: 'Otro' }, null)).ok).toBe(false)
    expect((await result.management.setActive(current, false)).ok).toBe(true)
    const archived = (await result.repository.read()).competitions[0]!
    expect((await result.management.setActive(archived, true)).ok).toBe(false)
    expect((await result.repository.read()).entries).toEqual(before.entries)
  })

  it('revierte todo el guardado si falla una participación después de guardar el torneo', async () => {
    const result = await configured()
    const before = await result.repository.read()
    vi.spyOn(result.db.competitionEntries, 'add').mockRejectedValueOnce(new Error('Cuota agotada'))
    expect(await result.management.save(result.input, null)).toMatchObject({ ok: false, message: expect.stringContaining('No se pudo guardar') })
    expect(await result.repository.read()).toEqual(before)
  })
})
