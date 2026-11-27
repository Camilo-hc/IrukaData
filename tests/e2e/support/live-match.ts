import { expect, type Locator, type Page } from '@playwright/test'

export async function pressPointAt(button: Locator, timeStamp: number) {
  await expect(button).toBeEnabled()
  await button.evaluate((element, timestamp) => {
    const click = new MouseEvent('click', { bubbles: true, detail: 1 })
    Object.defineProperty(click, 'timeStamp', { value: timestamp })
    element.dispatchEvent(click)
  }, timeStamp)
}

export async function prepareMatch(page: Page, withChanges = false) {
  await page.goto('/')
  await expect(page.getByText('Almacenamiento local disponible', { exact: true })).toBeVisible()
  await page.evaluate(async (withChanges) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('irukadata')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const rules = {
      schemaVersion: 1, profileId: 'iruka-mvp', profileVersion: 1, label: 'Mejor de tres', sources: [],
      format: { setsToWin: 2, regularSetTarget: 25, decidingSetTarget: 15, minimumLead: 2, decidingSetSideChangeAt: 8 },
      officialSubstitutions: { limitPerSet: 6, reentryPolicy: 'fivb_starter_pair' },
      libero: { minimumDesignated: 0, maximumDesignated: 2, twoRequiredAboveRosterSize: null, canServe: false, completedRallyBetweenReplacements: true },
      exceptionalProcedures: 'unsupported',
    }
    const roster = Array.from({ length: withChanges ? 10 : 7 }, (_, index) => ({
      id: `player-${index + 1}`, matchId: 'partido-vivo', athleteId: `athlete-${index + 1}`,
      rosterMembershipId: `member-${index + 1}`, nameSnapshot: `Deportista ${index + 1}`,
      jerseyNumberSnapshot: index + 1, calledUp: true, designatedLibero: withChanges && (index === 1 || index === 9),
    }))
    const starters = withChanges ? [1, 3, 4, 6, 5, 8].map((number) => roster[number - 1]!) : roster.slice(0, 6)
    const rows = {
      clubs: { id: 'local-club', name: 'Club Iruka', revision: 1 },
      teams: { id: 'team', clubId: 'local-club', name: 'Iruka Sub 16', branch: 'femenino', category: 'sub16', active: true, revision: 1, nameKey: 'iruka sub 16' },
      seasons: { id: 'season', name: '2026', start: '2026-01-01', end: '2026-12-31', active: true, revision: 1, nameKey: '2026' },
      teamSeasons: { id: 'team-season', teamId: 'team', seasonId: 'season', active: true },
      competitions: { id: 'cup', name: 'Copa Sur', nameKey: 'copa sur', kind: 'Copa', seasonId: 'season', active: true, revision: 1 },
      competitionEntries: { id: 'entry', teamSeasonId: 'team-season', competitionId: 'cup', active: true },
      matches: {
        id: 'partido-vivo', competitionEntryId: 'entry', opponentName: 'Club Costa', scheduledAt: '2026-11-22T12:00',
        venue: 'Gimnasio Norte', location: 'local', stage: '', rulesSnapshot: rules, phase: 'LISTO_PARA_SAQUE', version: 3, active: true,
      },
      matchSets: {
        id: 'set-1', matchId: 'partido-vivo', number: 1, initialOrder: Object.fromEntries(starters.map((player, index) => [index + 1, player.id])),
        initialService: 'opponent', rulesSnapshot: rules, status: 'pending', finalScore: null,
      },
    }
    try {
      const transaction = database.transaction([...Object.keys(rows), 'matchRosters', 'athletes', 'memberships'], 'readwrite')
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error)
        for (const [table, row] of Object.entries(rows)) transaction.objectStore(table).add(row)
        for (const player of roster) {
          transaction.objectStore('matchRosters').add(player)
          transaction.objectStore('athletes').add({
            id: player.athleteId, name: player.nameSnapshot, searchKey: player.nameSnapshot.toLowerCase(), active: true, revision: 1,
          })
          transaction.objectStore('memberships').add({
            id: player.rosterMembershipId, teamSeasonId: 'team-season', athleteId: player.athleteId,
            jerseyNumber: player.jerseyNumberSnapshot, activeJerseyNumber: player.jerseyNumberSnapshot,
            usualRole: 'sin_definir', active: true, revision: 1,
          })
        }
      })
    } finally { database.close() }
  }, withChanges)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15_000 }).toBe(true)
  await page.goto('/#/partidos/partido-vivo')
}
