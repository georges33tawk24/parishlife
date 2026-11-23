/* Purpose: the accessibility guard in CI (owner decision T6). axe-core (@axe-core/playwright) checks WCAG 2.0, 2.1 and 2.2
   A and AA on the public pages signed out in English and Arabic (sign-in, sign-up, home, a parish page, the product page,
   privacy, terms, cookies), on every screen of the member's menu in English, and on every screen of the priest's menu in
   English, in Arabic and in dark mode (the device's setting, which an account with no saved appearance follows).
   Main checks: no violation anywhere; each one found is listed with its page, rule and first elements.
   Motion is reduced, and each scan waits for running animations to end, so none catches a fade half-way. */
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { client, manifest, settle, signIn, test, watch } from './support.mjs';

const M = manifest();
/* No trace: each scan injects axe's whole source, so a trace of 130 scans takes hundreds of MB, and a failure already lists
   the page, the rule, the elements and the colours measured. */
test.use({ trace: 'off' });
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

async function scan(page, where, found) {
  // a page or panel still easing in would be measured half-transparent: wait for every finite animation to end
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(a => a.timeline === document.timeline && a.effect?.getComputedTiming().endTime !== Infinity)
        .map(a => a.finished.catch(() => {}))
    )
  );
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of violations)
    found.push(
      `[${where}] ${v.id} (${v.nodes.length}): ${v.nodes
        .slice(0, 3)
        .map(n => {
          const c = n.any?.[0]?.data; // color-contrast: the colours axe measured
          return n.target.join(' ') + (c?.fgColor ? ` ${c.fgColor} on ${c.bgColor} = ${c.contrastRatio}` : '');
        })
        .join(' | ')}`
    );
}

/* Every screen the signed-in role's menu offers, scanned in the page's current language and mode. */
async function screens(page, state, label, found) {
  const hrefs = [
    ...new Set(await page.locator('nav.rail-nav a[href^="#/"]').evaluateAll(a => a.map(x => x.getAttribute('href'))))
  ];
  for (const href of hrefs) {
    state.where = `${label} ${href}`;
    await page.evaluate(h => (location.hash = h), href);
    await settle(page, state);
    await scan(page, state.where, found);
  }
  return hrefs.length;
}

test('public pages signed out pass axe in English and Arabic', async ({ page }) => {
  await client(page, 120);
  const state = watch(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const found = [];
  const pages = [
    '/index.html',
    '/index.html?signup',
    '/public.html',
    '/public.html?parish=' + M.parishId,
    '/landing.html',
    '/privacy.html',
    '/terms.html',
    '/cookies.html'
  ];
  for (const lang of ['en', 'ar'])
    for (const path of pages) {
      const url = path + (path.includes('?') ? '&' : '?') + 'lang=' + lang;
      state.where = url;
      await page.goto(M.baseUrl + url);
      await settle(page, state);
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      await scan(page, url, found);
    }
  expect(found, found.join('\n')).toEqual([]);
});

test('every screen of the priest (English, Arabic, dark) and the member (English) passes axe', async ({
  page
}, info) => {
  await client(page, 121);
  const state = watch(page);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-lang-set')) {
      localStorage.setItem('pl-lang', 'en');
      sessionStorage.setItem('e2e-lang-set', '1');
    }
  });
  const found = [];
  let count = 0;

  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.member, M.totpSecret, M.password, M.turnstile);
  count += await screens(page, state, 'member en', found);
  await page.context().clearCookies(); // signed out: the priest signs in on a fresh sign-in page
  await page.goto(M.baseUrl + '/index.html');

  await signIn(page, state, M.accounts.priest, M.totpSecret, M.password, M.turnstile);
  count += await screens(page, state, 'priest en', found);
  await page.emulateMedia({ colorScheme: 'dark' }); // no saved appearance: the portal turns dark with the device
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  count += await screens(page, state, 'priest en dark', found);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => localStorage.setItem('pl-lang', 'ar'));
  await page.reload();
  await page.locator('nav.rail-nav').waitFor();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  count += await screens(page, state, 'priest ar', found);

  info.annotations.push({ type: 'screens scanned', description: String(count) });
  expect(found, found.join('\n')).toEqual([]);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});
