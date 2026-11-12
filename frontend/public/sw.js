/* ParishLife on a phone without a connection: the public pages, and the parishes, Mass times and
   events they last showed, stay readable. Every request still goes to the network first, so
   nothing is served from this copy while the phone is online. The members portal, private links
   (request tracking, documents) and document checks are never kept. */
const CACHE = 'parishlife-public-v2';

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

const kept = url => url.pathname === '/' || url.pathname === '/public.html' || url.pathname === '/site.webmanifest'
  || (url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/assets/app/portal-'));

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
  if (url.pathname.startsWith('/api/') || !kept(url)) return;
  event.respondWith(load(event, request, request.mode === 'navigate'));
});
