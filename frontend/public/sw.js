/* ParishLife on a phone without a connection: the public pages, and the parishes, Mass times and
   events they last showed, stay readable. Every request still goes to the network first, so
   nothing is served from this copy while the phone is online. Private links (request tracking,
   documents), document checks and every API answer that is not on the API's public list are never
   kept, so no personal data is stored here. The members portal's page is not kept either: opened
   offline, it gets a short bilingual page saying so instead of a browser error. */
const CACHE = 'parishlife-public-v3';
const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ParishLife · Offline</title><style>body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;background:#F5F1E8;color:#15203A;font:400 17px/1.6 system-ui,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:34rem}h1,h2{font:400 30px/1.25 Georgia,serif;margin:0 0 12px}p{margin:0 0 12px;color:#4A5468}a{color:#213C80;font-weight:600}</style></head>
<body><main><h1>You are offline</h1><p>ParishLife needs a connection to sign you in and to show your parish's records. Nothing you saved is lost.</p>
<p>Check your connection, then <a href="">reload this page</a>. The parish directory you last opened is still readable at <a href="/public.html">public.html</a>.</p>
<section lang="ar" dir="rtl"><h2>أنت غير متّصل</h2><p>يحتاج ParishLife إلى اتصال ليُدخلك ويعرض سجلات رعيتك. لم يضِع شيء ممّا حفظته.</p>
<p>تحقّق من اتصالك ثم <a href="">أعد تحميل هذه الصفحة</a>. ويبقى دليل الرعايا الذي فتحته آخر مرة متاحاً على <a href="/public.html">public.html</a>.</p></section></main></body></html>`;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/public.html')).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

/* Which API reads may be kept is the API's own list (GET /api/public/app/offline-policy: its cacheable
   anonymous reads, as route templates). Every other API response, such as a document check, a nearby
   search or anything signed in, is never stored. Without the list, no API response is kept. */
const POLICY = '/api/public/app/offline-policy';
let routes = null;
const compile = policy =>
  (policy.cacheableReads || [])
    .filter(route => route.method === 'GET' && typeof route.template === 'string')
    .map(route => new RegExp('^' + route.template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]*\}/g, '[^/]+') + '/?$'));
async function readableRoutes() {
  if (routes) return routes;
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(POLICY);
    if (response.ok) {
      await cache.put(POLICY, response.clone());
      return (routes = compile(await response.json()));
    }
  } catch {
    /* offline: the list kept last time */
  }
  const last = await cache.match(POLICY);
  return last ? (routes = compile(await last.json())) : [];
}

const kept = url => url.pathname === '/public.html' || url.pathname === '/site.webmanifest'
  || (url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/assets/app/portal-'));
const portalPage = url => url.pathname === '/' || url.pathname === '/index.html';

async function load(event, request, page) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  } catch {
    return (await caches.match(request)) || (page ? await caches.match('/public.html') : Response.error());
  }
}

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/public/')) {
    if (url.pathname === POLICY) return;
    event.respondWith((async () => {
      if ((await readableRoutes()).some(route => route.test(url.pathname))) return load(event, request, false);
      return fetch(request);
    })());
    return;
  }
  if (request.mode === 'navigate' && portalPage(url)) {
    // past the browser's own cache too: an old copy of the page whose scripts cannot load would draw a blank screen
    event.respondWith(fetch(request.url, { cache: 'no-store', credentials: 'same-origin' })
      .catch(() => new Response(OFFLINE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    return;
  }
  if (url.pathname.startsWith('/api/') || !kept(url)) return;
  event.respondWith(load(event, request, request.mode === 'navigate'));
});
