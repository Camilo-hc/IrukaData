import { canonicalJson } from '../../domain/shared/canonical-json'
import type { BackupData, BackupDocument, BackupRepository } from './contracts'

export const BACKUP_COUNTS = [
  ['teams', 'Equipos'], ['seasons', 'Temporadas'], ['athletes', 'Deportistas'], ['memberships', 'Inscripciones'],
  ['competitions', 'Torneos'], ['matches', 'Partidos'], ['sets', 'Sets'], ['events', 'Eventos de juego'],
] as const

function summarize(data: BackupData) {
  return {
    club: data.clubs[0]?.name ?? null,
    teams: data.teams.length, seasons: data.seasons.length, athletes: data.athletes.length, memberships: data.memberships.length,
    competitions: data.competitions.length, matches: data.matches.length, sets: data.matchSets.length,
    events: data.liveBatches.reduce((total, batch) => total + batch.events.length, 0),
  }
}

export interface BackupPreview {
  readonly exportedAt: string
  readonly current: ReturnType<typeof summarize>
  readonly incoming: ReturnType<typeof summarize>
  restore(): Promise<'restored' | 'changed' | 'failed'>
}

export function createBackupManagement(repository: BackupRepository, now: () => string) {
  return {
    lastExport: () => repository.lastExport(),
    async exportBackup() {
      const data = await repository.read()
      const exportedAt = now()
      const backup: BackupDocument = { format: 'IrukaData', version: 1, exportedAt, data }
      const text = JSON.stringify(backup, null, 2)
      return { text, exportedAt, filename: 'irukadata-respaldo-' + exportedAt.replaceAll(':', '-') + '.json' }
    },
    markExported: (at: string) => repository.markExported(at),
    async preview(text: string): Promise<BackupPreview> {
      const { readBackup } = await import('./read-document')
      const backup = readBackup(text)
      const current = await repository.read()
      const expected = canonicalJson(current)
      return {
        exportedAt: backup.exportedAt, current: summarize(current), incoming: summarize(backup.data),
        async restore() {
          try {
            return await repository.restore(backup.data, expected) ? 'restored' : 'changed'
          } catch {
            return 'failed'
          }
        },
      }
    },
  }
}

export type BackupManagement = ReturnType<typeof createBackupManagement>
