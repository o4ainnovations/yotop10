/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- ES client types + Express middleware type chains */
import { Router, RequestHandler } from 'express';
import { es } from '../lib/elasticsearch';
import { INDEX_PREFIX, ensureIndices } from '../elasticsearch/lib/indexer';
import { bulkReindexPosts, bulkReindexComments, bulkReindexCategories, bulkReindexUsers } from '../elasticsearch/lib/bulkWriter';
import { adminAuthMiddleware } from '../lib/adminAuth';
import { searchRateLimit } from '../lib/searchRateLimit';
import { searchQuerySchema, autocompleteQuerySchema, adminReindexSchema, adminPreviewQuerySchema, adminDeleteIndexSchema } from '../schemas/search';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { Category } from '../models/Category';
import { User } from '../models/User';
import { SearchEvent } from '../models/SearchEvent';
import { SearchClick } from '../models/SearchClick';

const router: Router = Router();

function validate(schema: { parse: (data: unknown) => unknown }): RequestHandler {
  return (req: any, res: any, next): void => {
    try {
      (req as any).validated = schema.parse(req.method === 'GET' ? req.query : req.body);
      next();
    } catch (err: any) {
      res.status(400).json({ code: 'VALIDATION', error: err?.issues ? err.issues.map((i: any) => i.message).join('; ') : 'Invalid input' });
    }
  };
}

// ══════════════════════════════════════════════════════════════════════
// Public
// ══════════════════════════════════════════════════════════════════════

router.get(
  '/',
  searchRateLimit as any,
  validate(searchQuerySchema), async (req: any, res: any) => {
    try {
      const { q, page, sort, category_slug, post_type, author } = (req as any).validated;
      const size = 10;
      const from = (page - 1) * size;

      if (!q || q.length < 2) {
        return res.json({ posts: [], comments: [], facets: {}, pagination: { page: 1, pages: 0 }, suggestions: null });
      }

      const must: Record<string, unknown>[] = [
        { multi_match: { query: q, fields: ['title^3', 'intro^2', 'items.title', 'items.justification'] } },
      ];
      if (category_slug) must.push({ term: { category_slug } });
      if (post_type) must.push({ term: { post_type } });
      if (author) must.push({ match: { author_username: author } });

      const sortField = sort === 'newest' ? 'created_at' : sort === 'most_comments' ? 'comment_count' : sort === 'most_fire' ? 'fire_count' : '_score';

      const [postResults, commentResults] = await Promise.all([
        es.search({
          index: `${INDEX_PREFIX}_posts`,
          body: {
            from, size,
            query: { bool: { must, filter: [{ term: { status: 'approved' } }] } },
            sort: [{ [sortField]: 'desc' }],
            aggs: {
              categories: { terms: { field: 'category_slug', size: 30 } },
              post_types: { terms: { field: 'post_type', size: 10 } },
            },
            highlight: {
              fields: {
                title: { number_of_fragments: 0 },
                intro: { number_of_fragments: 1, fragment_size: 150 },
              },
              pre_tags: ['<mark>'], post_tags: ['</mark>'],
            },
            suggest: {
              text: q,
              did_you_mean: {
                phrase: { field: 'title', size: 1, gram_size: 3, direct_generator: [{ field: 'title', suggest_mode: 'popular' }] },
              },
            },
          },
        } as any),
        es.search({
          index: `${INDEX_PREFIX}_comments`,
          body: {
            from, size,
            query: {
              bool: {
                must: [{ multi_match: { query: q, fields: ['content'] } }],
                must_not: [{ term: { hidden: true } }, { term: { deleted: true } }],
              },
            },
            sort: [{ _score: 'desc' }],
            highlight: {
              fields: { content: { number_of_fragments: 1, fragment_size: 150 } },
              pre_tags: ['<mark>'], post_tags: ['</mark>'],
            },
          },
        } as any),
      ]);

      const totalPosts = (postResults.hits.total as any)?.value || 0;
      const totalComments = (commentResults.hits.total as any)?.value || 0;

      const facets = {
        categories: ((postResults.aggregations as any)?.categories?.buckets || []).map((b: any) => ({ key: b.key, count: b.doc_count })),
        post_types: ((postResults.aggregations as any)?.post_types?.buckets || []).map((b: any) => ({ key: b.key, count: b.doc_count })),
      };

      const didYouMean = (postResults.suggest as any)?.did_you_mean?.[0]?.options?.[0]?.text || null;
      const suggestions = totalPosts < 3 && didYouMean && didYouMean !== q ? { original: q, suggestion: didYouMean } : null;

      // Fire-and-forget search analytics
      SearchEvent.create({
        query: q,
        normalized_query: q.toLowerCase().trim(),
        query_length: q.length,
        fingerprint: (req as any).fingerprint || null,
        session_id: req.headers['x-session-id'] as string || 'unknown',
        filters_applied: {
          ...(category_slug ? { category_slug } : {}),
          ...(post_type ? { post_type } : {}),
          ...(author ? { author } : {}),
        },
        sort_used: sort,
        total_results: { posts: totalPosts, comments: totalComments },
        had_suggestion: !!(suggestions),
        suggestion_text: suggestions?.suggestion || null,
        suggestion_accepted: false,
        zero_results: totalPosts === 0 && totalComments === 0,
        page,
        response_time_ms: 0,
        country: null,
        referer: (req.headers.referer as string) || '',
        timestamp: new Date(),
      }).catch(() => {}); // fire-and-forget

      res.json({
        posts: postResults.hits.hits.map((h: any) => ({
          ...h._source, id: h._id, _score: h._score,
          highlight: h.highlight || null,
        })),
        comments: commentResults.hits.hits.map((h: any) => ({
          ...h._source, id: h._id, _score: h._score,
          highlight: h.highlight || null,
        })),
        total: { posts: totalPosts, comments: totalComments },
        facets,
        suggestions,
        pagination: { page, pages: Math.ceil(Math.max(totalPosts, totalComments) / size) },
      });
    } catch (err) {
      console.error('[Search] Error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

router.get(
  '/autocomplete',
  validate(autocompleteQuerySchema),
  async (req: any, res: any) => {
    try {
      const { q } = (req as any).validated;
      if (!q || q.length < 1) return res.json({ titles: [], categories: [] });

      const [titleResults, catResults] = await Promise.all([
        es.search({
          index: `${INDEX_PREFIX}_posts`,
          body: {
            size: 5, _source: ['title', 'slug'],
            query: { match_phrase_prefix: { title: q } },
            highlight: {
              fields: { title: { number_of_fragments: 0 } },
              pre_tags: ['<mark>'], post_tags: ['</mark>'],
            },
          },
        } as any),
        es.search({
          index: `${INDEX_PREFIX}_categories`,
          body: {
            size: 5, _source: ['name', 'slug'],
            query: { match_phrase_prefix: { name: q } },
            highlight: {
              fields: { name: { number_of_fragments: 0 } },
              pre_tags: ['<mark>'], post_tags: ['</mark>'],
            },
          },
        } as any),
      ]);

      res.json({
        titles: titleResults.hits.hits.map((h: any) => ({
          ...h._source,
          highlight: h.highlight?.title?.[0] || h._source.title,
        })),
        categories: catResults.hits.hits.map((h: any) => ({
          ...h._source,
          highlight: h.highlight?.name?.[0] || h._source.name,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: 'Autocomplete failed' });
    }
  }
);

// Record search result click (beacon — no auth)
router.post('/click', async (req, res) => {
  try {
    await SearchClick.create({
      search_event_id: req.body.search_event_id || 'unknown',
      result_type: req.body.result_type || 'post',
      result_id: req.body.result_id || '',
      result_title: req.body.result_title || '',
      result_position: req.body.result_position || 1,
      result_score: req.body.result_score || 0,
      query: req.body.query || '',
      fingerprint: (req as any).fingerprint || null,
      session_id: req.headers['x-session-id'] as string || 'unknown',
      click_time_ms: req.body.click_time_ms || 0,
      timestamp: new Date(),
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ══════════════════════════════════════════════════════════════════════
// Admin
// ══════════════════════════════════════════════════════════════════════

router.get('/admin/status', adminAuthMiddleware, async (_req: any, res: any) => {
  try {
    const health = await es.cat.health({ format: 'json' });
    const indices = await es.cat.indices({ index: `${INDEX_PREFIX}_*`, format: 'json' });
    const [dbPosts, dbComments, dbCategories, dbUsers] = await Promise.all([
      Post.countDocuments({ deleted: false }),
      Comment.countDocuments({ deleted: false, hidden: false }),
      Category.countDocuments({ is_archived: false }),
      User.countDocuments({}),
    ]);

    const indexMap: Record<string, unknown> = {};
    for (const idx of indices as Array<Record<string, string>>) {
      const name = (idx.index || '').replace(`${INDEX_PREFIX}_`, '');
      indexMap[name] = { docs: parseInt(idx['docs.count']) || 0, size: idx['store.size'] || '0b' };
    }

    const gaps: Record<string, unknown> = {};
    const dbMap: Record<string, number> = { posts: dbPosts, comments: dbComments, categories: dbCategories, users: dbUsers };
    for (const [key, count] of Object.entries(dbMap)) {
      const esCount = (indexMap[key] as any)?.docs || 0;
      gaps[key] = { diff: count - esCount, pct: count > 0 ? Math.round(((count - esCount) / count) * 100) : 0 };
    }

    res.json({
      cluster: (health as Array<Record<string, string>>)[0]?.status || 'unknown',
      indices: indexMap,
      db_counts: dbMap,
      gaps,
    });
  } catch (err) { res.status(500).json({ error: 'Status check failed' }); }
});

router.post(
  '/admin/reindex',
  adminAuthMiddleware as any,
  validate(adminReindexSchema),
  async (req: any, res: any) => {
    try {
      const { scope } = (req as any).validated;
      const results: Record<string, { indexed: number; errors: number }> = {};

      if (scope === 'all' || scope === 'posts') {
        const posts = await Post.find({ $or: [{ deleted: false }, { deleted: { $exists: false } }] }).lean();
        results.posts = await bulkReindexPosts(posts as Array<Record<string, unknown>>);
      }

      if (scope === 'all' || scope === 'comments') {
        const comments = await Comment.find({
          $or: [{ deleted: false }, { deleted: { $exists: false } }],
          hidden: { $ne: true },
        }).limit(10000).lean();

        const postIds = [...new Set(comments.map((c) => c.post_id?.toString()).filter(Boolean))];
        const postLookups = await Post.find({ _id: { $in: postIds } }).select('title slug').lean();
        const postMap = new Map(postLookups.map((p) => [p._id.toString(), { title: p.title, slug: p.slug }]));

        results.comments = await bulkReindexComments(comments as Array<Record<string, unknown>>, postMap);
      }

      if (scope === 'all' || scope === 'categories') {
        const categories = await Category.find({ is_archived: false }).lean();
        results.categories = await bulkReindexCategories(categories as unknown as Array<Record<string, unknown>>);
      }

      if (scope === 'all' || scope === 'users') {
        const users = await User.find({}).lean();
        results.users = await bulkReindexUsers(users as unknown as Array<Record<string, unknown>>);
      }

      const totalIndexed = Object.values(results).reduce((sum, r) => sum + r.indexed, 0);
      const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);

      res.json({ success: true, scope, total: { indexed: totalIndexed, errors: totalErrors }, results });
    } catch (err) { res.status(500).json({ error: 'Reindex failed' }); }
  }
);

router.delete(
  '/admin/index',
  adminAuthMiddleware as any,
  validate(adminDeleteIndexSchema),
  async (req: any, res: any) => {
    try {
      const { index } = (req as any).validated;
      const indexName = `${INDEX_PREFIX}_${index}`;

      const exists = await es.indices.exists({ index: indexName });
      if (exists) {
        await es.indices.delete({ index: indexName });
      }

      await ensureIndices();
      res.json({ success: true, index, recreated: true });
    } catch (err) { res.status(500).json({ error: 'Index deletion failed' }); }
  }
);

router.get('/admin/mappings', adminAuthMiddleware, async (_req: any, res: any) => {
  try {
    const results: Record<string, unknown> = {};
    const allIndices = ['posts', 'comments', 'categories', 'users'];

    for (const name of allIndices) {
      try {
        const mapping = await es.indices.getMapping({ index: `${INDEX_PREFIX}_${name}` });
        results[name] = (mapping as any)[`${INDEX_PREFIX}_${name}`]?.mappings?.properties || {};
      } catch {
        results[name] = { error: 'Index not found' };
      }
    }

    res.json({ indices: results });
  } catch (err) { res.status(500).json({ error: 'Mappings fetch failed' }); }
});

router.get(
  '/admin/preview',
  adminAuthMiddleware as any,
  validate(adminPreviewQuerySchema),
  async (req: any, res: any) => {
    try {
      const { q } = (req as any).validated;
      if (!q) return res.json({ results: 0 });

      const result = await es.search({
        index: `${INDEX_PREFIX}_posts`,
        body: { size: 5, query: { multi_match: { query: q, fields: ['title^3', 'intro'] } } },
      } as any);

      res.json({
        results: (result.hits.total as any)?.value || 0,
        top: result.hits.hits.map((h: any) => ({ title: h._source.title, slug: h._source.slug, score: h._score })),
      });
    } catch (_err) { res.status(500).json({ error: 'Preview failed' }); }
  }
);

export default router;
