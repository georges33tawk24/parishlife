/* Purpose: Georges's Firefox concern before the portal registers the service worker (hardening D25, 05 #2 / 08 #2): open public.html,
   sign in, then reload the portal; it must not hang. Runs under Playwright's Firefox engine as a stand-in for real Firefox (the rest of
   the suite uses Edge). Records whether the worker actually registered, because Firefox may refuse a worker over the test host's
   self-signed certificate, which would make the check weaker.
   Main test: one journey; skipped when Playwright's Firefox is not installed or cannot start. The portal registers the worker only
   once this passes in real Firefox or here (frontend/src/portal/main.jsx does not register it yet). */
import { existsSync } from 'node:fs';
import { expect, firefox } from '@playwright/test';
import { manifest, offline, signIn, test, watch } from './support.mjs';

const M = manifest();

test('Firefox: public page, sign in, then reload the portal without hanging', async ({}, info) => {
  test.skip(
    !existsSync(firefox.executablePath()),
    "Playwright's Firefox is not installed (npx playwright install firefox)"
  );
  // the suite's Edge channel and Chromium-only flags do not apply to Firefox. A Firefox that is installed but cannot start here (on
  // 27 November 2026 Windows build 26300 refused it: side-by-side configuration) skips with the reason instead of failing the suite.
  let browser;
  try {
    browser = await firefox.launch({ channel: undefined, args: [] });
  } catch (error) {
    test.skip(true, 'Firefox could not start on this machine: ' + String(error.message).split('\n')[0]);
  }
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    await offline(context, M.baseUrl);
    await context.route(
      url => url.origin === M.baseUrl,
      route => route.continue({ headers: { ...route.request().headers(), 'x-e2e-client': '10.0.0.91' } })
    );
    const page = await context.newPage();
    const state = watch(page);
    await page.goto(M.baseUrl + '/public.html');
    await page.goto(M.baseUrl + '/index.html');
    await signIn(page, state, M.accounts.member, M.totpSecret, M.password, M.turnstile);
    await expect(page.locator('nav.rail-nav')).toBeVisible();
    const registered = await page.evaluate(async () =>
      'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : -1
    );
    info.annotations.push({ type: 'service worker registrations', description: String(registered) });
    const started = Date.now();
    await page.reload({ timeout: 30_000 });
    await expect(page.locator('nav.rail-nav')).toBeVisible({ timeout: 30_000 });
    info.annotations.push({ type: 'portal reload (ms)', description: String(Date.now() - started) });
    console.log(`firefox: worker registrations ${registered}, portal reload ${Date.now() - started} ms`);
  } finally {
    await browser.close();
  }
});
