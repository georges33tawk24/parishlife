/* Purpose: the smoke test to run after every deploy (Agent 09 item 2): about 35 read-only GET requests that fail loudly when a key
   page, script, endpoint or protection is down or erroring. No browser, no sign-in, no form post, nothing written.
   Target: SMOKE_URL (for example https://parish-life.org after a deploy; the certificate must then be valid), otherwise the local
   test host of `npm run e2e`.
   Run after a deploy: cd frontend && SMOKE_URL=https://parish-life.org npx playwright test e2e/smoke.spec.mjs --reporter=list
   Main checks: the sign-in, sign-up, public, product and legal pages answer 200 under the page policy and every script and style
   they name loads; liveness and readiness; the public API reads; protected API reads refuse anonymous callers (401, not an
   error); robots and sitemap; unknown addresses 404; the OpenAPI document is not public; no stack trace in an error answer. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const remote = process.env.SMOKE_URL?.replace(/\/$/, '');
const base = remote || JSON.parse(readFileSync(process.env.E2E_MANIFEST, 'utf8')).baseUrl;
test.use({ ignoreHTTPSErrors: !remote }); // the local test host's certificate is self-made; a deployed one must be valid

const PAGES = [
  '/',
  '/index.html?signup',
  '/public.html',
  '/landing.html',
  '/privacy.html',
  '/terms.html',
  '/cookies.html'
];

test('pages load under the page policy with all their scripts and styles', async ({ request }) => {
  const assets = new Set();
  for (const path of PAGES) {
    const response = await request.get(base + path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('text/html');
    expect(response.headers()['content-security-policy'], path).toContain("default-src 'self'");
    expect(response.headers()['x-content-type-options'], path).toBe('nosniff');
    if (remote) expect(response.headers()['strict-transport-security'], path).toContain('max-age=31536000');
    for (const [, asset] of (await response.text()).matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g))
      assets.add(asset);
  }
  expect(assets.size).toBeGreaterThan(2);
  for (const asset of assets) expect((await request.get(base + asset)).status(), asset).toBe(200);
});

test('health, public API reads and the anonymous refusal of protected reads', async ({ request }) => {
  expect((await (await request.get(base + '/health/live')).json()).status).toBe('Alive');
  expect((await request.get(base + '/health/ready')).status(), 'readiness (storage, blob, key vault)').toBe(200);
  const csrf = await request.get(base + '/api/auth/csrf');
  expect(csrf.status()).toBe(200);
  expect((await csrf.json()).token).toBeTruthy();
  for (const path of [
    '/api/auth/capabilities',
    '/api/public/parishes',
    '/api/plans',
    '/api/public/app/offline-policy'
  ]) {
    const response = await request.get(base + path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('json');
  }
  for (const path of ['/api/auth/me', '/api/me/home', '/api/me/parishes', '/api/administration/accounts']) {
    const response = await request.get(base + path);
    expect(response.status(), path).toBe(401);
    expect(response.headers()['cache-control'], path).toContain('no-store');
  }
});

test('search files, unknown addresses and what must stay private', async ({ request }) => {
  const robots = await request.get(base + '/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Disallow: /api/');
  const sitemap = await request.get(base + '/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain('<urlset');
  for (const path of [
    '/no-such-page',
    '/public.html?parish=00000000-0000-4000-8000-000000000000',
    '/.env',
    '/appsettings.json'
  ]) {
    const response = await request.get(base + path);
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).not.toMatch(/at ParishLife\.|Exception|StackTrace/);
  }
  expect([401, 404], 'OpenAPI document').toContain((await request.get(base + '/openapi/v1.json')).status());
});
