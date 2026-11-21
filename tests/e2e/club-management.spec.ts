import { expect, test, type Page } from '@playwright/test'

async function configureClub(page: Page) {
  await page.goto('/#/equipos')
  await page.getByLabel('Nombre del club', { exact: true }).fill('Club Iruka de prueba')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Nuevo equipo', exact: true })).toBeVisible()
}
async function createTeam(page: Page, name: string, season?: string) {
  await page.getByRole('button', { name: 'Nuevo equipo', exact: true }).click()
  const form = page.getByRole('form', { name: 'Nuevo equipo', exact: true })
  await form.getByLabel('Nombre del equipo', { exact: true }).fill(name)
  await form.getByLabel('Categoría', { exact: true }).selectOption('sub16')
  if (season) await form.getByRole('checkbox', { name: season, exact: true }).check()
  await form.getByRole('button', { name: 'Guardar', exact: true }).click({ clickCount: 2 })
  await expect(page.getByRole('rowheader', { name, exact: true })).toBeVisible()
}
async function prepareOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
}

test('crea, edita, archiva y restaura equipos y temporadas sin conexión, conservando asociaciones', async ({ page, context }) => {
  const external: string[] = []
  const errors: string[] = []
  context.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1024, height: 768 })
  await configureClub(page)
  await prepareOffline(page)
  await context.setOffline(true)

  await page.getByRole('navigation').getByRole('link', { name: 'Temporadas', exact: true }).click()
  await page.getByRole('button', { name: 'Nueva temporada', exact: true }).click()
  const seasonForm = page.getByRole('form', { name: 'Nueva temporada', exact: true })
  await seasonForm.getByLabel('Nombre de la temporada').fill('2026')
  await seasonForm.getByLabel('Fecha de inicio').fill('2026-01-01')
  await seasonForm.getByLabel('Fecha de término').fill('2025-12-31')
  await seasonForm.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(seasonForm.getByText('El término debe ser igual o posterior al inicio.')).toBeVisible()
  await seasonForm.getByLabel('Fecha de término').fill('2026-12-31')
  await seasonForm.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('rowheader', { name: '2026', exact: true })).toBeVisible()

  await page.getByRole('navigation').getByRole('link', { name: 'Equipos', exact: true }).click()
  await createTeam(page, 'Iruka Sub 16', '2026')
  await expect(page.getByRole('table', { name: 'Equipos del club' }).getByRole('row')).toHaveCount(2)
  await page.reload()
  await expect(page.getByRole('rowheader', { name: 'Iruka Sub 16', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Editar equipo Iruka Sub 16', exact: true }).click()
  const teamForm = page.getByRole('form', { name: 'Editar equipo', exact: true })
  await expect(teamForm.getByLabel('Categoría', { exact: true }).locator('option')).toHaveText(['Sub 14', 'Sub 16', 'Sub 18', 'Sub 21', 'TC'])
  await expect(teamForm.getByRole('checkbox', { name: '2026', exact: true })).toBeChecked()
  await teamForm.getByLabel('Nombre del equipo').fill('Iruka TC')
  await teamForm.getByLabel('Rama', { exact: true }).selectOption('masculino')
  await teamForm.getByLabel('Categoría', { exact: true }).selectOption('tc')
  await teamForm.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('rowheader', { name: 'Iruka TC', exact: true })).toBeVisible()
  await page.getByLabel('Filtrar por rama').selectOption('femenino')
  await expect(page.getByRole('rowheader', { name: 'Iruka TC', exact: true })).toHaveCount(0)
  await page.getByLabel('Filtrar por rama').selectOption('masculino')
  await page.getByLabel('Filtrar por categoría').selectOption('tc')
  await page.getByLabel('Filtrar por temporada').selectOption({ label: '2026' })
  await expect(page.getByRole('rowheader', { name: 'Iruka TC', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Archivar equipo Iruka TC', exact: true }).click()
  await expect(page.getByRole('rowheader', { name: 'Iruka TC', exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Ver solo equipos archivados' }).check()
  await page.getByRole('button', { name: 'Restaurar equipo Iruka TC', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Ver solo equipos archivados' }).uncheck()
  await expect(page.getByRole('rowheader', { name: 'Iruka TC', exact: true })).toBeVisible()

  await page.getByRole('navigation').getByRole('link', { name: 'Temporadas', exact: true }).click()
  await page.getByRole('button', { name: 'Editar temporada 2026', exact: true }).click()
  const editSeason = page.getByRole('form', { name: 'Editar temporada', exact: true })
  await editSeason.getByLabel('Nombre de la temporada').fill('Temporada 2026')
  await editSeason.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByRole('button', { name: 'Archivar temporada Temporada 2026', exact: true }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Equipos', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Equipos del club' }).getByText('Temporada 2026 (archivada)', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Editar equipo Iruka TC', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Temporada 2026 (archivada)' })).toBeDisabled()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Temporadas', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Ver solo temporadas archivadas' }).check()
  await page.getByRole('button', { name: 'Restaurar temporada Temporada 2026', exact: true }).click()

  const reopened = await context.newPage()
  await reopened.goto('/#/equipos')
  await expect(reopened.getByRole('rowheader', { name: 'Iruka TC', exact: true })).toBeVisible()
  await expect(reopened.getByRole('table', { name: 'Equipos del club' }).getByText('Temporada 2026', { exact: true })).toBeVisible()
  expect(await reopened.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await reopened.screenshot({ path: 'test-results/equipos-offline.png', fullPage: true })
  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('una segunda pestaña no sobrescribe un equipo editado mientras su formulario estaba abierto', async ({ page, context }) => {
  await configureClub(page)
  await createTeam(page, 'Equipo original')
  const second = await context.newPage()
  await second.goto('/#/equipos')
  await second.getByRole('button', { name: 'Editar equipo Equipo original', exact: true }).click()
  await page.getByRole('button', { name: 'Editar equipo Equipo original', exact: true }).click()
  await page.getByLabel('Nombre del equipo').fill('Edición confirmada')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('rowheader', { name: 'Edición confirmada', exact: true })).toBeVisible()
  await second.getByLabel('Nombre del equipo').fill('Edición desactualizada')
  await second.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(second.getByRole('alert')).toContainText('otra edición')
  await expect(second.getByLabel('Nombre del equipo')).toHaveValue('Edición desactualizada')
  await second.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(second.getByRole('rowheader', { name: 'Edición confirmada', exact: true })).toBeVisible()
})
