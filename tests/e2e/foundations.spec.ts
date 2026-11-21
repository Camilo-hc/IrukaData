import { expect, test } from '@playwright/test'

test('arranca en español, abre IndexedDB y navega sin recursos externos', async ({ page }) => {
  const externalRequests: string[] = []
  const errors: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') externalRequests.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page).toHaveTitle('IrukaData · Vóleibol local')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Todo comienza')
  await expect(page.getByRole('status')).toHaveText('Almacenamiento local disponible')
  await page.getByRole('link', { name: 'Explorar datos de ejemplo' }).click()
  await expect(page).toHaveURL(/#\/demostracion$/)
  await expect(page.getByRole('table')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Equipos de ejemplo' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Almacenamiento local disponible')
  expect(externalRequests).toEqual([])
  expect(errors).toEqual([])
})

test('la versión compilada carga y navega offline tras preparar el service worker', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Todo comienza')
  await page.getByRole('link', { name: 'Explorar datos de ejemplo' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Equipos de ejemplo' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Almacenamiento local disponible')
  await page.screenshot({ path: 'test-results/demostracion-offline.png', fullPage: true })
})

test('la vista de tablet no desborda y sus accesos tienen tamaño táctil', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/')
  const button = page.getByRole('link', { name: 'Explorar datos de ejemplo' })
  await expect(button).toBeVisible()
  const bounds = await button.boundingBox()
  expect(bounds?.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/inicio-tablet.png', fullPage: true })
})
