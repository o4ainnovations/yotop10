# YoTop10 PWA — Enterprise Specification

> **Version**: 1.0.0 — Draft
> **Scope**: Full PWA transformation of YoTop10 into a reliable, offline-capable,
> native-feeling installed app for iOS and Android, with desktop PWA support.
> **Status**: Planning — NOT YET IMPLEMENTED

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Service Worker Strategy](#2-service-worker-strategy)
3. [App Shell & Offline Behavior](#3-app-shell--offline-behavior)
4. [Installation & Lifecycle](#4-installation--lifecycle)
5. [Navigation & Deep Linking](#5-navigation--deep-linking)
6. [Push Notifications](#6-push-notifications)
7. [Background Sync](#7-background-sync)
8. [Security & Headers](#8-security--headers)
9. [Performance Budgets](#9-performance-budgets)
10. [OS Integrations](#10-os-integrations)
11. [Update Strategy](#11-update-strategy)
12. [Testing & QA](#12-testing--qa)
13. [Implementation Order](#13-implementation-order)

---

## 1. Architecture Overview

### 1.1 App Shell Pattern

The PWA MUST use an **app shell architecture**:

```
[ Shell: header + nav + footer ]
[ Content: page-specific body      ]
```

- **Shell** is cached on first load and served instantly offline
- **Content** is fetched dynamically, with cache fallbacks
- Shell NEVER changes without a version bump (immutable)
- Shell size MUST be < 50 KB gzipped (HTML + CSS + critical JS)

### 1.2 Component Tree (Visual Hierarchy)

```
┌──────────────────────────────────────────────┐
│  DeskTopBar (desktop) / DynamicIsland (mob)  │  ← Shell (cached)
├──────────────────────────────────────────────┤
│  SlideMenu (slide-out navigation)            │  ← Shell (cached)
├──────────────────────────────────────────────┤
│  Main Content Area (page-specific)           │  ← Dynamic
├──────────────────────────────────────────────┤
│  Toast / ErrorAlert overlays                 │  ← Shell (cached)
└──────────────────────────────────────────────┘
```

### 1.3 Data Flow (Render-as-You-Fetch)

```
Service Worker → Cache Storage
      ↓
App Shell (instant, from cache)
      ↓
Page Load → React hydrates → API fetch → render content
      ↓                        ↓
  Show skeleton            Show content or error
      ↓                        ↓
  If fetch fails → Show cached fallback or retry
```

- The app MUST render immediately from cache before any network request
- Skeletons MUST be part of the shell (not dynamic content)
- Errors MUST NOT show 404 for transient failures

---

## 2. Service Worker Strategy

### 2.1 Registration & Lifecycle

```typescript
// sw.ts — Compiled via workbox-webpack-plugin
// Registered at `/sw.js`
```

- SW MUST NOT be registered if already running (navigator.serviceWorker.controller check)
- SW MUST be registered on first user interaction (click, scroll), not on page load
- SW scope MUST be `/` (entire app)
- SW MUST use `skipWaiting()` on install + `clients.claim()` on activate
- SW MUST have a version constant (`SW_VERSION`) bumped on every deploy
- SW MUST NOT have `eval()` or `new Function()` (CSP compliance)

### 2.2 Cache Names

| Cache Name | Strategy | Contents | Max Size | TTL |
|---|---|---|---|---|
| `yotop10-shell-v{N}` | Install-time precache | App shell assets (CSS, fonts, critical JS) | 500 KB | Immutable |
| `yotop10-static-v{N}` | Stale-while-revalidate | Next.js static chunks (`_next/static/*`) | 50 MB | Immutable |
| `yotop10-pages-v{N}` | Network-first | HTML pages (SSR responses) | 20 MB | 24 hours |
| `yotop10-api-v{N}` | Network-first | API responses (GET only) | 10 MB | 1 hour |
| `yotop10-images-v{N}` | Cache-first | User uploads, icons | 100 MB | 30 days |
| `yotop10-fonts-v{N}` | Cache-first | Google Fonts, custom fonts | 2 MB | Immutable |

All cache names MUST include a version number incremented on deploy. Old caches MUST be deleted during `activate`.

### 2.3 Fetch Event Handler

```typescript
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin (or known CDN)
  if (!isSameOrigin(url) && !isAllowedCDN(url)) return;

  // Route to appropriate strategy
  if (isAppShell(request))        return shellStrategy(event);
  if (isStaticAsset(request))     return staleWhileRevalidate(event);
  if (isPageNavigation(request))  return networkFirst(event, { cacheName: 'yotop10-pages-v1', ttl: 86400 });
  if (isApiGetRequest(request))   return networkFirst(event, { cacheName: 'yotop10-api-v1', ttl: 3600 });
  if (isImageRequest(request))    return cacheFirst(event, { cacheName: 'yotop10-images-v1', ttl: 2592000 });
  if (isFontRequest(request))     return cacheFirst(event, { cacheName: 'yotop10-fonts-v1', ttl: Infinity });

  // Default: network-only
  return fetch(event.request);
});
```

**Routing order is priority-sensitive**: shell → static → API reads → images → everything else.

### 2.4 Network-First with Timeout (API)

```
1. Try network with 5 second timeout
2. If succeeds → cache response → return to page
3. If fails (timeout/offline) → serve from cache
4. If no cache → return offline fallback JSON
```

```typescript
async function networkFirst(event, { cacheName, ttl }) {
  const cached = await caches.match(event.request);
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
  try {
    const response = await Promise.race([fetch(event.request.clone()), timeout]);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(event.request, response.clone());
      return response;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch {
    return cached || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}
```

### 2.5 Cache Eviction

- Old caches from previous SW versions MUST be deleted in `activate` event
- Individual cache entries MUST have TTL checks during fetch:
  - Compare `Date.now()` against a custom header (`x-sw-cached-at`)
  - If expired → fetch from network, update cache on success
  - If network fails and cache expired → show stale data with "offline" indicator

### 2.6 Error Responses from SW

When offline and no cache is available:

| Route Type | Fallback |
|---|---|
| Page navigation (`text/html`) | Serve app shell with inline "You are offline" banner |
| API GET (`application/json`) | `{ error: 'offline', cached: false }` |
| Image | Single-pixel transparent SVG (inline) |
| Font | System font fallback |

---

## 3. App Shell & Offline Behavior

### 3.1 Shell Assets (Precached at Install Time)

The following MUST be precached during SW `install`:

```
/                           → Rendered HTML of shell (server-side)
/_next/static/css/*.css     → All critical CSS
/_next/static/chunks/*.js   → Framework + app JS (critical path only)
/favicon.ico
/manifest.json
/icons/*.png
/fonts/*.woff2              → If self-hosted
```

Total precache MUST NOT exceed 500 KB (gzipped).

### 3.2 Offline Landing States

| Page | Offline Behavior |
|---|---|
| Home (`/`) | Show cached post list + skeleton for missing posts. "You're offline" banner at top. |
| Post detail (`/[slug]`) | Show cached version if available. If not cached, show shell + "Content unavailable offline" + button to view cached categories feed |
| Categories (`/categories`) | Cached category tree. Static content works fully offline. |
| Category feed (`/c/...`) | Cached posts in that category. If none cached → "No cached content" with link to home. |
| Submit (`/submit`) | Show form with "Will be submitted when online" banner. Form saves to localStorage and syncs when online. |
| Search (`/search`) | Show cached recent searches. Search input disabled with "Search requires internet" message. |
| User profile (`/a/...`) | Cached profile if previously viewed. Otherwise → shell + "Not available offline" message. |
| Admin pages (`/admin/*`) | **OFFLINE NOT SUPPORTED.** Redirect to /admin/login with "Requires internet" message. Admin requires auth which requires network. |

### 3.3 Offline Banner

An offline banner MUST appear at the top of the content area when `navigator.onLine === false`:

```typescript
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOff = () => setOffline(true);
    const goOn = () => setOffline(false);
    window.addEventListener('offline', goOff);
    window.addEventListener('online', goOn);
    return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn); };
  }, []);
  if (!offline) return null;
  return <div className="offline-banner">You are offline. Some features may be limited.</div>;
}
```

- Banner MUST NOT cover navigation controls
- Banner MUST auto-dismiss when `online` event fires
- Banner MUST have a "Retry" button that re-fetches the current page

### 3.4 Skeleton Screens

Each page MUST have a CSS-only skeleton matching its layout:

| Page | Skeleton Shape |
|---|---|
| Home feed | 5 rectangular cards with animated grey gradient |
| Post detail | Title bar + 10 item rows with rank circles |
| Category feed | Same as home, with category name skeleton bar |
| Categories list | Grid of 6 rectangular cards |
| Search | Search bar skeleton + 3 result card skeletons |
| User profile | Avatar circle + info rows + tab skeletons |

Skeletons MUST be rendered in the initial HTML (server-side) and hidden when React hydrates. This prevents flash-of-loading-spinner.

---

## 4. Installation & Lifecycle

### 4.1 Install Prompt

- Listen for `beforeinstallprompt` event
- Show install prompt after user has viewed ≥3 pages OR spent ≥30 seconds on site
- Install prompt MUST NOT appear on first visit (too aggressive)
- Install prompt MUST NOT appear more than once per session (user can dismiss)
- If user dismisses → cooldown for 7 days before showing again
- If user installs → never show again
- Custom install button in SlideMenu panel (always visible)
- iOS: Show "Add to Home Screen" instructions for Safari (no beforeinstallprompt on iOS)

### 4.2 Install Prompt UI

```
┌──────────────────────────────────────┐
│ [App Icon] Install YoTop10           │
│           For a better experience    │
│                      [Install] [X]   │
└──────────────────────────────────────┘
```

- Position: Bottom sheet on mobile, bottom-right toast on desktop
- Must have clear dismiss action
- Must have clear install action
- Must explain benefit (faster, offline, notifications)

### 4.3 Post-Install UX

After successful installation:
1. Close install prompt immediately
2. No additional splash screen (native OS splash already shown)
3. Optionally show a one-time "Welcome to YoTop10 App!" toast
4. App opens to the current page (not start_url) if installed from within the app

### 4.4 App Uninstall Detection

- Check `navigator.getInstalledRelatedApps()` periodically (supporting browsers)
- If app was uninstalled → clean up IndexedDB data, reset install prompt cooldown

---

## 5. Navigation & Deep Linking

### 5.1 Client-Side Navigation in Standalone Mode

ALL navigation in PWA standalone mode MUST be client-side (no full page refreshes):

- `<Link>` components use Next.js router (already done)
- Back/forward MUST use History API (already done)
- `router.push()` calls MUST use shallow routing where possible
- Full page reloads MUST be avoided — they cause a flash in standalone mode

### 5.2 Deep Linking (URL Handling)

The PWA MUST handle deep links to every public route:

```
/                           → Home feed
/[slug]                     → Post detail
/c/[[...slug]]              → Category feed
/a/[username]               → User profile
/search                     → Search page
/arguments                  → Hot debates
/articles                   → Articles feed
/articles/[slug]            → Article detail
/hall-of-fame               → Hall of Fame
/saved                      → Saved posts (auth required)
/notifications              → User notifications (auth required)
/claim                      → Identity claim
/submit                     → New post form
/submit-article             → New article form
/username-history           → Username change log
/categories                 → Browse all categories
/explore                    → Trending posts
/notifications/[id]         → Single notification
/[slug]/history             → Post changelog
```

**In standalone mode:**
- Tapping a link from another app MUST open the PWA at that URL
- Push notification click MUST open the PWA at the relevant notification detail
- Universal links (iOS) / App Links (Android) MUST be configured
- Fallback: If the PWA is not installed, deep links open in the browser

### 5.3 Back Button Behavior (Standalone)

- Back button in standalone mode MUST use `window.history.back()` — never window.history.go(-2)
- If no history → go to home feed `/`
- On Android, the system back button (not visible) MUST do the same
- Swipe-to-go-back (iOS) MUST also navigate history

### 5.4 External Links

- Links to other domains MUST open in the system browser (`target="_blank"` + `rel="noopener noreferrer"`)
- Links MUST NOT open inside the PWA window (causes navigation away from app)
- Mailto/telephone links MUST open native handlers

---

## 6. Push Notifications

### 6.1 Service Worker Push Handler

```typescript
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  const options: NotificationOptions = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.tag || 'default',
    data: { url: data.url },       // Deep link URL for click handler
    vibrate: [200, 100, 200],
    requireInteraction: true,       // Keep notification until user interacts
    actions: data.actions || [],
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
```

### 6.2 Notification Click Handler

```typescript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
```

### 6.3 Notification Types

| Type | Trigger | Title | Body | URL | Priority |
|---|---|---|---|---|---|
| Post Approved | Admin approves post | "Post Approved!" | "Your list '${title}' is live" | `/${slug}` | High |
| Post Rejected | Admin rejects post | "Post Not Approved" | "'${title}' — ${reason}" | `/${slug}` | High |
| New Comment | Someone replies to your comment | "New Reply" | "${username} replied to your comment" | `/${slug}?comment=${id}` | Normal |
| New Subscriber | User with no comments becomes scholar | "🎉 Scholar Unlocked!" | "Your trust score reached 1.8!" | `/a/${username}` | Low |
| Admin Alert | Alert threshold breached | "⚠️ Admin Alert: ${alert_name}" | "${metric} is ${value} (threshold: ${threshold})" | `/admin/alerts` | Critical |
| Weekly Digest | Every Monday 9 AM | "Your YoTop10 Week" | "${n} posts published, ${m} comments this week" | `/` | Low |

### 6.4 Subscription Management

- Request notification permission after user has viewed ≥5 pages (never on first visit)
- Store PushSubscription on the server linked to device fingerprint
- Provide a "Notification Settings" page to opt in/out per type
- Allow unsubscribing entirely
- MUST handle 410 (expired) subscription errors by removing from DB

### 6.5 VAPID Keys

- Generate VAPID keys during build step using `web-push` library
- Public key exposed in manifest and SW registration
- Private key stored as server environment variable (`VAPID_PRIVATE_KEY`)
- Keys MUST be rotated on compromise

---

## 7. Background Sync

### 7.1 Post Submission Queue

When the user submits a post while offline:

1. Save post data to IndexedDB (not localStorage — may exceed 5 MB)
2. Show "Saved for later" confirmation
3. Register a `sync` event: `navigator.serviceWorker.ready.then(r => r.sync.register('submit-post'))`
4. When online, SW sync event fires → POST to API
5. On success → notify user via push (or toast when app is open)
6. On failure → retry with exponential backoff (3 attempts, then notify user)

### 7.2 Comment Queue

Same pattern as post submission:
1. IndexedDB queue
2. `sync` event registration
3. Batch POST on online
4. Retry with backoff

### 7.3 Reaction Queue

- Reactions are fire-and-forget (no ordering dependency)
- Queue in IndexedDB
- Flush on `sync` or `online` event
- No user notification needed (silent)

### 7.4 IndexedDB Schema

```typescript
interface PendingPost {
  id: string;                    // UUID generated client-side
  title: string;
  post_type: string;
  intro: string;
  category_slug: string;
  items: ListItem[];
  author_display_name?: string;
  created_at: number;            // Date.now()
  retries: number;               // 0-3
  last_attempt?: number;
}

interface PendingComment {
  id: string;
  post_slug: string;
  list_item_id?: string;
  parent_comment_id?: string;
  content: string;
  created_at: number;
  retries: number;
}

interface PendingReaction {
  target_type: 'comment' | 'post';
  target_id: string;
  action: 'toggle';
  created_at: number;
}
```

---

## 8. Security & Headers

### 8.1 Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';        <!-- unsafe-inline needed for Next.js -->
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://cdn.yotop10.com data: blob:;
  font-src 'self' data:;
  connect-src 'self' https://yotop10.com/api https://cdn.yotop10.com;
  manifest-src 'self';
  worker-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

### 8.2 PWA-Specific Security

- SW MUST only be served from the root path (`/sw.js`)
- SW MUST be served with `Service-Worker-Allowed: /` header
- SW MUST NOT be served with `Cache-Control: no-store` — Next.js sets this by default
- All push notification data MUST be encrypted (VAPID)
- All fetch requests in SW MUST validate response origins
- Service Worker MUST NOT import scripts from third-party CDNs
- `importScripts()` is BANNED in the SW

### 8.3 Permissions Policy

```html
<Permissions-Policy: geolocation=(), camera=(), microphone=(), 
  interest-cohort=(), payment=(), usb=(), bluetooth=()>
```

Block ALL permissions except `notifications` and `background-sync`.

---

## 9. Performance Budgets

### 9.1 App Shell

| Metric | Budget |
|---|---|
| Shell HTML (gzipped) | < 15 KB |
| Shell CSS (gzipped) | < 20 KB |
| Shell JS (gzipped) | < 30 KB |
| Total Shell (gzipped) | < 65 KB |
| First Paint | < 800 ms on 3G |
| First Contentful Paint | < 1.2 s on 3G |
| Largest Contentful Paint | < 2.5 s on 3G |
| Time to Interactive | < 3.5 s on 3G |

### 9.2 Runtime

| Metric | Budget |
|---|---|
| Cache Storage total | < 200 MB |
| IndexedDB per store | < 50 MB |
| SW activation time | < 500 ms |
| API fetch timeout | 5 s (SW) / 10 s (page) |
| Notification display latency | < 200 ms from push event |
| Background sync retry interval | Min 30 s, max 1 hour, exponential |

### 9.3 Testing Thresholds

- Lighthouse PWA score MUST be ≥ 90
- Lighthouse Performance score MUST be ≥ 85
- All audits in "Installable" category MUST pass
- "PWA Optimized" badge in Lighthouse MUST be green
- Offline page load MUST complete in < 1 s (from cache)

---

## 10. OS Integrations

### 10.1 Share Target API

Register as a share target so users can share URLs/images from other apps:

```json
// manifest.json
{
  "share_target": {
    "action": "/submit",
    "method": "GET",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

When a user shares a URL to YoTop10:
- Open submit page with pre-filled title + link
- User can add justification and submit as a list item

### 10.2 File Handling API

Register to handle common file types (optional, future):

```json
// manifest.json
{
  "file_handlers": [
    {
      "action": "/submit",
      "accept": {
        "text/plain": ".txt",
        "text/html": ".html"
      }
    }
  ]
}
```

### 10.3 Protocol Handling

Register `yotop10://` as a custom protocol:

```
yotop10://post/{slug}      →  /[slug]
yotop10://profile/{user}   →  /a/[username]
yotop10://search?q={query} →  /search?q={query}
yotop10://submit           →  /submit
```

- iOS: Universal Links (`apple-app-site-association`)
- Android: App Links (`assetlinks.json`)
- Desktop: Protocol handler registration in SW

### 10.4 App Badging

```typescript
// Update badge count for unread notifications
if (navigator.setAppBadge) {
  await navigator.setAppBadge(unreadCount);
}
// Clear badge when user opens notifications page
if (navigator.clearAppBadge) {
  await navigator.clearAppBadge();
}
```

### 10.5 Display Modes

Support the following display modes in order of preference:

1. `window-controls-overlay` — Desktop PWA with title bar integration
2. `standalone` — Mobile PWA (default)
3. `minimal-ui` — Fallback if standalone not supported
4. `browser` — Last resort

Test every display mode during QA.

---

## 11. Update Strategy

### 11.1 SW Update Detection

The browser checks for SW updates every 24 hours automatically. Additionally:

- Check for updates on every page navigation (compare `SW_VERSION` header)
- If update found → download new SW in background
- AFTER new SW is installed (not before), show update prompt to user
- Update prompt: "A new version of YoTop10 is available. Update now?"
- On user confirmation → `postMessage()` to SW to `skipWaiting()` + reload all clients

### 11.2 Update Prompt UI

```
┌──────────────────────────────────────┐
│  A new version of YoTop10 is         │
│  available. Update now?              │
│              [Later] [Update Now]     │
└──────────────────────────────────────┘
```

- Position: Bottom sheet (mobile), bottom-right toast (desktop)
- Auto-dismisses after 7 days (force update)
- "Later" → dismiss for 24 hours, then show again
- "Update Now" → trigger SW update + page reload

### 11.3 Version Tracking

- `SW_VERSION` constant in `sw.ts` — bumped on every deploy
- Build script auto-generates `sw.ts` with version from `package.json` + build timestamp
- API response headers include `X-SW-Version` for comparison
- Mixed-version caches MUST NOT conflict (cache key includes version)

### 11.4 Cache Migration

When SW version changes:

```typescript
self.addEventListener('activate', (event) => {
  const currentCaches = ['yotop10-shell-v2', 'yotop10-static-v2', /* ... */];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => !currentCaches.includes(name))
          .map(name => caches.delete(name))
      );
    })
  );
});
```

- Old caches are deleted on SW activation (not install)
- This prevents partial-state bugs during update
- Users on old SW continue using old caches until they update

---

## 12. Testing & QA

### 12.1 Manual Test Cases

| # | Test Case | Expected Result |
|---|---|---|
| 1 | Install app via beforeinstallprompt | App appears in home screen, opens standalone |
| 2 | Open app, navigate to 3+ pages | All pages load, client-side navigation works |
| 3 | Turn off network, reload page | App shell loads, offline banner appears |
| 4 | Offline: visit previously viewed post | Cached post content displays |
| 5 | Offline: visit never-viewed post | "Content unavailable offline" message |
| 6 | Offline: submit a post | Post saved to queue, "Saved for later" shown |
| 7 | Go online after offline submission | Post submits automatically, toast notification |
| 8 | Receive push notification | Notification appears with correct title/body/icon |
| 9 | Tap push notification | App opens at correct deep link URL |
| 10 | Force-close app, relaunch | App opens to last viewed page (or start_url) |
| 11 | Receive SW update while app is open | Update prompt appears within 60 seconds |
| 12 | Accept update | App reloads, new SW activates, caches refresh |
| 13 | Share URL from browser to app | Submit form opens with pre-filled fields |
| 14 | Open `yotop10://post/some-slug` from another app | App opens to that post |
| 15 | Check Lighthouse PWA audit | All installable/optimized checks green |

### 12.2 Automated Tests

- **Playwright E2E**: Test offline navigation, SW registration, push notification simulation
- **Lighthouse CI**: PWA score regressions block PRs
- **Workbox SW tests**: Unit test fetch handlers with mock events
- **Cache eviction tests**: Verify old caches deleted on version bump

### 12.3 Supported Browsers (PWA)

| Browser | PWA Support | Notes |
|---|---|---|
| Chrome (Android) | Full | beforeinstallprompt, push, sync, badging |
| Samsung Internet | Full | Same as Chrome |
| Firefox (Android) | Partial | No beforeinstallprompt, push works |
| Opera (Android) | Full | Same as Chrome |
| Safari (iOS) | Limited | No beforeinstallprompt, no push, no sync. Must use manual "Add to Home Screen" |
| Chrome (Desktop) | Full | window-controls-overlay |
| Edge (Desktop) | Full | Same as Chrome |
| Safari (Desktop) | Limited | No push, no badging |
| Firefox (Desktop) | Partial | Push works, no badging |

### 12.4 Known PWA Limitations (Documented)

| Limitation | Impact | Mitigation |
|---|---|---|
| iOS Safari no Push API | iOS users don't get notifications | Use in-app polling for notifications on iOS |
| iOS no beforeinstallprompt | iOS users must manually add to home screen | Show instructions in SlideMenu panel |
| Safari no Background Sync | iOS can't queue offline submissions | Fall back to localStorage + POST on online event |
| Safari cache limit (50 MB) | Large offline content not possible | Prioritize recent content, evict oldest |
| No file_handlers on iOS | Can't open files | Not implemented for iOS |
| SW takes 24h to update on Chrome | Stale SW may serve old content | Force update check on every navigation |

---

## 13. Implementation Order

### Phase 1: Foundation (Week 1-2)

| # | Task | Files |
|---|---|---|
| 1.1 | Create `sw.ts` with Workbox webpack plugin config | `frontend/sw.ts`, `next.config.ts` |
| 1.2 | Register SW on user interaction | `layout.tsx`, `components/PWARegistrar.tsx` |
| 1.3 | Precache app shell (HTML + critical CSS/JS) | `sw.ts` |
| 1.4 | Implement network-first for API GETs | `sw.ts` |
| 1.5 | Implement cache-first for static assets | `sw.ts` |
| 1.6 | Add SKIP_WAITING + clients.claim + cache cleanup | `sw.ts` |
| 1.7 | Create OfflineBanner component | `components/OfflineBanner.tsx` |
| 1.8 | Verify app shell loads offline | Manual test |

### Phase 2: Navigation & UX (Week 3-4)

| # | Task | Files |
|---|---|---|
| 2.1 | Add skeleton screens for all page types | `components/skeletons/*.tsx` |
| 2.2 | Implement manual update check + prompt | `components/UpdatePrompt.tsx`, `sw.ts` |
| 2.3 | Fix `[slug]` catch to not 404 on transient errors | `app/[slug]/page.tsx` |
| 2.4 | Polish install prompt timing/dismissal | `components/PWAInstallPrompt.tsx` |
| 2.5 | iOS add-to-homescreen instructions | `components/PWAInstallPrompt.tsx` |
| 2.6 | Set up Lighthouse CI PWA audit | `.github/workflows/lighthouse.yml` |

### Phase 3: Push & Sync (Week 5-6)

| # | Task | Files |
|---|---|---|
| 3.1 | Add VAPID key generation to build | `scripts/generate-vapid-keys.sh` |
| 3.2 | Implement push subscription endpoint | `backend/src/routes/push.ts` |
| 3.3 | Implement push notification send API | `backend/src/lib/pushSender.ts` |
| 3.4 | Add push handler to SW | `sw.ts` |
| 3.5 | Implement notification click → deep link | `sw.ts` |
| 3.6 | Create Notification Settings UI | `app/settings/notifications/*.tsx` |
| 3.7 | Implement IndexedDB queue for offline posts | `lib/offlineQueue.ts` |
| 3.8 | Implement background sync for submissions | `lib/offlineQueue.ts`, `sw.ts` |
| 3.9 | Automatically flush queue on `online` event | `lib/offlineQueue.ts` |

### Phase 4: OS Integrations (Week 7-8)

| # | Task | Files |
|---|---|---|
| 4.1 | Add share_target to manifest.json | `public/manifest.json` |
| 4.2 | Handle share_target on submit page | `app/submit/page.tsx` |
| 4.3 | Add protocol handler registration | `sw.ts`, `public/manifest.json` |
| 4.4 | Configure iOS Universal Links | `public/apple-app-site-association` |
| 4.5 | Configure Android App Links | `public/.well-known/assetlinks.json` |
| 4.6 | Implement app badging | `components/HeaderBells.tsx` |
| 4.7 | Add window-controls-overlay support | `public/manifest.json`, `globals.css` |

### Phase 5: Polish & Testing (Week 9-10)

| # | Task | Files |
|---|---|---|
| 5.1 | Write Playwright E2E offline tests | `e2e/pwa.spec.ts` |
| 5.2 | Run Lighthouse PWA audit, fix all failing items | Various |
| 5.3 | Test on iOS Safari (manual add to home screen) | QA |
| 5.4 | Test on Android Chrome (full install flow) | QA |
| 5.5 | Test push notifications on Android + Desktop | QA |
| 5.6 | Test offline submission + sync on Android | QA |
| 5.7 | Performance profiling — ensure shell < 65 KB | Lighthouse |
| 5.8 | Edge case: reject push permission, then enable | QA |
| 5.9 | Edge case: SW update during active form fill | QA |
| 5.10 | Production roll-out + monitoring | Deploy |

---

## Appendix A: Key Files to Create/Modify

```
frontend/
├── sw.ts                              # NEW — Service Worker (compiled by workbox)
├── next.config.ts                     # MODIFY — Add workbox plugin
├── public/
│   ├── manifest.json                  # MODIFY — Add share_target, file_handlers
│   ├── apple-app-site-association     # NEW — iOS Universal Links
│   └── .well-known/
│       └── assetlinks.json            # NEW — Android App Links
├── src/
│   ├── app/
│   │   └── layout.tsx                 # MODIFY — SW registration, OfflineBanner
│   ├── components/
│   │   ├── PWAInstallPrompt.tsx       # MODIFY — Better timing, iOS instructions
│   │   ├── PWARegistrar.tsx           # NEW — SW registration on interaction
│   │   ├── OfflineBanner.tsx          # NEW — Offline indicator
│   │   ├── UpdatePrompt.tsx           # NEW — New version available prompt
│   │   ├── skeletons/
│   │   │   ├── FeedSkeleton.tsx       # NEW
│   │   │   ├── PostSkeleton.tsx       # NEW
│   │   │   ├── CategorySkeleton.tsx   # NEW
│   │   │   └── SearchSkeleton.tsx     # NEW
│   │   └── HeaderBells.tsx            # MODIFY — App badging
│   ├── lib/
│   │   ├── offlineQueue.ts            # NEW — IndexedDB queue for sync
│   │   └── pwa.ts                    # NEW — PWA utility functions
│   └── app/
│       └── settings/
│           └── notifications/        # NEW — Notification preferences UI
└── e2e/
    └── pwa.spec.ts                    # NEW — Playwright PWA tests

backend/
└── src/
    ├── routes/
    │   └── push.ts                    # NEW — Push subscription CRUD + send
    └── lib/
        └── pushSender.ts             # NEW — VAPID push notification logic
```

## Appendix B: SW Version Manifest

```json
// version.json — Generated at build time, served at /version.json
{
  "version": "1.0.0",
  "build": "2026-06-07T15:00:00Z",
  "commit": "abc123def456",
  "sw": "2"
}
```

The SW checks this file on every navigation. If the `sw` version differs from its own, it triggers an update flow.

## Appendix C: Offline Analytics

Track offline behavior in IndexedDB and flush when online:

```typescript
interface OfflineEvent {
  type: 'page_view' | 'submission' | 'comment' | 'reaction';
  url: string;
  timestamp: number;
  was_offline: boolean;
}
```

- Store offline events in IndexedDB
- Flush to analytics endpoint when online
- Never block user actions for analytics
- Respect DNT/GPC headers
