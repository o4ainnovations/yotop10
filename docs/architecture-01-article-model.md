# Article Content Type — Separate Model

## The Problem

The Post model assumes every post is a ranked list. Articles have no items, no rankings, no justifications. Adding articles naively means:
- `items` validation (min 3) must be conditionally bypassed
- Post detail rendering branches on `post_type === 'article'` everywhere
- The submit form now has two completely different modes
- ListItem model becomes unused for 20% of posts

## The Fix

Articles should NOT be Posts. They are a separate content type with their own model, own routes, own rendering.

```
Post (ranked content)          Article (long-form)
├── items[]                    ├── body (markdown)
├── rank logic                 ├── reading_time
├── 3-item minimum             ├── cover_image
└── list template              └── author bio
```

Separate models mean:
- No conditional validation branches
- No `if (post_type === 'article')` scattered through 50+ files
- Each content type optimized for its purpose
- Future content types (polls, galleries, etc.) follow the same pattern

## Additional Article Fields

Articles on YoTop10 serve as fact mines. They should have:
- **Source citations** (required for articles): `sources: { url: string, title: string, accessed_at: Date }[]`
- **Fact-check status**: `fact_check_status: 'unverified' | 'verified' | 'disputed'` (set by admin)
- **Revision visibility**: articles can be updated, changelog shows diffs
- **Related rankings**: `related_posts: ObjectId[]` — links to Top 10 posts on the same topic

This makes YoTop10 articles different from Medium blogs. They're sourced knowledge pieces, not opinion posts.
