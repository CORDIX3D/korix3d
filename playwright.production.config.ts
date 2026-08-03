import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PRODUCTION_BASE_URL || 'https://korix3d.pl';

export default defineConfig({
  testDir: './e2e-production',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  timeout: 45_000,
  reporter: [['line'], ['html', { open: 'never', outputFolder: 'playwright-report-production' }]],
  outputDir: 'test-results-production',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'production-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'production-mobile', use: { ...devices['Pixel 5'] } },
  ],
});
