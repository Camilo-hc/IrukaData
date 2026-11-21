import type { Competition, CompetitionEntry, Season, Team, TeamSeason } from '../club/contracts'

export interface MatchContext {
  readonly entry: CompetitionEntry
  readonly competition: Competition
  readonly teamSeason: TeamSeason
  readonly team: Team
  readonly season: Season
}
export interface MatchReferences {
  readonly entries: readonly CompetitionEntry[]
  readonly competitions: readonly Competition[]
  readonly teamSeasons: readonly TeamSeason[]
  readonly teams: readonly Team[]
  readonly seasons: readonly Season[]
}
export function resolveMatchContext(entryId: string, references: MatchReferences): MatchContext | undefined {
  const entry = references.entries.find((item) => item.id === entryId)
  const competition = references.competitions.find((item) => item.id === entry?.competitionId)
  const teamSeason = references.teamSeasons.find((item) => item.id === entry?.teamSeasonId)
  const team = references.teams.find((item) => item.id === teamSeason?.teamId)
  const season = references.seasons.find((item) => item.id === competition?.seasonId)
  if (!entry || !competition || !teamSeason || !team || !season || teamSeason.seasonId !== season.id) return undefined
  return { entry, competition, teamSeason, team, season }
}
export function participationIsActive(context: MatchContext | undefined): context is MatchContext {
  return Boolean(context && context.entry.active && context.competition.active && context.teamSeason.active && context.team.active && context.season.active)
}
