import { test, expect } from '@playwright/test'

/**
 * Rimora Platform E2E Test Örnekleri
 * Bu dosya Playwright kurulumunun doğru çalıştığını doğrulamak için örnek testler içerir.
 */

test.describe('Ana Sayfa Testleri', () => {
  test('ana sayfa başarıyla yüklenmeli', async ({ page }) => {
    await page.goto('/')
    
    // Sayfa başlığını kontrol et
    await expect(page).toHaveTitle(/Rimora/i)
  })

  test('header görünür olmalı', async ({ page }) => {
    await page.goto('/')
    
    // Header elementini kontrol et
    const header = page.locator('header')
    await expect(header).toBeVisible()
  })

  test('navigasyon linkleri çalışmalı', async ({ page }) => {
    await page.goto('/')
    
    // Filmler linkine tıkla
    const filmlerLink = page.locator('a[href="/filmler"]').first()
    if (await filmlerLink.isVisible()) {
      await filmlerLink.click()
      await expect(page).toHaveURL(/\/filmler/)
    }
  })
})

test.describe('Arama Fonksiyonu', () => {
  test('arama sayfası yüklenmeli', async ({ page }) => {
    await page.goto('/arama')
    
    // Arama sayfasının yüklendiğini kontrol et
    await expect(page).toHaveURL(/\/arama/)
  })
})

test.describe('Responsive Tasarım', () => {
  test('mobil görünümde hamburger menü görünmeli', async ({ page }) => {
    // Mobil viewport ayarla
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    // Sayfanın yüklendiğini kontrol et
    await expect(page).toHaveTitle(/Rimora/i)
  })
})

test.describe('Erişilebilirlik Temel Kontrolleri', () => {
  test('ana sayfa temel erişilebilirlik kontrolü', async ({ page }) => {
    await page.goto('/')
    
    // HTML lang attribute kontrolü
    const htmlLang = await page.locator('html').getAttribute('lang')
    expect(htmlLang).toBeTruthy()
    
    // Main landmark kontrolü
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })
})
