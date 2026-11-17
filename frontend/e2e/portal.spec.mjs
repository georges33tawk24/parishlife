/* Purpose: the signed-in end-to-end tests. Against the real API (test-only host, isolated storage), each
   fixture role signs in through the real sign-in screen and opens every screen its menu offers, first in
   English and then in Arabic (right to left); the public pages are opened signed out.
   Main checks: no page errors, no 5xx or 400 API responses, no "not connected" screen, the expected
   menu entries for each role, and dir="rtl" in Arabic. 403/404 answers are listed, not failed: the API
   answers 404 for records a role may not see. */
import { test, expect } from '@playwright/test';
import { manifest, NOT_CONNECTED, settle, signIn, watch } from './support.mjs';

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
  for (const path of ['/', '/public.html', '/landing.html', '/index.html']) {
    state.where = path;
    const response = await page.goto(M.baseUrl + path);
    // served by the API's own hosting (UseParishLifeFrontend), as in production; a blocked resource is a console error
    expect(response.headers()['content-security-policy'], path).toContain("default-src 'self'");
    expect(response.headers()['cache-control'], path).toBe('no-cache');
    await settle(page, state);
  }
  await expect(page.locator('input[name="username"]')).toBeVisible();
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
    await signIn(page, state, account, M.totpSecret, M.password);

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
