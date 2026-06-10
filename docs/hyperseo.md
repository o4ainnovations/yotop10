# HyperSEO — YoTop10 Search Dominance Architecture

> **Objective**: Transform YoTop10 from a basic Next.js app into an entity-powered,
> schema-rich search powerhouse capable of beating Medium and Reddit for
> content-type-specific keywords.
>
> **Guiding Principle**: Every page is a unique entity. Every entity has a complete
> schema.org profile. Every profile is connected to every other profile via explicit
> relationships. Google's Knowledge Graph treats YoTop10 as a source, not a sink.

---

## Table of Contents

1. [Phase 0 — Indexing Governance (Prerequisite)](#phase-0--indexing-governance-prerequisite)
2. [Phase 1 — Foundation: Crawl Budget & Discoverability](#phase-1--foundation-crawl-budget--discoverability)
3. [Phase 2 — Schema.org Entity Web](#phase-2--schemaorg-entity-web)
4. [Phase 3 — Dynamic OG Images & Social Graph](#phase-3--dynamic-og-images--social-graph)
5. [Phase 4 — Link Equity & Internal Navigation](#phase-4--link-equity--internal-navigation)
6. [Cross-Cutting — Canonical Domain Strategy](#cross-cutting--canonical-domain-strategy)
7. [Appendix A — Per-Page Metadata Matrix](#appendix-a--per-page-metadata-matrix)
8. [Appendix B — JSON-LD Schemas (Full)](#appendix-b--json-ld-schemas-full)
9. [Appendix C — Implementation Order & Dependencies](#appendix-c--implementation-order--dependencies)
10. [Appendix D — Testing & Validation](#appendix-d--testing--validation)

---

## Phase 0 — Indexing Governance (Prerequisite)

### 0.1 Philosophy

Before any SEO work, we must decide: what gets indexed and what does not.
A new platform cannot afford to de-index its own content. But we also cannot
afford to index spam. The solution: **per-post-type rules, with a kill switch
for traffic-based de-indexing.**

### 0.2 `shouldNoIndex()` — Complete Logic

```typescript
// backend/src/lib/seoGuard.ts

export interface SeoSignals {
  post_type: string;
  status: string;
  content_length: number;
  age_hours: number;
  comment_count: number;
  view_count: number;
  trust_score?: number;        // future
  parent_spark_score?: number; // future (counter-lists)
}

const THIN_CONTENT_TYPES = new Set(['top_list', 'article', 'best_of', 'worst_of', 'hidden_gems']);
const STALE_EXEMPT_TYPES = new Set(['fact_drop', 'this_vs_that', 'counter_list']);

// Per-type thin content thresholds
const THIN_THRESHOLDS: Record<string, number> = {
  top_list: 100,     // intro length
  article: 200,      // body length
  best_of: 100,
  worst_of: 100,
  hidden_gems: 100,
};

// Config-gated stale engagement threshold (hours). null = disabled.
// When enabled, only applies to THIN_CONTENT_TYPES.
const STALE_ENGAGEMENT_HOURS = null; // set via config, e.g., getConfig().seo.stale_engagement_hours

export function shouldNoIndex(signals: SeoSignals): boolean {
  // 1. Non-approved posts are always noindex
  if (signals.status !== 'approved') return true;

  // 2. Thin content gate — only for content types that need substance
  if (THIN_CONTENT_TYPES.has(signals.post_type)) {
    const threshold = THIN_THRESHOLDS[signals.post_type] || 100;
    if (signals.content_length < threshold && signals.age_hours > 24) return true;
  }

  // 3. Stale engagement gate — DISABLED by default (null)
  //    Only for thin-content-eligible types. fact_drop and this_vs_that are exempt.
  if (STALE_ENGAGEMENT_HOURS !== null && THIN_CONTENT_TYPES.has(signals.post_type)) {
    if (signals.comment_count === 0 && signals.view_count === 0 && signals.age_hours > STALE_ENGAGEMENT_HOURS) return true;
  }

  // 4. Future: low-trust user gate
  //    if (signals.trust_score !== undefined && signals.trust_score < TRUST_THRESHOLD && signals.age_hours > 72) return true;

  // 5. Future: counter-list independence gate
  //    if (signals.post_type === 'counter_list' && signals.parent_spark_score !== undefined && signals.spark_score <= signals.parent_spark_score) return true;

  return false;
}
```

### 0.3 Per-Post-Type Indexing Rules

| Post Type | Thin content? | Stale engagement? | Default index state | Rationale |
|-----------|-------------|-------------------|---------------------|-----------|
| `top_list` | ✅ intro < 100 chars + age > 24h | ✅ When enabled: 0 comments + 0 views > threshold | `index, follow` | Core content type — needs quality gate |
| `article` | ✅ body < 200 chars + age > 24h | ✅ Same | `index, follow` | Long-form — needs substance |
| `this_vs_that` | ❌ Exempt | ❌ Exempt | `index, follow` | Title + 2 items is the format — inherently concise |
| `fact_drop` | ❌ Exempt | ❌ Exempt | `index, follow` | Single-fact format — intentionally short |
| `counter_list` | ❌ Exempt | ❌ Exempt | `noindex, follow` initially; promoted on spark_score > parent | SEO independence logic pre-vents keyword cannibalization |
| `best_of` | ✅ intro < 100 chars + age > 24h | ✅ When enabled | `index, follow` | Variant of top_list |
| `worst_of` | ✅ intro < 100 chars + age > 24h | ✅ When enabled | `index, follow` | Variant of top_list |
| `hidden_gems` | ✅ intro < 100 chars + age > 24h | ✅ When enabled | `index, follow` | Variant of top_list |

### 0.4 Configuration (Config Registry)

```typescript
// Added to config model:
seo: {
  stale_engagement_hours: null,         // number | null — disabled until traffic grows
  stale_engagement_comment_threshold: 0, // min comments to be considered "engaged"
  stale_engagement_view_threshold: 0,    // min views to be considered "engaged"
  thin_content_age_hours: 24,           // hours before thin content check activates
  thin_content_top_list: 100,           // min intro length for top_list
  thin_content_article: 200,            // min body length for article
  noindex_non_approved: true,           // always noindex non-approved posts
}
```

### 0.5 Duplicated Logic Rule

The `shouldNoIndex()` function exists in the backend. The frontend
`generateMetadata()` in `[slug]/page.tsx` and `articles/[slug]/page.tsx`
currently duplicates this logic. **Both must match at all times.**

**Solution:** Create a shared `shouldNoIndex()` utility that can be called
from both backend and frontend. Since Next.js runs server-side, the
frontend can import the same function:

```typescript
// frontend/src/lib/seoGuard.ts — mirrors backend logic EXACTLY
// (kept in sync manually or extracted to a shared package in future)
```

The backend `meta_robots` field on the Post model is the SSoT. When the
backend saves a post, it computes and persists `meta_robots`. The sitemap
and `generateMetadata` both read this field instead of re-computing.

---

## Phase 1 — Foundation: Crawl Budget & Discoverability

### 1.1 Dynamic robots.txt

**File**: `frontend/src/app/robots.ts`

```typescript
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/_next/',
          '/claim',
          '/username-history',
        ],
      },
    ],
    sitemap: 'https://yotop10.com/sitemap.xml',
  };
}
```

Rules:
- `/admin/*` — all admin pages consume crawl budget with zero value
- `/api/*` — API endpoints are not content
- `/_next/*` — Next.js internal chunks
- `/claim` — identity claim flow, no content value
- `/username-history` — utility page, no SEO value
- Everything else: crawl freely

### 1.2 Dynamic Sitemap Architecture

**Strategy**: Sitemap index → multiple sub-sitemaps.

**File**: `frontend/src/app/sitemap.ts`

```typescript
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://yotop10.com/sitemap-static.xml', lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: 'https://yotop10.com/sitemap-posts.xml', lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: 'https://yotop10.com/sitemap-articles.xml', lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: 'https://yotop10.com/sitemap-categories.xml', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ];
}
```

**Sub-sitemap: Static Pages** — `frontend/src/app/sitemap-static.xml/route.ts`:

Static page entries with fixed priorities:

| Path | Priority | Changefreq |
|------|----------|------------|
| `/` | 1.0 | daily |
| `/arguments` | 0.9 | hourly (new debates change frequently) |
| `/categories` | 0.8 | weekly |
| `/explore` | 0.7 | daily |
| `/submit` | 0.5 | monthly (utility page) |
| `/submit-article` | 0.5 | monthly |
| `/saved` | 0.3 | never (auth-gated) |
| `/notifications` | 0.3 | never (auth-gated) |

**Sub-sitemap: Posts** — fetches from API `GET /api/posts?limit=ALL`:

- Filters out posts where `meta_robots` starts with `noindex`
- Uses `bumped_at` as `lastmod` (falls back to `created_at`)
- Batch: 50,000 entries per sub-sitemap max (Google limit)
- Groups by `lastmod` week to minimize sitemap size
- Priority: `top_list` = 0.8, `this_vs_that` = 0.8, `fact_drop` = 0.7, others = 0.6

**Sub-sitemap: Articles** — `GET /api/articles?limit=ALL`:

- Status: `approved` only
- `lastmod` from `updated_at`
- Priority: 0.7

**Sub-sitemap: Categories** — `GET /api/categories?include_children=true`:

- Only parent categories (children inherit parent's crawl budget)
- Only if `post_count > 0`
- Priority: 0.5

**Sitemap Cache Strategy:**
- Sitemaps are cached for 1 hour via `Cache-Control: public, max-age=3600`
- Invalidate on: new post published, post deleted, post status changed
- Use Next.js `generateSitemaps()` with `revalidate` segment config

### 1.3 Canonical Domain Fix

**Current state**: `metadataBase` is `https://yotop10.com` but canonical URLs
hardcode `https://yotop10.fun`. This is a **critical error** — Google sees
conflicting signals.

**Fix**: Change ALL canonical URLs to use `process.env.NEXT_PUBLIC_SITE_URL`
or derive from `metadataBase`:

```typescript
// In layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com'),
  // ...
};

// In generateMetadata for [slug]/page.tsx
alternates: {
  canonical: `${metadataBase}${post.slug}`,
}
```

Set `NEXT_PUBLIC_SITE_URL=https://yotop10.com` in production environment.

### 1.4 Paginated Endpoints — `rel="prev"` / `rel="next"`

For paginated pages (`/arguments?page=2`, `/explore?page=3`, `/search?q=...&page=2`):

```html
<link rel="prev" href="https://yotop10.com/arguments?page=1" />
<link rel="next" href="https://yotop10.com/arguments?page=3" />
```

Implementation: add to `generateMetadata()` or a `<head>` injection in the
page component when the current page has prev/next.

---

## Phase 2 — Schema.org Entity Web

### 2.1 Philosophy

Every page is a **typed entity** in Google's Knowledge Graph. Entities are
connected via explicit relationships (`about`, `mainEntity`, `author`,
`isPartOf`, `breadcrumb`). When Google sees a post about "Ronaldo vs Messi",
it should understand:
- These are two football players
- The page compares them
- The community voted on who is better
- The author has expertise in football

### 2.2 Schema Map — Every Page Type

| Page Route | Schema Type(s) | `@id` | Key Properties |
|-----------|---------------|-------|---------------|
| `/` | `WebSite` + `SearchAction` | `#website` | `url`, `name`, `potentialAction` search |
| `/[slug]` (top_list) | `ItemList` + `CreativeWork` | `#post-{id}` | `itemListElement` (10 items), `author`, `datePublished`, `about` Category |
| `/[slug]` (this_vs_that) | `WebPage` + `OpinionNewsArticle` | `#post-{id}` | `about` [Thing A, Thing B], `aggregateRating` (votes A vs B) |
| `/[slug]` (fact_drop) | `Article` + `Claim` | `#post-{id}` | `Claim` with `citation` source, `ClaimReview` |
| `/[slug]` (counter_list) | `WebPage` + `CreativeWork` | `#post-{id}` | `isBasedOn` pointing to parent post, `aggregateRating` |
| `/articles/[slug]` | `Article` | `#article-{id}` | `headline`, `author`, `datePublished`, `image`, `publisher`, `isBasedOn` sources |
| `/c/[[...slug]]` | `CollectionPage` | `#category-{slug}` | `mainEntity` → `ItemList` of posts, `breadcrumb` |
| `/a/[username]` | `ProfilePage` + `Person` | `#user-{id}` | `name`, `description`, `knowsAbout` categories, `memberOf` YoTop10 |
| `/arguments` | `WebPage` + `BreadcrumbList` | `#arguments-page` | `description`, `about` debate topics |
| `/categories` | `CollectionPage` | `#categories-page` | `mainEntity` → `ItemList` of categories |
| `/explore` | `WebPage` | `#explore-page` | `description`, `about` discovery |
| `/search` | `SearchResultsPage` | `#search-page` | `mainEntity` → `ItemList`, `rel="search"` |
| `/hall-of-fame` | `CollectionPage` | `#hof-page` | `mainEntity` → `ItemList` of featured posts |
| Every page | `BreadcrumbList` | `#breadcrumb` | `itemListElement` [Home, ..., Current Page] |
| Root (layout) | `Organization` | `#organization` | `name`, `url`, `logo`, `sameAs` [], `founder` |

### 2.3 Complete JSON-LD Schemas

#### 2.3.1 Organization (injected in root layout `<head>`)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://yotop10.com/#organization",
  "name": "YoTop10",
  "alternateName": "YoTop10 — Fact Mine. Debate Ground.",
  "url": "https://yotop10.com",
  "logo": "https://yotop10.com/icon-512.png",
  "foundingDate": "2025",
  "description": "The open catalog of ranked lists. Submit your list. Defend your rankings.",
  "sameAs": [
    "https://twitter.com/yotop10",
    "https://reddit.com/r/yotop10"
  ],
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://yotop10.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

#### 2.3.2 Post Detail — `top_list` (ItemList + CreativeWork)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ItemList",
      "@id": "https://yotop10.com/{slug}#list",
      "name": "{post.title}",
      "description": "{post.intro}",
      "numberOfItems": 10,
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "Thing",
            "name": "{item.title}",
            "description": "{item.justification}"
          }
        }
      ],
      "about": {
        "@id": "https://yotop10.com/c/{category_slug}#category"
      },
      "author": {
        "@id": "https://yotop10.com/a/{username}#person"
      },
      "datePublished": "{post.created_at}",
      "dateModified": "{post.updated_at}",
      "image": "{post.hero_image_url}"
    },
    {
      "@type": "CreativeWork",
      "@id": "https://yotop10.com/{slug}#creative-work",
      "name": "{post.title}",
      "isPartOf": {
        "@id": "https://yotop10.com/#organization"
      },
      "potentialAction": {
        "@type": "CommentAction",
        "target": "https://yotop10.com/{slug}#comments"
      }
    }
  ]
}
```

#### 2.3.3 Post Detail — `this_vs_that` (OpinionNewsArticle + AggregateRating)

```json
{
  "@context": "https://schema.org",
  "@type": "OpinionNewsArticle",
  "@id": "https://yotop10.com/{slug}#article",
  "headline": "{post.title}",
  "description": "{post.intro}",
  "author": {
    "@id": "https://yotop10.com/a/{username}#person"
  },
  "about": [
    {
      "@type": "Thing",
      "name": "{item_a_title}",
      "description": "Option A in the debate"
    },
    {
      "@type": "Thing",
      "name": "{item_b_title}",
      "description": "Option B in the debate"
    }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{side with more votes as percentage}",
    "bestRating": 100,
    "worstRating": 0,
    "ratingCount": "{total_votes}",
    "reviewCount": "{total_votes}"
  },
  "datePublished": "{post.created_at}",
  "dateModified": "{post.updated_at}",
  "image": "{post.hero_image_url}"
}
```

#### 2.3.4 Post Detail — `fact_drop` (Article + Claim + ClaimReview)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "https://yotop10.com/{slug}#article",
      "headline": "{post.title}",
      "description": "{post.intro}",
      "author": {
        "@id": "https://yotop10.com/a/{username}#person"
      },
      "datePublished": "{post.created_at}",
      "dateModified": "{post.updated_at}"
    },
    {
      "@type": "Claim",
      "@id": "https://yotop10.com/{slug}#claim",
      "name": "{post.title}",
      "description": "{post.intro}",
      "citation": {
        "@type": "CreativeWork",
        "name": "{source_title or 'Community fact'}",
        "url": "{source_url}"
      }
    },
    {
      "@type": "ClaimReview",
      "@id": "https://yotop10.com/{slug}#review",
      "claimReviewed": "{post.intro}",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": 4,
        "bestRating": 5,
        "worstRating": 1
      },
      "author": {
        "@type": "Organization",
        "name": "YoTop10 Community"
      }
    }
  ]
}
```

Note: `Claim` + `ClaimReview` is a **Google rich result** that can display
fact checks directly in search results. This is massive for fact_drop posts.

#### 2.3.5 Category Page (CollectionPage + BreadcrumbList)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": "https://yotop10.com/c/{slug}#page",
      "name": "{category_name} — YoTop10",
      "description": "Ranked lists and debates about {category_name}. {post_count} posts.",
      "mainEntity": {
        "@type": "ItemList",
        "name": "Posts in {category_name}",
        "numberOfItems": {post_count},
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "url": "https://yotop10.com/{post_slug}"
          }
        ]
      },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://yotop10.com/" },
          { "@type": "ListItem", "position": 2, "name": "{category_name}", "item": "https://yotop10.com/c/{slug}" }
        ]
      }
    }
  ]
}
```

#### 2.3.6 User Profile (ProfilePage + Person)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfilePage",
      "@id": "https://yotop10.com/a/{username}#page",
      "name": "{display_name} — YoTop10",
      "description": "Posts and comments by {display_name}. Trust score: {trust_score}.",
      "mainEntity": {
        "@id": "https://yotop10.com/a/{username}#person"
      }
    },
    {
      "@type": "Person",
      "@id": "https://yotop10.com/a/{username}#person",
      "name": "{display_name}",
      "alternateName": "@{username}",
      "description": "YoTop10 contributor. {post_count} posts, {comment_count} comments.",
      "knowsAbout": ["{category_1}", "{category_2}"],
      "memberOf": {
        "@type": "Organization",
        "@id": "https://yotop10.com/#organization"
      }
    }
  ]
}
```

#### 2.3.7 Homepage (WebSite + SearchAction) — injected in root layout

Already covered in section 2.3.1 `Organization` — the `SearchAction` is
attached to the Organization entity.

### 2.4 Implementation Strategy for JSON-LD

Each page component injects its JSON-LD via a `<script type="application/ld+json">`
tag. Use a `JsonLd` helper component:

```typescript
// frontend/src/components/JsonLd.tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/<\//gi, '<\\/'),
      }}
    />
  );
}
```

Each page's server component computes its JSON-LD and passes it to `JsonLd`.
The schema is generated server-side — no client hydration overhead.

### 2.5 BreadcrumbList — Universal Component

```typescript
// frontend/src/components/BreadcrumbJsonLd.tsx
interface Crumb {
  name: string;
  item: string;
}

export function BreadcrumbJsonLd({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: c.item,
        })),
      }).replace(/<\//gi, '<\\/'),
    }} />
  );
}
```

Breadcrumb patterns per page:

| Page | Breadcrumb |
|------|-----------|
| `/` | [Home] |
| `/[slug]` (post) | [Home, Category Name, Post Title] |
| `/c/[slug]` | [Home, Category Name] |
| `/articles` | [Home, Articles] |
| `/articles/[slug]` | [Home, Articles, Article Title] |
| `/arguments` | [Home, Hot Debates] |
| `/a/[username]` | [Home, @username] |
| `/search?q=X` | [Home, Search: X] |

---

## Phase 3 — Dynamic OG Images & Social Graph

### 3.1 Dynamic OG Image Generation

**File**: `frontend/src/app/[slug]/opengraph-image.tsx`

Uses Next.js `ImageResponse` (Satori) to render a PNG per post:

```
┌─────────────────────────────┐
│  🔥 YoTop10                 │
│                             │
│  Top 10 Greatest Football   │
│  Players Ever               │
│                             │
│  #1  Lionel Messi           │
│  #2  Cristiano Ronaldo      │
│  #3  Pelé                   │
│  ...                        │
│                             │
│  ── Sports & Athletics ──   │
└─────────────────────────────┘
```

- 1200×630px (standard OG card size)
- White text on dark gradient background (matches app theme)
- Title font: Anton (Google Font, already loaded)
- Top 3 items listed
- Category badge at bottom
- Cached via `revalidate: 3600`

**Implementation**:
```typescript
// frontend/src/app/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  return new ImageResponse(
    <div style={{ ... }}>...</div>,
    { width: 1200, height: 630 }
  );
}
```

**Per-type OG images:**

| Type | File | Content |
|------|------|---------|
| Post (top_list) | `app/[slug]/opengraph-image.tsx` | Title + top 3 items + category |
| Post (this_vs_that) | `app/[slug]/opengraph-image.tsx` (branch) | Title + VS badge + both options with vote % |
| Post (fact_drop) | `app/[slug]/opengraph-image.tsx` (branch) | Title + "Did You Know?" badge + fact text |
| Article | `app/articles/[slug]/opengraph-image.tsx` | Title + author + reading time |
| Category | `app/c/[[...slug]]/opengraph-image.tsx` | Category name + post count + top 3 post titles |
| User | `app/a/[username]/opengraph-image.tsx` | Avatar circle + username + stats |

**Fallback**: If post fetch fails, render a generic YoTop10 OG image.

### 3.2 Twitter Image

Same approach as OG images but can be larger or different aspect ratio.
Twitter recommends 1200×600 (2:1) vs OG's 1200×630 (1.91:1).

**File**: `frontend/src/app/[slug]/twitter-image.tsx`
```typescript
import Image from './opengraph-image';
export default Image; // reuse OG image
export const size = { width: 1200, height: 600 };
```

### 3.3 Social Graph Signals

In Organization JSON-LD (root layout):

```json
"sameAs": [
  "https://twitter.com/yotop10",
  "https://reddit.com/r/yotop10",
  "https://github.com/o4ainnovations/yotop10"
]
```

This tells Google:
- YoTop10 is a real organization with a social presence
- The Twitter account and Reddit community are officially linked
- Knowledge Graph treats the entity as authoritative

### 3.4 Social Preview Meta Per Page

Every page must have unique OG/Twitter tags, not fall through to root defaults.
Current state: only post and article detail have per-page OG. All other pages
(about 20+) use root defaults.

**Full list of pages needing per-page OG:**

| Page | OG Title | OG Description | OG Image |
|------|----------|---------------|----------|
| `/` | YoTop10 — Fact Mine. Debate Ground. | The open catalog of ranked lists. | `/og-image.jpg` |
| `/arguments` | Hot Debates — YoTop10 | Vote on the most heated debates. {N} active debates. | generated: Arguments OG |
| `/c/{slug}` | {Category Name} — YoTop10 | {post_count} ranked lists about {category}. | generated: Category OG |
| `/a/{username}` | {display_name} — YoTop10 | YoTop10 contributor with {count} posts. | generated: User OG |
| `/explore` | Explore — YoTop10 | Discover trending lists and debates. | `/og-image.jpg` |
| `/search?q=X` | Search: {query} — YoTop10 | {N} results for "{query}". | `/og-image.jpg` |
| `/categories` | Categories — YoTop10 | Browse all categories. | `/og-image.jpg` |
| `/articles` | Articles — YoTop10 | In-depth analysis and stories. | `/og-image.jpg` |

---

## Phase 4 — Link Equity & Internal Navigation

### 4.1 Breadcrumb Internal Links

Breadcrumbs are not just JSON-LD — they should be **visible HTML links**
at the top of every content page. This serves two purposes:
1. Google uses breadcrumb HTML for sitelinks
2. Internal link equity flows from deep pages up to categories and home

**Component**: `frontend/src/components/Breadcrumbs.tsx`

```tsx
export function Breadcrumbs({ items }: { items: { label: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="...">
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            {i < items.length - 1
              ? <Link href={item.href}>{item.label}</Link>
              : <span>{item.label}</span>
            }
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

Rendered visibly at the top of:
- Post detail pages
- Article detail pages
- Category pages
- User profile pages

### 4.2 Related Posts — Internal Link Distribution

At the bottom of every post detail page, show 3-6 related posts:
- Same category, different posts
- Sorted by relevance (shared tags, same author, same post_type)
- Each link passes link equity to another indexed page

**Implementation**: `GET /api/posts?category={slug}&exclude={current_id}&limit=6`

### 4.3 Category → Post Link Structure

Every category page links to every post in that category. Google uses this
to discover new posts. Ensure:
- Category pages are in the sitemap
- Category pages have textual descriptions (not just "no posts yet")
- Even empty categories redirect to parent category instead of showing dead end

### 4.4 Author Links

Every post links to the author's profile via `/a/{username}`.
Every author profile links back to their posts.
This creates a bidirectional link graph:

```
Home → Category → Post → Author → (more posts by author)
                 Post → Related Posts
```

### 4.5 Sitelinks Search Box

Google renders a search box in sitelinks when it sees `SearchAction` in
`WebSite` schema. Already planned in Phase 2. Ensure:

```json
"potentialAction": {
  "@type": "SearchAction",
  "target": "https://yotop10.com/search?q={search_term_string}",
  "query-input": "required name=search_term_string"
}
```

### 4.6 No Dead Ends

Every page must have at least 3 outbound internal links.
- Post: author link, category link, 3 related posts, breadcrumb home link
- Category: breadcrumb home, 10+ post links
- Article: author link, category link, 3 related articles
- User profile: 10+ post links, breadcrumb home

---

## Cross-Cutting — Canonical Domain Strategy

### Current State (Broken)

```
metadataBase:              https://yotop10.com
Post canonical:            https://yotop10.fun/{slug}
Article canonical:         https://yotop10.fun/articles/{slug}
```

This means:
- Google sees `<html lang="en">` pointing to `.com`
- But canonical tags point to `.fun`
- This is a conflicting signal — Google may pick neither

### Fix

**One domain to rule them all.** Choose ONE:
- `yotop10.com` (recommended — .com is standard)
- `yotop10.fun` (if .com is not available)

Set as a single environment variable:

```
# .env
NEXT_PUBLIC_SITE_URL=https://yotop10.com
SITEMAP_BASE_URL=https://yotop10.com
```

All canonical, OG:url, sitemap URLs derive from this single source.

**Implementation:**

```typescript
// frontend/src/lib/urls.ts
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com';

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function postUrl(slug: string): string {
  return absoluteUrl(`/${slug}`);
}

export function articleUrl(slug: string): string {
  return absoluteUrl(`/articles/${slug}`);
}

export function categoryUrl(slug: string): string {
  return absoluteUrl(`/c/${slug}`);
}

export function profileUrl(username: string): string {
  return absoluteUrl(`/a/${username}`);
}
```

**HTTPS enforcement**: Next.js redirects HTTP→HTTPS automatically when
deployed behind a proxy. Nginx handles this at the edge.

---

## Appendix A — Per-Page Metadata Matrix

| Route | `generateMetadata` | OG tags | Twitter | JSON-LD | Canonical |
|-------|-------------------|---------|---------|---------|-----------|
| `/` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `WebSite` | `absoluteUrl('/')` |
| `/[slug]` | ✅ | ✅ | ✅ | `ItemList` / `Article` + `BreadcrumbList` | `postUrl(slug)` |
| `/[slug]/history` | ✅ (basic) | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS `WebPage` | `absoluteUrl(path)` |
| `/articles/[slug]` | ✅ | ✅ | ✅ | `Article` + `BreadcrumbList` | `articleUrl(slug)` |
| `/articles` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `CollectionPage` | `absoluteUrl('/articles')` |
| `/c/[[...slug]]` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `CollectionPage` + `BreadcrumbList` | `categoryUrl(slug)` |
| `/a/[username]` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `ProfilePage` + `Person` | `profileUrl(username)` |
| `/arguments` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `WebPage` + `BreadcrumbList` | `absoluteUrl('/arguments')` |
| `/arguments?page=N` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `WebPage` + `rel="prev/next"` | `absoluteUrl(path)` |
| `/categories` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `CollectionPage` | `absoluteUrl('/categories')` |
| `/explore` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `WebPage` | `absoluteUrl('/explore')` |
| `/search?q=X` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `SearchResultsPage` + `rel="search"` | `absoluteUrl(path)` |
| `/hall-of-fame` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | `CollectionPage` | `absoluteUrl('/hall-of-fame')` |
| `/submit` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | None (utility) | `absoluteUrl('/submit')` |
| `/submit-article` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | None (utility) | `absoluteUrl('/submit-article')` |
| `/saved` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | None (auth) | `absoluteUrl('/saved')` |
| `/notifications` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | None (auth) | `absoluteUrl('/notifications')` |
| `/claim` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | None (utility) | `absoluteUrl('/claim')` |
| `/username-history` | ❌ → NEEDS | ❌ → NEEDS | ❌ → NEEDS | None (utility) | `absoluteUrl('/username-history')` |
| Admin routes | ❌ → NEEDS noindex | ❌ | ❌ | None | None (noindex) |

---

## Appendix B — JSON-LD Schemas (Full)

### B.1 WebSite (root layout)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://yotop10.com/#website",
  "url": "https://yotop10.com",
  "name": "YoTop10",
  "description": "The open catalog of ranked lists. Submit your list. Defend your rankings.",
  "publisher": { "@id": "https://yotop10.com/#organization" },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://yotop10.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

### B.2 Organization (root layout)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://yotop10.com/#organization",
  "name": "YoTop10",
  "url": "https://yotop10.com",
  "logo": "https://yotop10.com/icon-512.png",
  "sameAs": [
    "https://twitter.com/yotop10",
    "https://reddit.com/r/yotop10"
  ],
  "foundingDate": "2025"
}
```

### B.3 ItemList (top_list post)

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": "https://yotop10.com/{slug}#list",
  "name": "{title}",
  "description": "{intro}",
  "numberOfItems": "{totalItems}",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Thing",
        "name": "{item.title}",
        "description": "{item.justification}"
      }
    }
  ],
  "about": {
    "@type": "CategoryCode",
    "name": "{category_name}",
    "url": "https://yotop10.com/c/{category_slug}"
  },
  "author": {
    "@type": "Person",
    "name": "{author_display_name}",
    "url": "https://yotop10.com/a/{author_username}"
  },
  "datePublished": "{created_at}",
  "dateModified": "{updated_at}"
}
```

### B.4 OpinionNewsArticle (this_vs_that post)

```json
{
  "@context": "https://schema.org",
  "@type": "OpinionNewsArticle",
  "@id": "https://yotop10.com/{slug}#article",
  "headline": "{title}",
  "description": "{intro}",
  "author": {
    "@type": "Person",
    "name": "{author_display_name}",
    "url": "https://yotop10.com/a/{author_username}"
  },
  "about": [
    { "@type": "Thing", "name": "{item_a_title}" },
    { "@type": "Thing", "name": "{item_b_title}" }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{higher_pct}",
    "bestRating": 100,
    "worstRating": 0,
    "ratingCount": "{total_votes}"
  },
  "datePublished": "{created_at}",
  "dateModified": "{updated_at}"
}
```

### B.5 Claim + ClaimReview (fact_drop post)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "https://yotop10.com/{slug}#article",
      "headline": "{title}",
      "description": "{intro}",
      "author": {
        "@type": "Person",
        "name": "{author_display_name}",
        "url": "https://yotop10.com/a/{author_username}"
      },
      "datePublished": "{created_at}"
    },
    {
      "@type": "Claim",
      "@id": "https://yotop10.com/{slug}#claim",
      "name": "{title}",
      "description": "{intro}",
      "citation": {
        "@type": "CreativeWork",
        "name": "Community fact"
      }
    },
    {
      "@type": "ClaimReview",
      "url": "https://yotop10.com/{slug}",
      "claimReviewed": "{intro}",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": 4,
        "bestRating": 5
      },
      "author": {
        "@type": "Organization",
        "name": "YoTop10 Community",
        "url": "https://yotop10.com"
      }
    }
  ]
}
```

### B.6 CollectionPage (category)

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": "https://yotop10.com/c/{slug}#page",
  "name": "{category_name} — YoTop10",
  "description": "Ranked lists and debates about {category_name}.",
  "mainEntity": {
    "@type": "ItemList",
    "name": "Posts in {category_name}",
    "numberOfItems": {post_count},
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "url": "https://yotop10.com/{post_slug}" }
    ]
  },
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://yotop10.com/" },
      { "@type": "ListItem", "position": 2, "name": "{category_name}", "item": "https://yotop10.com/c/{slug}" }
    ]
  }
}
```

### B.7 Person (user profile)

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://yotop10.com/a/{username}#person",
  "name": "{display_name}",
  "alternateName": "@{username}",
  "description": "YoTop10 contributor. {post_count} posts, {comment_count} comments.",
  "memberOf": { "@id": "https://yotop10.com/#organization" },
  "knowsAbout": ["{category_1}", "{category_2}"]
}
```

---

## Appendix C — Implementation Order & Dependencies

### Phase 0 — Indexing Governance (2 files, 1 config change)

| Step | File | Dependency |
|------|------|-----------|
| 0.1 | `backend/src/lib/seoGuard.ts` | None — rewrite existing |
| 0.2 | `backend/src/models/Post.ts` | None — ensure `meta_robots` persists |
| 0.3 | Config: add `seo.stale_engagement_hours = null` | Config registry |

**Estimated**: 2 hours

### Phase 1 — Foundation (4 files)

| Step | File | Dependency |
|------|------|-----------|
| 1.1 | `frontend/src/app/robots.ts` | None |
| 1.2 | `frontend/src/app/sitemap.ts` | None |
| 1.3 | `frontend/src/app/sitemap-static.xml/route.ts` | None |
| 1.4 | `frontend/src/app/sitemap-posts.xml/route.ts` | Phase 0 (filters noindex) |
| 1.5 | `frontend/src/app/sitemap-articles.xml/route.ts` | Phase 0 |
| 1.6 | `frontend/src/app/sitemap-categories.xml/route.ts` | None |
| 1.7 | `frontend/src/lib/urls.ts` | None (utility used everywhere) |
| 1.8 | Fix canonical URLs in all `generateMetadata` | 1.7 |
| 1.9 | Fix `metadataBase` in `layout.tsx` | 1.7 |
| 1.10 | Add `rel="prev/next"` to paginated pages | None |

**Estimated**: 4 hours

### Phase 2 — Schema Entity Web (10+ files)

| Step | File | Dependency |
|------|------|-----------|
| 2.1 | `frontend/src/components/JsonLd.tsx` | None |
| 2.2 | `frontend/src/components/BreadcrumbJsonLd.tsx` | None |
| 2.3 | `frontend/src/components/Breadcrumbs.tsx` (visible HTML) | None |
| 2.4 | Update `layout.tsx` → inject Organization + WebSite JSON-LD | 2.1 |
| 2.5 | Update `[slug]/page.tsx` → full per-type JSON-LD | 2.1, Phase 0 |
| 2.6 | Update `articles/[slug]/page.tsx` → Article JSON-LD | 2.1 |
| 2.7 | Create `c/[[...slug]]/page.tsx` → CollectionPage JSON-LD | 2.1, 2.2 |
| 2.8 | Create `a/[username]/page.tsx` → ProfilePage JSON-LD | 2.1 |
| 2.9 | Update `arguments/page.tsx` → WebPage + BreadcrumbList | 2.1 |
| 2.10 | Add `generateMetadata` to 15+ pages without it | Phase 1 (urls.ts) |
| 2.11 | Add BreadcrumbJsonLd to post, article, category, profile pages | 2.2 |

**Estimated**: 8 hours

### Phase 3 — Dynamic OG Images (4 files)

| Step | File | Dependency |
|------|------|-----------|
| 3.1 | `frontend/src/app/[slug]/opengraph-image.tsx` | None |
| 3.2 | `frontend/src/app/articles/[slug]/opengraph-image.tsx` | None |
| 3.3 | `frontend/src/app/c/[[...slug]]/opengraph-image.tsx` | None |
| 3.4 | `frontend/src/app/a/[username]/opengraph-image.tsx` | None |
| 3.5 | Add per-page OG metadata to all remaining pages | Phase 1 (urls.ts) |

**Estimated**: 6 hours

### Phase 4 — Link Equity (3 files)

| Step | File | Dependency |
|------|------|-----------|
| 4.1 | Add `<Breadcrumbs>` to post, article, category, profile pages | Phase 2 (component) |
| 4.2 | Add related posts section to post detail | None |
| 4.3 | Add related articles section to article detail | None |
| 4.4 | Ensure minimum 3 outbound links per page | All above |

**Estimated**: 2 hours

### Total Estimated: 22 hours

---

## Appendix D — Testing & Validation

### D.1 Google Tools

| Tool | How to validate |
|------|----------------|
| **Rich Results Test** | Paste post/article/category URL — check ItemList, Article, CollectionPage, BreadcrumbList all parse correctly |
| **PageSpeed Insights** | Check no render-blocking schema, OG images load fast |
| **Google Search Console** | Monitor sitemap submission status, index coverage, crawl stats |
| **Mobile-Friendly Test** | Ensure breadcrumbs don't overflow, OG images display on mobile share sheets |
| **URL Inspection** | Check canonical matches, noindex rules applied correctly |

### D.2 Automated Checks

```bash
# Validate sitemap XML
curl -s https://yotop10.com/sitemap.xml | xmllint --format -

# Check robots.txt
curl -s https://yotop10.com/robots.txt

# Verify canonical header
curl -sI https://yotop10.com/top-10-greatest-football-players-ever | grep canonical

# Check noindex on admin pages
curl -s https://yotop10.com/admin/login | grep robots

# Validate JSON-LD on homepage
curl -s https://yotop10.com/ | grep -oP '(?<=<script type="application/ld\+json">).*?(?=</script>)' | jq .

# Validate JSON-LD on post detail
curl -s https://yotop10.com/top-10-greatest-football-players-ever | grep -oP '(?<=<script type="application/ld\+json">).*?(?=</script>)' | jq .
```

### D.3 Schema Validation Script

A script that crawls all major page types and validates:
1. Page has `<title>` tag
2. Page has `<meta name="description">`  
3. Page has OG title, description, image, url
4. Page has Twitter card
5. Page has `<link rel="canonical">`
6. Page has `<script type="application/ld+json">`
7. JSON-LD parses as valid JSON
8. JSON-LD has required fields per type
9. Page has `<link rel="prev">` or `<link rel="next">` if paginated
10. Page returns HTTP 200 (not 404, 500)

---

## Implementation Principles

1. **No blocking scripts**. All JSON-LD is server-rendered inline scripts.
   No external SDKs, no JS execution needed for SEO data.

2. **Server components only**. `generateMetadata` runs server-side.
   `JsonLd` components render in the server component tree.
   No client-side SEO — Google renders JS inconsistently.

3. **One source of truth**. `shouldNoIndex()` exists once. Backend persists
   `meta_robots` on the Post model. Frontend reads it. Sitemap reads it.
   No duplicated logic.

4. **Crawl budget first**. Sitemap excludes noindex content. robots.txt
   blocks admin/api/claim. Google wastes zero budget on non-content pages.

5. **Entity relationships**. Every JSON-LD `@id` references other entities
   on the site. Google builds a knowledge graph, not a list of pages.
   Post → Author → Organization; Post → Category; Post → Related Posts.

6. **Progressive enhancement**. Phase 0 is a prerequisite. Phases 1-4 can
   be done in any order after Phase 0. Each phase is independently deployable
   and independently testable.
