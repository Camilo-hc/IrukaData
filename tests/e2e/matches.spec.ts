import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page) {
  await page.goto('/#/equipos')
  await page.getByLabel('Nombre del club', { exact: true }).fill('Club Iruka de prueba')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Nuevo equipo', exact: true })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Temporadas', exact: true }).click()
  await page.getByRole('button', { name: 'Nueva temporada', exact: true }).click()
  await page.getByLabel('Nombre de la temporada').fill('2026')
  await page.getByLabel('Fecha de inicio').fill('2026-01-01')
  await page.getByLabel('Fecha de término').fill('2026-12-31')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('rowheader', { name: '2026', exact: true })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Equipos', exact: true }).click()
  for (const [name, category] of [['Iruka Sub 16', 'sub16'], ['Iruka Sub 14', 'sub14']]) {
    await page.getByRole('button', { name: 'Nuevo equipo', exact: true }).click()
    await page.getByLabel('Nombre del equipo', { exact: true }).fill(name!)
    await page.getByLabel('Categoría', { exact: true }).selectOption(category!)
    await page.getByRole('checkbox', { name: '2026', exact: true }).check()
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByRole('rowheader', { name: name!, exact: true })).toBeVisible()
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Torneos', exact: true }).click()
  for (const name of ['Copa Sur', 'Liga Regional']) {
    await page.getByRole('button', { name: 'Nuevo torneo', exact: true }).click()
    await page.getByLabel('Nombre del torneo', { exact: true }).fill(name)
    await page.getByLabel('Temporada del torneo', { exact: true }).selectOption({ label: '2026' })
    await page.getByRole('checkbox', { name: 'Iruka Sub 16 · Femenino · Sub 16', exact: true }).check()
    if (name === 'Copa Sur') await page.getByRole('checkbox', { name: 'Iruka Sub 14 · Femenino · Sub 14', exact: true }).check()
    await page.getByRole('button', { name: 'Guardar torneo', exact: true }).click()
    await expect(page.getByRole('button', { name: `Editar torneo ${name}`, exact: true })).toBeVisible()
  }
}
async function startMatch(page: Page, competition = 'Copa Sur') {
  await page.getByRole('navigation').getByRole('link', { name: 'Torneos', exact: true }).click()
  await page.getByRole('link', { name: `Ver partidos de ${competition}`, exact: true }).click()
  await page.getByRole('button', { name: 'Nuevo partido', exact: true }).click()
  const form = page.getByRole('form', { name: 'Nuevo partido', exact: true })
  await form.getByLabel('Equipo y torneo', { exact: true }).selectOption({ label: `${competition} · Iruka Sub 16 · Femenino · Sub 16 · 2026` })
  await form.getByLabel('Nombre del rival', { exact: true }).fill('Club Costa')
  await form.getByLabel('Fecha y hora local del partido', { exact: true }).fill('2026-11-21T19:30')
  await form.getByLabel('Sede del partido', { exact: true }).fill('Gimnasio Norte')
  await form.getByLabel('Condición del equipo', { exact: true }).selectOption('local')
  await form.getByLabel('Fase o jornada (opcional)', { exact: true }).fill('Jornada 1')
  return form
}

test('programa y recupera partidos offline desde un torneo, con reglas independientes y edición móvil', async ({ page, context }) => {
  const external: string[] = []
  const errors: string[] = []
  context.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1024, height: 768 })
  await setup(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
  })
  await context.setOffline(true)
  const form = await startMatch(page)
  await expect(form.getByLabel('Equipo y torneo').getByRole('option', { name: /Liga Regional/ })).toHaveCount(0)
  await form.getByLabel('Sustituciones oficiales por set', { exact: true }).fill('8')
  await form.getByLabel('Mínimo de líberos designados', { exact: true }).selectOption('1')
  await form.getByLabel('Exigir 2 líberos si la convocatoria supera (opcional)', { exact: true }).fill('12')
  await form.getByRole('button', { name: 'Guardar partido', exact: true }).click({ clickCount: 2 })
  await expect(page.getByRole('link', { name: 'vs. Club Costa', exact: true })).toHaveCount(1)
  await page.getByRole('link', { name: 'vs. Club Costa', exact: true }).click()
  const matchUrl = page.url()
  await expect(page.getByRole('heading', { name: 'vs. Club Costa', exact: true })).toBeVisible()
  const rules = page.getByRole('region', { name: 'Reglas guardadas del partido', exact: true })
  await expect(rules).toContainText('8 por set')
  await expect(rules).toContainText('Si la convocatoria supera 12 deportistas')
  await expect(page.getByText('21-11-2026 · 19:30', { exact: true })).toBeVisible()
  await page.reload()
  await expect(rules).toContainText('8 por set')
  const other = await startMatch(page, 'Liga Regional')
  await other.getByLabel('Nombre del rival', { exact: true }).fill('Club Valle')
  await expect(other.getByLabel('Sustituciones oficiales por set', { exact: true })).toHaveValue('6')
  await other.getByRole('button', { name: 'Guardar partido', exact: true }).click()
  await page.getByRole('link', { name: 'vs. Club Valle', exact: true }).click()
  await expect(rules).toContainText('6 por set')
  await page.getByRole('navigation').getByRole('link', { name: 'Partidos', exact: true }).click()
  await expect(page.getByRole('link', { name: 'vs. Club Costa', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'vs. Club Valle', exact: true })).toBeVisible()
  await page.getByLabel('Buscar rival o jornada', { exact: true }).fill('Costa')
  await expect(page.getByRole('link', { name: 'vs. Club Valle', exact: true })).toHaveCount(0)
  await page.getByLabel('Buscar rival o jornada', { exact: true }).fill('')
  await page.getByLabel('Filtrar partidos por torneo', { exact: true }).selectOption({ label: 'Copa Sur' })
  await expect(page.getByRole('link', { name: 'vs. Club Valle', exact: true })).toHaveCount(0)
  await page.getByLabel('Filtrar partidos por torneo', { exact: true }).selectOption('')
  await page.screenshot({ path: 'test-results/partidos-offline.png', fullPage: true })

  const reopened = await context.newPage()
  await reopened.setViewportSize({ width: 375, height: 812 })
  await reopened.goto(matchUrl)
  await expect(reopened.getByRole('region', { name: 'Reglas guardadas del partido' })).toContainText('8 por set')
  await reopened.getByRole('button', { name: 'Editar partido contra Club Costa', exact: true }).click()
  await expect(reopened.getByLabel('Equipo y torneo', { exact: true })).toBeDisabled()
  await expect(reopened.getByLabel('Fecha y hora local del partido', { exact: true })).toHaveValue('2026-11-21T19:30')
  await reopened.getByLabel('Sede del partido', { exact: true }).fill('Cancha B')
  const save = reopened.getByRole('button', { name: 'Guardar partido', exact: true })
  expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect(await reopened.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await save.click()
  await expect(reopened.getByText('Cancha B', { exact: true })).toBeVisible()
  expect(reopened.url()).toBe(matchUrl)
  await reopened.screenshot({ path: 'test-results/partido-movil.png', fullPage: true })
  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('rechaza ediciones antiguas y conserva el partido al archivar y reactivar su torneo', async ({ page, context }) => {
  await setup(page)
  const form = await startMatch(page)
  await form.getByRole('button', { name: 'Guardar partido', exact: true }).click()
  await page.getByRole('link', { name: 'vs. Club Costa', exact: true }).click()
  const matchUrl = page.url()
  const second = await context.newPage()
  await second.goto(matchUrl)
  await second.getByRole('button', { name: 'Editar partido contra Club Costa', exact: true }).click()
  await page.getByRole('button', { name: 'Editar partido contra Club Costa', exact: true }).click()
  await page.getByLabel('Sede del partido', { exact: true }).fill('Cancha confirmada')
  await page.getByLabel('Sustituciones oficiales por set', { exact: true }).fill('8')
  await page.getByRole('button', { name: 'Guardar partido', exact: true }).click()
  await expect(page.getByText('Cancha confirmada', { exact: true })).toBeVisible()
  await second.getByLabel('Sede del partido', { exact: true }).fill('Edición antigua')
  await second.getByRole('button', { name: 'Guardar partido', exact: true }).click()
  await expect(second.getByRole('alert')).toContainText('otra edición')
  await expect(second.getByLabel('Sede del partido', { exact: true })).toHaveValue('Edición antigua')
  await second.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(second.getByText('Cancha confirmada', { exact: true })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Torneos', exact: true }).click()
  await page.getByRole('button', { name: 'Archivar torneo Copa Sur', exact: true }).click()
  await expect(second.getByRole('button', { name: 'Editar partido contra Club Costa', exact: true })).toBeDisabled()
  await second.getByRole('button', { name: 'Archivar partido contra Club Costa', exact: true }).click()
  await expect(second.getByRole('button', { name: 'Restaurar partido contra Club Costa', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Ver solo torneos archivados' }).check()
  await page.getByRole('button', { name: 'Restaurar torneo Copa Sur', exact: true }).click()
  await expect(second.getByRole('button', { name: 'Restaurar partido contra Club Costa', exact: true })).toBeEnabled()
  await second.getByRole('button', { name: 'Restaurar partido contra Club Costa', exact: true }).click()
  await expect(second.getByRole('button', { name: 'Editar partido contra Club Costa', exact: true })).toBeEnabled()
  await expect(second.getByRole('region', { name: 'Reglas guardadas del partido' })).toContainText('8 por set')
  await second.reload()
  expect(second.url()).toBe(matchUrl)
  await expect(second.getByText('Cancha confirmada', { exact: true })).toBeVisible()
})

test('explica los requisitos para crear partidos y permite volver desde rutas inexistentes', async ({ page }) => {
  await page.goto('/#/partidos')
  await expect(page.getByRole('button', { name: 'Nuevo partido', exact: true })).toBeDisabled()
  await expect(page.getByText('Para crear partidos necesitas un torneo y una participación activos, con equipo y temporada activos.')).toBeVisible()
  await page.goto('/#/partidos/inexistente')
  await expect(page.getByRole('heading', { name: 'Partido no encontrado', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Ver partidos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Partidos', exact: true })).toBeVisible()
  await page.goto('/#/torneos/inexistente/partidos')
  await expect(page.getByRole('heading', { name: 'Torneo no encontrado', exact: true })).toBeVisible()
})

test('convoca desde la plantilla del partido y conserva nombres y dorsales offline', async ({ page, context }) => {
  await setup(page)
  const form = await startMatch(page)
  await form.getByLabel('Mínimo de líberos designados', { exact: true }).selectOption('1')
  await form.getByRole('button', { name: 'Guardar partido', exact: true }).click()
  await page.getByRole('link', { name: 'vs. Club Costa', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Convocatoria', exact: true })).toBeVisible()

  // Fixture masiva en el IndexedDB aislado de Playwright. El partido se creó desde la interfaz.
  await page.evaluate(async () => {
    function result<T>(request: IDBRequest<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }
    const db = await result(indexedDB.open('irukadata'))
    try {
      const lookup = db.transaction(['teams', 'teamSeasons'], 'readonly')
      const [teams, links] = await Promise.all([
        result(lookup.objectStore('teams').getAll()),
        result(lookup.objectStore('teamSeasons').getAll()),
      ])
      const team16 = links.find((link) => teams.some((team) => team.id === link.teamId && team.category === 'sub16'))
      const team14 = links.find((link) => teams.some((team) => team.id === link.teamId && team.category === 'sub14'))
      if (!team16 || !team14) throw new Error('No se encontraron las plantillas de prueba.')
      const transaction = db.transaction(['athletes', 'memberships'], 'readwrite')
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error)
        for (let number = 1; number <= 9; number++) {
          const name = `Deportista ${number}`
          const athleteId = `convocatoria-athlete-${number}`
          const active = number !== 8
          transaction.objectStore('athletes').add({ id: athleteId, name, active: true, revision: 1, searchKey: name.toLowerCase() })
          transaction.objectStore('memberships').add({
            id: `convocatoria-membership-${number}`, athleteId, active, revision: 1,
            teamSeasonId: number === 9 ? team14.id : team16.id, jerseyNumber: number,
            ...(active ? { activeJerseyNumber: number } : {}), usualRole: number === 1 ? 'libero' : 'sin_definir',
          })
        }
      })
    } finally { db.close() }
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.reload()
  await page.getByRole('button', { name: 'Preparar convocatoria', exact: true }).click()
  const editor = page.getByRole('form', { name: 'Editar convocatoria del partido' })
  await expect(editor.getByRole('button', { name: /Deportista [1-7]$/ })).toHaveCount(7)
  await expect(editor.getByRole('button', { name: /Deportista [89]$/ })).toHaveCount(0)
  for (let number = 1; number <= 7; number++) {
    await editor.getByRole('button', { name: new RegExp(`Deportista ${number}$`) }).click()
  }
  const save = editor.getByRole('button', { name: 'Guardar convocatoria', exact: true })
  await save.click()
  await expect(editor.getByRole('alert')).toContainText('al menos un líbero')
  await editor.getByRole('checkbox', { name: 'Designar líbero a Deportista 7 #7' }).check()
  await expect(editor.getByRole('checkbox', { name: 'Designar líbero a Deportista 1 #1' })).not.toBeChecked()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await save.click()
  const roster = page.getByRole('list', { name: 'Deportistas convocados' })
  await expect(roster.getByRole('listitem')).toHaveCount(7)
  await expect(roster.getByRole('listitem').filter({ hasText: 'Deportista 7' })).toContainText('Líbero')
  await page.reload()
  await expect(roster.getByRole('listitem')).toHaveCount(7)
  await expect(roster.getByRole('listitem').filter({ hasText: 'Deportista 1' })).toContainText('#1')
  await page.getByRole('button', { name: 'Editar convocatoria', exact: true }).click()
  await expect(editor.getByRole('checkbox', { name: 'Designar líbero a Deportista 7 #7' })).toBeChecked()
})
