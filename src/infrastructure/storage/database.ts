import Dexie, { type Table } from 'dexie'
import type { StorageHealthPort, StorageStatus } from '../../application/ports'

export interface AppMetadata { key: string; value: string }

/** Solo metadatos de infraestructura. Las tablas del producto llegarán por hito. */
export class IrukaDatabase extends Dexie {
  appMetadata!: Table<AppMetadata, string>

  constructor(name = 'irukadata') {
    super(name)
    this.version(1).stores({ appMetadata: '&key' })
  }
}

export function createStorageHealth(database: IrukaDatabase): StorageHealthPort {
  return {
    async check(): Promise<StorageStatus> {
      try {
        await database.transaction('rw', database.appMetadata, async () => {
          const version = await database.appMetadata.get('schemaVersion')
          if (!version) await database.appMetadata.add({ key: 'schemaVersion', value: '1' })
        })
        return 'ready'
      } catch {
        return 'unavailable'
      }
    },
  }
}
