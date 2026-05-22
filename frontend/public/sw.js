// Enterprise-grade service worker
// Responsibilities:
// - Versioned cache names using build-time placeholder
// - Precache minimal shell + offline fallback
// - Network-first for fingerprinted static assets (/_next/static/, .js, .css)
// - Stale-while-revalidate for navigation pages
// - Cache-first for images (with maximum entries)
// - Message handling for SKIP_WAITING and CLIENTS_CLAIM

// BUILD_ID can be injected at build time; fallback to a static value if not provided
const BUILD_ID = (self && self.__BUILD_ID) ? self.__BUILD_ID : 'fa17e3b9'; // injected at build-time; keep in sync with git sha
const CACHE_PREFIX = 'yotop10';
const CACHE_NAME = `${CACHE_PREFIX}-${BUILD_ID}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${BUILD_ID}`;

const PRECACHE_URLS = [
  '/offline.html',
  '/',
];

// Max entries for image cache
const IMAGE_CACHE_MAX_ENTRIES = 100;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate new SW as soon as it's finished installing
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Utility helpers
async function cachePut(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (e) {
    // ignore cache write errors
  }
}

async function cacheMatch(request) {
  return caches.match(request);
}

// Simple LRU-like trimming for image cache
async function trimImageCache() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();
    if (requests.length <= IMAGE_CACHE_MAX_ENTRIES) return;
    const overflow = requests.length - IMAGE_CACHE_MAX_ENTRIES;
    for (let i = 0; i < overflow; i++) {
      await cache.delete(requests[i]);
    }
  } catch (e) {
    // ignore
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Put in runtime cache for faster subsequent loads
    cachePut(RUNTIME_CACHE, request, response);
    return response;
  } catch (e) {
    const cached = await cacheMatch(request);
    if (cached) return cached;
    // For navigation, return offline fallback
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/offline.html');
      return fallback || new Response('Offline', { status: 503 });
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await cacheMatch(request);
  const networkPromise = fetch(request)
    .then((response) => {
      cachePut(RUNTIME_CACHE, request, response);
      return response;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response('Offline', { status: 503 });
}

async function cacheFirst(request) {
  const cached = await cacheMatch(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    cachePut(RUNTIME_CACHE, request, response);
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

// Fetch handler: choose strategy by request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Do not handle chrome-extension requests
  if (url.protocol.startsWith('chrome-extension')) return;

  // API: network-first but with fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fingerprinted static assets served from /_next/static should be network-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Images: cache-first with trimming
  if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|avif|svg)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const resp = await cacheFirst(request);
        // Trim image cache in background
        event.waitUntil(trimImageCache());
        return resp;
      })()
    );
    return;
  }

  // Navigation pages: stale-while-revalidate so users get a fast response and we update in background
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Fallback to cache-first for everything else
  event.respondWith(cacheFirst(request));
});

// Listen for messages from the page (e.g. SKIP_WAITING)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Inform clients when a new version is available (optional)
async function broadcastMessage(message) {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clientsList) {
    client.postMessage(message);
  }
}

// Immediately notify clients on activation that a new version exists
self.addEventListener('activate', () => {
  broadcastMessage({ type: 'NEW_VERSION_AVAILABLE', buildId: BUILD_ID });
});
