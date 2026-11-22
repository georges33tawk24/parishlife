/* Purpose: the main flows on phone, tablet and desktop sizes (Agent 09 item 10). Playwright's WebKit does not start on this
   machine, so iPhone and iPad are emulated in Chromium (their size, pixel ratio, touch and user agent); Android is a Pixel 7.
   Main checks: the public directory, a parish page and the sign-in page fit the width (no sideways scroll); a member signs in by
   touch and reaches their home and My account, which also fit; no page error or failing API call. */
import { devices, expect } from '@playwright/test';
import { client, manifest, settle, test, turnstileToken, watch } from './support.mjs';

const M = manifest();
const strip = ({ defaultBrowserType, ...device }) => device; // the browser stays Chromium
const SIZES = {
  'iPhone 14 (Chromium emulation)': strip(devices['iPhone 14']),
  'Pixel 7': strip(devices['Pixel 7']),
  'iPad Mini (Chromium emulation)': strip(devices['iPad Mini']),
  'desktop 1440': { viewport: { width: 1440, height: 900 } }
};

const overflow = page =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

Object.entries(SIZES).forEach(([name, device], index) => {
  test.describe(name, () => {
    test.use(device);
    test(`${name}: public pages and a member's portal fit the screen`, async ({ page }) => {
      await client(page, 100 + index);
      const state = watch(page);
      await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
      for (const path of ['/public.html', '/public.html?parish=' + M.parishId, '/index.html']) {
        state.where = `${name} ${path}`;
        await page.goto(M.baseUrl + path);
        await settle(page, state, 600, 8000);
        expect(await overflow(page), state.where).toBeLessThanOrEqual(1);
      }
      state.where = `${name} sign-in`;
      await page.locator('input[name="username"]').fill(M.accounts.member.username);
      await page.locator('input[name="password"]').fill(M.password);
      if (M.turnstile) await turnstileToken(page);
      const submit = page.locator('button.auth-submit');
      await (device.hasTouch ? submit.tap() : submit.click());
      await page.locator('nav.rail-nav').waitFor({ state: 'attached', timeout: 60_000 });
      await settle(page, state);
      for (const hash of ['#/memberhome', '#/account']) {
        state.where = `${name} ${hash}`;
        await page.evaluate(h => (location.hash = h), hash);
        await settle(page, state);
        expect(await overflow(page), state.where).toBeLessThanOrEqual(1);
      }
      expect(state.problems, state.problems.join('\n')).toEqual([]);
    });
  });
});
