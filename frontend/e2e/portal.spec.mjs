/* Purpose: the signed-in end-to-end tests. Against the real API (test-only host, isolated storage), each
   fixture role signs in through the real sign-in screen and opens every screen its menu offers, first in
   English and then in Arabic (right to left); the public pages are opened signed out.
   Then the visitor and the priest sign out from the user menu, and the session must be gone. Google sign-up with a
   stand-in client posts once for a double press and reaches Google; a failed check comes back to the sign-in screen.
   Main checks: no page errors, no 5xx or 400 API responses, no "not connected" screen, the expected
   menu entries for each role, and dir="rtl" in Arabic. 403/404 answers are listed, not failed: the API
   answers 404 for records a role may not see. */
import { expect } from '@playwright/test';
import { NOT_CONNECTED, manifest, settle, signIn, test, turnstileToken, watch } from './support.mjs';

const M = manifest();

/* Screens each role's menu must offer (a subset; the test opens everything the menu shows). */
const EXPECTED = {
  operator: ['#/workspace', '#/account'],
  bishop: ['#/oversight', '#/account'],
  priest: ['#/dashboard', '#/people', '#/sacraments', '#/account'],
  secretary: ['#/people', '#/account'],
  treasurer: ['#/finance', '#/account'],
  leader: ['#/account'],
  member: ['#/activity', '#/account'],
  visitor: ['#/account']
};

/* Each test is its own client for the API's per-address rate limits (the test host reads X-E2E-Client),
   as separate people on separate devices would be. Only requests to the host carry it: fonts and other
   third-party requests would reject the unknown header. */
const client = (page, n) =>
  page.context().route(
    url => url.origin === M.baseUrl,
    route => route.continue({ headers: { ...route.request().headers(), 'x-e2e-client': '10.0.0.' + n } })
  );

test('public pages load signed out', async ({ page }) => {
  await client(page, 2);
  const state = watch(page);
  const legal = ['/privacy.html', '/terms.html', '/privacy.html?lang=ar', '/terms.html?lang=ar'];
  for (const path of ['/', '/public.html', '/landing.html', ...legal, '/index.html']) {
    state.where = path;
    const response = await page.goto(M.baseUrl + path);
    // served by the API's own hosting (UseParishLifeFrontend), as in production; a blocked resource is a console error
    expect(response.headers()['content-security-policy'], path).toContain("default-src 'self'");
    expect(response.headers()['cache-control'], path).toBe('no-cache');
    await settle(page, state);
    if (legal.includes(path)) {
      // approved text (no placeholder left); one language shows at a time
      const ar = path.endsWith('lang=ar');
      await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr');
      await expect(page.locator(`main section[lang="${ar ? 'ar' : 'en'}"]`)).toBeVisible();
      await expect(page.locator(`main section[lang="${ar ? 'en' : 'ar'}"]`)).toBeHidden();
      expect(await page.locator('body').innerText()).not.toContain('[OWNER');
    }
  }
  await expect(page.locator('input[name="username"]')).toBeVisible();
  // With Turnstile on, the widget loads under the page policy and gives the sign-in form a token.
  if (M.turnstile) await turnstileToken(page);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

for (const role of Object.keys(EXPECTED)) {
  test(`${role}: signs in and opens every screen in English and Arabic`, async ({ page }, info) => {
    const account = M.accounts[role];
    await client(page, 10 + Object.keys(EXPECTED).indexOf(role));
    const state = watch(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-lang-set')) {
        localStorage.setItem('pl-lang', 'en');
        sessionStorage.setItem('e2e-lang-set', '1');
      }
    });
    await page.goto(M.baseUrl + '/index.html');
    await signIn(page, state, account, M.totpSecret, M.password, M.turnstile);

    const hrefs = [
      ...new Set(await page.locator('nav.rail-nav a[href^="#/"]').evaluateAll(a => a.map(x => x.getAttribute('href'))))
    ];
    info.annotations.push({ type: 'menu', description: hrefs.join(' ') });
    for (const wanted of EXPECTED[role]) expect(hrefs, `${role} menu`).toContain(wanted);

    for (const lang of ['en', 'ar']) {
      if (lang === 'ar') {
        await page.evaluate(() => localStorage.setItem('pl-lang', 'ar'));
        await page.reload();
        await page.locator('nav.rail-nav').waitFor();
        await settle(page, state);
      }
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      for (const href of hrefs) {
        state.where = `${role} ${lang} ${href}`;
        await page.evaluate(h => (location.hash = h), href);
        await settle(page, state);
        const text = await page.locator('body').innerText();
        const at = text.indexOf(NOT_CONNECTED);
        if (at >= 0)
          state.problems.push(
            `[${state.where}] shows "not connected": …${text.slice(Math.max(0, at - 200), at + 80).replace(/\s+/g, ' ')}…`
          );
      }
    }

    await info.attach('api-403-404.txt', { body: state.notes.join('\n') || 'none', contentType: 'text/plain' });
    expect(state.problems, state.problems.join('\n')).toEqual([]);
  });
}

/* Google sign-up with a stand-in client (the test host's): pressing the button twice in a row sends one form post, and
   the page policy lets the API's redirect reach Google (form-action once blocked it, so a press did nothing). The trip
   ends at Google, which rejects the made-up client; nothing is signed in. */
test('Google sign-up: a double press posts once and reaches Google', async ({ page }) => {
  await client(page, 40);
  const posts = [];
  page.on('request', r => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/auth/external/google/sign-up') posts.push(r);
  });
  await page.goto(M.baseUrl + '/index.html?signup');
  const button = page.locator('[data-external="google"]');
  await expect(button).toBeVisible();
  await page.locator('[data-age]').check(); // accounts are for 13 and over (the API refuses sign-up without it)
  if (M.turnstile) await turnstileToken(page);
  const google = page.waitForRequest(r => new URL(r.url()).host === 'accounts.google.com', { timeout: 30000 });
  await button.dblclick();
  await button.click({ force: true, timeout: 2000 }).catch(() => {}); // a third, impatient press: disabled or already gone
  const authorize = new URL((await google).url());
  expect(authorize.searchParams.get('client_id')).toBe('e2e-stand-in-client');
  expect(posts).toHaveLength(1);
});

/* A failed check on that form post comes back to the sign-in screen with a plain message, not a JSON page. */
test('a failed check on a provider form post shows the sign-in screen with a message', async ({ page }) => {
  await client(page, 41);
  const state = watch(page);
  await page.goto(M.baseUrl + '/index.html?external=check-failed');
  await expect(page.locator('[data-error]')).toContainText('security check did not go through');
  await expect(page.locator('input[name="username"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.has('external')).toBe(false);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

/* Signing out from the user menu ends the session on the API. Both menus are covered: the member menu
   (visitor) and the staff menu (priest). A sign-out that never sent auth/logout once froze the tab. */
for (const [role, n] of [
  ['visitor', 30],
  ['priest', 31]
]) {
  test(`${role}: signs out from the user menu and the session is gone`, async ({ page }) => {
    await client(page, n);
    const state = watch(page);
    await page.goto(M.baseUrl + '/index.html');
    await signIn(page, state, M.accounts[role], M.totpSecret, M.password, M.turnstile);

    state.where = `${role} sign-out`;
    await page.locator('#userbtn').click();
    const logout = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/logout', { timeout: 15000 });
    await page.locator('[data-u="signout"]').click();
    expect((await logout).status()).toBe(204);
    await expect(page.locator('input[name="username"]')).toBeVisible();

    // The cookie no longer signs anything in, even after a reload.
    expect(await page.evaluate(() => fetch('/api/auth/me').then(r => r.status))).toBe(401);
    await page.reload();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('nav.rail-nav')).toHaveCount(0);
    expect(state.problems, state.problems.join('\n')).toEqual([]);
  });
}
