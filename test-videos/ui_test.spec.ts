import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

test.describe('LanguageMaster UI', () => {
  test('页面加载并显示工具栏', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForTimeout(2000)
    
    // Check title
    await expect(page.locator('.toolbar-title')).toContainText('LanguageMaster')
    
    // Check toolbar buttons
    await expect(page.locator('.toolbar-btn', { hasText: '打开视频' })).toBeVisible()
    await expect(page.locator('.toolbar-btn', { hasText: '加载字幕' })).toBeVisible()
    await expect(page.locator('.toolbar-btn', { hasText: '设置' })).toBeVisible()
    await expect(page.locator('.toolbar-btn', { hasText: '复习本' })).toBeVisible()
  })

  test('设置弹窗可以打开和关闭', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForTimeout(1000)
    
    // Open settings
    await page.locator('.toolbar-btn', { hasText: '设置' }).click()
    await page.waitForTimeout(500)
    
    // Check modal is visible
    await expect(page.locator('.modal-title')).toContainText('设置')
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    
    // Close
    await page.locator('.modal-close').click()
    await page.waitForTimeout(500)
    await expect(page.locator('.modal-title')).not.toBeVisible()
  })

  test('字幕显示切换按钮存在', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForTimeout(1000)
    
    const toggles = page.locator('.toggle-btn')
    await expect(toggles).toHaveCount(3)
    await expect(page.locator('.toggle-btn', { hasText: '日文' })).toBeVisible()
    await expect(page.locator('.toggle-btn', { hasText: '注音' })).toBeVisible()
    await expect(page.locator('.toggle-btn', { hasText: '中文' })).toBeVisible()
  })

  test('视频占位符显示', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForTimeout(1000)
    
    await expect(page.locator('.video-placeholder')).toContainText('打开视频')
  })
})
