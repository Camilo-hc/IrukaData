import { expect, test, type Locator, type Page } from '@playwright/test'

async function pressPointAt(button: Locator, timeStamp: number) {
  await expect(button).toBeEnabled()
  await button.evaluate((element, timestamp) => {
    const click = new MouseEvent('click', { bubbles: true, detail: 1 })
    Object.defineProperty(click, 'timeStamp', { value: timestamp })
    element.dispatchEvent(click)
  }, timeStamp)
}

async function prepareMatch(page: Page, withChanges = false) {
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
    await navigator.serviceWorker.ready
  }, withChanges)
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

test('registra dos líberos y una solicitud oficial agrupada sin salir del partido ni conectarse', async ({ page, context }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1024, height: 768 })
  await prepareMatch(page, true)
  const matchUrl = page.url()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Iniciar anotación', exact: true }).click()
  const live = page.getByRole('region', { name: 'Anotación en vivo' })
  const court = live.getByRole('group', { name: 'Posiciones en cancha' })
  const recent = live.getByRole('list', { name: 'Últimos registros' })
  const changes = live.getByRole('region', { name: 'Cambios en cancha' })
  const count = changes.getByLabel('Cupo de cambios oficiales')
  const official = changes.getByRole('button', { name: /^Cambio oficial/ })
  const libero = changes.getByRole('button', { name: /^Reemplazo de líbero/ })
  const own = live.getByLabel('Puntos del equipo propio', { exact: true })
  const rival = live.getByLabel('Puntos del rival', { exact: true })
  const ownPoint = live.getByRole('button', { name: 'Punto propio', exact: true })
  const rivalPoint = live.getByRole('button', { name: 'Punto rival', exact: true })
  const player = (number: number) => court.getByRole('button', { name: new RegExp(`Deportista ${number}(?: |$)`) })

  await player(5).click()
  await libero.click()
  await changes.getByRole('button', { name: 'Entra #2 Deportista 2', exact: true }).click()
  await expect(player(2)).toContainText('Líbero por #5')
  await expect(count).toContainText('0 / 6')
  await expect(own).toHaveText('0')
  await expect(libero).toBeDisabled()

  await live.getByRole('button', { name: 'Defensa', exact: true }).click()
  await live.getByRole('button', { name: 'Controlada', exact: true }).click()
  await expect(changes.getByText('Termina la jugada antes de registrar cambios.')).toBeVisible()
  await expect(official).toBeDisabled()
  await pressPointAt(ownPoint, 1_000)
  await expect(own).toHaveText('1')
  await expect(ownPoint).toBeDisabled()
  await expect(player(2)).toContainText('Posición 4')
  await expect(libero).toHaveAccessibleName(/Entra #5/)
  await libero.click()
  await expect(player(5)).toContainText('Posición 4')
  await pressPointAt(rivalPoint, 1_100)
  await expect(rival).toHaveText('1')
  await pressPointAt(rivalPoint, 1_150)
  await expect(rival).toHaveText('1')

  await player(8).click()
  await libero.click()
  await changes.getByRole('button', { name: 'Entra #10 Deportista 10', exact: true }).click()
  await expect(player(10)).toContainText('Líbero por #8')
  await page.reload()
  await expect(player(10)).toContainText('Líbero por #8')
  await expect(recent).toContainText('Reemplazo de líbero · Sale #5 Deportista 5 · Entra #2 Deportista 2')
  await expect(recent).toContainText('Reemplazo de líbero · Sale #2 Deportista 2 · Entra #5 Deportista 5')
  await expect(recent).toContainText('Reemplazo de líbero · Sale #8 Deportista 8 · Entra #10 Deportista 10')
  await expect(count).toContainText('0 / 6')
  await expect(own).toHaveText('1')
  await expect(rival).toHaveText('1')

  await player(3).click()
  await official.click()
  await changes.getByRole('checkbox', { name: 'Agrupar cambios en una solicitud' }).check()
  await changes.getByRole('button', { name: 'Entra #7 Deportista 7', exact: true }).click()
  await player(4).click()
  await expect(changes.getByRole('button', { name: 'Entra #7 Deportista 7', exact: true })).toHaveCount(0)
  await changes.getByRole('button', { name: 'Entra #9 Deportista 9', exact: true }).click()
  await changes.getByRole('button', { name: 'Confirmar 2 cambios de la solicitud', exact: true }).click()
  await expect(count).toContainText('2 / 6')
  await expect(player(7)).toContainText('Posición 1')
  await expect(player(9)).toContainText('Posición 2')
  await expect(player(10)).toContainText('Líbero por #8')
  await expect(own).toHaveText('1')
  await expect(rival).toHaveText('1')
  await player(7).click()
  await expect(official).toBeDisabled()
  await rivalPoint.click()
  await expect(rival).toHaveText('2')
  await expect(official).toHaveAccessibleName(/Entra #3/)
  await official.click()
  await expect(count).toContainText('3 / 6')
  await live.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(count).toContainText('2 / 6')
  await expect(player(7)).toContainText('Posición 1')
  await expect(player(10)).toContainText('Líbero por #8')
  expect(page.url()).toBe(matchUrl)
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('consulta estadísticas e historial y restaura un respaldo sin conexión', async ({ page, context }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1024, height: 768 })
  await prepareMatch(page)
  const matchUrl = page.url()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Iniciar anotación', exact: true }).click()
  const live = page.getByRole('region', { name: 'Anotación en vivo' })
  const player = live.getByRole('button', { name: /Posición 1.*Deportista 1/ })
  const own = live.getByLabel('Puntos del equipo propio', { exact: true })
  await player.click()
  await live.getByRole('button', { name: 'Ataque', exact: true }).click()
  await live.getByRole('button', { name: 'Continuidad', exact: true }).click()
  await live.getByRole('button', { name: 'Ataque', exact: true }).click()
  await live.getByRole('button', { name: /^Punto \+ propio/ }).click()
  await expect(own).toHaveText('1')
  await live.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(own).toHaveText('0')
  await live.getByRole('button', { name: 'Punto rival', exact: true }).click()
  await expect(live.getByLabel('Puntos del rival', { exact: true })).toHaveText('1')

  await page.goto('/#/plantillas/team-season')
  await page.getByRole('button', { name: 'Editar inscripción de Deportista 1', exact: true }).click()
  const membership = page.getByRole('form', { name: 'Editar inscripción', exact: true })
  await membership.getByLabel('Dorsal', { exact: true }).fill('55')
  await membership.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Inscripciones de la plantilla' })).toContainText('#55')
  await page.getByRole('link', { name: 'Deportista 1', exact: true }).click()
  await page.getByRole('link', { name: 'Ver estadísticas', exact: true }).click()
  const stats = page.getByRole('table', { name: 'Estadísticas por deportista' })
  const cells = stats.getByRole('row', { name: /^Deportista 1 / }).getByRole('cell')
  await expect(cells.nth(0)).toHaveText('1')
  await expect(cells.nth(2)).toHaveText('0')
  await expect(cells.nth(5)).toHaveText('1')
  await expect(page.getByRole('list', { name: 'Partidos del deportista', exact: true })).toContainText('Dorsal #1')
  await page.getByLabel('Categoría', { exact: true }).selectOption('sub14')
  await expect(page.getByText('No hay participaciones registradas para estos filtros.')).toBeVisible()
  await page.getByLabel('Categoría', { exact: true }).selectOption('sub16')
  await expect(stats).toBeVisible()

  const navigation = page.getByRole('navigation', { name: 'Navegación principal' })
  await navigation.getByRole('link', { name: 'Respaldos', exact: true }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar respaldo JSON', exact: true }).click(),
  ])
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const backup = Buffer.concat(chunks)
  await expect(page.getByText('Respaldo generado. Conserva el archivo descargado.')).toBeVisible()
  await page.goto(matchUrl)
  await live.getByRole('button', { name: 'Punto propio', exact: true }).click()
  await expect(own).toHaveText('1')
  await navigation.getByRole('link', { name: 'Respaldos', exact: true }).click()
  const input = page.getByLabel('Archivo de respaldo JSON', { exact: true })
  await input.setInputFiles({ name: 'invalido.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
  await expect(page.getByRole('alert')).toContainText('formato o versión')
  await input.setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: backup })
  await expect(page.getByRole('heading', { name: 'Vista previa de restauración' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Eventos de juego/ }).getByRole('cell')).toHaveText(['7', '6'])
  const restore = page.getByRole('button', { name: 'Restaurar datos', exact: true })
  await expect(restore).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Confirmo que quiero reemplazar los datos locales con este respaldo.' }).check()
  await restore.click()
  await expect(page.getByText('Respaldo restaurado. Tus datos ya están disponibles.')).toBeVisible()

  await navigation.getByRole('link', { name: 'Historial', exact: true }).click()
  await page.getByRole('link', { name: 'vs. Club Costa', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Marcador por set' })).toContainText('0–1')
  await page.getByText('Convocatoria guardada', { exact: true }).click()
  await expect(page.getByRole('list', { name: 'Convocatoria guardada' })).toContainText('#1 Deportista 1')
  const history = page.getByRole('list', { name: 'Registros en orden de anotación' })
  await expect(history.getByRole('listitem').filter({ hasText: 'Ataque · Punto' })).toContainText('Deshecho')
  await expect(history).toContainText('Último registro deshecho')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Marcador por set' })).toContainText('0–1')
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
