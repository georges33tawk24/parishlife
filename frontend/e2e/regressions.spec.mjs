/* Purpose: browser regressions for fixes of the hardening run that only a browser can show (Agent 09 item 3), each named after
   the fix.
   Main checks: signing out removes the account-linked browser storage (03, 06 handoff 2); the authenticator step takes the focus
   and starts empty (05 B4); the sign-in page honours ?lang=ar (05 B1); a failed save says so and rolls the screen back to what
   the API stored (04 item 5, 05 C1); and it keeps the dialog and the typed text (05 C6). */
import { expect } from '@playwright/test';
import { client, manifest, settle, signIn, test, totp, turnstileToken, watch } from './support.mjs';

const M = manifest();

test('signing out removes the account-linked browser storage and keeps the preferences', async ({ page }) => {
  await client(page, 70);
  const state = watch(page);
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.treasurer, M.totpSecret, M.password, M.turnstile);
  await page.evaluate(
    ([account, parish]) => {
      localStorage.setItem('pl-anniversaries-' + account, '{"layout":"list"}');
      localStorage.setItem('pl-finance-session:' + parish, '{"session":"last"}');
      localStorage.setItem('pl-lang', 'en');
      sessionStorage.setItem('pl-admin-opened', '["x"]');
    },
    [M.accounts.treasurer.id, M.parishId]
  );
  await page.locator('#userbtn').click();
  await page.locator('[data-u="signout"]').click();
  await expect(page.locator('input[name="username"]')).toBeVisible();
  const left = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
  expect(left.local.filter(k => k.startsWith('pl-anniversaries-') || k.startsWith('pl-finance-session:'))).toEqual([]);
  expect(left.session).not.toContain('pl-admin-opened');
  expect(left.local).toContain('pl-lang');
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('the authenticator step takes the focus and starts empty', async ({ page }) => {
  await client(page, 71);
  const state = watch(page);
  await page.goto(M.baseUrl + '/index.html');
  await page.locator('input[name="username"]').fill(M.accounts.reviewer.username);
  await page.locator('input[name="password"]').fill(M.password);
  if (M.turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  const code = page.locator('input[name="code"]');
  await expect(code).toBeFocused();
  await expect(code).toHaveValue('');
  // Typed straight away, without a click, the code lands in the field and signs in (the second operator signs in only here,
  // so no other test has spent this code).
  if (30000 - (Date.now() % 30000) < 3000) await page.waitForTimeout(3500); // never a code about to expire
  await page.keyboard.type(totp(M.totpSecret));
  await page.keyboard.press('Enter');
  await page.locator('nav.rail-nav').waitFor();
  await settle(page, state);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('the sign-in page honours ?lang=ar', async ({ page }) => {
  await client(page, 72);
  await page.goto(M.baseUrl + '/index.html?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h1')).toHaveText('أهلاً بعودتك');
});

/* The leader's meeting, edited in its dialog while the save request fails on the way (a dropped connection). */
async function failedMeetingSave(page, n) {
  await client(page, n);
  const state = watch(page);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.leader, M.totpSecret, M.password, M.turnstile);
  const seat = `parishes/${M.parishId}/ministries/${M.ministryId}/meetings`;
  const title = 'Rollback check ' + n;
  const id = await page.evaluate(
    async ([seat, title]) => {
      const { token } = await (await fetch('/api/auth/csrf')).json();
      const start = new Date(Date.now() + (5 + Math.random() * 20) * 86400000);
      start.setUTCHours(8, 0, 0, 0);
      const response = await fetch('/api/' + seat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          title,
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + 3600000).toISOString(),
          timeZone: 'Asia/Beirut',
          rsvpMode: 'Optional'
        })
      });
      return (await response.json()).id;
    },
    [seat, title]
  );
  await page.reload();
  await page.locator('nav.rail-nav').waitFor();
  await page.evaluate(m => (location.hash = `#/groups/${m}/meetings`), M.ministryId);
  await settle(page, state);
  await page.locator(`[data-meeting-edit="${id}"]`).first().click();
  await page.locator('#me_title').fill('Renamed while offline');
  const failing = url => url.pathname.includes('/meetings');
  await page.route(failing, route =>
    route.request().method() === 'GET' ? route.fallback() : route.abort('connectionreset')
  );
  await page.locator('#me_save').click();
  await expect(page.getByText('Changes were not saved')).toBeVisible();
  return { state, seat, id, title, failing };
}

test('a failed save says so and the screen shows what the API stored', async ({ page }) => {
  const { state, seat, id, title, failing } = await failedMeetingSave(page, 73);
  await page.unroute(failing);
  const stored = await page.evaluate(
    async ([seat, id]) => (await (await fetch(`/api/${seat}/${id}`)).json()).value.title,
    [seat, id]
  );
  expect(stored).toBe(title);
  await page.keyboard.press('Escape');
  await settle(page, state);
  await expect(page.getByText('Renamed while offline')).toHaveCount(0);
  await expect(page.getByText(title).first()).toBeVisible();
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('a failed save keeps the dialog open with what was typed', async ({ page }) => {
  await failedMeetingSave(page, 74);
  await expect(page.locator('#me_title')).toHaveValue('Renamed while offline', { timeout: 5000 });
});
