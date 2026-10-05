// ROKTOK — Service Worker: offline app shell, smart API caching, media caching
// Bump VERSION whenever shell files change.
const VERSION = 'roktok-v1';
const SHELL = [
  '/',
  '/app.css',
  '/app.js',
  '/views-create.js',
  '/views-final.js',
  '/views-project.js',
  '/views-tools.js',
  '/renderer.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];
// GET API responses worth keeping for offline browsing
const API_CACHE = /^\/api\/(state|projects|providers)(\/|$)/;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(SHELL))
      .catch(() => undefined) // never block install on a single asset
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k.startsWith('roktok-')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // never intercept writes
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // external: pass through

  // 1) App navigations: network first, offline → cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/', copy)); return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 2) Lightweight API reads: network first, cache fallback for offline browsing
  if (url.pathname.startsWith('/api/')) {
    if (API_CACHE.test(url.pathname)) {
      event.respondWith(
        fetch(req)
          .then(res => {
            if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
            return res;
          })
          .catch(() => caches.match(req).then(r => r || new Response(
            JSON.stringify({ error: 'You are offline — showing cached data where possible.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } })))
      );
    }
    return; // all other API calls: pure network (never serve stale jobs/settings)
  }

  // 3) Generated media & uploads: cache first (files are content-named)
  if (url.pathname.startsWith('/files/')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // 4) Static shell assets: stale-while-revalidate (fast + always updating)
  event.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
