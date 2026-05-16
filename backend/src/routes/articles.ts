/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { Article } from '../models/Article';
import { redis } from '../lib/redis';
import { logAudit } from '../lib/auditWriter';
import { getClientIp } from '../middleware/fingerprint';

const router: Router = Router();

const generateArticleSlug = (title: string, id: string): string => {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-+$/, '');
  }

  const idSuffix = id.substring(id.length - 6);
  return `${slug}-${idSuffix}`;
};

// Validation middleware
const validateArticleSubmission = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('body')
    .trim()
    .notEmpty()
    .withMessage('Body is required')
    .isLength({ min: 100 })
    .withMessage('Body must be at least 100 characters'),
  body('category_slug')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),
  body('cover_image')
    .optional()
    .isURL()
    .withMessage('Invalid cover image URL'),
  body('sources')
    .optional()
    .isArray()
    .withMessage('Sources must be an array'),
  body('sources.*.url')
    .optional()
    .isURL()
    .withMessage('Invalid source URL'),
  body('sources.*.title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Source title is required when source URL is provided'),
];

// GET /api/articles — All approved articles (paginated)
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      category,
      sort = 'newest',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = { status: 'approved' };

    if (category) {
      query.category_slug = category;
    }

    let sortOption: Record<string, 1 | -1> = { created_at: -1 };
    if (sort === 'oldest') {
      sortOption = { created_at: 1 };
    } else if (sort === 'most_viewed') {
      sortOption = { view_count: -1 };
    }

    const [articles, total] = await Promise.all([
      Article.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Article.countDocuments(query),
    ]);

    const formattedArticles = articles.map((article) => ({
      id: article._id,
      slug: article.slug,
      title: article.title,
      body: (article.body || '').substring(0, 300),
      reading_time: article.reading_time,
      cover_image: article.cover_image || null,
      author_username: article.author_username,
      author_display_name: article.author_display_name,
      view_count: article.view_count,
      comment_count: article.comment_count,
      bookmark_count: article.bookmark_count,
      category_slug: article.category_slug,
      created_at: article.created_at,
    }));

    res.json({
      articles: formattedArticles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// GET /api/articles/:slug — Single article by slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const article = await Article.findOne({ slug, status: 'approved' }).lean();

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Unique view counting: same fingerprint + same article = 1 view per 30 min
    const viewerFp =
      req.user?.device_fingerprint ||
      (req.headers['x-device-fingerprint'] as string) ||
      req.ip ||
      'unknown';
    const viewKey = `article_view:${article._id}:${viewerFp}`;
    const alreadyViewed = await redis.get(viewKey);
    if (!alreadyViewed) {
      await Promise.all([
        Article.findByIdAndUpdate(article._id, { $inc: { view_count: 1 } }),
        redis.set(viewKey, '1', { EX: 1800 }),
      ]);
    }

    res.json({
      article: {
        id: article._id,
        slug: article.slug,
        title: article.title,
        body: article.body,
        reading_time: article.reading_time,
        cover_image: article.cover_image || null,
        sources: article.sources || [],
        fact_check_status: article.fact_check_status,
        author_id: article.author_id,
        author_username: article.author_username,
        author_display_name: article.author_display_name,
        view_count: (article.view_count as number) + 1,
        comment_count: article.comment_count,
        bookmark_count: article.bookmark_count,
        category_slug: article.category_slug,
        status: article.status,
        created_at: article.created_at,
        updated_at: article.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// POST /api/articles — Submit article (fingerprint auth)
router.post('/', ...validateArticleSubmission as any[], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, body: articleBody, category_slug, cover_image, sources } = req.body;

    // Fingerprint auth required
    const user = req.user;
    if (!user || !user.device_fingerprint || user.device_fingerprint === 'unknown') {
      return res.status(401).json({ error: 'Device identity required for submission' });
    }

    if (user.restricted_until && new Date() < new Date(user.restricted_until)) {
      const remaining = Math.ceil(
        (new Date(user.restricted_until).getTime() - Date.now()) / 60000
      );
      return res.status(429).json({
        error: `Account restricted. Resumes in ${remaining} minutes.`,
        resetTime: user.restricted_until,
      });
    }

    const readingTime = Math.ceil(articleBody.split(/\s+/).length / 200);

    const mappedSources = sources && Array.isArray(sources)
      ? sources.map((s: { url: string; title: string }) => ({
          url: s.url,
          title: s.title,
          accessed_at: new Date(),
        }))
      : [];

    const article = await Article.create({
      author_id: user.user_id,
      author_username: user.username,
      author_display_name: user.custom_display_name || user.username,
      title,
      body: articleBody,
      reading_time: readingTime,
      cover_image: cover_image || undefined,
      sources: mappedSources,
      category_slug,
      status: 'pending_review',
      view_count: 0,
      comment_count: 0,
      bookmark_count: 0,
      slug: `temp-${crypto.randomBytes(8).toString('hex')}`,
    });

    const finalSlug = generateArticleSlug(title, article._id.toString());
    await Article.findByIdAndUpdate(article._id, { slug: finalSlug });
    const updatedArticle = await Article.findById(article._id);
    if (!updatedArticle) {
      await Article.findByIdAndDelete(article._id);
      throw new Error('Article lost during creation');
    }

    logAudit({
      admin_id: user.user_id,
      action: 'submit_article',
      ip: getClientIp(req),
      metadata: {
        article_id: updatedArticle._id.toString(),
        title,
        category_slug,
      },
      user_agent: req.headers['user-agent'] || '',
    });

    res.status(201).json({
      message: 'Article submitted successfully. It will be reviewed by an admin.',
      article: {
        id: updatedArticle._id,
        title: updatedArticle.title,
        slug: updatedArticle.slug,
        status: updatedArticle.status,
        created_at: updatedArticle.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

export default router;
