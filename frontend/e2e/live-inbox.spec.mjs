/* Purpose: the owner's requests of 27 November 2026, in the browser against the real API (test-only host).
   Main checks: a colour preference is stored on the account and is used on another device after signing in there; a
   member's message opens for the operator as the whole thread with a reply box, the reply reaches the member's open
   conversation without a reload (live updates), and the conversation's own address opens it directly; the operator's
   Administration page shows the parish follow-up worklist and the site analytics. */
import { expect } from '@playwright/test';
import { client, manifest, offline, settle, signIn, test, watch } from './support.mjs';

const M = manifest();

/* Another device: a fresh browser context with its own cookies and storage, kept offline like the test's own. */
async function device(browser, n) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 900 } });
  await offline(context, M.baseUrl);
  const page = await context.newPage();
  await client(page, n);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  return { context, page };
}

test('a colour preference is saved on the account and used on another device', async ({ page, browser }) => {
  await client(page, 130);
  const state = watch(page);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.visitor, M.totpSecret, M.password, M.turnstile);
  await page.evaluate(() => (location.hash = '#/account'));
  const form = page.locator('form[data-theme]');
  await form.locator('input[name="scheme"][value="navy"]').check();
  await form.locator('select[name="mode"]').selectOption('dark');
  // no button pressed: the choice is saved on its own
  await expect(form.locator('[data-appearance-status]')).toContainText('Saved to your account', { timeout: 15000 });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');

  const other = await device(browser, 131);
  try {
    const otherState = watch(other.page);
    await other.page.goto(M.baseUrl + '/index.html');
    await signIn(other.page, otherState, M.accounts.visitor, M.totpSecret, M.password, M.turnstile);
    await expect(other.page.locator('html')).toHaveAttribute('data-scheme', 'navy');
    await expect(other.page.locator('html')).toHaveAttribute('data-mode', 'dark');
    expect(otherState.problems, otherState.problems.join('\n')).toEqual([]);
  } finally {
    await other.context.close();
  }

  // back to no saved appearance, as the other tests expect
  await page.locator('[data-reset-appearance]').click();
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'forest');
  await settle(page, state);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('a conversation opens as the whole thread, a reply arrives without a reload, and its address opens it', async ({
  page,
  browser
}) => {
  await client(page, 132);
  const state = watch(page);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.member, M.totpSecret, M.password, M.turnstile);
  const subject = 'Live thread ' + Date.now();
  await page.evaluate(() => (location.hash = '#/mymessages'));
  await settle(page, state);
  await page.locator('[data-compose]').first().click();
  const compose = page.locator('form[data-compose-form]');
  await compose.locator('input[name="subject"]').fill(subject);
  await compose.locator('textarea[name="body"]').fill('Could the office call me back?');
  await compose.locator('button.btn-primary').click();
  await expect(page.locator('.chat .bubble-body', { hasText: 'Could the office call me back?' })).toBeVisible();

  const office = await device(browser, 133);
  let conversation = '';
  try {
    const officeState = watch(office.page);
    // the operator opens the parish straight away (?parish=), as from its switcher
    await office.page.goto(M.baseUrl + '/index.html?parish=' + M.parishId);
    await signIn(office.page, officeState, M.accounts.operator, M.totpSecret, M.password, M.turnstile);
    await office.page.evaluate(() => (location.hash = '#/inbox'));
    const row = office.page.locator('button.mail-row', { hasText: subject });
    await row.click();
    conversation = await row.getAttribute('data-open');
    // the member's side of the thread, and a reply box under it
    await expect(
      office.page.locator('.chat .bubble-body', { hasText: 'Could the office call me back?' })
    ).toBeVisible();
    await office.page.locator('form[data-reply-form] textarea').fill('Yes, this afternoon.');
    await office.page.locator('[data-reply]').click();
    await expect(
      office.page.locator('.chat .chat-row.mine .bubble-body', { hasText: 'Yes, this afternoon.' })
    ).toBeVisible();
    expect(officeState.problems, officeState.problems.join('\n')).toEqual([]);
  } finally {
    await office.context.close();
  }

  // The member's open conversation shows the reply on the next live round (every 30 seconds), with no reload.
  await expect(page.locator('.chat .bubble-body', { hasText: 'Yes, this afternoon.' })).toBeVisible({ timeout: 45000 });

  // The conversation's own address (the link its notice carries) opens the thread directly.
  await page.evaluate(([p, c]) => (location.hash = `#/mymessages/${p}/${c}`), [M.parishId, conversation]);
  await expect(page.locator('.mail-head h2', { hasText: subject })).toBeVisible();
  await expect(page.locator('.chat .bubble-body', { hasText: 'Could the office call me back?' })).toBeVisible();
  await expect(page.locator('.chat .bubble-body', { hasText: 'Yes, this afternoon.' })).toBeVisible();
  await settle(page, state);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test("the operator's Administration page shows the parish follow-up and the site analytics", async ({ page }) => {
  await client(page, 134);
  const state = watch(page);
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'));
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.operator, M.totpSecret, M.password, M.turnstile);
  await page.evaluate(() => (location.hash = '#/workspace'));
  const overview = page.locator('[data-platform-overview]');
  await expect(overview.getByRole('heading', { name: 'Parish follow-up' })).toBeVisible();
  await expect(overview.getByRole('heading', { name: 'Site analytics' })).toBeVisible();
  await expect(overview.getByText('Recorded visits')).toBeVisible();
  await settle(page, state);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});
