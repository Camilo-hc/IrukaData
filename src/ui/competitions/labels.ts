import type { CompetitionDirectory } from '../../application/competitions/ports'
import type { TeamSeason } from '../../domain/club/contracts'
import { BRANCHES, CATEGORIES } from '../../domain/club/validation'

export function teamSeasonLabel(directory: CompetitionDirectory, link: TeamSeason): string {
  const team = directory.teams.find((item) => item.id === link.teamId)
  return team ? `${team.name} · ${BRANCHES[team.branch]} · ${CATEGORIES[team.category]}` : 'Equipo no disponible'
}
