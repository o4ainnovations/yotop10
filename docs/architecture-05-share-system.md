# Share System — Beyond a Button

## The Problem

A share button that copies a URL is 3 lines. Enterprise share needs more.

## The Fix

| Layer | What |
|---|---|
| **URL scheme** | `yotop10.fun/top-10-sci-fi-movies-a9gh7k` — slugs already exist |
| **UTM tracking** | `?utm_source=share&utm_medium=user&utm_campaign=post_{id}` — for analytics |
| **Open Graph** | Dynamic `<meta>` tags per post: title, description, image (hero_image_url), type |
| **Twitter Card** | `twitter:card=summary_large_image` per post |
| **Copy feedback** | Toast "Link copied" with the toast system you already have |
| **Share analytics** | Track share_count per post for Explore algorithm |

## Implementation

Build the `PostMeta` server component that generates OG tags per-post at request time. Reuse the existing post data — one extra database query for the share preview, not a new system.
