import { expect, test, type Page } from '@playwright/test'

// NFR-PRIV-02 / CLAUDE.md invariant 3: a read-only visitor leaves with no
// cookies. Two regressions this guards: the proxy minting pk_lang on every
// localized page, and SessionProvider fetching /api/auth/session (Auth.js
// sets its csrf-token and callback-url cookies on every /api/auth/* hit).

async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' })
  // SessionProvider also refetches when the tab regains focus.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

test('read-only visitor gets zero cookies', async ({ page, context }) => {
  const authRequests: string[] = []
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/api/auth/')) authRequests.push(req.url())
  })

  await visit(page, '/')
  await visit(page, '/en')
  const professorHref = await page
    .locator('a[href*="/professors/"]')
    .first()
    .getAttribute('href', { timeout: 5_000 })
    .catch(() => null)
  test.skip(!professorHref, 'no professors in this database to open')

  await visit(page, '/bn')
  await visit(page, '/en/search?q=dr')
  await visit(page, professorHref!)

  expect(authRequests).toEqual([])
  expect(await context.cookies()).toEqual([])
})
