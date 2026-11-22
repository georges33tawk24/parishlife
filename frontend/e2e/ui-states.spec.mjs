/* Purpose: end-to-end checks of the portal's waiting and failure states against the real API (test-only host).
   Main checks: a double click on a dialog's Delete removes exactly one record (the button waits for the server,
   and a second press never removes the next or the last record: handoff 04-8); while the browser is offline the
   portal says so, and the banner goes when the connection is back. */
import { test, expect } from '@playwright/test';
import { manifest, settle, signIn, watch } from './support.mjs';

const M = manifest();

/* Each test is its own client for the API's per-address rate limits (see portal.spec.mjs). */
const client = (page, n) =>
  page.context().route(
    url => url.origin === M.baseUrl,
    route => route.continue({ headers: { ...route.request().headers(), 'x-e2e-client': '10.0.0.' + n } })
  );

test('a double click on Delete removes one meeting, not two', async ({ page }) => {
  await client(page, 50);
  const state = watch(page);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.priest, M.totpSecret, M.password, M.turnstile);

  // Two meetings of the fixture ministry, through the API as the signed-in priest.
  const seat = `parishes/${M.parishId}/ministries/${M.ministryId}/meetings`;
  const [first, second] = await page.evaluate(async seat => {
    const { token } = await (await fetch('/api/auth/csrf')).json();
    const made = [];
    for (const hour of [7, 9]) {
      const start = new Date(Date.now() + 4 * 86400000);
      start.setUTCHours(hour, 0, 0, 0);
      const response = await fetch('/api/' + seat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          title: 'Double click check ' + hour,
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + 3600000).toISOString(),
          timeZone: 'Asia/Beirut',
          rsvpMode: 'Optional'
        })
      });
      if (!response.ok) throw new Error('meeting not created: ' + response.status);
      made.push((await response.json()).id);
    }
    return made;
  }, seat);

  await page.reload();
  await page.locator('nav.rail-nav').waitFor();
  await page.evaluate(id => (location.hash = `#/groups/${id}/meetings`), M.ministryId);
  await settle(page, state);
  await page.locator(`[data-meeting-edit="${first}"]`).first().click();
  await page.locator('#me_delete').click();
  const confirm = page.locator('#me_confirm');
  await expect(confirm).toBeVisible();
  await confirm.dblclick();
  await expect(page.locator('.modal.open')).toHaveCount(0, { timeout: 30000 });
  await settle(page, state);

  const status = await page.evaluate(
    async ([seat, ids]) =>
      Promise.all(ids.map(async id => (await (await fetch(`/api/${seat}/${id}`)).json()).value.status)),
    [seat, [first, second]]
  );
  expect(status[0], 'the meeting chosen for deletion').toBe('Cancelled');
  expect(status[1], 'the other meeting must survive a double click').not.toBe('Cancelled');
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('the portal says when the device is offline, and stops saying it when it is back', async ({ page }) => {
  await client(page, 51);
  const state = watch(page);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.member, M.totpSecret, M.password, M.turnstile);
  const banner = page.locator('[data-offline-banner]');
  await expect(banner).toHaveCount(0);
  await page.context().setOffline(true);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('offline');
  await page.context().setOffline(false);
  await expect(banner).toHaveCount(0);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});
