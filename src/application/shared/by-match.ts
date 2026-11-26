import type { Match } from '../../domain/match/contracts'

export function byMatch<T extends { matchId: Match['id'] }>(rows: readonly T[]): Map<Match['id'], T[]> {
  const groups = new Map<Match['id'], T[]>()
  for (const row of rows) {
    const group = groups.get(row.matchId) ?? []
    group.push(row)
    groups.set(row.matchId, group)
  }
  return groups
}
