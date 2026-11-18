import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5173'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`))
  const userIds = new Set<string>()
  page.on('request', (r) => {
    if (r.url().includes('/api/')) userIds.add(r.headers()['x-user-id'] || 'MISSING')
  })

  await page.goto(BASE, { waitUntil: 'networkidle' })
  const checks: [string, boolean][] = []
  checks.push(['navbar rendered', await page.locator('.navbar').isVisible()])
  checks.push(['local player rendered by default', await page.locator('.toolbar-title').isVisible()])
  for (const [name, text] of [['watch', '链接播放'], ['community', '社区'], ['pricing', '会员']]) {
    await page.locator(`[data-tour="nav-${name}"]`).click()
    await page.waitForTimeout(300)
    checks.push([`#/${name} shows placeholder`, (await page.locator('.page').textContent())!.includes(text)])
  }
  await page.locator('[data-tour="nav-local"]').click()
  await page.waitForTimeout(500)
  checks.push(['back to local player', await page.locator('.toolbar-title').isVisible()])
  checks.push([`api calls carry X-User-Id (${[...userIds].join(',')})`, userIds.size === 1 && !userIds.has('MISSING')])
  checks.push([`no errors (${errors.join('; ')})`, errors.length === 0])

  for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  await browser.close()
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
}

main()
