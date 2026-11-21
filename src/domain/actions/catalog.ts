import type { Side } from '../shared/types'

interface ResultDefinition { readonly label: string; readonly pointWinner: Side | null }
interface ActionDefinition {
  readonly label: string
  readonly results: Readonly<Record<string, ResultDefinition>>
}

/** Semántica compartida por motor y estadísticas; sin mutaciones ni puntuación. */
export const ACTION_CATALOG = {
  serve: { label: 'Saque', results: {
    ace: { label: 'Ace', pointWinner: 'own' },
    efectivo: { label: 'Efectivo', pointWinner: null },
    en_juego: { label: 'En juego', pointWinner: null },
    error: { label: 'Error', pointWinner: 'opponent' },
  } },
  reception: { label: 'Recepción', results: {
    perfecta: { label: 'Perfecta', pointWinner: null },
    positiva: { label: 'Positiva', pointWinner: null },
    regular: { label: 'Regular', pointWinner: null },
    negativa: { label: 'Negativa', pointWinner: null },
    error: { label: 'Error', pointWinner: 'opponent' },
  } },
  attack: { label: 'Ataque', results: {
    punto: { label: 'Punto', pointWinner: 'own' },
    continuidad: { label: 'Continuidad', pointWinner: null },
    bloqueado_punto_rival: { label: 'Bloqueado: punto rival', pointWinner: 'opponent' },
    error: { label: 'Error', pointWinner: 'opponent' },
  } },
  block: { label: 'Bloqueo', results: {
    punto: { label: 'Punto', pointWinner: 'own' },
    toque: { label: 'Toque', pointWinner: null },
    falta: { label: 'Falta', pointWinner: 'opponent' },
  } },
  dig: { label: 'Defensa', results: {
    controlada: { label: 'Controlada', pointWinner: null },
    sin_control: { label: 'Sin control', pointWinner: null },
    error_directo: { label: 'Error directo', pointWinner: 'opponent' },
  } },
  setting: { label: 'Colocación', results: {
    precisa: { label: 'Precisa', pointWinner: null },
    imprecisa: { label: 'Imprecisa', pointWinner: null },
    falta: { label: 'Falta', pointWinner: 'opponent' },
  } },
} as const satisfies Readonly<Record<string, ActionDefinition>>

export type TechnicalAction = {
  [K in keyof typeof ACTION_CATALOG]: Readonly<{
    action: K
    result: keyof typeof ACTION_CATALOG[K]['results']
  }>
}[keyof typeof ACTION_CATALOG]
