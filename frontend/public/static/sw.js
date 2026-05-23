// Enterprise-grade service worker
// Responsibilities:
// - Versioned cache names using build-time placeholder
// - Precache minimal shell + offline fallback
// - Network-first for fingerprinted static assets (/_next/static/, .js, .css)
// - Stale-while-revalidate for navigation pages
// - Cache-first for images (with maximum entries)
// - Message handling for SKIP_WAITING and CLIENTS_CLAIM

// BUILD_ID will be read from public/__build_info.json if available, otherwise fallback.
const CACHE_PREFIX = 'yotop10';
let BUILD_ID = '73658118-2026-05-23T13-56-39-618Z';
let CACHE_NAME = `${CACHE_PREFIX}-${BUILD_ID}`;
let RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${BUILD_ID}`;

const DEFAULT_PRECACHE = ['/static/offline.html', '/'];
let PRECACHE_URLS = [...DEFAULT_PRECACHE];

// Helper to initialize BUILD_ID and PRECACHE_URLS based on sw-manifest.json / __build_info.json
async function initBuildInfo() {
  try {
    const res = await fetch('/__build_info.json', { cache: 'no-store' });
    if (res.ok) {
      const info = await res.json();
      if (info && info.buildId) BUILD_ID = info.buildId;
    }
  } catch (e) {
    // ignore
  }

  CACHE_NAME = `${CACHE_PREFIX}-${BUILD_ID}`;
  RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${BUILD_ID}`;

  try {
    const mres = await fetch('/sw-manifest.json', { cache: 'no-store' });
    if (mres.ok) {
      const manifest = await mres.json();
      if (manifest && manifest.groups) {
        PRECACHE_URLS = Array.from(new Set([...(manifest.groups.precache || []), ...DEFAULT_PRECACHE]));
      }
    }
  } catch (e) {
    // ignore
  }
}

// Max entries for image cache
const IMAGE_CACHE_MAX_ENTRIES = 100;

self.addEventListener('install', (event) => {
  // During install we fetch build info and manifest, then precache known assets
  event.waitUntil(
    (async () => {
      await initBuildInfo();
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (e) {
        // best-effort precache
      }
    })()
  );
  // Activate new SW as soon as it's finished installing
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await initBuildInfo();
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );

      // Broadcast new version to clients only if build id changed
      try {
        const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of clientsList) {
          client.postMessage({ type: 'NEW_VERSION_AVAILABLE', buildId: BUILD_ID });
        }
      } catch (e) {
        // ignore
      }
    })()
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
  // networkFirst with fallback to cache; used for static fingerprinted assets and API GETs
  const TIMEOUT_MS = 3000; // network timeout; enterprise deployments may tune this
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(id);
    if (response && response.ok) {
      cachePut(RUNTIME_CACHE, request, response);
      return response;
    }
  } catch (e) {
    // fallthrough to cache
  }

  const cached = await cacheMatch(request);
  if (cached) return cached;
  // For navigation, return offline fallback
  if (request.mode === 'navigate') {
    const fallback = await caches.match('/offline.html');
    return fallback || new Response('Offline', { status: 503 });
  }
  return new Response('Offline', { status: 503 });
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
    // For GET: networkFirst
    if (request.method === 'GET') {
      event.respondWith(networkFirst(request));
      return;
    }

    // For POST/PUT/DELETE: attempt network, but if offline enqueue into outbox for background sync
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      event.respondWith(
        (async () => {
          try {
            const resp = await fetch(request.clone());
            return resp;
          } catch (e) {
            // enqueue the request
            try {
              const body = await request.clone().text();
              await enqueueRequest({ url: request.url, request: { method: request.method, headers: Array.from(request.headers.entries()), body } });
              // register for background sync if available
              const allClients = await self.clients.matchAll();
              if ('sync' in self.registration) {
                try {
                  await self.registration.sync.register('outbox-sync-' + BUILD_ID);
                } catch (e) {
                  // sync registration failed
                }
              }
            } catch (ee) {
              // enqueue failure
            }
            return new Response(JSON.stringify({ queued: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
          }
        })()
      );
      return;
    }

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
  if (data.type === 'REPLAY_QUEUE') {
    event.waitUntil(replayQueue());
  }
});

// -------------------
// Outbound queue (IndexedDB) for POSTs: basic implementation
// -------------------
const DB_NAME = 'yotop10-sw-queue';
const STORE_NAME = 'outbox';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueRequest(entry) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllQueued() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function clearQueued(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Attempt to replay queued requests; called on sync or when network is back
async function replayQueue() {
  const items = await getAllQueued();
  for (const it of items) {
    try {
      const req = new Request(it.url, it.request);
      const resp = await fetch(req);
      if (resp && resp.ok) {
        await clearQueued(it.id);
      }
    } catch (e) {
      // keep it in queue
    }
  }
}

// Sync handler
self.addEventListener('sync', (event) => {
  if (event.tag && event.tag.startsWith('outbox-sync')) {
    event.waitUntil(replayQueue());
  }
});

// Listen to online event from clients (best-effort) by pinging replayQueue periodically
setInterval(() => {
  if (self.navigator && self.navigator.onLine) {
    replayQueue();
  }
}, 30 * 1000);


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
