/* Purpose: a new person's whole account life in the browser against the real API (test-only host), with codes read from the
   host's test inbox instead of email (Agent 03 handoff 6; Agent 09 items 6, 7, 8 and 14).
   Main checks: sign-up refuses a press without the 13-or-older box and posts nothing; a person signs up, verifies the email
   with the emailed code, signs in, resets a forgotten password from another device (that device's code works once, the old
   password stops working and the first device's session ends), downloads their data, and closes the account with the
   button (signed out, cannot sign in again). */
import { expect } from '@playwright/test';
import { client, manifest, outbox, outboxSize, settle, signIn, test, turnstileToken, watch } from './support.mjs';

const M = manifest();

async function fillSignUp(page, email, password) {
  await page.goto(M.baseUrl + '/index.html?signup');
  await page.locator('input[name="firstName"]').fill('Rita');
  await page.locator('input[name="lastName"]').fill("Al-Khoury O'Neil");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
}

test('sign-up refuses a press without the 13-or-older box and sends nothing', async ({ page }) => {
  await client(page, 60);
  const state = watch(page);
  const posts = [];
  page.on('request', r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/auth/register' && posts.push(r));
  await fillSignUp(page, `young-${Date.now()}@e2e.example`, 'a sentence that is long enough');
  if (M.turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  await expect.poll(() => page.locator('[data-age]').evaluate(box => box.validity.valueMissing)).toBe(true);
  await page.waitForTimeout(500);
  expect(posts).toHaveLength(0);
  await expect(page.locator('[data-tab="signup"]')).toHaveAttribute('aria-pressed', 'true');
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('a person signs up, verifies the email, resets the password, downloads the data and closes the account', async ({
  page,
  browser
}) => {
  const email = `rita-${Date.now()}@e2e.example`;
  const first = 'my first long sign-up password';
  const second = 'my second long password after reset';
  await client(page, 61);
  const state = watch(page);

  // Sign up, then verify the address with the code from the inbox.
  await fillSignUp(page, email, first);
  await page.locator('[data-age]').check();
  if (M.turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  await expect(page.locator('[data-send-code]')).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  if (M.turnstile) await turnstileToken(page);
  const before = outboxSize();
  await page.locator('[data-send-code]').click();
  await page.locator('input[name="code"]').fill(await outbox(email, 'ConfirmEmail', before));
  await page.locator('button.auth-submit').click();

  // Accepting the code signs the person straight in with the password chosen at sign-up (owner, 26 November 2026).
  await expect(page.locator('#userbtn')).toBeVisible({ timeout: 15000 });

  // Forgotten password, from another device that is signed out.
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  const phone = await other.newPage();
  await client(phone, 62);
  const phoneState = watch(phone);
  await phone.goto(M.baseUrl + '/index.html');
  await phone.locator('[data-forgot]').click();
  await phone.locator('[data-reset-password]').click();
  await phone.locator('input[name="email"]').fill(email);
  if (M.turnstile) await turnstileToken(phone);
  const sent = outboxSize();
  await phone.locator('[data-send-reset]').click();
  const code = await outbox(email, 'ResetPassword', sent);
  await phone.locator('input[name="code"]').fill(code);
  await phone.locator('input[name="password"]').fill(second);
  await phone.locator('button.auth-submit').click();
  await expect(phone.locator('p[role="status"]')).toContainText('Your password is changed');
  // The code works once.
  const reuse = await phone.evaluate(
    async ([email, code]) => {
      const { token } = await (await fetch('/api/auth/csrf')).json();
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
        body: JSON.stringify({ email, code, newPassword: 'a third password that is long' })
      });
      return response.status;
    },
    [email, code]
  );
  expect(reuse).toBe(400);
  expect(phoneState.problems.filter(p => !p.includes('password-reset/confirm → 400'))).toEqual([]);
  await other.close();

  // The first device's session ended; the old password no longer signs in; the new one does.
  expect(await page.evaluate(() => fetch('/api/auth/me').then(r => r.status))).toBe(401);
  await page.goto(M.baseUrl + '/index.html'); // this tab opened on ?signup
  await page.locator('input[name="username"]').fill(email);
  await page.locator('input[name="password"]').fill(first);
  if (M.turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  await expect(page.locator('[data-error]')).toBeVisible();
  await expect(page.locator('nav.rail-nav')).toHaveCount(0);
  await signIn(page, state, { username: email }, M.totpSecret, second, M.turnstile);

  // Download my data: a JSON file with this account in it.
  await page.evaluate(() => (location.hash = '#/account'));
  await settle(page, state);
  const download = page.waitForEvent('download');
  await page.locator('[data-download-data]').click();
  const file = await download;
  const copy = JSON.parse(
    await (await file.createReadStream()).toArray().then(parts => Buffer.concat(parts).toString())
  );
  expect(copy.account.email).toBe(email);
  expect(JSON.stringify(copy)).not.toMatch(/passwordHash|securityStamp/i);

  // Close my account with the button: fresh password and the word CLOSE.
  await page.locator('[data-close-account]').click();
  const form = page.locator('form[data-account-close]');
  await form.locator('input[name="password"]').fill(second);
  await form.locator('input[name="confirmation"]').fill('CLOSE');
  const closed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/account/close');
  await form.locator('button[type="submit"]').click();
  expect((await closed).status()).toBe(200);
  await expect(page.locator('input[name="username"]')).toBeVisible();
  expect(await page.evaluate(() => fetch('/api/auth/me').then(r => r.status))).toBe(401);
  await page.locator('input[name="username"]').fill(email);
  await page.locator('input[name="password"]').fill(second);
  if (M.turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  await expect(page.locator('[data-error]')).toBeVisible();
  expect(state.problems.filter(p => !p.includes('/api/auth/login → '))).toEqual([]);
});
