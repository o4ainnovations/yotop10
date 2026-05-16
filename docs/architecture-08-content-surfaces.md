# Content Types vs Discovery Surfaces — Orthogonal Design

## The Pattern

```
Content Types (models)     Discovery Surfaces (pages)
├── Post (ranked lists)    ├── / (chronological feed)
├── Article (long-form)    ├── /explore (algorithmic)
├── Counter (debates)      ├── /articles (medium-style)
└── (future: Poll, etc.)   ├── /arguments (debate aggregator)
                           ├── /saved (bookmarks)
                           └── /categories (taxonomy)
```

Content types and discovery surfaces are orthogonal. Any content type can appear on any surface. The surface determines the sorting logic, not the content structure. This separation means adding a new content type doesn't require touching discovery pages, and vice versa.
