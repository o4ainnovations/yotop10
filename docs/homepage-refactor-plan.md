# Homepage Refactor — Implementation Plan

## Objective

Replace the current homepage with a data-terminal / command-center design.
Feed-first, search-centric, content-dense. Zero marketing copy.
One unified DataCard component for all post types.

---

## 1. Pre-Flight

### 1.1 Files to create

| File | Purpose |
|---|---|
| `src/components/DataCard.tsx` | Unified glass card for all post types — replaces PostCard |
| `src/components/FloatingDock.tsx` | macOS-style bottom nav — 3 tabs (Home / Categories / Submit) |
| `src/components/CommandSearch.tsx` | Hero search bar with trending pill tags |
| `src/app/FeedClient.tsx` | Client-side feed shell (sort pills, DataCard list, intersection observer) |

### 1.2 Files to modify

| File | Changes |
|---|---|
| `src/app/page.tsx` | SSR shell — renders CommandSearch + FeedClient |
| `src/app/layout.tsx` | Ghost header (reduced height, Geist-only logo), FloatingDock |
| `src/components/PostCard.tsx` | **Delete** — replaced by DataCard |
| `src/components/CategoryBar.tsx` | **Delete** — categories move to FloatingDock |

### 1.3 Files to keep (unchanged)

| File | Reason |
|---|---|
| `src/lib/dates.ts` | Already immune |
| `src/app/globals.css` | Already clean |
| `src/lib/api.ts` | Already wired |
| All admin pages | Unrelated to homepage |

---

## 2. Ghost Header (`layout.tsx`)

### 2.1 Visual spec

```
┌─────────────────────────────────────────────────────────────┐
│  Yo  Top10                        🔍  ☀️  👤              │
│  ^^  ^^^^^                        ^^  ^^  ^^              │
│  400 800 gradient                 search theme user        │
│                                   toggle icon              │
│                                   toggle                   │
├─────────────────────────────────────────────────────────────┤
│  border-b border-white/5                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Tailwind classes

```html
<nav class="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/60 backdrop-blur-xl">
  <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
    <!-- Logo -->
    <Link href="/" class="flex items-baseline gap-0.5">
      <span class="text-lg font-light tracking-tight text-zinc-400">Yo</span>
      <span class="text-lg font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Top10</span>
    </Link>
    <!-- Right actions -->
    <div class="flex items-center gap-3">
      <SearchTrigger />
      <ThemeToggle />
      <UserIcon />
    </div>
  </div>
</nav>
```

### 2.3 Height reduction

- Old: `py-3` (24px total)
- New: `py-2.5` (20px total) — **17% reduction**
- Combined with thinner border (`border-white/5`)

### 2.4 Logo details

| Element | Font | Weight | Color |
|---|---|---|---|
| `Yo` | Geist Sans | 400 (font-light) | `text-zinc-400` |
| `Top10` | Geist Sans | 800 (font-extrabold) | `from-orange-500 to-pink-500` gradient via `bg-clip-text text-transparent` |

No Anton. No image icon. Pure typography.

### 2.5 Right-side icons

- **Search**: `Icon name="Search" size={18}` — glass button, opens CommandSearch overlay (or scrolls to hero search on `/`)
- **ThemeToggle**: Moon/sun icon — circular glass button (`rounded-full p-1.5 hover:bg-white/10`)
- **UserIcon**: First letter of `user_id` in monospace — `rounded-full w-7 h-7 bg-white/10 flex items-center justify-center text-xs font-mono text-zinc-400`. Opens profile dropdown or navigates to `/a/[username]`.

---

## 3. CommandSearch Hero (`CommandSearch.tsx`)

### 3.1 Visual spec

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🔍  Fact mine. Debate ground. Search rankings...       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  01 #SNEAKERS  02 #AI_TOOLS  03 #NBA  04 #MOVIES  05 #MUSIC│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Component props

```typescript
interface CommandSearchProps {
  trendingQueries: string[];  // fetched server-side, SSR-safe
}
```

### 3.3 Layout classes

```html
<section class="px-4 pt-6 pb-4">
  <div class="mx-auto max-w-2xl">
    <!-- Search bar -->
    <div class="relative">
      <Icon name="Search" class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
      <input
        type="text"
        placeholder="Fact mine. Debate ground. Search rankings..."
        class="w-full rounded-2xl border border-white/20 bg-white/[0.03] py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none focus:bg-white/[0.05] transition"
      />
    </div>
    <!-- Trending tags -->
    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
      <span class="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">Trending</span>
      {trendingQueries.map((q, i) => (
        <button key={q} class="text-[11px] font-mono text-zinc-500 hover:text-orange-400 transition">
          {(i + 1).toString().padStart(2, '0')} #{q.toUpperCase().replace(/\s/g, '_')}
        </button>
      ))}
    </div>
  </div>
</section>
```

### 3.4 Interaction details

- **Search input**: On `Enter` or click, navigates to `/search?q=<query>`
- **Trending pills**: On click, navigates to `/search?q=<term>` where term is extracted from the pill (e.g., `#SNEAKERS` → `sneakers`)
- **Trending data source**: SSR-fetched from `GET /api/search/trending` — the 5-6 most popular queries from the last 7 days. Cached for 5 minutes to avoid hitting ES on every page load. Falls back gracefully to a static list if the endpoint is unavailable.

### 3.5 States

| State | Behavior |
|---|---|
| **Loading (SSR)** | Server fetches trending; sends hydrated HTML. No spinner. |
| **Empty** | No trending queries available → just the search bar, no pill row. No error message. |
| **Error** | ES unavailable → static fallback list: `['SNEAKERS','AI','NBA','MOVIES','MUSIC']` |
| **Focused** | Search bar border shifts to `border-orange-500/40`, bg to `bg-white/[0.05]` |

### 3.6 Size / spacing

- Section padding: `pt-6 pb-4` (not `pt-16 pb-8` like the old hero)
- Total height on mobile: ~120px including search bar + pills
- Feed starts ~120px below the sticky header on mobile → compliant with the "visible within 15% of viewport" requirement

---

## 4. DataCard Component (`DataCard.tsx`)

### 4.1 Visual spec (list_only format)

```
┌─────────────────────────────────────────────────────────────┐
│  CAT/MOVIES                                  5h ago        │
│                                                             │
│  Top 10 Sci-Fi Movies of All Time                           │
│                                                             │
│  1. Blade Runner                                            │
│  2. 2001: A Space Odyssey                                   │
│  3. The Matrix                                              │
│                                                             │
│  by @a_9Gh7                          ◧ 1.2k    ○ 12        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Visual spec (hero_list / full_list — with image)

```
┌─────────────────────────────────────────────────────────────┐
│  CAT/MOVIES                                  5h ago        │
│                                                             │
│  Top 10 Sci-Fi Movies of All Time    ┌──────────────────┐   │
│                                      │                  │   │
│  1. Blade Runner                     │   [IMAGE]        │   │
│  2. 2001: A Space Odyssey            │   120x120        │   │
│  3. The Matrix                       │   rounded-xl     │   │
│                                      │                  │   │
│  by @a_9Gh7      ◧ 1.2k    ○ 12     └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Component props

```typescript
interface DataCardProps {
  post: Post;
}
```

### 4.4 Layout classes (full component)

```html
<Link href={`/${post.slug}`} class="group block">
  <article class="rounded-2xl border border-white/5 bg-white/[0.01] p-4 transition hover:border-white/10 hover:bg-white/[0.03]">
    
    {/* Top bar: category + time */}
    <div class="mb-2.5 flex items-center justify-between text-[11px]">
      <span class="font-mono font-semibold uppercase tracking-wider text-zinc-500">
        CAT/{post.category_slug}
      </span>
      <span class="font-mono tabular-nums text-zinc-600" suppressHydrationWarning>
        {relativeTime(post.created_at)}
      </span>
    </div>

    {/* Content area: flex row (text left, optional image right) */}
    <div class="flex gap-4">
      <div class="min-w-0 flex-1">
        {/* Title */}
        <h3 class="mb-2 text-base font-bold leading-snug text-white sm:text-lg">
          {post.title}
        </h3>
        
        {/* List preview — top 3 items */}
        <div class="mb-3 space-y-0.5">
          {(post.topItems || []).slice(0, 3).map((item, i) => (
            <div key={i} class="flex items-center gap-2 text-sm text-zinc-400">
              <span class="font-mono text-xs text-zinc-600 tabular-nums w-5 text-right">{item.rank}.</span>
              <span class="truncate">{item.title}</span>
            </div>
          ))}
        </div>
        
        {/* Meta row */}
        <div class="flex items-center justify-between text-xs">
          <span class="font-mono text-zinc-500">by @{post.author_username}</span>
          <div class="flex items-center gap-4">
            <span class="flex items-center gap-1 font-mono tabular-nums text-zinc-500">
              <Icon name="ChartBar" size={12} />
              {post.view_count}
            </span>
            <span class="flex items-center gap-1 font-mono tabular-nums text-zinc-500">
              <Icon name="MessageCircle" size={12} />
              {post.comment_count}
            </span>
          </div>
        </div>
      </div>

      {/* Image — only for hero_list / full_list */}
      {(post.format === 'hero_list' || post.format === 'full_list') && post.hero_image_url && (
        <div class="hidden w-[120px] flex-shrink-0 sm:block">
          <Image src={post.hero_image_url} alt="" width={120} height={120} class="rounded-xl object-cover" unoptimized />
        </div>
      )}
    </div>

    {/* Mobile image — wide banner below content */}
    {(post.format === 'hero_list' || post.format === 'full_list') && post.hero_image_url && (
      <div class="mt-3 sm:hidden">
        <Image src={post.hero_image_url} alt="" width={600} height={160} class="w-full rounded-xl object-cover" unoptimized />
      </div>
    )}
  </article>
</Link>
```

### 4.5 List preview data

The `topItems` field must be returned by `GET /api/posts`. Currently the feed returns posts without items. **Backend change required**:

```typescript
// In GET /api/posts — for each post, attach top 3 items
const formattedPosts = await Promise.all(posts.map(async (post) => {
  const topItems = await ListItem.find({ post_id: post._id })
    .sort({ rank: 1 }).limit(3).select('rank title').lean();
  return { ...postFields, topItems };
}));
```

This is a `$lookup` or parallel query. For performance: batch the item lookups using `ListItem.find({ post_id: { $in: postIds } })` and group by `post_id` client-side.

### 4.6 Design rules

| Rule | Implementation |
|---|---|
| **Gradient scarcity** | Zero gradient on DataCard. Gradient only on active nav states and Submit button. |
| **Monospaced metadata** | Category slug, timestamps, author, view count, comment count, item ranks — all `font-mono tabular-nums`. Geist Mono via Tailwind. |
| **Borders over shadows** | `border border-white/5` on all cards. No `shadow-*`. Hover shifts border to `border-white/10` (not shadow, not glow). |
| **Image treatment** | Only appears when the post HAS `hero_image_url`. Image is `120x120` square on desktop, hidden on mobile, and shown as a wide banner below the card content on mobile. No placeholder for text-only posts. |
| **Type badge removal** | No more "RANKED LIST" / "COUNTER LIST" badges. Post type differentiation happens in the list preview format. Counter lists get a `↳ rebuts {parent_title}` line below the title. |

---

## 5. FeedClient (`FeedClient.tsx`)

### 5.1 Component structure

```typescript
'use client';

export function FeedClient({ initialPosts, initialHasMore }: {
  initialPosts: PostWithItems[];
  initialHasMore: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '400px' }  // trigger 400px before visible
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, page]);

  return (
    <>
      {/* Sort pills */}
      <div class="flex justify-end gap-1.5 px-4 py-2">
        <SortPill active>Newest</SortPill>
        <SortPill>Most Viewed</SortPill>
        <SortPill>Most Commented</SortPill>
      </div>

      {/* DataCard list */}
      <div className="space-y-3 px-3 sm:px-4">
        {posts.map(post => <DataCard key={post.id} post={post} />)}
      </div>

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="h-4" />
      )}

      {/* Empty state */}
      {posts.length === 0 && !loading && (
        <EmptyState />
      )}
    </>
  );
}
```

### 5.2 Sort pills

```html
<button class="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider
  {active
    ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
    : 'border-transparent text-zinc-500 hover:text-zinc-300'}">
```

### 5.3 Infinite scroll mechanism

| Concern | Implementation |
|---|---|
| **Trigger** | `IntersectionObserver` on a sentinel `<div>` at the bottom of the feed |
| **Root margin** | `400px` — fetch 400px before the sentinel enters viewport (prefetching) |
| **State during fetch** | No spinner, no "Loading..." text. Posts appear. The sentinel div is present but invisible. |
| **End of feed** | Remove the sentinel div when `hasMore === false`. Feed simply ends. No "You've reached the end" message. |
| **Sort change** | Resets `posts` and `page`. Observer restarts from page 1. |
| **Error handling** | If fetch fails, the sentinel stays. Next intersection triggers retry. No error toast on the feed — too intrusive. |

### 5.4 Empty state

```html
<div class="py-16 text-center">
  <Icon name="FileText" class="mx-auto mb-4 text-zinc-700" size={32} />
  <p class="text-sm text-zinc-500">No ranked lists yet.</p>
  <p class="mb-4 text-xs text-zinc-600">The catalog awaits its first entry.</p>
  <Link href="/submit" class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 text-sm font-bold text-white">
    <Icon name="Plus" size={14} />
    Submit the First List
  </Link>
</div>
```

---

## 6. FloatingDock (`FloatingDock.tsx`)

### 6.1 Visual spec

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │        ┌──┐          ┌──────────┐    ┌──────────┐  │   │
│   │        │🏠│          │📁        │    │  + SUBMIT│  │   │
│   │        │Home         │Categories │    └──────────┘  │   │
│   │        └──┘          └──────────┘                   │   │
│   └─────────────────────────────────────────────────────┘   │
│                         ^  ^  ^                             │
│                         neutral   gradient CTA              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Layout classes

```html
<nav class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
  <div class="flex items-center gap-0.5 rounded-2xl border border-white/10 bg-zinc-900/70 px-1.5 py-1.5 backdrop-blur-xl">
    <DockItem href="/" icon="Home" label="Home" active={pathname === '/'} />
    <DockItem href="/categories" icon="Folder" label="Categories" active={pathname.startsWith('/c')} />
    <DockItem href="/submit" icon="Plus" label="Submit" active={false} gradient />
  </div>
</nav>
```

### 6.3 DockItem component

```typescript
function DockItem({ href, icon, label, active, gradient }: {
  href: string; icon: string; label: string; active: boolean; gradient?: boolean;
}) {
  return (
    <Link href={href} class={clsx(
      'flex items-center gap-2 rounded-xl px-3 py-2 transition',
      gradient
        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold'
        : active
          ? 'text-white bg-white/10'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
    )}>
      <Icon name={icon} size={18} />
      {gradient && <span class="text-xs font-bold hidden sm:inline">{label}</span>}
    </Link>
  );
}
```

### 6.4 Design rules

| Rule | Detail |
|---|---|
| **Scarcity** | Gradient only on Submit. Home and Categories are neutral. |
| **Size** | `bottom-4` (16px bottom offset), `h-12` effective height with padding. Floats above content, does not consume layout space. |
| **Mobile** | Labels hidden on mobile (`hidden sm:inline`). Icons only. |
| **Desktop** | Labels visible. Dock is centered, ~320px wide. |
| **Z-index** | `z-50` — above feed, below modals. |
| **Active state** | `bg-white/10` behind the active icon. No glow, no gradient. |
| **Visibility** | Always visible on all public pages. Hidden on admin pages (admin has its own nav). |

---

## 7. Light Mode

### 7.1 Palette

| Token | Dark | Light |
|---|---|---|
| Page bg | `bg-zinc-950` | `bg-zinc-50` |
| Surface | `bg-white/[0.02]` | `bg-white` (solid) |
| Card border | `border-white/5` | `border-zinc-200` |
| Text primary | `text-white` | `text-zinc-900` |
| Text secondary | `text-zinc-400` | `text-zinc-500` |
| Text muted | `text-zinc-600` | `text-zinc-400` |
| Accent gradient | `from-orange-500 to-pink-500` | Same — works on both |
| Glass nav | `bg-zinc-950/70 backdrop-blur-xl` | `bg-white/80 backdrop-blur-xl` |
| Floating dock | `bg-zinc-900/70` | `bg-white/80 border-zinc-200` |

### 7.2 Implementation

No new code. Tailwind `dark:` prefix already handles this across all pages. The `ThemeToggle` component already switches the `<html class="dark">` class. All new components use `dark:` variants for color classes.

---

## 8. SSR Strategy

### 8.1 Data flow

```
Request → page.tsx (Server Component)
  │
  ├─ fetch trending queries (GET /api/search/trending — cached 5min)
  │
  ├─ fetch initial posts (GET /api/posts?page=1&limit=20 + topItems)
  │
  └─ render HTML:
       ├─ CommandSearch (trendingQueries={...})
       └─ FeedClient (initialPosts={...}, initialHasMore={...})
```

### 8.2 Component tree

```
page.tsx (Server Component)
├── CommandSearch (Server Component — receives trendingQueries as prop)
└── FeedClient (Client Component — receives initialPosts + initialHasMore as props)
    ├── SortPills (Client — triggers sort change)
    ├── DataCard[] (renders from state)
    └── SentinelDiv (Client — IntersectionObserver target)
```

### 8.3 No hydration mismatch

- `relativeTime()` uses `Date.now()` → **this will differ between server and client**
- **Fix**: Server renders `relativeTime()` which produces `"3h"`. Client hydrates and may produce `"4h"`. The `<span suppressHydrationWarning>` attribute suppresses the mismatch warning. React replaces the server content with client content on hydration.
- Alternative: Server sends raw ISO timestamp, client formats it in `useEffect`. But that causes layout shift. `suppressHydrationWarning` is the correct tradeoff for date formatting.

### 8.4 Performance

- Trending queries: cached in memory for 5 minutes (don't hit ES on every request)
- Initial posts: fetched on every request (no cache — feed must be real-time)
- Top items per post: batched in a single MongoDB `$in` query
- Total SSR time target: <300ms for full page

---

## 9. File Deletions

| File | Reason |
|---|---|
| `src/components/PostCard.tsx` | Replaced by `DataCard.tsx` |
| `src/components/CategoryBar.tsx` | Categories move to FloatingDock |
| `src/app/FeedClient.tsx` | **Rewritten** — new infinite scroll + DataCard integration |

---

## 10. Implementation Order

| Step | File(s) | Effort |
|---|---|---|
| 1. Backend — add topItems to GET /api/posts | `routes/posts.ts` | M |
| 2. Backend — trending queries endpoint (or reuse existing) | `routes/search.ts` | S |
| 3. Create DataCard component | `components/DataCard.tsx` | L |
| 4. Create CommandSearch component | `components/CommandSearch.tsx` | M |
| 5. Create FloatingDock component | `components/FloatingDock.tsx` | M |
| 6. Rewrite FeedClient (infinite scroll) | `app/FeedClient.tsx` | M |
| 7. Rewrite page.tsx (SSR shell) | `app/page.tsx` | M |
| 8. Update layout.tsx (ghost header + dock) | `app/layout.tsx` | M |
| 9. Delete PostCard + CategoryBar | 2 files | S |
| 10. Light mode QA | All new files | S |
| 11. Full typecheck + lint | — | S |

---

## 11. Verification Checklist

- [ ] No "Welcome" or "Explore" text anywhere on the homepage
- [ ] Feed visible within first 15% of viewport on mobile
- [ ] DataCard renders correctly for all 8 post types (top_list, this_vs_that, counter_list, etc.)
- [ ] DataCard shows top 3 items for each post
- [ ] DataCard only shows image if `hero_image_url` is present
- [ ] CommandSearch shows trending pills from the API
- [ ] CommandSearch pills navigate to search
- [ ] FloatingDock has exactly 3 items
- [ ] Submit tab in FloatingDock has gradient treatment
- [ ] Gradient appears NOWHERE else on the homepage
- [ ] All metadata uses `font-mono tabular-nums`
- [ ] All cards use `border-white/5`, zero `shadow-*`
- [ ] Infinite scroll triggers 400px before sentinel
- [ ] No "Load More" button
- [ ] No loading spinner on initial render (SSR)
- [ ] Light mode toggle works — zinc-50 bg, white cards, zinc-200 borders
- [ ] `suppressHydrationWarning` on all date-rendered elements
- [ ] `tsc --noEmit` → 0 errors
- [ ] `eslint src/` → 0 errors, 0 warnings
