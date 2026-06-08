/**
 * sw.js — Service Worker (offline cache)
 */

const CACHE = 'kids-translator-v1';
const PRECACHE = [
  './',
  './index.html',
  './css/kids.css',
  './js/translate.js',
  './js/voice.js',
  './js/camera.js',
  './js/wordbook.js',
  './js/app.js',
  './data/words_zh_en.json',
  './manifest.json',
  './icons/icon-192.svg',
];

// Install: pre-cache core files
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for local assets, network-first for API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Translation API — network only
  if (url.hostname.includes('libretranslate')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Local assets — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
