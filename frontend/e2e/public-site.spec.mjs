/* Purpose: the signed-out site as a visitor and a search engine see it, served by the real API host (Agent 09 items 11, 16 and 18).
   Main checks: no cookie banner is needed because the public pages and the sign-in page set only the strictly necessary
   anti-forgery cookie and contact no other site (Turnstile on the sign-in form excepted, as disclosed); every public page has its
   own title, description and canonical link and unknown addresses answer 404; content without JavaScript (fixed 26 November 2026; was a known failure: the
   pages are drawn by React); with the service worker in control, the portal address shows the offline page and the directory
   stays readable when the connection drops. */
import { expect } from '@playwright/test';
import { client, manifest, settle, test, watch } from './support.mjs';

const M = manifest();
const PUBLIC = ['/public.html', '/landing.html', '/privacy.html', '/terms.html', '/cookies.html'];

test('public pages and the sign-in page set only the necessary cookie and contact no other site', async ({ page }) => {
  await client(page, 80);
  const state = watch(page);
  const elsewhere = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== M.baseUrl)
      elsewhere.push(`${state.where} → ${url.host}${url.pathname}`);
  });
  const signIn = ['/', '/index.html?signup'];
  for (const path of [...PUBLIC, '/public.html?parish=' + M.parishId, '/public.html?lang=ar', ...signIn]) {
    state.where = path;
    await page.goto(M.baseUrl + path);
    await settle(page, state, 600, 8000);
  }
  // Turnstile is the disclosed security check of the sign-in and sign-up forms; nothing else leaves the site.
  expect(
    elsewhere.filter(line => !/^(\/|\/index\.html\?signup) → challenges\.cloudflare\.com\/turnstile\//.test(line))
  ).toEqual([]);
  const cookies = await page.context().cookies();
  expect(cookies.map(c => c.name)).toEqual(['__Host-ParishLife.Csrf']);
  for (const cookie of cookies)
    expect([cookie.httpOnly, cookie.secure, cookie.sameSite]).toEqual([true, true, 'Strict']);
  const stored = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  expect(stored.filter(key => !['pl-lang', 'pl-text', 'pl-simple', 'pl-rail'].includes(key))).toEqual([]);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('every public page has its own title, description and canonical link, and unknown addresses answer 404', async ({
  request
}) => {
  const heads = [];
  for (const path of PUBLIC) {
    const response = await request.get(M.baseUrl + path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    const description = /<meta name="description" content="([^"]+)"/.exec(html)?.[1];
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    // parish pages get their own from the server (SecuritySweepTests).
    expect(canonical, path).toBe('https://parish-life.org' + path);
    expect([path, !!title, !!description]).toEqual([path, true, true]);
    expect(html, path).not.toMatch(/noindex/);
    heads.push({ title, description });
  }
  expect(new Set(heads.map(h => h.title)).size).toBe(PUBLIC.length);
  expect(new Set(heads.map(h => h.description)).size).toBe(PUBLIC.length);
  for (const path of [
    '/no-such-page',
    '/public.html?parish=' + crypto.randomUUID(),
    '/public.html?parish=not-a-parish',
    '/assets/app/missing.js',
    '/api/no-such-endpoint'
  ])
    expect((await request.get(M.baseUrl + path)).status(), path).toBe(404);
});

test('the directory page names its canonical address', async ({ request }) => {
  // from-09-qa.md #7, fixed: public.html carries the directory's canonical link; parish pages replace it with their own
  const html = await (await request.get(M.baseUrl + '/public.html?lang=ar')).text();
  expect(html).toContain('<link rel="canonical" href="https://parish-life.org/public.html">');
});

test('public pages show their content without JavaScript', async ({ browser }) => {
  // Was a known failure (from-09-qa.md #4) until the pages carried their text: landing.html is rendered at build time, and public.html
  // gets its directory or parish text from the server (26 November 2026).
  const context = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  for (const path of ['/public.html', '/landing.html']) {
    await page.goto(M.baseUrl + path);
    expect((await page.locator('body').innerText()).trim().length, path).toBeGreaterThan(200);
  }
  await context.close();
});

test('with the connection gone, the portal address shows the offline page and the directory stays readable', async ({
  page
}) => {
  await client(page, 81);
  await page.goto(M.baseUrl + '/public.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Offline for the page and for the service worker's own fetches (setOffline alone does not reach the worker).
  await page.context().setOffline(true);
  await page.context().route(
    url => url.origin === M.baseUrl,
    route => route.abort('internetdisconnected')
  );
  await page.goto(M.baseUrl + '/index.html');
  await expect(page.locator('h1')).toHaveText('You are offline');
  await expect(page.locator('section[lang="ar"] h2')).toHaveText('أنت غير متّصل');
  await page.goto(M.baseUrl + '/public.html');
  await expect(page).toHaveTitle(/ParishLife/);
  const kept = await page.evaluate(async () =>
    (await (await caches.open('parishlife-public-v3')).keys()).map(r => new URL(r.url).pathname)
  );
  expect(kept.filter(path => path.startsWith('/api/auth') || path.startsWith('/api/me'))).toEqual([]);
  await page.context().setOffline(false);
});
