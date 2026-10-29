/* ParishLife on a phone without a connection: the public pages, and the parishes, Mass times and
   events they last showed, stay readable. Every request still goes to the network first, so
   nothing is served from this copy while the phone is online. The members portal and private
   links (request tracking, documents) and signature checks are never kept. */
const CACHE = 'parishlife-public-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/public.html')).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

const kept = url => url.pathname === '/' || url.pathname === '/public.html' || url.pathname === '/site.webmanifest'
  || (url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/assets/views/'))
  || (url.pathname.startsWith('/api/public/') && !url.pathname.startsWith('/api/public/track/') && !url.pathname.startsWith('/api/public/guest-files/') && !url.pathname.startsWith('/api/public/verify/'));

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !kept(url)) return;
  const page = request.mode === 'navigate';
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(request)) || (page ? await caches.match('/public.html') : Response.error())));
});
