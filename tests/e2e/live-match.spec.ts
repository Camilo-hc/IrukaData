import { expect, test, type Page } from '@playwright/test'

async function prepareMatch(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Almacenamiento local disponible', { exact: true })).toBeVisible()
  await page.evaluate(async () => {
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
    const roster = Array.from({ length: 7 }, (_, index) => ({
      id: `player-${index + 1}`, matchId: 'partido-vivo', athleteId: `athlete-${index + 1}`,
      rosterMembershipId: `member-${index + 1}`, nameSnapshot: `Deportista ${index + 1}`,
      jerseyNumberSnapshot: index + 1, calledUp: true, designatedLibero: false,
    }))
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
        id: 'set-1', matchId: 'partido-vivo', number: 1, initialOrder: Object.fromEntries(roster.slice(0, 6).map((player, index) => [index + 1, player.id])),
        initialService: 'opponent', rulesSnapshot: rules, status: 'pending', finalScore: null,
      },
    }
    try {
      const transaction = database.transaction([...Object.keys(rows), 'matchRosters'], 'readwrite')
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error)
        for (const [table, row] of Object.entries(rows)) transaction.objectStore(table).add(row)
        for (const player of roster) transaction.objectStore('matchRosters').add(player)
      })
    } finally { database.close() }
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.goto('/#/partidos/partido-vivo')
}

test('registra siete acciones offline, suma un punto y deshace marcador, saque y rotación', async ({ page, context }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1024, height: 768 })
  await prepareMatch(page)
  const matchUrl = page.url()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Iniciar anotación', exact: true }).click()
  const live = page.getByRole('region', { name: 'Anotación en vivo' })
  const score = live.getByRole('group', { name: 'Marcador del set' })
  const own = score.getByLabel('Puntos del equipo propio', { exact: true })
  const rival = score.getByLabel('Puntos del rival', { exact: true })
  const recent = live.getByRole('list', { name: 'Últimos registros' })
  const court = live.getByRole('group', { name: 'Posiciones en cancha' })
  await expect(score).toContainText('Saque Club Costa')
  await court.getByRole('button', { name: /Posición 1.*Deportista 1/ }).click()
  await expect(live.getByRole('group', { name: 'Acciones técnicas' }).getByRole('button', { name: 'Saque', exact: true })).toBeDisabled()

  async function action(kind: string, result: RegExp) {
    await live.getByRole('group', { name: 'Acciones técnicas' }).getByRole('button', { name: kind, exact: true }).click()
    const results = live.getByRole('group', { name: `Resultados de ${kind.toLowerCase()}` })
    await results.getByRole('button', { name: result }).click()
    await expect(results).toHaveCount(0)
  }

  await action('Recepción', /^Perfecta$/)
  await action('Colocación', /^Precisa$/)
  await action('Ataque', /^Continuidad$/)
  await expect(own).toHaveText('0')
  await page.reload()
  await expect(score).toContainText('Jugada en curso')
  await expect(recent).toContainText('Ataque · Continuidad')
  await court.getByRole('button', { name: /Posición 1.*Deportista 1/ }).click()
  await action('Defensa', /^Controlada$/)
  await action('Colocación', /^Imprecisa$/)
  await action('Ataque', /^Continuidad$/)
  await action('Ataque', /^Punto \+/)
  await expect(own).toHaveText('1')
  await expect(rival).toHaveText('0')
  await expect(score).toContainText('Saque Iruka Sub 16')
  await expect(court.getByRole('button', { name: /Posición 1.*Deportista 2/ })).toBeVisible()
  await expect(recent.getByRole('listitem').filter({ hasText: 'Punto para Iruka Sub 16' })).toHaveCount(1)
  expect(page.url()).toBe(matchUrl)
  await live.screenshot({ path: 'test-results/partido-en-vivo.png' })

  const second = await context.newPage()
  await second.setViewportSize({ width: 375, height: 812 })
  await second.goto(matchUrl)
  const mobile = second.getByRole('region', { name: 'Anotación en vivo' })
  await expect(mobile.getByLabel('Puntos del equipo propio', { exact: true })).toHaveText('1')
  await mobile.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(own).toHaveText('0')
  await expect(score).toContainText('Saque Club Costa')
  await expect(court.getByRole('button', { name: /Posición 1.*Deportista 1/ })).toBeVisible()
  await expect(recent).toContainText('Último registro deshecho')
  const manual = mobile.getByRole('button', { name: 'Punto rival', exact: true })
  await manual.dblclick()
  await expect(rival).toHaveText('1')
  await expect(recent.getByRole('listitem').filter({ hasText: 'Punto para Club Costa · Manual' })).toHaveCount(1)
  await second.reload()
  await expect(mobile.getByLabel('Puntos del rival', { exact: true })).toHaveText('1')
  expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(second.url()).toBe(matchUrl)
})
