import type { Athlete, Club, RosterMembership, Season, Team, TeamSeason } from '../domain/club/contracts'
import type { Id } from '../domain/shared/types'

// IDs fijos y datos ficticios: nunca se insertan automáticamente en IndexedDB.
const id = <T extends string>(value: string) => value as Id<T>
export const demoClub: Club = { id: id('demo-club'), name: 'Club Iruka · Demostración', revision: 1 }
export const demoSeason: Season = { id: id('demo-2026'), name: 'Temporada 2026', start: '2026-01-01', end: '2026-12-31', active: true, revision: 1 }
export const demoTeams: readonly Team[] = [
  { id: id('demo-sub14'), clubId: demoClub.id, name: 'Iruka Sub 14', branch: 'femenino', category: 'sub14', active: true, revision: 1 },
  { id: id('demo-sub16'), clubId: demoClub.id, name: 'Iruka Sub 16', branch: 'femenino', category: 'sub16', active: true, revision: 1 },
  { id: id('demo-tc'), clubId: demoClub.id, name: 'Iruka TC', branch: 'masculino', category: 'tc', active: true, revision: 1 },
]
export const demoTeamSeasons: readonly TeamSeason[] = demoTeams.map((team) => ({
  id: id(`demo-ts-${team.category}`), teamId: team.id, seasonId: demoSeason.id, active: true,
}))
export const demoAthletes: readonly Athlete[] = [
  { id: id('demo-alex'), name: 'Alex Marín', active: true, revision: 1 },
  { id: id('demo-sol'), name: 'Sol Ríos', active: true, revision: 1 },
  { id: id('demo-noa'), name: 'Noa Vega', active: true, revision: 1 },
]
export const demoMemberships: readonly RosterMembership[] = [
  { id: id('demo-r1'), athleteId: id('demo-alex'), teamSeasonId: id('demo-ts-sub14'), jerseyNumber: 5, usualRole: 'punta', active: true, revision: 1 },
  { id: id('demo-r2'), athleteId: id('demo-alex'), teamSeasonId: id('demo-ts-sub16'), jerseyNumber: 8, usualRole: 'punta', active: true, revision: 1 },
  { id: id('demo-r3'), athleteId: id('demo-sol'), teamSeasonId: id('demo-ts-sub16'), jerseyNumber: 2, usualRole: 'libero', active: true, revision: 1 },
  { id: id('demo-r4'), athleteId: id('demo-noa'), teamSeasonId: id('demo-ts-tc'), jerseyNumber: 10, usualRole: 'colocador', active: true, revision: 1 },
]
