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

  // Collect console errors
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  console.log('1. 打开页面...')
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial.png'), fullPage: false })
  console.log('   截图: 01-initial.png')

  // Check toolbar
  const title = await page.locator('.toolbar-title').textContent()
  console.log(`   标题: ${title}`)

  console.log('2. 打开设置弹窗，检查 API keys 是否已从 .env 加载...')
  await page.locator('.toolbar-btn', { hasText: '设置' }).click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-settings.png') })

  const claudeKeyInput = page.locator('input[type="password"]').first()
  const claudeKeyValue = await claudeKeyInput.inputValue()
  console.log(`   Claude Key 已填充: ${claudeKeyValue.length > 0} (长度 ${claudeKeyValue.length})`)

  // Close settings
  await page.locator('.modal-close').click()
  await page.waitForTimeout(500)

  console.log('3. 加载视频文件...')
  const videoPath = path.join(__dirname, 'doraemon_full.mp4')
  if (fs.existsSync(videoPath)) {
    await page.setInputFiles('input[type="file"][accept*="video"]', videoPath)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-video-loaded.png') })
    console.log('   视频已加载')

    // Check video element exists
    const videoSrc = await page.locator('video').getAttribute('src')
    console.log(`   Video src: ${videoSrc ? 'blob:...' : 'none'}`)
  } else {
    console.log('   视频文件不存在，跳过')
  }

  console.log('4. 加载日文字幕文件...')
  const srtPath = path.join(__dirname, 'doraemon_ja.srt')
  if (fs.existsSync(srtPath)) {
    await page.setInputFiles('input[type="file"][accept*="srt"]', srtPath)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-subtitle-loaded.png') })

    // Check subtitle list
    const subtitleCount = await page.locator('.subtitle-list-item').count()
    console.log(`   字幕列表条目数: ${subtitleCount}`)

    // Check status
    const status = await page.locator('.toolbar-status').textContent()
    console.log(`   状态栏: ${status}`)
  } else {
    console.log('   字幕文件不存在，跳过')
  }

  console.log('5. 处理字幕（Claude 注音 + 翻译）...')
  await page.locator('.toolbar-btn', { hasText: '处理字幕' }).click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-processing.png') })

  // Wait for processing to complete (up to 60s)
  let processing = true
  for (let i = 0; i < 60; i++) {
    const overlayVisible = await page.locator('.processing-overlay').isVisible().catch(() => false)
    if (!overlayVisible) {
      processing = false
      break
    }
    await page.waitForTimeout(2000)
  }
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-processed.png') })
  console.log(`   处理完成: ${!processing}`)

  console.log('6. 播放视频并检查 furigana 渲染...')
  // Play video
  await page.locator('video').click().catch(() => {})
  await page.waitForTimeout(500)

  // Seek to a position with subtitles (around 30s where dialogue starts)
  await page.evaluate(() => {
    const video = document.querySelector('video') as HTMLVideoElement
    if (video) {
      video.currentTime = 32
    }
  })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-subtitle-display.png') })

  // Check furigana rendering - look for ruby tags
  const rubyCount = await page.locator('.subtitle-japanese ruby').count()
  console.log(`   Ruby 标签数量: ${rubyCount}`)

  if (rubyCount > 0) {
    // Get the HTML of the subtitle japanese div to inspect furigana
    const subtitleHtml = await page.locator('.subtitle-japanese').first().innerHTML()
    console.log(`   字幕 HTML: ${subtitleHtml.substring(0, 200)}`)

    // Check rt (ruby text) elements
    const rtCount = await page.locator('.subtitle-japanese rt').count()
    console.log(`   Rt (注音) 元素数量: ${rtCount}`)

    // Get actual rendered text
    const rtTexts = await page.locator('.subtitle-japanese rt').allTextContents()
    console.log(`   注音内容: ${rtTexts.join(', ')}`)
  }

  // Check Chinese translation
  const chineseText = await page.locator('.subtitle-chinese').first().textContent().catch(() => '')
  console.log(`   中文翻译: ${chineseText}`)

  console.log('7. 测试框选文字加入复习本...')
  // Select text in the subtitle bar using native mouse drag
  const subtitleJapanese = page.locator('.subtitle-japanese').first()
  if (await subtitleJapanese.isVisible()) {
    // Get bounding box of the subtitle text
    const box = await subtitleJapanese.boundingBox()
    if (box) {
      // Click and drag to select text (from 20% to 60% of the width)
      const startX = box.x + box.width * 0.2
      const endX = box.x + box.width * 0.6
      const y = box.y + box.height / 2

      await page.mouse.move(startX, y)
      await page.mouse.down()
      await page.mouse.move(endX, y, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(2000)

      // Check if selection was made
      const selText = await page.evaluate(() => window.getSelection()?.toString() || '')
      console.log(`   选中文字: "${selText}"`)

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-after-select.png') })

      // Check review count
      const reviewBtn = page.locator('.toolbar-btn', { hasText: '复习本' })
      const reviewText = await reviewBtn.textContent()
      console.log(`   复习本按钮: ${reviewText}`)
    }
  } else {
    console.log('   字幕不可见，跳过框选测试')
  }

  console.log('8. 打开复习本...')
  await page.locator('.toolbar-btn', { hasText: '复习本' }).click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-review-book.png') })

  const reviewItems = await page.locator('.review-item').count()
  console.log(`   复习本条目数: ${reviewItems}`)

  if (reviewItems > 0) {
    const firstItemText = await page.locator('.review-item-text').first().textContent()
    console.log(`   第一条: ${firstItemText}`)
  }

  // Close review
  await page.locator('.modal-close').click()
  await page.waitForTimeout(500)

  console.log('9. 检查字幕显示切换...')
  // Toggle off furigana
  await page.locator('.toggle-btn', { hasText: '注音' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-no-furigana.png') })

  const rubyAfterToggle = await page.locator('.subtitle-japanese ruby').count()
  console.log(`   关闭注音后 ruby 数量: ${rubyAfterToggle}`)

  // Toggle back on
  await page.locator('.toggle-btn', { hasText: '注音' }).click()
  await page.waitForTimeout(500)

  // Toggle off Chinese
  await page.locator('.toggle-btn', { hasText: '中文' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-no-chinese.png') })

  const chineseVisible = await page.locator('.subtitle-chinese').first().isVisible().catch(() => false)
  console.log(`   关闭后中文可见: ${chineseVisible}`)

  // Toggle back
  await page.locator('.toggle-btn', { hasText: '中文' }).click()
  await page.waitForTimeout(500)

  console.log('\n=== 测试总结 ===')
  console.log(`Console errors: ${consoleErrors.length}`)
  if (consoleErrors.length > 0) {
    console.log('Errors:')
    consoleErrors.forEach((e) => console.log(`  - ${e}`))
  }

  console.log(`\n截图保存在: ${SCREENSHOT_DIR}`)
  const screenshots = fs.readdirSync(SCREENSHOT_DIR)
  screenshots.forEach((s) => console.log(`  - ${s}`))

  await browser.close()
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
