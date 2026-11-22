import type { Id, IsoDate } from '../shared/types'

export type Category = 'sub14' | 'sub16' | 'sub18' | 'sub21' | 'tc'
export type Branch = 'masculino' | 'femenino'
export type AthleteRole = 'colocador' | 'central' | 'punta' | 'opuesto' | 'libero' | 'sin_definir'

export interface Club { readonly id: Id<'Club'>; readonly name: string; readonly revision: number }
export interface Athlete {
  readonly id: Id<'Athlete'>
  readonly name: string
  readonly birthDate?: IsoDate
  readonly notes?: string
  readonly active: boolean
  readonly revision: number
}
export interface Team {
  readonly id: Id<'Team'>
  readonly clubId: Club['id']
  readonly name: string
  readonly branch: Branch
  readonly category: Category
  readonly active: boolean
  readonly revision: number
}
export interface Season {
  readonly id: Id<'Season'>
  readonly name: string
  readonly start: IsoDate
  readonly end: IsoDate
  readonly active: boolean
  readonly revision: number
}
export interface TeamSeason {
  readonly id: Id<'TeamSeason'>
  readonly teamId: Team['id']
  readonly seasonId: Season['id']
  readonly active: boolean
}
export interface RosterMembership {
  readonly id: Id<'RosterMembership'>
  readonly athleteId: Athlete['id']
  readonly teamSeasonId: TeamSeason['id']
  readonly jerseyNumber: number
  readonly usualRole: AthleteRole
  readonly active: boolean
  readonly revision: number
}
export interface Competition {
  readonly id: Id<'Competition'>
  readonly name: string
  readonly kind: string
  readonly seasonId: Season['id']
  readonly notes?: string
  readonly active: boolean
  readonly revision: number
}
export interface CompetitionEntry {
  readonly id: Id<'CompetitionEntry'>
  readonly teamSeasonId: TeamSeason['id']
  readonly competitionId: Competition['id']
  readonly active: boolean
}
