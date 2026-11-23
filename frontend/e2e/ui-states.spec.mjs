/* Purpose: end-to-end checks of the portal's waiting and failure states against the real API (test-only host).
   Main checks: a double click on a dialog's Delete removes exactly one record (the button waits for the server,
   and a second press never removes the next or the last record: handoff 04-8); while the browser is offline the
   portal says so, and the banner goes when the connection is back; with no saved appearance the portal is light or dark
   as the device is, and changes with it (owner decision T17); Send pressed again after a message timed out (the server
   stored it late) stores it once, because the retry carries the first operation id (audit N2). */
import { expect } from '@playwright/test';
import { manifest, settle, signIn, test, watch } from './support.mjs';

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
  await signIn(page, state, M.accounts.leader, M.totpSecret, M.password, M.turnstile);

  // Two meetings of the fixture ministry, through the API as its signed-in leader.
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
      if (!response.ok) throw new Error('meeting not created: ' + response.status + ' ' + (await response.text()));
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
  // A double click whose second press lands just after the server answered, while the dialog fades out: the
  // button is still under the pointer for a moment, and the record it named is already gone.
  const box = await confirm.boundingBox();
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.click(x, y);
  await page.waitForFunction(() => !document.querySelector('.modal.open'), null, { polling: 'raf', timeout: 30000 });
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
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

test('with no saved appearance the portal follows the device, also when it changes', async ({ page }) => {
  await client(page, 52);
  const state = watch(page);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.member, M.totpSecret, M.password, M.turnstile);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-mode', 'dark');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg'))).toBe('#11161E');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html).toHaveAttribute('data-mode', 'light');
  await page.reload();
  await page.locator('nav.rail-nav').waitFor();
  await expect(html).toHaveAttribute('data-mode', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveAttribute('data-mode', 'dark');
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('Send pressed again after a time-out stores the message once (audit N2)', async ({ page }) => {
  await client(page, 53);
  const state = watch(page);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.member, M.totpSecret, M.password, M.turnstile);
  const inbox = `/api/parishes/${M.parishId}/inbox`;
  const subject = 'Time-out check ' + Date.now();

  // The first message is held past the portal's 30-second wait; only once the page has given up does the server
  // receive it and store it, as on a connection that answers too late.
  let release, received;
  const released = new Promise(resolve => (release = resolve));
  const stored = new Promise(resolve => (received = resolve));
  let held = false;
  await page.route(
    url => url.pathname === inbox,
    async route => {
      if (route.request().method() !== 'POST' || held) return route.fallback();
      held = true;
      await released;
      const headers = { ...(await route.request().allHeaders()), 'x-e2e-client': '10.0.0.53' }; // with the cookies
      const response = await route.fetch({ headers });
      received(response.status());
      await route.fulfill({ response }).catch(() => {}); // the page stopped listening long ago
    }
  );

  await page.evaluate(() => (location.hash = '#/mymessages'));
  await settle(page, state);
  await page.locator('[data-compose]').first().click();
  const form = page.locator('form[data-compose-form]');
  await form.locator('input[name="subject"]').fill(subject);
  await form.locator('textarea[name="body"]').fill('Is the hall free on Saturday?');
  const send = form.locator('button.btn-primary');
  await send.click();
  await expect(form.getByText(/did not answer in time/)).toBeVisible({ timeout: 45000 });
  release();
  expect(await stored, 'the held message reached the server').toBeLessThan(300);

  const second = page.waitForResponse(r => new URL(r.url()).pathname === inbox && r.request().method() === 'POST');
  await send.click(); // the form kept what was typed
  expect((await second).status()).toBeLessThan(300);
  await settle(page, state);

  const list = await page.evaluate(async path => (await fetch(path)).json(), inbox);
  const items = Array.isArray(list) ? list : list.items;
  expect(items.filter(c => (c.value || c).subject === subject)).toHaveLength(1);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});
