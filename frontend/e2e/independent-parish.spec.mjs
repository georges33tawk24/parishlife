/* Purpose: the ParishLife administrator inside an independent parish (one with no archdiocese, as Saint Abda & Focus
   church is). Archdiocese-only reads answer 409 or 403 there; the dashboard drew nothing at all for an administrator
   (27 November 2026), so it must now draw from whatever the parish's modules loaded, in English and Arabic.
   Main checks: the dashboard shows its heading, the parish name and its figures; every screen of the menu opens in the
   independent parish; no page errors, no 400/5xx answers and no "not connected" screen. */
import { expect } from '@playwright/test';
import { NOT_CONNECTED, client, manifest, settle, signIn, test, watch } from './support.mjs';

const M = manifest();

test('operator: the dashboard and every screen load in an independent parish', async ({ page }) => {
  await client(page, 130);
  const state = watch(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-lang-set')) {
      localStorage.setItem('pl-lang', 'en');
      sessionStorage.setItem('e2e-lang-set', '1');
    }
  });
  // a link from a parish's public page names the parish, and the portal opens there (Portal.jsx pickParish)
  await page.goto(`${M.baseUrl}/index.html?parish=${M.independentParishId}`);
  await signIn(page, state, M.accounts.operator, M.totpSecret, M.password, M.turnstile);

  for (const lang of ['en', 'ar']) {
    if (lang === 'ar') {
      await page.evaluate(() => localStorage.setItem('pl-lang', 'ar'));
      // a reload starts a ParishLife administrator in Administration again, so the parish is named once more
      await page.goto(`${M.baseUrl}/index.html?parish=${M.independentParishId}`);
      await page.locator('nav.rail-nav').waitFor();
      await settle(page, state);
    }
    state.where = `operator ${lang} independent #/dashboard`;
    await page.evaluate(() => (location.hash = '#/dashboard'));
    await settle(page, state);
    const view = page.locator('#view');
    await expect(view.locator('.pagehead h1')).toBeVisible();
    await expect(view.locator('.pagehead .sub')).toContainText('E2E Independent Parish');
    await expect(view.locator('.stats').first()).toBeVisible();

    const hrefs = [
      ...new Set(await page.locator('nav.rail-nav a[href^="#/"]').evaluateAll(a => a.map(x => x.getAttribute('href'))))
    ];
    expect(hrefs).toContain('#/dashboard');
    for (const href of hrefs) {
      state.where = `operator ${lang} independent ${href}`;
      await page.evaluate(h => (location.hash = h), href);
      await settle(page, state);
      const text = await page.locator('body').innerText();
      if (text.includes(NOT_CONNECTED)) state.problems.push(`[${state.where}] shows "not connected"`);
    }
  }
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});
