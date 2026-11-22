/* Purpose: Playwright settings for the signed-in end-to-end tests, which run against the test-only host
   (ParishLife.EndToEnd) started by scripts/e2e.mjs.
   Main parts: one worker (one shared isolated host), the installed Edge or Chrome instead of a downloaded
   browser (E2E_CHANNEL), the development certificate accepted, and output kept out of Git.
   The test host's own certificate is accepted by its public-key hash (E2E_CERT_SPKI, from scripts/e2e.mjs), so Chromium also
   fetches the service-worker script from it; any other certificate is still checked. No system trust setting is changed. */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.mjs',
  workers: 1,
  fullyParallel: false,
  timeout: 600_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results',
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  use: {
    channel: process.env.E2E_CHANNEL || 'msedge',
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: process.env.E2E_CERT_SPKI ? ['--ignore-certificate-errors-spki-list=' + process.env.E2E_CERT_SPKI] : []
    },
    viewport: { width: 1366, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
});
