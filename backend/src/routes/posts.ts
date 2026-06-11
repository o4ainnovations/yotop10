/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Post, generateUniqueSlug } from '../models/Post';
import { shouldNoIndex } from '../lib/seoGuard';
import { ListItem } from '../models/ListItem';
import { Category } from '../models/Category';
import { getCategoryNameMap } from '../lib/categoryCache';
import { Comment } from '../models/Comment';
import { atomicCheckRateLimit, redis } from '../lib/redis';
import { calculateEffectivePostLimit, getRateLimitKey } from '../lib/rateLimit';
import { getActiveBoost, grantBoost, BoostType } from '../lib/ladderSystem';
import { checkTitleMatch } from '../lib/titleSimilarity';
import { findSimilarTitles } from '../lib/titleSimilarityV2';
import { validateListTitle, needsListTitleValidation } from '../lib/listTitleValidation';
import { updateParentSparkScore } from './comments';
import { computeSparkScore, getThresholds } from '../lib/sparkScore';
import { indexComment, indexPost } from '../elasticsearch/lib/indexWriter';
import { queuePostForAiReview } from '../lib/aiModerationWorker';

const router: Router = Router();

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10);

const checkRateLimit = async (fingerprint: string, trustScore: number = 1.0, postType?: string, userId?: string, trustLevel?: string): Promise<{ allowed: boolean; remaining: number; resetTime: number; maxRequests: number }> => {
  try {
    const key = getRateLimitKey('posts', fingerprint);
    const windowMs = RATE_LIMIT_WINDOW_MS;

    let maxRequests = calculateEffectivePostLimit(trustScore, postType, trustLevel);

    if (userId) {
      const activeBoost = await getActiveBoost(userId);
      if (activeBoost?.posts && Number.isFinite(activeBoost.posts)) {
        maxRequests += activeBoost.posts;
      }
    }

    if (!Number.isFinite(maxRequests)) {
      maxRequests = calculateEffectivePostLimit(trustScore, undefined, trustLevel);
    }

    const { allowed, remaining } = await atomicCheckRateLimit(key, windowMs, maxRequests);
    const now = Date.now();

    return {
      allowed,
      remaining,
      resetTime: now + windowMs,
      maxRequests: Number.isFinite(maxRequests) ? maxRequests : calculateEffectivePostLimit(trustScore, undefined, trustLevel),
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    const fallback = calculateEffectivePostLimit(trustScore, undefined, trustLevel);
    return { allowed: false, remaining: 0, resetTime: Date.now() + 60 * 60 * 1000, maxRequests: fallback };
  }
};

// Validation middleware
const validatePostSubmission = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('post_type')
    .trim()
    .notEmpty()
    .withMessage('Post type is required')
    .isIn(['top_list', 'this_vs_that', 'who_is_better', 'fact_drop', 'best_of', 'worst_of', 'hidden_gems', 'counter_list'])
    .withMessage('Invalid post type'),
  body('intro')
    .trim()
    .optional({ values: 'falsy' })
    .isLength({ max: 2000 })
    .withMessage('Intro must be less than 2000 characters'),
  body('category_id')
    .trim()
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('category_slug')
    .trim()
    .optional(),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least 1 item is required'),
  body('items.*.rank')
    .isInt({ min: 1 })
    .withMessage('Item rank must be a positive integer'),
  body('items.*.title')
    .trim()
    .notEmpty()
    .withMessage('Item title is required')
    .isLength({ max: 200 })
    .withMessage('Item title must be less than 200 characters'),
  body('items.*.justification')
    .trim()
    .optional({ values: 'falsy' })
    .isLength({ max: 2000 })
    .withMessage('Item justification must be less than 2000 characters'),
  body('items.*.image_url')
    .optional({ values: 'falsy' })
    .isURL()
    .withMessage('Invalid image URL'),
  body('items.*.source_url')
    .optional({ values: 'falsy' })
    .isURL()
    .withMessage('Invalid source URL'),
  body('source_url')
    .optional({ values: 'falsy' })
    .isURL()
    .withMessage('Invalid fact source URL'),
  body('author_display_name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name must be less than 50 characters'),
  body('format')
    .optional({ values: 'falsy' })
    .customSanitizer(v => !v || v === '' ? undefined : v)
    .isIn(['list_only', 'hero_list', 'full_list'])
    .withMessage('Invalid format'),
  body('hero_image_url')
    .optional({ values: 'falsy' })
    .customSanitizer(v => !v || v === '' ? undefined : v),
];

// GET /api/posts — Approved posts with filtering, sorting, pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      category,
      post_type,
      sort = 'newest',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build query - only approved posts
    const query: Record<string, unknown> = { status: 'approved', deleted: { $ne: true } };

    // Filter by category
    if (category) {
      const categoryDoc = await Category.findOne({ slug: category as string });
      if (categoryDoc) {
        if (categoryDoc.parent_id) {
          query.category_slug = categoryDoc.slug;
        } else {
          const childSlugs = (await Category.find({ parent_id: categoryDoc._id }).select('slug').lean()).map(c => c.slug);
          query.category_slug = { $in: [categoryDoc.slug, ...childSlugs] };
        }
      } else {
        query.category_slug = category;
      }
    }

    // Filter by post type (supports comma-separated list, e.g. "top_list,best_of,worst_of")
    if (post_type) {
      const types = (post_type as string).split(',').map(s => s.trim()).filter(Boolean);
      if (types.length === 1) {
        query.post_type = types[0];
      } else if (types.length > 1) {
        query.post_type = { $in: types };
      }
    }

    // Determine sort order
    let sortOption: Record<string, 1 | -1> = { created_at: -1 }; // newest first
    if (sort === 'oldest') {
      sortOption = { created_at: 1 };
    } else if (sort === 'most_commented') {
      sortOption = { comment_count: -1 };
    } else if (sort === 'most_viewed') {
      sortOption = { view_count: -1 };
    }

    // Build slug→name map for category resolution (Redis-cached)
    const categoryNameMap = await getCategoryNameMap();

    // Execute query with pagination
    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Post.countDocuments(query),
    ]);

// Format posts — attach top 3 items in a single batch lookup
    const postIds = posts.map((p) => p._id);
    const allItems = await ListItem.find({ post_id: { $in: postIds } })
      .sort({ rank: 1 })
      .select('post_id rank title')
      .lean();

    const itemsByPost: Record<string, Array<{ rank: number; title: string }>> = {};
    const countByPost: Record<string, number> = {};
    for (const item of allItems) {
      const pid = (item as Record<string, unknown>).post_id?.toString() || '';
      countByPost[pid] = (countByPost[pid] || 0) + 1;
      if (!itemsByPost[pid]) itemsByPost[pid] = [];
      if (itemsByPost[pid].length < 3) {
        itemsByPost[pid].push({ rank: item.rank, title: item.title });
      }
    }

    const formattedPosts = posts.map((post) => ({
      id: post._id,
      slug: post.slug,
      title: post.title,
      post_type: post.post_type,
      intro: post.intro,
      comment_count: post.comment_count,
      view_count: post.view_count,
      author_username: post.author_username,
      author_display_name: post.author_display_name,
      format: (post as Record<string, unknown>).format || 'list_only',
      hero_image_url: (post as Record<string, unknown>).hero_image_url || null,
      topItems: itemsByPost[post._id.toString()] || [],
      totalItems: countByPost[post._id.toString()] || 0,
      created_at: post.created_at,
      published_at: post.published_at,
      category_slug: post.category_slug,
      category_name: categoryNameMap.get(post.category_slug as string) || post.category_slug,
    }));

    res.json({
      posts: formattedPosts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET /api/posts/check-title — Global similarity check (no category silo)
router.get('/check-title', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();

    if (!q || q.length < 3) {
      return res.json({
        allowed: true, blocked: false, warning: false,
        matches: [], etag: '',
      });
    }

    const [approvedPosts, pendingPosts] = await Promise.all([
      Post.find({ status: 'approved' })
        .select('title slug normalized_title category_slug')
        .sort({ created_at: -1 })
        .limit(200)
        .lean(),
      Post.find({ status: 'pending_review', deleted: false })
        .select('title created_at')
        .sort({ created_at: -1 })
        .limit(200)
        .lean(),
    ]);

    const matches: Array<{ title: string; slug: string; category_slug: string; similarity: number }> = [];
    const pendingConflicts: Array<{ title: string; submitted_at: string }> = [];
    let blocked = false;
    let warned = false;

    for (const post of approvedPosts) {
      const result = checkTitleMatch(q, post.title as string);
      if (result.similarity >= 50) {
        matches.push({
          title: post.title as string,
          slug: post.slug as string,
          category_slug: post.category_slug as string,
          similarity: result.similarity,
        });
        if (result.isDuplicate) blocked = true;
        if (result.isWarning) warned = true;
      }
    }

    for (const post of pendingPosts) {
      const result = checkTitleMatch(q, post.title as string);
      if (result.similarity >= 80) {
        pendingConflicts.push({
          title: post.title as string,
          submitted_at: (post as any).created_at,
        });
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);

    const etag = `"${Buffer.from(q).toString('base64').substring(0, 16)}"`;
    const formatCheck = validateListTitle(q);

    res.json({
      allowed: !blocked,
      blocked,
      warning: warned,
      matches: matches.slice(0, 5),
      pending_conflicts: pendingConflicts.slice(0, 5),
      suggestion: matches.length > 0 && !blocked
        ? `${q} — Part 2`
        : undefined,
      etag,
      format_check: formatCheck,
    });
  } catch (error) {
    console.error('Check title error:', error);
    res.status(500).json({ error: 'Failed to check title' });
  }
});

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'login', 'search', 'settings', 'profile',
  'categories', 'c', 'auth', 'submit', 'explore', 'articles',
  'saved', 'arguments', 'hall-of-fame', 'claim', 'notifications',
  'username-history', 'submit-article',
]);

// GET /api/posts/:idOrSlug — Single post with items and comments
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    if (RESERVED_SLUGS.has(idOrSlug)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Find approved post - try both _id and slug
    let post: { _id: { toString(): string }; [key: string]: unknown } | null = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findOne({ _id: idOrSlug, status: 'approved', deleted: { $ne: true } }).lean();
    }
    
    if (!post) {
      post = await Post.findOne({ slug: idOrSlug, status: 'approved', deleted: { $ne: true } }).lean();
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Unique view counting: same fingerprint + same post = 1 view per 30 min
    const viewerFp = req.user?.device_fingerprint || req.headers['x-device-fingerprint'] as string || req.ip || 'unknown';
    const viewKey = `post_view:${post._id}:${viewerFp}`;
    const alreadyViewed = await redis.get(viewKey);
    if (!alreadyViewed) {
      await Promise.all([
        Post.findByIdAndUpdate(post._id, { $inc: { view_count: 1 } }),
        redis.set(viewKey, '1', { EX: 1800 }),
      ]);
    }

    // Compute SEO robots
    const ageHours = (Date.now() - new Date(post.created_at as string).getTime()) / 3600000;
    const seoSignals = {
      comment_count: post.comment_count as number,
      view_count: post.view_count as number,
      content_length: (post.intro as string)?.length || 0,
      status: post.status as string,
      age_hours: ageHours,
    };
    const noindex = shouldNoIndex(seoSignals);
    const robots = (post as Record<string, unknown>).meta_robots || (noindex ? 'noindex, follow' : 'index, follow');

    // Get list items for this post
    const listItems = await ListItem.find({ post_id: post._id })
      .sort({ rank: 1 })
      .lean();

    // Get comments for this post (top-level only)
    const comments = await Comment.find({
      post_id: post._id,
      parent_comment_id: null,
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
      hidden: { $ne: true },
    })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

    res.json({
      post: {
        id: post._id,
        title: post.title,
        post_type: post.post_type,
        intro: post.intro,
        comment_count: post.comment_count,
        view_count: (post.view_count as number) + 1,
        author_id: post.author_id,
        author_username: post.author_username,
        author_display_name: post.author_display_name,
        category_slug: post.category_slug,
        status: post.status,
        format: (post as Record<string, unknown>).format || 'list_only',
        hero_image_url: (post as Record<string, unknown>).hero_image_url || null,
        share_count: (post as Record<string, unknown>).share_count || 0,
        created_at: post.created_at,
        updated_at: post.updated_at,
        published_at: post.published_at,
        robots,
        votes_a: (post as any).votes_a || 0,
        votes_b: (post as any).votes_b || 0,
      },
      items: listItems.map((item) => ({
        id: item._id,
        rank: item.rank,
        title: item.title,
        justification: item.justification,
        image_url: item.image_url,
        source_url: item.source_url,
      })),
      comments: comments.map((comment) => ({
        id: comment._id,
        content: comment.content,
        depth: comment.depth,
        fire_count: comment.fire_count,
        reply_count: comment.reply_count,
        author_username: comment.author_username,
        author_display_name: comment.author_display_name,
        created_at: comment.created_at,
        list_item_id: comment.list_item_id,
      })),
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// POST /api/posts — Submit post (no auth)
router.post('/', ...validatePostSubmission as any[], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      post_type,
      intro,
      category_id,
      category_slug,
      items,
      author_display_name,
      device_fingerprint,
    } = req.body;

    // Resolve category slug (dual-accept during transition)
    let resolvedCategorySlug: string | null = category_slug || null;
    if (!resolvedCategorySlug && category_id) {
      const cat = await Category.findById(category_id);
      if (cat) resolvedCategorySlug = cat.slug;
    }
    if (!resolvedCategorySlug) {
      return res.status(400).json({ error: 'Category is required' });
    }

    // Verify category exists
    const category = await Category.findOne({ slug: resolvedCategorySlug });
    if (!category) {
      return res.status(400).json({ error: 'Category not found' });
    }

    // Apply per-user rate limit override if set
    let effectiveTrustScore = req.user?.trust_score || 1.0;
    
    // Check for admin override
    if (req.user?.rate_limit_override?.posts_per_hour) {
      effectiveTrustScore = req.user.rate_limit_override.posts_per_hour / 4;
    }
    
    // ─── Validation FIRST (before rate limit) — invalid submissions don't consume quota ───
    const bodyItems: Array<{ title?: string; justification?: string; source_url?: string }> = req.body.items || [];

    // Validate title format for list-type posts
    if (needsListTitleValidation(post_type)) {
      const formatResult = validateListTitle(title, post_type);
      if (!formatResult.valid) {
        return res.status(400).json({
          code: 'INVALID_TITLE_FORMAT',
          error: formatResult.error,
          format_code: formatResult.code,
        });
      }
    }

    // Per-type item count + field validation
    const LIST_TYPES = new Set(['top_list', 'best_of', 'worst_of', 'hidden_gems', 'counter_list']);

    if (post_type === 'this_vs_that') {
      if (bodyItems.length !== 2) {
        return res.status(400).json({ code: 'INVALID_ITEM_COUNT', error: 'Exactly 2 items are required for debates.' });
      }
      if (!req.body.intro && bodyItems[0]?.title && bodyItems[1]?.title) {
        req.body.intro = `${bodyItems[0].title} vs ${bodyItems[1].title}`;
      }
    } else if (post_type === 'fact_drop') {
      if (bodyItems.length !== 1) {
        return res.status(400).json({ code: 'INVALID_ITEM_COUNT', error: 'Exactly 1 item is required for fact drops.' });
      }
      const sourceUrl = bodyItems[0]?.source_url || req.body.source_url;
      if (!sourceUrl) {
        return res.status(400).json({ code: 'SOURCE_REQUIRED', error: 'Source URL is required for fact drops.' });
      }
    } else if (LIST_TYPES.has(post_type)) {
      if (bodyItems.length < 3) {
        return res.status(400).json({ code: 'INVALID_ITEM_COUNT', error: 'At least 3 items are required for ranked lists.' });
      }
      if (bodyItems.length > 100) {
        return res.status(400).json({ code: 'MAX_ITEMS', error: 'Maximum 100 items allowed.' });
      }
    }

    // Final title similarity check on submit - ES-backed with MongoDB fallback
    if (post_type !== 'counter_list') {
      const similar = await findSimilarTitles(title);
      if (similar.length > 0) {
        return res.status(409).json({
          error: 'This list already exists.',
          suggestion: `${title} ${new Date().getFullYear()}`,
          matches: similar.slice(0, 5),
        });
      }
    }

    // ─── Rate limit check (after validation — only valid submissions consume quota) ───
    const fingerprint = req.user?.device_fingerprint || req.fingerprint || device_fingerprint;
    if (!fingerprint) {
      return res.status(401).json({ error: 'Device identity required for posting' });
    }
    const userId = req.user?.user_id;
    const rateLimitResult = await checkRateLimit(fingerprint, effectiveTrustScore, post_type, userId, (req.user as any)?.trust_level);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. You can submit ${rateLimitResult.maxRequests ?? 4} posts per hour.`,
        resetTime: rateLimitResult.resetTime,
      });
    }

    const user = req.user!;
    if (user.restricted_until && new Date() < new Date(user.restricted_until)) {
      const remaining = Math.ceil((new Date(user.restricted_until).getTime() - Date.now()) / 60000);
      return res.status(429).json({ error: `Account restricted. Resumes in ${remaining} minutes.`, resetTime: user.restricted_until });
    }

    // Create post
    const post = await Post.create({
      author_id: user.user_id,
      author_username: user.username,
      author_display_name: author_display_name || user.username,
      title,
      post_type,
      intro,
      category_slug: resolvedCategorySlug,
      status: 'pending_review',
      category_id,
      fire_count: 0,
      comment_count: 0,
      view_count: 0,
      format: req.body.format || 'list_only',
      hero_image_url: req.body.hero_image_url || null,
      slug: `temp-${crypto.randomBytes(8).toString('hex')}`,
    });

    try {
      const listItems = await Promise.all(
        items.map((item: { rank: number; title: string; justification: string; image_url?: string; source_url?: string }) =>
          ListItem.create({
            post_id: post._id,
            rank: item.rank,
            title: item.title,
            justification: item.justification,
            image_url: item.image_url,
            source_url: item.source_url,
            fire_count: 0,
          })
        )
      );

      const finalSlug = generateUniqueSlug(title, (post._id as { toString(): string }).toString());
      await Post.findByIdAndUpdate(post._id, { slug: finalSlug });
      const updatedPost = await Post.findById(post._id);
      if (!updatedPost) throw new Error('Post lost during creation'); // caught by route handler → 500

      indexPost(updatedPost as unknown as Record<string, unknown>);

      // Enqueue AI quality check (async, fire-and-forget)
      queuePostForAiReview(updatedPost._id.toString()).catch(() => {});

      res.status(201).json({
        message: 'Post submitted successfully. It will be reviewed by an admin.',
        post: {
          id: updatedPost._id,
          slug: updatedPost.slug,
          title: updatedPost.title,
          status: updatedPost.status,
          created_at: updatedPost.created_at,
        },
        items: listItems.map((item) => ({
          id: item._id,
          rank: item.rank,
          title: item.title,
        })),
        rate_limit: {
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime,
        },
      });
    } catch (itemError) {
      await Post.findByIdAndDelete(post._id);
      throw itemError;
    }
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// GET /api/posts/:idOrSlug/history — Get post revision history
router.get('/:idOrSlug/history', async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    let post: { _id: { toString(): string }; [key: string]: unknown } | null = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findById(idOrSlug).lean();
    }
    
    if (!post) {
      post = await Post.findOne({ slug: idOrSlug }).lean();
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const listItems = await ListItem.find({ post_id: post._id }).sort({ rank: 1 }).lean();
    
    const versions = [
      {
        version_number: 1,
        title: post.title,
        intro: post.intro,
        items: listItems.map(item => ({
          rank: item.rank,
          title: item.title,
          justification: item.justification,
        })),
        created_at: post.created_at,
        author_username: post.author_username,
        change_summary: 'Initial version',
      },
    ];
    
    res.json({ versions, total: versions.length });
  } catch (error) {
    console.error('Error fetching post history:', error);
    res.status(500).json({ error: 'Failed to fetch post history' });
  }
});

// GET /api/posts/:idOrSlug/comments — Get comments for a post
router.get('/:idOrSlug/comments', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { list_item_id } = req.query;

    let post: { _id: { toString(): string } } | null = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findOne({ _id: idOrSlug, status: 'approved', deleted: { $ne: true } });
    }
    if (!post) {
      post = await Post.findOne({ slug: idOrSlug, status: 'approved' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postId = post._id.toString();
    const query: Record<string, unknown> = { post_id: postId, $or: [{ deleted: false }, { deleted: { $exists: false } }], hidden: { $ne: true } };
    if (list_item_id && mongoose.Types.ObjectId.isValid(list_item_id as string)) {
      query.list_item_id = list_item_id;
    }

    const comments = await Comment.find(query)
      .sort({ spark_score: -1, created_at: 1 })
      .lean();

    const commentMap = new Map<string, Record<string, unknown>>();
    const rootComments: Record<string, unknown>[] = [];

    comments.forEach((comment: Record<string, unknown>) => {
      commentMap.set((comment._id as mongoose.Types.ObjectId).toString(), {
        ...comment,
        id: (comment._id as mongoose.Types.ObjectId).toString(),
        replies: [],
      });
    });

    comments.forEach((comment: Record<string, unknown>) => {
      const entry = commentMap.get((comment._id as mongoose.Types.ObjectId).toString());
      if (!entry) return;
      if (comment.parent_comment_id) {
        const parent = commentMap.get((comment.parent_comment_id as mongoose.Types.ObjectId).toString());
        if (parent) {
          (parent.replies as unknown[]).push(entry);
          (parent as Record<string, unknown>).reply_count = (parent.replies as unknown[]).length;
        } else {
          rootComments.push(entry);
        }
      } else {
        rootComments.push(entry);
      }
    });

    res.json({ comments: rootComments, total: comments.length });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/posts/:idOrSlug/comments — Add comment (anonymous)
router.post('/:idOrSlug/comments', [
  body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 2000 }).withMessage('Content must be less than 2000 characters'),
  body('list_item_id').optional().isMongoId().withMessage('Invalid list item ID'),
  body('parent_comment_id').optional().isMongoId().withMessage('Invalid parent comment ID'),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { idOrSlug } = req.params;
    const { content, list_item_id, parent_comment_id } = req.body;
    const deviceFingerprint = req.user?.device_fingerprint;
    if (!deviceFingerprint || deviceFingerprint === 'unknown') {
      return res.status(401).json({ error: 'Device identity required' });
    }

    let post: { _id: { toString(): string }; author_id?: string } | null = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findOne({ _id: idOrSlug, status: 'approved', deleted: { $ne: true } });
    }
    if (!post) {
      post = await Post.findOne({ slug: idOrSlug, status: 'approved' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const postId = post._id.toString();

    if ((post as Record<string, unknown>).comments_locked) {
      return res.status(403).json({ error: 'Comments are locked for this post.' });
    }

    const user = req.user!;
    const fingerprint = deviceFingerprint;

    if (user.restricted_until && new Date() < new Date(user.restricted_until)) {
      const remaining = Math.ceil((new Date(user.restricted_until).getTime() - Date.now()) / 60000);
      return res.status(429).json({ error: `Account restricted. Resumes in ${remaining} minutes.`, resetTime: user.restricted_until });
    }

    const rateLimitKey = getRateLimitKey('comments', fingerprint);
    const windowMs = 60 * 60 * 1000;
    const trustScore = Number.isFinite(user.trust_score) && user.trust_score > 0 ? user.trust_score : 1.0;
    let limit = Math.max(5, Math.floor(20 * trustScore));
    if (!Number.isFinite(limit)) { limit = 20; }

    const activeBoost = await getActiveBoost(user.user_id);
    if (activeBoost?.comments && Number.isFinite(activeBoost.comments)) {
      limit += activeBoost.comments;
      if (!Number.isFinite(limit)) { limit = 20; }
    }

    const { allowed } = await atomicCheckRateLimit(rateLimitKey, windowMs, limit);
    if (!allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        remaining: 0,
        resetTime: Date.now() + windowMs,
      });
    }

    let depth = 0;
    if (parent_comment_id) {
      const parentComment = await Comment.findById(parent_comment_id);
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      if (parentComment.depth >= 10) {
        return res.status(400).json({ error: 'Maximum reply depth is 10 levels' });
      }
      depth = parentComment.depth + 1;
    }

    if (list_item_id) {
      const listItem = await ListItem.findById(list_item_id);
      if (!listItem || listItem.post_id.toString() !== postId) {
        return res.status(400).json({ error: 'List item not found or does not belong to this post' });
      }
    }

    const now = new Date();
    const thresholds = await getThresholds();
    const initialSparkScore = computeSparkScore(
      { fireCount: 0, replyCount: 0, createdAt: now },
      thresholds
    );

    const comment = await Comment.create({
      post_id: postId,
      list_item_id: list_item_id || undefined,
      parent_comment_id: parent_comment_id || undefined,
      depth,
      author_id: user.user_id,
      author_username: user.username,
      author_display_name: user.username,
      content,
      fire_count: 0,
      reply_count: 0,
      spark_score: initialSparkScore,
      last_engaged_at: now,
    });

    indexComment(comment as unknown as Record<string, unknown>);

    if (parent_comment_id) {
      const updatedParent = await Comment.findByIdAndUpdate(
        parent_comment_id,
        { $inc: { reply_count: 1 } },
        { new: true }
      );
      if (updatedParent && updatedParent.reply_count === 2) {
        await grantBoost(updatedParent.author_id.toString(), BoostType.COMMENT_TWO_REPLIES);
      }
      await updateParentSparkScore(parent_comment_id);
    }

    await Post.findByIdAndUpdate(postId, { $inc: { comment_count: 1 } });

    if (post && ['this_vs_that', 'counter_list'].includes((post as Record<string, unknown>).post_type as string)) {
      const velocityKey = `arguments:velocity:${postId}`;
      redis.incr(velocityKey).catch(() => {});
      redis.expire(velocityKey, 3600).catch(() => {});
    }

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// POST /api/posts/:idOrSlug/share — Track share analytics
router.post('/:idOrSlug/share', async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    let post: { _id: { toString(): string } } | null = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findById(idOrSlug);
    }
    if (!post) {
      post = await Post.findOne({ slug: idOrSlug });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postId = post._id.toString();

    const { trackExploreView } = await import('../lib/exploreScore');

    await Promise.all([
      Post.findByIdAndUpdate(postId, { $inc: { share_count: 1 } }),
      trackExploreView(postId),
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Share tracking error:', error);
    res.status(500).json({ error: 'Failed to track share' });
  }
});

// POST /api/posts/:id/vote — Cast a vote on a this_vs_that post
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { side } = req.body;

    if (!side || !['A', 'B'].includes(side)) {
      res.status(400).json({ error: 'Invalid side. Must be "A" or "B".' });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    if (post.post_type !== 'this_vs_that') {
      res.status(400).json({ error: 'Voting is only supported on this_vs_that posts' });
      return;
    }

    const fingerprint = (req as any).fingerprint || req.headers['x-device-fingerprint'] as string;
    if (!fingerprint) {
      res.status(400).json({ error: 'Device fingerprint required for voting' });
      return;
    }

    const voteKey = `vote:post:${id}:fp:${fingerprint}`;
    const existingVote = await redis.get(voteKey);

    if (existingVote === side) {
      const field = side === 'A' ? 'votes_a' : 'votes_b';
      const updated = await Post.findByIdAndUpdate(id, { $inc: { [field]: -1 } }, { new: true }).select('votes_a votes_b');
      await redis.del(voteKey);
      res.json({ votes_a: updated?.votes_a || 0, votes_b: updated?.votes_b || 0, voted: null });
      return;
    }

    if (existingVote && existingVote !== side) {
      const oldField = existingVote === 'A' ? 'votes_a' : 'votes_b';
      const newField = side === 'A' ? 'votes_a' : 'votes_b';
      const updated = await Post.findByIdAndUpdate(
        id,
        { $inc: { [oldField]: -1, [newField]: 1 } },
        { new: true },
      ).select('votes_a votes_b');
      await redis.set(voteKey, side);
      res.json({ votes_a: updated?.votes_a || 0, votes_b: updated?.votes_b || 0, voted: side });
      return;
    }

    const field = side === 'A' ? 'votes_a' : 'votes_b';
    const updated = await Post.findByIdAndUpdate(id, { $inc: { [field]: 1 } }, { new: true }).select('votes_a votes_b');
    await redis.set(voteKey, side);
    res.json({ votes_a: updated?.votes_a || 0, votes_b: updated?.votes_b || 0, voted: side });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// GET /api/posts/:id/vote — Get current vote counts (no side = read-only)
router.get('/:id/vote', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select('votes_a votes_b').lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ votes_a: (post as any).votes_a || 0, votes_b: (post as any).votes_b || 0 });
  } catch (error) {
    console.error('Vote counts error:', error);
    res.status(500).json({ error: 'Failed to get vote counts' });
  }
});

// ─── Counter-List Arena (M5.6) ─────────────────────────────────────────

// POST /api/posts/:slug/counter — Create a counter list rebutting an existing post
router.post('/:slug/counter', async (req, res) => {
  try {
    const { slug } = req.params;
    const parent = await Post.findOne({ slug, status: 'approved', deleted: { $ne: true } });
    if (!parent) return res.status(404).json({ error: 'Original post not found' });

    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { title, intro, items } = req.body;
    if (!title || !items || !Array.isArray(items) || items.length < 3) {
      return res.status(400).json({ error: 'Title and at least 3 items are required' });
    }

    // Create counter post linked to parent
    const counter = await Post.create({
      author_id: user.user_id,
      author_username: user.username,
      author_display_name: user.custom_display_name || user.username,
      title,
      post_type: 'counter_list',
      intro: intro ? `Counter to: ${parent.slug}. ${intro}` : `Counter to: ${parent.slug}`,
      category_slug: parent.category_slug,
      category_id: parent.category_id,
      parent_id: parent._id.toString(),
      status: 'pending_review',
      slug: `${slug}-counter-${Date.now().toString(36)}`,
      meta_robots: 'noindex, follow',
      fire_count: 0,
      comment_count: 0,
      view_count: 0,
    });

    // Create list items
    const listItems = items.map((item: { title: string; justification?: string }, idx: number) => ({
      post_id: counter._id,
      rank: idx + 1,
      title: item.title,
      justification: item.justification || '',
    }));
    await ListItem.insertMany(listItems);

    // Boost parent spark
    await Post.findByIdAndUpdate(parent._id, { $inc: { fire_count: 10 } });

    res.status(201).json({
      success: true,
      post: { id: counter._id, slug: counter.slug, title: counter.title, status: counter.status },
      rate_limit: { remaining: 9999, resetTime: Date.now() + 3600000 },
    });
  } catch (error) {
    console.error('Counter create error:', error);
    res.status(500).json({ error: 'Failed to create counter list' });
  }
});

// GET /api/posts/:slug/counters — List all counters for a post
router.get('/:slug/counters', async (req, res) => {
  try {
    const { slug } = req.params;
    const parent = await Post.findOne({ slug });
    if (!parent) return res.status(404).json({ error: 'Post not found' });

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;
    const sortField = req.query.sort === 'oldest' ? 'created_at' : (req.query.sort === 'spark' ? 'fire_count' : 'created_at');
    const sortDir = req.query.sort === 'oldest' ? 1 : -1;

    const [counters, total] = await Promise.all([
      Post.find({ parent_id: parent._id.toString(), status: 'approved', deleted: { $ne: true } })
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .select('title slug post_type fire_count comment_count view_count created_at author_username author_display_name')
        .lean(),
      Post.countDocuments({ parent_id: parent._id.toString(), status: 'approved', deleted: { $ne: true } }),
    ]);

    res.json({
      counters: counters.map((c: any) => ({
        id: c._id, slug: c.slug, title: c.title, post_type: c.post_type,
        fire_count: c.fire_count, comment_count: c.comment_count, view_count: c.view_count,
        created_at: c.created_at, author_username: c.author_username, author_display_name: c.author_display_name,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List counters error:', error);
    res.status(500).json({ error: 'Failed to list counters' });
  }
});

// GET /api/posts/compare/:original/:counter — Compare two posts (diff engine)
router.get('/compare/:original/:counter', async (req, res) => {
  try {
    const [original, counter] = await Promise.all([
      Post.findOne({ slug: req.params.original, status: 'approved' }).lean(),
      Post.findOne({ slug: req.params.counter, status: 'approved' }).lean(),
    ]);
    if (!original || !counter) return res.status(404).json({ error: 'One or both posts not found' });

    const [origItems, counterItems] = await Promise.all([
      ListItem.find({ post_id: original._id }).sort({ rank: 1 }).lean(),
      ListItem.find({ post_id: counter._id }).sort({ rank: 1 }).lean(),
    ]);

    const origTitles = new Map(origItems.map((i: any) => [i.title.toLowerCase().trim(), i]));
    const counterTitleSet = new Set(counterItems.map((i: any) => i.title.toLowerCase().trim()));

    const matches: Array<{ rank: number; title: string }> = [];
    const moved: Array<{ title: string; old_rank: number; new_rank: number }> = [];
    const replaced: Array<{ title: string; old_rank: number }> = [];
    const added: Array<{ title: string; new_rank: number }> = [];

    for (const item of counterItems) {
      const key = (item as any).title.toLowerCase().trim();
      const origItem = origTitles.get(key);
      if (origItem) {
        const origRank = (origItem as any).rank;
        if (origRank === (item as any).rank) {
          matches.push({ rank: origRank, title: (item as any).title });
        } else {
          moved.push({ title: (item as any).title, old_rank: origRank, new_rank: (item as any).rank });
        }
      } else {
        added.push({ title: (item as any).title, new_rank: (item as any).rank });
      }
    }

    for (const item of origItems) {
      if (!counterTitleSet.has((item as any).title.toLowerCase().trim())) {
        replaced.push({ title: (item as any).title, old_rank: (item as any).rank });
      }
    }

    res.json({
      original: { title: (original as any).title, slug: (original as any).slug },
      counter: { title: (counter as any).title, slug: (counter as any).slug },
      diff: { matches, moved, replaced, added },
    });
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({ error: 'Failed to compare posts' });
  }
});

// POST /api/posts/compare/:original/:counter/vote — Community "Better List" Vote
router.post('/compare/:original/:counter/vote', async (req, res) => {
  try {
    const [original, counter] = await Promise.all([
      Post.findOne({ slug: req.params.original, status: 'approved' }),
      Post.findOne({ slug: req.params.counter, status: 'approved' }),
    ]);
    if (!original || !counter) return res.status(404).json({ error: 'One or both posts not found' });
    if (counter.parent_id !== original._id.toString()) return res.status(400).json({ error: 'Posts are not related as original/counter' });

    const { vote } = req.body;
    if (!vote || !['original', 'counter'].includes(vote)) return res.status(400).json({ error: 'Vote must be "original" or "counter"' });

    const fingerprint = (req as any).fingerprint || req.headers['x-device-fingerprint'] as string;
    if (!fingerprint) return res.status(400).json({ error: 'Fingerprint required' });

    const voteKey = `better_list:${original._id}:${counter._id}:fp:${fingerprint}`;
    const existing = await redis.get(voteKey);
    if (existing) return res.status(409).json({ error: 'Already voted' });

    const target = vote === 'original' ? original : counter;
    await Post.findByIdAndUpdate(target._id, { $inc: { fire_count: 5 } });
    await redis.set(voteKey, vote, { EX: 86400 * 365 });

    res.json({ success: true, voted: vote });
  } catch (error) {
    console.error('Better list vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// GET /api/posts/:slug/authority-flip — Check if a counter has surpassed the original
router.get('/:slug/authority-flip', async (req, res) => {
  try {
    const parent = await Post.findOne({ slug: req.params.slug });
    if (!parent) return res.status(404).json({ error: 'Post not found' });

    const counters = await Post.find({ parent_id: parent._id.toString(), status: 'approved' })
      .select('title slug fire_count view_count comment_count created_at')
      .sort({ fire_count: -1 })
      .lean() as any[];

    const parentFire = (parent as any).fire_count || 0;
    const flips = counters
      .filter(c => (c.fire_count || 0) > parentFire * 1.2)
      .map(c => ({ title: c.title, slug: c.slug, fire_count: c.fire_count || 0, parent_fire_count: parentFire }));

    res.json({ flips });
  } catch (error) {
    console.error('Authority flip error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
