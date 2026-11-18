import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

  const consoleMessages: string[] = []
  const pageErrors: string[] = []
  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    pageErrors.push(err.message)
  })

  console.log('Navigating to', BASE_URL)
  const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  console.log('Response status:', response?.status())
  
  await page.waitForTimeout(5000)
  
  // Get page content
  const bodyText = await page.evaluate(() => document.body.innerHTML.substring(0, 3000))
  console.log('\n=== Page body HTML (first 3000 chars) ===')
  console.log(bodyText)
  
  // Get root content
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root')
    return root ? root.innerHTML.substring(0, 2000) : 'NO ROOT'
  })
  console.log('\n=== Root content ===')
  console.log(rootContent)
  
  console.log('\n=== Console messages ===')
  consoleMessages.forEach((m) => console.log(m))
  
  console.log('\n=== Page errors ===')
  pageErrors.forEach((e) => console.log(e))
  
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-page.png') })
  console.log('\nScreenshot saved')

  await browser.close()
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
