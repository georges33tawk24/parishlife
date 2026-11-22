/* Purpose: the sign-in and the first portal screen on slow networks, and how waiting and failure look (Agent 09 items 9 and 18).
   Chromium's network emulation throttles the page to slow 3G (2 s round trip, 400 kbit/s) and slow 4G (150 ms, 1.6 Mbit/s down,
   750 kbit/s up, Lighthouse's mobile profile).
   Main checks: the sign-in form arrives; a double press sends one sign-in and the button shows it is busy; a page skeleton
   covers the wait for the first screen instead of a blank page; a wrong password gets a plain message in English and
   in Arabic; a sign-in that never answers ends in a message (the client stops waiting after 30 seconds). */
import { expect } from '@playwright/test';
import { client, manifest, settle, test, turnstileToken, watch } from './support.mjs';

const M = manifest();
const PROFILES = {
  'slow 3G': { latency: 2000, downloadThroughput: 50_000, uploadThroughput: 50_000 },
  'slow 4G': { latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 }
};

for (const [name, conditions] of Object.entries(PROFILES)) {
  test(`${name}: sign-in waits visibly, sends once, and a skeleton covers the first screen`, async ({ page }, info) => {
    await client(page, name === 'slow 3G' ? 90 : 91);
    const state = watch(page);
    await page.addInitScript(() => {
      localStorage.setItem('pl-lang', 'en');
      new MutationObserver(() => {
        if (document.querySelector('.page-skel')) window.__sawSkeleton = true;
      }).observe(document, { childList: true, subtree: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...conditions });
    const posts = [];
    page.on('request', r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/auth/login' && posts.push(r));

    const started = Date.now();
    await page.goto(M.baseUrl + '/index.html', { timeout: 180_000 });
    await page.locator('input[name="username"]').waitFor({ timeout: 180_000 });
    const formAfter = Date.now() - started;
    await page.locator('input[name="username"]').fill(M.accounts.member.username);
    await page.locator('input[name="password"]').fill(M.password);
    if (M.turnstile) await turnstileToken(page);
    const submit = page.locator('button.auth-submit');
    await submit.dblclick();
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    await expect(submit).toBeDisabled();
    const signedIn = Date.now();
    await page.locator('nav.rail-nav').waitFor({ timeout: 240_000 });
    await settle(page, state, 1000, 120_000);
    const shellAfter = Date.now() - signedIn;
    expect(posts).toHaveLength(1);
    if (name === 'slow 3G') expect(await page.evaluate(() => window.__sawSkeleton === true)).toBe(true);
    info.annotations.push({
      type: 'timing',
      description: `${name}: sign-in form after ${formAfter} ms; portal ready ${shellAfter} ms after pressing Sign in; skeleton seen: ${await page.evaluate(() => !!window.__sawSkeleton)}`
    });
    expect(state.problems, state.problems.join('\n')).toEqual([]);
  });
}

test('a wrong password gets a plain message and the form keeps what was typed', async ({ page }) => {
  await client(page, 92);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await page.locator('input[name="username"]').fill(M.accounts.visitor.username);
  await page.locator('input[name="password"]').fill('not the right password at all');
  if (M.turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  await expect(page.locator('[data-error]')).toHaveText(/password do not match/);
  await expect(page.locator('input[name="username"]')).toHaveValue(M.accounts.visitor.username);
  await expect(page.locator('button.auth-submit')).toBeEnabled();
});

test('a wrong password gets its message in Arabic on the Arabic page', async ({ page }) => {
  // from-09-qa.md #5, fixed: the sign-in 401 messages in model/api.js are bilingual
  await client(page, 93);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'ar'));
  await page.goto(M.baseUrl + '/index.html');
  await page.locator('input[name="username"]').fill(M.accounts.visitor.username);
  await page.locator('input[name="password"]').fill('not the right password at all');
  if (M.turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  await expect(page.locator('[data-error]')).toBeVisible();
  expect(await page.locator('[data-error]').innerText()).toMatch(/[؀-ۿ]/);
});

test('a sign-in that never answers ends in a message instead of waiting for ever', async ({ page }) => {
  // from-09-qa.md #6, fixed: API calls stop waiting for an answer after 30 seconds
  await client(page, 94);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await page.route('**/api/auth/login', () => {}); // never answered, as on a dead mobile connection
  await page.locator('input[name="username"]').fill(M.accounts.visitor.username);
  await page.locator('input[name="password"]').fill(M.password);
  if (M.turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  await expect(page.locator('[data-error]')).toBeVisible({ timeout: 35_000 });
  await expect(page.locator('button.auth-submit')).toBeEnabled();
});
