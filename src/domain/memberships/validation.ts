import type { AthleteRole, RosterMembership, Season, Team, TeamSeason } from '../club/contracts'
import type { Validation } from '../shared/validation'

export const ATHLETE_ROLES: Readonly<Record<AthleteRole, string>> = {
  sin_definir: 'Sin definir', colocador: 'Colocador/a', central: 'Central',
  punta: 'Punta', opuesto: 'Opuesto/a', libero: 'Líbero',
}
export interface MembershipInput { athleteId: string; teamSeasonId: string; jerseyNumber: string; usualRole: string }
export type MembershipDetails = Pick<RosterMembership, 'athleteId' | 'teamSeasonId' | 'jerseyNumber' | 'usualRole'>

export function validateMembership(input: MembershipInput): Validation<MembershipDetails> {
  const rawNumber = input.jerseyNumber.trim()
  const jerseyNumber = Number(rawNumber)
  const fields = {
    ...(!input.athleteId.trim() ? { athleteId: 'Selecciona un deportista existente.' } : {}),
    ...(!input.teamSeasonId.trim() ? { teamSeasonId: 'Selecciona una plantilla de equipo y temporada.' } : {}),
    ...(!/^\d+$/.test(rawNumber) || !Number.isSafeInteger(jerseyNumber) || jerseyNumber <= 0 ? { jerseyNumber: 'Indica un dorsal entero positivo.' } : {}),
    ...(!Object.hasOwn(ATHLETE_ROLES, input.usualRole) ? { usualRole: 'Selecciona un rol habitual válido.' } : {}),
  }
  if (Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, value: {
    athleteId: input.athleteId as RosterMembership['athleteId'],
    teamSeasonId: input.teamSeasonId as RosterMembership['teamSeasonId'],
    jerseyNumber, usualRole: input.usualRole as AthleteRole,
  } }
}

export interface RosterContext { teamSeason: TeamSeason; team: Team; season: Season }
export function resolveRoster(id: string, links: readonly TeamSeason[], teams: readonly Team[], seasons: readonly Season[]): RosterContext | undefined {
  const teamSeason = links.find((link) => link.id === id)
  const team = teams.find((item) => item.id === teamSeason?.teamId)
  const season = seasons.find((item) => item.id === teamSeason?.seasonId)
  return teamSeason && team && season ? { teamSeason, team, season } : undefined
}
export function rosterIsActive(context: RosterContext): boolean {
  return context.teamSeason.active && context.team.active && context.season.active
}
