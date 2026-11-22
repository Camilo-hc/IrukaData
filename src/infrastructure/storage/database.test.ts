import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStorageHealth, IrukaDatabase } from './database'

const databases: IrukaDatabase[] = []
afterEach(async () => {
  for (const database of databases.splice(0)) await database.delete()
})

describe('base IndexedDB de infraestructura', () => {
  it('conserva metadatos al cerrar y reabrir sin insertar ejemplos', async () => {
    const database = new IrukaDatabase('iruka-test-persistence')
    databases.push(database)
    expect(await createStorageHealth(database).check()).toBe('ready')
    database.close()
    await database.open()
    expect(await database.appMetadata.toArray()).toEqual([{ key: 'schemaVersion', value: '7' }])
    expect(await database.clubs.count()).toBe(0)
    expect(await database.teams.count()).toBe(0)
    expect(await database.seasons.count()).toBe(0)
    expect(await database.athletes.count()).toBe(0)
  })

  it('tolera comprobaciones simultáneas sin duplicar la versión', async () => {
    const database = new IrukaDatabase('iruka-test-concurrent')
    databases.push(database)
    const health = createStorageHealth(database)
    expect(await Promise.all([health.check(), health.check()])).toEqual(['ready', 'ready'])
    expect(await database.appMetadata.count()).toBe(1)
  })

  it('informa indisponibilidad si falla el almacenamiento', async () => {
    const database = new IrukaDatabase('iruka-test-unavailable')
    databases.push(database)
    vi.spyOn(database, 'transaction').mockRejectedValueOnce(new Error('Almacenamiento bloqueado'))
    expect(await createStorageHealth(database).check()).toBe('unavailable')
  })
})
