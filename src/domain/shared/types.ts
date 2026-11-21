export type Id<Entity extends string> = string & { readonly __entity: Entity }
export type Side = 'own' | 'opponent'
export type Position = 1 | 2 | 3 | 4 | 5 | 6
export type Score = Readonly<{ own: number; opponent: number }>
export type Positions<T> = Readonly<Record<Position, T>>
export type IsoDate = string
export type IsoTimestamp = string
