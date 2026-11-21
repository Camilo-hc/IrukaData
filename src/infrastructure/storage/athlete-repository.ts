import { liveQuery } from 'dexie'
import { AthleteError, type AthleteDirectory, type AthleteRepository } from '../../application/athletes/ports'
import type { Athlete } from '../../domain/club/contracts'
import { athleteSearchKey } from '../../domain/athletes/validation'
import type { IrukaDatabase, StoredAthlete } from './database'

function athleteModel(row: StoredAthlete): Athlete {
  return {
    id: row.id, name: row.name, active: row.active, revision: row.revision,
    ...(row.birthDate ? { birthDate: row.birthDate } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
  }
}

export class DexieAthleteRepository implements AthleteRepository {
  constructor(private readonly database: IrukaDatabase) {}

  async read(): Promise<AthleteDirectory> {
    const db = this.database
    return db.transaction('r', [db.clubs, db.athletes], async () => {
      const [clubs, athletes] = await Promise.all([db.clubs.toArray(), db.athletes.toArray()])
      return { club: clubs[0] ?? null, athletes: athletes.map(athleteModel) }
    })
  }

  observe(next: (directory: AthleteDirectory) => void, error: () => void): () => void {
    const subscription = liveQuery(() => this.read()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }

  async save(athlete: Athlete, expectedRevision: number) {
    const db = this.database
    await db.transaction('rw', [db.clubs, db.athletes], async () => {
      if (await db.clubs.count() !== 1) throw new AthleteError('club_missing')
      const current = await db.athletes.get(athlete.id)
      if ((current?.revision ?? 0) !== expectedRevision || (current && !current.active)) throw new AthleteError('conflict')
      // El nombre no es único: dos personas pueden ser homónimas.
      await db.athletes.put({ ...athlete, searchKey: athleteSearchKey(athlete.name) })
    })
  }

  async setActive(athlete: Athlete, active: boolean) {
    const db = this.database
    await db.transaction('rw', db.athletes, async () => {
      const current = await db.athletes.get(athlete.id)
      if (!current || current.revision !== athlete.revision) throw new AthleteError('conflict')
      await db.athletes.put({ ...current, active, revision: current.revision + 1 })
    })
  }
}
