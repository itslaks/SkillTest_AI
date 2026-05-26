const { chromium } = require('@playwright/test')
const { spawn } = require('child_process')
const http = require('http')

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'
let devServer = null

function waitForServer(url, timeoutMs = 45000) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume()
        response.on('end', () => resolve(true))
      })
      request.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}. Start the app or set SMOKE_BASE_URL to a running server.`))
          return
        }
        setTimeout(check, 1000)
      })
      request.setTimeout(3000, () => {
        request.destroy()
      })
    }
    check()
  })
}

async function ensureServer() {
  try {
    await waitForServer(BASE_URL, 1500)
    return
  } catch {
    if (process.env.SMOKE_NO_AUTOSTART === '1') throw new Error(`${BASE_URL} is not reachable.`)
  }

  const url = new URL(BASE_URL)
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  devServer = spawn(command, ['run', 'dev', '--', '-p', port], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  devServer.stdout.on('data', (chunk) => process.stdout.write(chunk))
  devServer.stderr.on('data', (chunk) => process.stderr.write(chunk))
  await waitForServer(BASE_URL, 60000)
}

async function main() {
  await ensureServer()
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
    if (request.url().includes('/__nextjs_font/') && failure.includes('ERR_ABORTED')) return
    if (request.url().includes('/_next/static/') && failure.includes('ERR_ABORTED')) return
    failedRequests.push(`${request.method()} ${request.url()} ${failure}`)
  })

  const publicRoutes = [
    { path: '/', expectText: 'skilltest_ai' },
    { path: '/auth/login', expectText: 'Welcome back' },
    { path: '/auth/sign-up', expectText: 'Create' },
    { path: '/auth/reset-password', expectText: 'Reset' },
  ]

  for (const route of publicRoutes) {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
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

  const realConsoleErrors = consoleErrors.filter((text) =>
    !text.includes('favicon.ico') &&
    !text.includes('/_next/webpack-hmr') &&
    !text.includes('WebSocket connection')
  )
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
  process.exitCode = 1
}).finally(() => {
  if (devServer) devServer.kill()
})
