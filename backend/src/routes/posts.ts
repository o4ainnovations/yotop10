import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Post, generateUniqueSlug } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { Comment } from '../models/Comment';
import { createClient } from 'redis';
import { calculateEffectivePostLimit } from '../lib/rateLimit';
import { getActiveBoost } from '../lib/ladderSystem';
import { checkTitleMatch } from '../lib/titleSimilarity';
import { normalizeTitle } from '../lib/titleNormalization';

const router: Router = Router();

// GET /api/posts/check-title
// Check for similar titles before submission
router.get('/check-title', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const categoryId = req.query.categoryId as string;

    if (!query || query.length < 8) {
      return res.json({
        allowed: true,
        blocked: false,
        warning: false,
        matches: [],
      });
    }

    if (query === 'counter_list') {
      return res.json({
        allowed: true,
        blocked: false,
        warning: false,
        matches: [],
      });
    }

    // Check posts from last 5 years, same category, approved only
    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    
    const posts = await Post.find({
      category_id: categoryId,
      status: 'approved',
      created_at: { $gt: fiveYearsAgo },
    }).select('title slug');

    const matches = [];
    let blocked = false;
    let warning = false;
    let suggestion;

    for (const post of posts) {
      const result = checkTitleMatch(query, post.title);
      
      if (result.isYearVariation) {
        const currentYear = new Date().getFullYear();
        suggestion = `${query} ${currentYear}`;
        continue;
      }

      if (result.isDuplicate) {
        blocked = true;
        matches.push({
          title: post.title,
          slug: post.slug,
          similarity: result.similarity,
        });
      } else if (result.isWarning) {
        warning = true;
      }
    }

    return res.json({
      allowed: !blocked,
      blocked,
      warning,
      matches,
      suggestion,
      etag: crypto.randomBytes(8).toString('hex'),
    });

  } catch (error) {
    // Fail open behaviour - allow everything on any error
    return res.json({
      allowed: true,
      blocked: false,
      warning: false,
      matches: [],
    });
  }
});

// Initialize Redis client for rate limiting
const getRedisClient = async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = createClient({ url: redisUrl });
  await client.connect();
  return client;
};



// Check rate limit (4 posts per hour per fingerprint)
const checkRateLimit = async (fingerprint: string, trustScore: number = 1.0, postType?: string, userId?: string): Promise<{ allowed: boolean; remaining: number; resetTime: number; maxRequests: number }> => {
  try {
    const redis = await getRedisClient();
    const key = `rate_limit:posts:${fingerprint}`;
    const windowMs = 60 * 60 * 1000; // 1 hour
    
    let maxRequests = calculateEffectivePostLimit(trustScore, postType);
    
    // Add active boost if available
    if (userId) {
      const activeBoost = await getActiveBoost(userId);
      if (activeBoost) {
        maxRequests += activeBoost.posts;
      }
    }

    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old entries
    await redis.zRemRangeByScore(key, '0', windowStart.toString());

    // Count current requests
    const requestCount = await redis.zCard(key);

    if (requestCount >= maxRequests) {
      // Calculate reset time as now + windowMs (since we can't easily get the oldest entry)
      const resetTime = now + windowMs;
      await redis.disconnect();
      return { allowed: false, remaining: 0, resetTime, maxRequests };
    }

    // Add current request
    await redis.zAdd(key, { score: now, value: now.toString() });
    await redis.expire(key, Math.ceil(windowMs / 1000));

    await redis.disconnect();
    return { allowed: true, remaining: maxRequests - requestCount - 1, resetTime: now + windowMs, maxRequests };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // If Redis fails, allow the request (fail open)
    const fallbackLimit = Math.floor(3 * trustScore);
    return { allowed: true, remaining: fallbackLimit, resetTime: Date.now() + 60 * 60 * 1000, maxRequests: fallbackLimit };
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
    .notEmpty()
    .withMessage('Category ID is required')
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
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
        .populate('category_id', 'name slug icon')
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
      category: post.category_id
        ? {
            id: (post.category_id as unknown as { _id: string })._id,
            name: (post.category_id as unknown as { name: string }).name,
            slug: (post.category_id as unknown as { slug: string }).slug,
            icon: (post.category_id as unknown as { icon?: string }).icon,
          }
        : null,
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

// GET /api/posts/:idOrSlug — Single post with items and comments
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    // Find approved post - try both _id and slug
    let post: any;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findOne({ _id: idOrSlug, status: 'approved' })
        .populate('category_id', 'name slug icon')
        .lean();
    }
    
    if (!post) {
      post = await Post.findOne({ slug: idOrSlug, status: 'approved' })
        .populate('category_id', 'name slug icon')
        .lean();
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
        view_count: post.view_count + 1,
        author_id: post.author_id,
        author_username: post.author_username,
        author_display_name: post.author_display_name,
        category: post.category_id
          ? {
              id: (post.category_id as unknown as { _id: string })._id,
              name: (post.category_id as unknown as { name: string }).name,
              slug: (post.category_id as unknown as { slug: string }).slug,
              icon: (post.category_id as unknown as { icon?: string }).icon,
            }
          : null,
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
      items,
      author_display_name,
      device_fingerprint,
    } = req.body;

    // Apply per-user rate limit override if set
    let effectiveTrustScore = req.user?.trust_score || 1.0;
    
    // Check for admin override
    if (req.user?.rate_limit_override?.posts_per_hour) {
      effectiveTrustScore = req.user.rate_limit_override.posts_per_hour / 4;
    }
    
    // Check rate limit with trust score multiplier
    // Use fingerprint from middleware - works for both authenticated and grace period users
    const fingerprint = req.user?.device_fingerprint || req.fingerprint || device_fingerprint;
    const userId = req.user?.user_id;
    const rateLimitResult = await checkRateLimit(fingerprint, effectiveTrustScore, post_type, userId);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. You can submit ${rateLimitResult.maxRequests ?? 4} posts per hour.`,
        resetTime: rateLimitResult.resetTime,
      });
    }

    // Verify category exists
    const category = await Category.findById(category_id);
    if (!category) {
      return res.status(400).json({ error: 'Category not found' });
    }

    // User is guaranteed to exist by fingerprint middleware
    const user = req.user!;

    // Final title similarity check on submit - never trust client side validation
    if (post_type !== 'counter_list') {
      const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
      
      const existingPosts = await Post.find({
        category_id,
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
    let post = await Post.create({
      author_id: user.user_id,
      author_username: user.username,
      author_display_name: author_display_name || user.username,
      title,
      post_type,
      intro,
      status: 'pending_review',
      category_id,
      fire_count: 0,
      comment_count: 0,
      view_count: 0,
      slug: `temp-${crypto.randomBytes(8).toString('hex')}`, // Temporary slug to pass validation
    });
    
    // Generate final slug with ID
    const finalSlug = generateUniqueSlug(title, post._id.toString());
    await Post.findByIdAndUpdate(
      post._id,
      { slug: finalSlug }
    );
    
    // Refresh post with slug
    post = (await Post.findById(post._id))!;

    // Create list items
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

    // Update category post count
    await Category.findByIdAndUpdate(category_id, { $inc: { post_count: 1 } });

    res.status(201).json({
      message: 'Post submitted successfully. It will be reviewed by an admin.',
      post: {
        id: post._id,
        title: post.title,
        status: post.status,
        created_at: post.created_at,
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
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// GET /api/posts/:idOrSlug/history — Get post revision history
router.get('/:idOrSlug/history', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    let post: any;
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

export default router;
