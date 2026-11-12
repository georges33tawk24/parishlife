/* Purpose: checks the public site's reads and writes against an in-memory stand-in for ParishLife.Api:
   near me, the homepage's published content, the liturgical calendar, the app information and the
   check of a signed document, plus the service worker's rule for which API reads it may keep.
   Main parts: a mock of /api/public/*, assertions on what api-data.js sends and shapes, and the
   service worker run in a sandbox with a fake cache. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { mockApi, json } from '../mock-api.mjs';

const today = new Date(),
  iso = n => {
    const d = new Date(today.getTime() + n * 86400000);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  };
let homepageLive = true,
  calendarFor = new Set(['B']), // parishes whose authority has approved a calendar
  manifestConfigured = false;
const requested = [];

const day = (date, title, extra = {}) => ({
  date,
  title,
  language: 'en',
  rank: null,
  season: null,
  displayColor: null,
  rite: 'Maronite',
  source: 'Patriarchal calendar',
  calendarVersion: '2026.1',
  calendarId: 'cal1',
  parishException: false,
  ...extra
});

const { sent } = mockApi((method, path, body) => {
  requested.push(`${method} ${path}`);
  if (path === 'public/parishes/nearby' && method === 'POST') {
    assert.equal(typeof body.latitude, 'number');
    assert.equal(typeof body.longitude, 'number');
    return json(200, {
      items: [
        { parishId: 'B', name: 'Saint B', locality: 'Jounieh', distanceKm: 2.4, links: {} },
        { parishId: 'A', name: 'Saint A', locality: 'Hadath', distanceKm: 11.9, links: {} }
      ],
      distanceUnavailable: [{ parishId: 'C', name: 'Saint C', locality: 'Zahle', distanceKm: null, links: {} }],
      outsideRadius: 0,
      distanceApproximate: true,
      total: 3
    });
  }
  const home = path.match(/^public\/homepage\?lang=(en|ar)$/);
  if (home) {
    if (!homepageLive) return json(404, { status: 404, title: 'resource_not_found', detail: 'unavailable' });
    const ar = home[1] === 'ar';
    const block = (section, id, title, body, extra = {}) => ({
      section,
      id,
      language: ar ? 'ar' : 'en',
      title,
      body,
      linkLabel: null,
      linkUrl: null,
      ...extra
    });
    return json(200, {
      language: home[1],
      publishedAt: '2026-11-01T00:00:00Z',
      blocks: [
        block('hero', 'hero', ar ? 'عنوان' : 'Headline', ar ? 'نص' : 'Lede'),
        block('announcement', 'announcement', ar ? 'إعلان' : 'Notice', ar ? 'تفاصيل' : 'Details', {
          linkLabel: ar ? 'اقرأ' : 'Read',
          linkUrl: '/public.html#directory'
        }),
        block('stories', 'pilgrimage', ar ? 'حج' : 'Pilgrimage', ar ? 'قصة' : 'A story', {
          linkUrl: 'https://example.org/p',
          linkLabel: ar ? 'المزيد' : 'More'
        }),
        // the Arabic request is served the English text for this story: no Arabic text was published
        block('stories', 'feast', 'Feast day', 'Come along', { language: 'en' }),
        block('about', 'about', ar ? 'عنّا' : 'About us', ar ? 'نبذة' : 'Who we are')
      ]
    });
  }
  const liturgy = path.match(/^public\/parishes\/(\w+)\/liturgical-calendar\?from=([\d-]+)&to=([\d-]+)&lang=(en|ar)$/);
  if (liturgy) {
    const [, id, from, to, lang] = liturgy,
      ar = lang === 'ar';
    if (!calendarFor.has(id)) return json(200, { parishId: id, from, to, status: 'NotPublished', days: [] });
    return json(200, {
      parishId: id,
      from,
      to,
      status: 'Published',
      days: [
        day(iso(0), ar ? 'اليوم' : 'Today feast', { language: lang, season: 'Season of the Cross', rank: 'Feast' }),
        day(iso(1), ar ? 'عيد الرعية' : 'Parish patron', { language: lang, parishException: true }),
        // a title that exists in English only, whichever language was asked
        day(iso(2), 'English only')
      ]
    });
  }
  if (path === 'public/parishes' && method === 'GET')
    return json(200, {
      items: ['A', 'B', 'C'].map(id => ({ parishId: id, name: 'Saint ' + id, locality: id, dioceseName: 'D' })),
      distanceUnavailable: [],
      total: 3
    });
  if (path === 'public/app/manifest')
    return manifestConfigured ? json(200, { name: 'ParishLife', short_name: 'PL', theme_color: '#0E1A31' }) : undefined;
  if (path === 'public/app/offline-policy')
    return json(200, {
      cacheableReads: [
        { method: 'GET', template: '/api/public/parishes', maxAgeSeconds: 60 },
        { method: 'GET', template: '/api/public/parishes/{parishId:guid}/website', maxAgeSeconds: 60 },
        { method: 'GET', template: '/api/public/homepage', maxAgeSeconds: 60 }
      ],
      defaultPolicy: 'no-store',
      offlineWrites: 'NotSupported',
      rules: []
    });
  const verify = path.match(/^public\/document-verifications\/(.+)$/);
  if (verify) {
    if (decodeURIComponent(verify[1]).replace(/[- ]/g, '').length !== 32)
      return json(404, {
        status: 404,
        title: 'resource_not_found',
        detail: 'No authorized document matches this code.'
      });
    return json(200, {
      code: 'A'.repeat(32),
      status: 'Valid',
      statusMeaning: 'This exact document version was electronically authorized.',
      documentType: 'Certificate',
      documentDetail: 'Baptism',
      reference: 'BAP-1',
      documentVersion: 2,
      issuingParish: 'Saint A',
      authorizedBy: 'Fr. Test, Pastor',
      authorizedAt: '2026-10-01T09:00:00Z',
      electronicSignatureRecognized: false,
      officialStatement: 'Reference only: the official document is the paper issued by the parish.',
      checkedAt: '2026-11-11T09:00:00Z'
    });
  }
  return undefined;
});

const A = await import('../../src/public/api-data.js');

// near me: the visitor's point goes in the body, never the address; located parishes get a distance
const km = await A.nearbyParishes([33.8, 35.5]);
assert.deepEqual(km, { B: 2.4, A: 11.9 }, 'parishes with no recorded location have no distance');
const [method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST public/parishes/nearby');
assert.deepEqual(body, { latitude: 33.8, longitude: 35.5 });
assert.ok(!requested.some(r => r.includes('33.8')), 'coordinates are not in any address');

// homepage content: hero, announcement, stories, about; each text under the language it was served in
const site = await A.loadHomepage();
assert.deepEqual(site.hero, { title: { en: 'Headline', ar: 'عنوان' }, subtitle: { en: 'Lede', ar: 'نص' } });
assert.deepEqual(site.announcement, {
  link: '/public.html#directory',
  text: { en: 'Notice', ar: 'إعلان' },
  detail: { en: 'Details', ar: 'تفاصيل' },
  linkLabel: { en: 'Read', ar: 'اقرأ' }
});
assert.deepEqual(
  site.stories.map(s => [s.id, s.title, s.link]),
  [
    ['pilgrimage', { en: 'Pilgrimage', ar: 'حج' }, 'https://example.org/p'],
    ['feast', { en: 'Feast day', ar: '' }, '']
  ],
  'a story with no Arabic text leaves the Arabic empty'
);
assert.deepEqual(site.about, { title: { en: 'About us', ar: 'عنّا' }, body: { en: 'Who we are', ar: 'نبذة' } });
assert.equal(site.join, undefined, 'a section the editor left out stays out, and the page hides it');
homepageLive = false;
assert.equal(await A.loadHomepage(), null, 'nothing published: the built-in wording stays');
homepageLive = true;

// liturgical calendar on the homepage: the first parish with an approved calendar; no parish exceptions
const directory = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
const home = await A.loadHomeLiturgy(directory);
assert.equal(home.published, true);
const fromB = requested.filter(r => r.includes('parishes/B/liturgical-calendar'));
assert.equal(fromB.length, 2, 'English to find it, Arabic for the same parish');
assert.equal(
  requested.filter(r => r.includes('parishes/A/liturgical-calendar')).length,
  1,
  'A was tried first, in English'
);
assert.deepEqual([A.observanceOn(home, iso(0)).en, A.observanceOn(home, iso(0)).ar], ['Today feast', 'اليوم']);
assert.equal(A.observanceOn(home, iso(1)), null, "a parish's own exception is not a feast for every visitor");
assert.deepEqual(
  [A.observanceOn(home, iso(2)).en, A.observanceOn(home, iso(2)).ar],
  ['English only', 'English only'],
  'a title served in one language is shown in the other as it is, not translated'
);
assert.deepEqual(A.seasonOn(home, iso(0)), { text: 'Season of the Cross', rite: 'Maronite' });
assert.equal(A.seasonOn(home, iso(2)), null, 'a season is only what the calendar attaches to that day');
calendarFor = new Set();
const none = await A.loadHomeLiturgy(directory);
assert.deepEqual(none, { published: false, byDate: {} }, 'NotPublished shows no observances');
assert.equal(A.observanceOn(none, iso(0)), null);

// a parish's own page keeps its exceptions
calendarFor = new Set(['A']);
const parish = await A.loadParish({ id: 'A', name: 'Saint A', town: 'A' });
assert.equal(A.observanceOn(parish.liturgy, iso(1)).en, 'Parish patron');
const listing = await A.loadDirectory();
assert.equal(listing.details.get('A').liturgy.published, false, 'the homepage does not load every parish calendar');

// app information: the manifest only when the deployment has one
let info = await A.loadAppInfo();
assert.equal(info.manifest, null);
assert.equal(info.policy.defaultPolicy, 'no-store');
manifestConfigured = true;
info = await A.loadAppInfo();
assert.equal(info.manifest.short_name, 'PL');

// document verification: the API's status and statements, nothing about signatures or content
const verified = await A.verifyDocument(' ' + 'A'.repeat(8) + '-' + 'A'.repeat(24) + ' ');
assert.equal(verified.status, 'Valid');
assert.ok(requested.some(r => r === 'GET public/document-verifications/' + 'A'.repeat(8) + '-' + 'A'.repeat(24)));
assert.deepEqual(
  A.verdictOf(verified),
  { tone: 'note', key: 'ReferenceOnly' },
  'valid but not an official arrangement'
);
assert.deepEqual(A.verdictOf({ ...verified, electronicSignatureRecognized: true }), { tone: 'good', key: 'Valid' });
assert.deepEqual(A.verdictOf({ status: 'NotYetIssued' }), { tone: 'note', key: 'NotYetIssued' });
for (const status of ['Superseded', 'Withdrawn', 'Revoked', 'IntegrityCheckFailed', 'Invalidated'])
  assert.equal(A.verdictOf({ status, electronicSignatureRecognized: true }).tone, 'critical', status);
await assert.rejects(A.verifyDocument('nope'), { status: 404, message: 'No authorized document matches this code.' });

// the service worker keeps only the reads the API's offline policy lists
const stored = new Map();
const handlers = {};
const sandbox = {
  URL,
  Response,
  Request,
  self: {
    addEventListener: (type, fn) => (handlers[type] = fn),
    location: { origin: 'https://site.test' },
    skipWaiting() {},
    clients: { claim() {} }
  },
  caches: {
    open: async () => ({
      put: async (key, value) => stored.set(typeof key === 'string' ? key : new URL(key.url).pathname, value),
      match: async key => stored.get(typeof key === 'string' ? key : new URL(key.url).pathname),
      add: async () => {}
    }),
    match: async key => stored.get(typeof key === 'string' ? key : new URL(key.url).pathname),
    keys: async () => []
  },
  fetch: async url => {
    const pathname = new URL(String(url.url || url), 'https://site.test').pathname;
    if (pathname === '/api/public/app/offline-policy')
      return new Response(
        JSON.stringify({
          cacheableReads: [
            { method: 'GET', template: '/api/public/parishes/{parishId:guid}/website' },
            { method: 'GET', template: '/api/public/parishes' }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
/* a same-origin response, as the browser reports it */
const answer = sandbox.fetch;
sandbox.fetch = async url => {
  const response = await answer(url);
  Object.defineProperty(response, 'type', { value: 'basic' });
  return response;
};
sandbox.global = sandbox;
vm.runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), sandbox);
const visit = async pathname => {
  const request = Object.assign(new Request('https://site.test' + pathname), {}),
    waits = [];
  let responded;
  handlers.fetch({ request, respondWith: p => (responded = p), waitUntil: p => waits.push(p) });
  if (responded) await responded;
  await Promise.all(waits);
  return !!responded;
};
await visit('/api/public/parishes');
await visit('/api/public/parishes/11111111-1111-1111-1111-111111111111/website');
await visit('/api/public/document-verifications/' + 'A'.repeat(32));
await visit('/api/public/parishes/11111111-1111-1111-1111-111111111111/ministries');
assert.ok(stored.has('/api/public/parishes'), 'a listed read is kept');
assert.ok(stored.has('/api/public/parishes/11111111-1111-1111-1111-111111111111/website'));
assert.ok(!stored.has('/api/public/document-verifications/' + 'A'.repeat(32)), 'a document check is never kept');
assert.ok(
  !stored.has('/api/public/parishes/11111111-1111-1111-1111-111111111111/ministries'),
  'a read the policy does not list is not kept'
);

console.log('public: all assertions passed');
