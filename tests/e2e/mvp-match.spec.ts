import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { prepareMatch, pressPointAt } from './support/live-match'

type Side = 'own' | 'opponent'

async function removePilotProfile(profile: string, temporaryRoot: string) {
  const resolvedProfile = await realpath(profile)
  if (dirname(resolvedProfile) !== temporaryRoot || !basename(resolvedProfile).startsWith('iruka-mvp-')) {
    throw new Error('La ruta del perfil temporal no coincide con la creada para esta prueba.')
  }
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
}

function scoreboard(page: Page) {
  const live = page.getByRole('region', { name: 'Anotación en vivo' })
  return {
    live,
    header: live.getByRole('group', { name: 'Marcador del set' }),
    court: live.getByRole('group', { name: 'Posiciones en cancha' }),
    recent: live.getByRole('list', { name: 'Últimos registros' }),
    results: live.getByRole('list', { name: 'Resultados por set' }),
    own: live.getByLabel('Puntos del equipo propio', { exact: true }),
    opponent: live.getByLabel('Puntos del rival', { exact: true }),
    point: (side: Side) => live.getByRole('button', { name: side === 'own' ? 'Punto propio' : 'Punto rival', exact: true }),
  }
}

test('cierra un partido 2–1 sin conexión, reabre el navegador y restaura el respaldo en otro perfil', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(150_000)
  if (!baseURL) throw new Error('La prueba requiere la URL local de la PWA.')
  const origin = new URL(baseURL).origin
  const viewport = { width: 1024, height: 768 }
  const settings = { baseURL, viewport, hasTouch: true, acceptDownloads: true }
  // CacheStorage crea rutas profundas dentro del perfil. Mantén corta la ruta base en Windows.
  const temporaryRoot = await realpath(tmpdir())
  const profile = await mkdtemp(join(temporaryRoot, 'iruka-mvp-'))
  const contexts = new Set<BrowserContext>()
  const external = new Set<string>()
  const pageErrors: string[] = []
  let time = 100_000
  let tally = { own: 0, opponent: 0 }

  function observe(context: BrowserContext, page: Page) {
    contexts.add(context)
    context.on('request', (request) => {
      if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) external.add(request.url())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
  }

  async function openProfile(offline: boolean) {
    const context = await chromium.launchPersistentContext(profile, {
      ...settings, offline,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    })
    const page = context.pages()[0] ?? await context.newPage()
    observe(context, page)
    return { context, page }
  }

  async function point(board: ReturnType<typeof scoreboard>, side: Side) {
    await pressPointAt(board.point(side), time)
    time += 400
    tally[side] += 1
    await expect(board[side]).toHaveText(String(tally[side]))
  }

  async function playTo(board: ReturnType<typeof scoreboard>, own: number, opponent: number) {
    while (tally.own < own || tally.opponent < opponent) {
      if (tally.own < own) await point(board, 'own')
      if (tally.opponent < opponent) await point(board, 'opponent')
    }
  }

  async function nextSet(board: ReturnType<typeof scoreboard>, number: number, serving: string, changeStarter = false) {
    await board.live.getByRole('button', { name: 'Copiar alineación inicial anterior', exact: true }).tap()
    const form = board.live.getByRole('form', { name: 'Preparar alineación del set ' + number, exact: true })
    if (changeStarter) {
      await form.getByRole('button', { name: 'Quitar titular de posición 1', exact: true }).tap()
      await form.getByRole('button', { name: /^#7 Deportista 7$/ }).tap()
    }
    await expect(form.getByRole('radio', { checked: true })).toHaveCount(0)
    await form.getByRole('radio', { name: serving, exact: true }).check()
    await form.getByRole('button', { name: 'Confirmar alineación y saque', exact: true }).tap()
    await expect(board.header).toContainText('Set ' + number)
    await expect(board.own).toHaveText('0')
    await expect(board.opponent).toHaveText('0')
    tally = { own: 0, opponent: 0 }
  }

  try {
    const first = await openProfile(false)
    await prepareMatch(first.page, true)
    const matchUrl = first.page.url()
    await first.context.setOffline(true)
    await first.page.getByRole('button', { name: 'Iniciar anotación', exact: true }).tap()
    let board = scoreboard(first.page)
    await expect(board.header).toContainText('Saque Club Costa')

    const skip = first.page.getByRole('link', { name: 'Saltar al contenido' })
    await skip.focus()
    await first.page.keyboard.press('Enter')
    await expect(first.page.getByRole('main')).toBeFocused()
    await expect(first.page).toHaveURL(matchUrl)

    const changes = board.live.getByRole('region', { name: 'Cambios en cancha' })
    const libero = changes.getByRole('button', { name: /^Reemplazo de líbero/ })
    const fifth = board.court.getByRole('button', { name: /Posición 5.*Deportista 5/ })
    await fifth.tap()
    await board.live.getByRole('heading', { name: 'Anotación en vivo' }).evaluate((element) => element.scrollIntoView({ block: 'start' }))
    for (const control of [board.point('own'), board.point('opponent'), fifth, libero, changes.getByRole('button', { name: /^Cambio oficial/ })]) {
      await expect(control).toBeInViewport({ ratio: 1 })
      const bounds = await control.boundingBox()
      expect(bounds?.width).toBeGreaterThanOrEqual(44)
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
    }
    await first.page.screenshot({ path: testInfo.outputPath('panel-tablet.png') })
    await libero.tap()
    await changes.getByRole('button', { name: 'Entra #2 Deportista 2', exact: true }).tap()
    await expect(board.court.getByRole('button', { name: /Posición 5.*Deportista 2.*Líbero por #5/ })).toBeVisible()

    await board.point('opponent').dblclick()
    await expect(board.opponent).toHaveText('1')
    tally.opponent = 1
    await expect(board.recent.getByRole('listitem').filter({ hasText: 'Punto para Club Costa · Manual' })).toHaveCount(1)
    await point(board, 'own')
    await expect(board.point('own')).toBeDisabled()
    await expect(board.court.getByRole('button', { name: /Posición 4.*Deportista 2/ })).toBeVisible()
    await libero.tap()
    await expect(board.court.getByRole('button', { name: /Posición 4.*Deportista 5/ })).toBeVisible()

    const official = changes.getByRole('button', { name: /^Cambio oficial/ })
    await board.court.getByRole('button', { name: /Posición 1.*Deportista 3/ }).tap()
    await official.tap()
    await changes.getByRole('button', { name: 'Entra #7 Deportista 7', exact: true }).tap()
    await expect(board.court.getByRole('button', { name: /Posición 1.*Deportista 7/ })).toBeVisible()
    await point(board, 'opponent')
    await expect(official).toHaveAccessibleName(/Entra #3/)
    await official.tap()
    await expect(changes.getByLabel('Cupo de cambios oficiales')).toContainText('2 / 6')
    await playTo(board, 25, 23)
    await expect(board.results).toContainText('25–23')
    await nextSet(board, 2, 'Iruka Sub 16 (equipo propio)', true)
    await board.court.getByRole('button', { name: /Posición 1.*Deportista 7/ }).tap()
    await board.live.getByRole('button', { name: 'Saque', exact: true }).tap()
    await board.live.getByRole('button', { name: 'En juego', exact: true }).tap()
    await expect(board.header).toContainText('Jugada en curso')
    await first.context.close()
    contexts.delete(first.context)

    const restarted = await openProfile(true)
    await restarted.page.goto(matchUrl)
    expect(await restarted.page.evaluate(() => navigator.onLine)).toBe(false)
    board = scoreboard(restarted.page)
    await expect(board.header).toContainText('Jugada en curso')
    await expect(board.results).toContainText('25–23')
    await expect(board.recent).toContainText('#7 Deportista 7 · Saque · En juego')
    await expect(board.court.getByRole('button', { name: /Posición 1.*Deportista 7/ })).toBeVisible()
    await playTo(board, 23, 25)
    await expect(board.results).toContainText('23–25')
    await nextSet(board, 3, 'Club Costa (rival)')
    await playTo(board, 7, 7)
    const sideChange = board.live.getByText('Cambio de lado del tercer set.', { exact: false })
    await expect(sideChange).toHaveCount(0)
    await point(board, 'own')
    await expect(sideChange).toBeVisible()
    await point(board, 'opponent')
    await playTo(board, 14, 14)
    await playTo(board, 16, 14)
    await expect(board.header).toContainText('Ganó Iruka Sub 16')
    await expect(board.results.getByRole('listitem')).toHaveText(['Set 1 25–23', 'Set 2 23–25', 'Set 3 16–14'])
    await expect(board.live.getByRole('heading', { name: /Alineación del set 4/ })).toHaveCount(0)
    await board.live.getByRole('button', { name: 'Deshacer', exact: true }).tap()
    tally.own -= 1
    await expect(board.own).toHaveText('15')
    await expect(board.point('own')).toBeEnabled()
    await point(board, 'own')
    await expect(board.header).toContainText('Ganó Iruka Sub 16')
    await expect(restarted.page).toHaveURL(matchUrl)

    await restarted.page.getByRole('link', { name: 'Respaldos', exact: true }).tap()
    await expect(restarted.page.getByText('Todavía no se ha generado un respaldo en este navegador.')).toBeVisible()
    const [download] = await Promise.all([
      restarted.page.waitForEvent('download'),
      restarted.page.getByRole('button', { name: 'Descargar respaldo JSON', exact: true }).tap(),
    ])
    const backup = testInfo.outputPath('irukadata-respaldo-piloto.json')
    await download.saveAs(backup)
    await restarted.page.clock.setFixedTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000))
    await restarted.page.reload()
    await expect(restarted.page.getByText('El último respaldo tiene más de una semana.')).toBeVisible()
    const other = await browser.newContext(settings)
    const fresh = await other.newPage()
    observe(other, fresh)
    await fresh.goto('/')
    await expect.poll(() => fresh.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    await other.setOffline(true)
    await fresh.getByRole('link', { name: 'Respaldos', exact: true }).tap()
    await fresh.getByLabel('Archivo de respaldo JSON', { exact: true }).setInputFiles(backup)
    await expect(fresh.getByRole('row', { name: /^Sets/ }).getByRole('cell')).toHaveText(['0', '3'])
    await fresh.getByRole('checkbox', { name: /Confirmo que quiero reemplazar/ }).check()
    await fresh.getByRole('button', { name: 'Restaurar datos', exact: true }).tap()
    await expect(fresh.getByText('Respaldo restaurado. Tus datos ya están disponibles.')).toBeVisible()
    await fresh.getByRole('link', { name: 'Historial', exact: true }).tap()
    await fresh.getByRole('link', { name: 'vs. Club Costa', exact: true }).tap()
    const restored = fresh.getByRole('region', { name: 'Marcador por set' })
    await expect(restored.getByRole('listitem')).toHaveText(['Set 1 25–23', 'Set 2 23–25', 'Set 3 16–14'])
    const history = fresh.getByRole('list', { name: 'Registros en orden de anotación' })
    await expect(history).toContainText('Último registro deshecho')
    await expect(history).toContainText('Sustitución oficial · Sale #3')
    await expect(history).toContainText('Reemplazo de líbero · Sale #5')
    expect([...external]).toEqual([])
    expect(pageErrors).toEqual([])
  } finally {
    await Promise.all([...contexts].map((context) => context.close()))
    await removePilotProfile(profile, temporaryRoot)
  }
})
