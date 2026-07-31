import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Konfigürasyonu
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test dosyalarının bulunduğu dizin
  testDir: './e2e',

  // Test dosyası pattern'i
  testMatch: '**/*.spec.ts',

  // Paralel test çalıştırma
  fullyParallel: true,

  // CI ortamında retry sayısı
  retries: process.env.CI ? 2 : 0,

  // CI ortamında worker sayısı
  workers: process.env.CI ? 1 : undefined,

  // Test raporlama
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Tüm testler için ortak ayarlar
  use: {
    // Next.js development server URL
    baseURL: 'http://localhost:3000',

    // Hata durumunda trace kaydet
    trace: 'on-first-retry',

    // Hata durumunda screenshot al
    screenshot: 'only-on-failure',

    // Hata durumunda video kaydet
    video: 'on-first-retry',

    // Viewport boyutu
    viewport: { width: 1280, height: 720 },

    // Timeout ayarları
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Tarayıcı projeleri
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobil tarayıcılar (opsiyonel)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Development server'ı otomatik başlat
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Output dizini
  outputDir: 'test-results',
})
