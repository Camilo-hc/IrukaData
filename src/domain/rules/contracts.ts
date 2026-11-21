/** Contrato de configuración; no valida ni ejecuta reglas en Hito 0. */
export interface RulesSnapshot {
  readonly schemaVersion: 1
  readonly profileId: string
  readonly profileVersion: number
  readonly label: string
  readonly sources: readonly string[]
  readonly format: Readonly<{
    setsToWin: 2
    regularSetTarget: 25
    decidingSetTarget: 15
    minimumLead: 2
    decidingSetSideChangeAt: number | null
  }>
  readonly officialSubstitutions: Readonly<{
    limitPerSet: number
    reentryPolicy: 'fivb_starter_pair'
  }>
  readonly libero: Readonly<{
    minimumDesignated: 0 | 1 | 2
    maximumDesignated: 0 | 1 | 2
    twoRequiredAboveRosterSize: number | null
    canServe: false
    completedRallyBetweenReplacements: true
  }>
  readonly exceptionalProcedures: 'unsupported'
}
