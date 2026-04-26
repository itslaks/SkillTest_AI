const { chromium } = require('@playwright/test')

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3002'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  const consoleErrors = []
  const failedRequests = []

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || ''
    if (request.url().includes('_rsc=') && failure.includes('ERR_ABORTED')) return
    failedRequests.push(`${request.method()} ${request.url()} ${failure}`)
  })

  const publicRoutes = [
    { path: '/', expectText: 'SkillTest' },
    { path: '/auth/login', expectText: 'Welcome back' },
    { path: '/auth/sign-up', expectText: 'Create' },
    { path: '/auth/reset-password', expectText: 'Reset' },
  ]

  for (const route of publicRoutes) {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 })
    const bodyText = await page.locator('body').innerText({ timeout: 10000 })
    if (!bodyText.includes(route.expectText)) {
      throw new Error(`${route.path} did not contain expected text: ${route.expectText}`)
    }

    const overlayCount = await page
      .locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')
      .count()
    if (overlayCount > 0) throw new Error(`${route.path} rendered a framework error overlay`)
  }

  await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!page.url().includes('/auth/login')) {
    throw new Error(`/manager did not redirect to login; current URL ${page.url()}`)
  }

  await browser.close()

  const realConsoleErrors = consoleErrors.filter((text) => !text.includes('favicon.ico'))
  if (realConsoleErrors.length > 0) {
    throw new Error(`Console errors found:\n${realConsoleErrors.join('\n')}`)
  }
  if (failedRequests.length > 0) {
    throw new Error(`Failed requests found:\n${failedRequests.join('\n')}`)
  }

  console.log('Playwright smoke check passed')
}

main().catch(async (error) => {
  console.error(error)
  process.exit(1)
})
