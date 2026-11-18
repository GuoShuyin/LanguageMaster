import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const failedRequests: string[] = []
  page.on('requestfailed', (req) => {
    failedRequests.push(`FAILED: ${req.url()} - ${req.failure()?.errorText}`)
  })
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      failedRequests.push(`${resp.status()}: ${resp.url()}`)
    }
  })

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(3000)

  console.log('=== Failed/error requests ===')
  failedRequests.forEach((r) => console.log(r))

  await browser.close()
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
