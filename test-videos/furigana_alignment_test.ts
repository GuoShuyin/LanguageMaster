import { chromium, type Page } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')
const KANJI_ONLY = /^[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF々〆〇ヶヵ]+$/
const MAX_OFFSET = 3

interface RubyMeasure {
  base: string
  rt: string
  offset: number
}

function parseSrt(file: string) {
  return fs
    .readFileSync(file, 'utf8')
    .trim()
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const lines = block.split(/\r?\n/)
      const [h, m, s] = lines[1].split(' --> ')[0].split(':')
      return { start: +h * 3600 + +m * 60 + parseFloat(s.replace(',', '.')), text: lines.slice(2).join('') }
    })
}

async function measure(page: Page): Promise<RubyMeasure[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.subtitle-japanese ruby')).map((ruby) => {
      const rt = ruby.querySelector('rt')!
      const textNode = Array.from(ruby.childNodes).find((n) => n.nodeType === Node.TEXT_NODE)!
      const range = document.createRange()
      range.selectNodeContents(textNode)
      const b = range.getBoundingClientRect()
      const r = rt.getBoundingClientRect()
      return {
        base: textNode.textContent ?? '',
        rt: rt.textContent ?? '',
        offset: Math.round((r.left + r.width / 2 - (b.left + b.width / 2)) * 10) / 10
      }
    })
  )
}

async function seek(page: Page, t: number) {
  await page.evaluate((time) => {
    const v = document.querySelector('video') as HTMLVideoElement
    v.pause()
    v.currentTime = time
  }, t)
  await page.waitForTimeout(400)
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })
  const page = await context.newPage()
  const failures: string[] = []

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.setInputFiles('input[type="file"][accept*="video"]', path.join(__dirname, 'doraemon_full.mp4'))
  await page.waitForTimeout(1500)
  const srtPath = path.join(__dirname, 'doraemon_ja.srt')
  await page.setInputFiles('input[type="file"][accept*="srt"]', srtPath)
  await page.waitForTimeout(1500)

  console.log('Processing subtitles with Claude...')
  await page.locator('.toolbar-btn', { hasText: '处理字幕' }).click()
  await page.waitForTimeout(1000)
  for (let i = 0; i < 150 && (await page.locator('.processing-overlay').isVisible().catch(() => false)); i++) {
    await page.waitForTimeout(2000)
  }

  const cues = parseSrt(srtPath)
  const listTexts = await page.locator('.subtitle-list-item .text-jp').allTextContents()
  if (listTexts.length) {
    const mismatched = cues.filter((c, i) => listTexts[i] !== undefined && listTexts[i].replace(/\s+/g, '') !== c.text.replace(/\s+/g, ''))
    console.log(`Stripped furigana mismatches vs SRT: ${mismatched.length}/${cues.length}`)
  }

  let total = 0
  for (const [i, cue] of cues.entries()) {
    await seek(page, cue.start + 0.3)
    const rubies = await measure(page)
    if (!rubies.length) continue
    total += rubies.length
    console.log(`#${i + 1} @${cue.start}s ${cue.text}`)
    for (const r of rubies) {
      const ok = KANJI_ONLY.test(r.base) && Math.abs(r.offset) <= MAX_OFFSET
      console.log(`   ${ok ? 'OK ' : 'BAD'} ${r.base}[${r.rt}] offset=${r.offset}px`)
      if (!ok) failures.push(`#${i + 1} ${r.base}[${r.rt}] offset=${r.offset}`)
    }
  }
  console.log(`Measured ${total} ruby elements`)

  for (const t of [42, 10, 60, 120]) {
    await seek(page, t)
    await page.locator('.subtitle-bar').screenshot({ path: path.join(SCREENSHOT_DIR, `furigana-${t}s.png`) })
  }

  console.log('Selecting 友達 at 42s...')
  await seek(page, 42)
  const selected = await page.evaluate(() => {
    const ruby = Array.from(document.querySelectorAll('.subtitle-japanese ruby')).find((r) =>
      r.firstChild?.textContent === '友達'
    )
    if (!ruby) return ''
    const range = document.createRange()
    range.selectNodeContents(ruby.firstChild!)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)
    const text = sel.toString()
    document.querySelector('.subtitle-bar')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    return text
  })
  console.log(`   selection: "${selected}"`)
  await page.waitForTimeout(1000)

  await page.locator('.toolbar-btn', { hasText: '复习本' }).click()
  await page.waitForTimeout(800)
  const item = page.locator('.review-item', { has: page.locator('.review-item-text', { hasText: /^友達$/ }) }).last()
  const reading = await item.locator('.review-item-reading').textContent().catch(() => null)
  console.log(`   review reading: ${reading}`)
  if (reading !== 'ともだち') failures.push(`review reading = ${reading}`)
  await page.locator('.modal').screenshot({ path: path.join(SCREENSHOT_DIR, 'furigana-review-book.png') })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.form-btn', { hasText: '导出 Anki' }).click()
  ])
  const tsv = fs.readFileSync(await download.path(), 'utf8')
  const row = tsv.split('\n').find((l) => l.startsWith('友達\t'))
  console.log(`   anki row: ${row}`)
  if (!row || row.split('\t')[1] !== 'ともだち') failures.push(`anki row = ${row}`)

  await browser.close()
  console.log(failures.length ? `FAILED:\n${failures.join('\n')}` : 'ALL CHECKS PASSED')
  process.exit(failures.length ? 1 : 0)
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
