import { defineConfig, devices } from '@playwright/test'

/**
 * E2E com a camada MSW ativa (build de preview com VITE_ENABLE_MOCKS=true).
 * - Cada teste parte de estado isolado: contexto novo + reset do mock (fixture `app`).
 * - PW_CHANNEL=chrome usa o Chrome do sistema (útil em CI/containers sem download de browsers).
 */
const PORT = Number(process.env.PW_PORT ?? 4173)
const channel = process.env.PW_CHANNEL || undefined
// Build próprio do E2E (não disputa `dist/` com outros builds/execuções simultâneas).
const OUT_DIR = 'node_modules/.e2e-dist'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide' } },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Este container não tem o ffmpeg do Playwright: vídeo desligado (traces continuam ativos).
    video: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel } },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, channel },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: `pnpm build --outDir ${OUT_DIR} --emptyOutDir && pnpm exec vite preview --outDir ${OUT_DIR} --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_ENABLE_MOCKS: 'true' },
  },
})
