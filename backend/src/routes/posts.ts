import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Post, generateUniqueSlug } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { Category } from '../models/Category';
import { Comment } from '../models/Comment';
import { atomicCheckRateLimit } from '../lib/redis';
import { calculateEffectivePostLimit, getRateLimitKey } from '../lib/rateLimit';
import { getActiveBoost, grantBoost, BoostType } from '../lib/ladderSystem';
import { checkTitleMatch } from '../lib/titleSimilarity';
import { validateListTitle, needsListTitleValidation, FormatCheckResult } from '../lib/listTitleValidation';
import { updateParentSparkScore } from './comments';
import { computeSparkScore, getThresholds } from '../lib/sparkScore';

const router: Router = Router();

const checkRateLimit = async (fingerprint: string, trustScore: number = 1.0, postType?: string, userId?: string): Promise<{ allowed: boolean; remaining: number; resetTime: number; maxRequests: number }> => {
  try {
    const key = getRateLimitKey('posts', fingerprint);
    const windowMs = 60 * 60 * 1000;

    let maxRequests = calculateEffectivePostLimit(trustScore, postType);

    if (userId) {
      const activeBoost = await getActiveBoost(userId);
      if (activeBoost?.posts && Number.isFinite(activeBoost.posts)) {
        maxRequests += activeBoost.posts;
      }
    }

    if (!Number.isFinite(maxRequests)) {
      maxRequests = calculateEffectivePostLimit(trustScore);
    }

    const { allowed, remaining } = await atomicCheckRateLimit(key, windowMs, maxRequests);
    const now = Date.now();

    return {
      allowed,
      remaining,
      resetTime: now + windowMs,
      maxRequests: Number.isFinite(maxRequests) ? maxRequests : calculateEffectivePostLimit(trustScore),
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    const fallback = calculateEffectivePostLimit(trustScore);
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
    .notEmpty()
    .withMessage('Intro is required')
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
    .isArray({ min: 3 })
    .withMessage('At least 3 items are required'),
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
    .notEmpty()
    .withMessage('Item justification is required')
    .isLength({ max: 2000 })
    .withMessage('Item justification must be less than 2000 characters'),
  body('items.*.image_url')
    .optional()
    .isURL()
    .withMessage('Invalid image URL'),
  body('items.*.source_url')
    .optional()
    .isURL()
    .withMessage('Invalid source URL'),
  body('author_display_name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name must be less than 50 characters'),
];

// GET /api/posts — Approved posts with filtering, sorting, pagination
router.get('/', async (req: Request, res: Response) => {
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
    const query: Record<string, unknown> = { status: 'approved' };

    // Filter by category
    if (category) {
      // Support both category ID and slug (including nested slugs like "business/accounting-tax")
      const categoryDoc = await Category.findOne({ slug: category as string });
      if (categoryDoc) {
        query.category_id = categoryDoc._id;
      } else {
        // Also try by ID if slug doesn't match
        query.category_id = category;
      }
    }

    // Filter by post type
    if (post_type) {
      query.post_type = post_type;
    }

    // Determine sort order
    let sortOption: Record<string, 1 | -1> = { created_at: -1 }; // newest first
    if (sort === 'oldest') {
      sortOption = { created_at: 1 };
    } else if (sort === 'most_commented') {
      sortOption = { comment_count: -1 };
    }

    // Execute query with pagination
    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Post.countDocuments(query),
    ]);

// Format posts
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
      created_at: post.created_at,
      published_at: post.published_at,
      category_slug: post.category_slug,
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
router.get('/check-title', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();

    if (!q || q.length < 3) {
      return res.json({
        allowed: true, blocked: false, warning: false,
        matches: [], etag: '',
      });
    }

    const posts = await Post.find({ status: 'approved' })
      .select('title slug normalized_title category_slug')
      .sort({ created_at: -1 })
      .limit(200)
      .lean();

    const matches: Array<{ title: string; slug: string; category_slug: string; similarity: number }> = [];
    let blocked = false;
    let warned = false;

    for (const post of posts) {
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

    matches.sort((a, b) => b.similarity - a.similarity);

    const etag = `"${Buffer.from(q).toString('base64').substring(0, 16)}"`;
    const formatCheck = validateListTitle(q);

    res.json({
      allowed: !blocked,
      blocked,
      warning: warned,
      matches: matches.slice(0, 5),
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

// GET /api/posts/:idOrSlug — Single post with items and comments
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    // Find approved post - try both _id and slug
    let post: { _id: { toString(): string }; [key: string]: unknown } | null = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findOne({ _id: idOrSlug, status: 'approved' }).lean();
    }
    
    if (!post) {
      post = await Post.findOne({ slug: idOrSlug, status: 'approved' }).lean();
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Increment view count
    await Post.findByIdAndUpdate(post._id, { $inc: { view_count: 1 } });

    // Get list items for this post
    const listItems = await ListItem.find({ post_id: post._id })
      .sort({ rank: 1 })
      .lean();

    // Get comments for this post (top-level only)
    const comments = await Comment.find({
      post_id: post._id,
      parent_comment_id: null,
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
        created_at: post.created_at,
        updated_at: post.updated_at,
        published_at: post.published_at,
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
router.post('/', validatePostSubmission, async (req: Request, res: Response) => {
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
    
    // Reject if no fingerprint — rate limiting requires identity
    const fingerprint = req.user?.device_fingerprint || req.fingerprint || device_fingerprint;
    if (!fingerprint) {
      return res.status(401).json({ error: 'Device identity required for posting' });
    }
    const userId = req.user?.user_id;
    const rateLimitResult = await checkRateLimit(fingerprint, effectiveTrustScore, post_type, userId);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. You can submit ${rateLimitResult.maxRequests ?? 4} posts per hour.`,
        resetTime: rateLimitResult.resetTime,
      });
    }

    // User is guaranteed to exist by fingerprint middleware
    const user = req.user!;

    // Validate list title format for list-type posts
    if (needsListTitleValidation(post_type)) {
      const formatResult = validateListTitle(title);
      if (!formatResult.valid) {
        return res.status(400).json({
          code: 'INVALID_TITLE_FORMAT',
          error: formatResult.error,
          format_code: formatResult.code,
        });
      }
    }

    // Final title similarity check on submit - global (never trust client side validation)
    if (post_type !== 'counter_list') {
      const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
      
      const existingPosts = await Post.find({
        status: 'approved',
        created_at: { $gt: fiveYearsAgo },
      }).select('title');

      for (const existing of existingPosts) {
        const result = checkTitleMatch(title, existing.title);
        if (result.isDuplicate && !result.isYearVariation) {
          return res.status(409).json({
            error: 'This list already exists.',
            suggestion: `${title} ${new Date().getFullYear()}`,
          });
        }
      }
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
      if (!updatedPost) throw new Error('Post lost during creation');

      res.status(201).json({
        message: 'Post submitted successfully. It will be reviewed by an admin.',
        post: {
          id: updatedPost._id,
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
router.get('/:idOrSlug/history', async (req: Request, res: Response) => {
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
router.get('/:idOrSlug/comments', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const { list_item_id } = req.query;

    let post: { _id: { toString(): string } } | null = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findOne({ _id: idOrSlug, status: 'approved' });
    }
    if (!post) {
      post = await Post.findOne({ slug: idOrSlug, status: 'approved' });
    }
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postId = post._id.toString();
    const query: Record<string, unknown> = { post_id: postId };
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
], async (req: Request, res: Response) => {
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
      post = await Post.findOne({ _id: idOrSlug, status: 'approved' });
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

    const { allowed, remaining } = await atomicCheckRateLimit(rateLimitKey, windowMs, limit);
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

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

export default router;
