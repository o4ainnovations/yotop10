/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import mongoose from 'mongoose';
import { SavedPost } from '../models/SavedPost';
import { Post } from '../models/Post';
import { Article } from '../models/Article';
import { redis } from '../lib/redis';

const router: Router = Router();

const SAVED_SET_TTL = 3600;

const savedKey = (userId: string): string => `saved:posts:${userId}`;

// POST /api/bookmarks/save — Bookmark a post
router.post('/save', async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { post_id, content_type } = req.body;
    if (!post_id || !mongoose.Types.ObjectId.isValid(post_id)) {
      return res.status(400).json({ error: 'Invalid post_id' });
    }

    const userId = req.user.user_id;
    const type = (content_type === 'article') ? 'article' : 'post';

    const existing = await SavedPost.findOne({ user_id: userId, post_id }).lean();
    if (existing) {
      return res.json({ success: true, bookmarked: true, already: true });
    }

    await SavedPost.create({ user_id: userId, post_id, content_type: type });

    if (type === 'article') {
      await Article.findByIdAndUpdate(post_id, { $inc: { bookmark_count: 1 } });
    } else {
      await Post.findByIdAndUpdate(post_id, { $inc: { bookmark_count: 1 } });
    }

    try {
      const key = savedKey(userId);
      await redis.sAdd(key, post_id.toString());
      await redis.expire(key, SAVED_SET_TTL);
    } catch { /* Redis failure is non-fatal */ }

    res.json({ success: true, bookmarked: true });
  } catch (error) {
    console.error('Bookmark save error:', error);
    res.status(500).json({ error: 'Failed to bookmark post' });
  }
});

// DELETE /api/bookmarks/save — Remove bookmark
router.delete('/save', async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { post_id } = req.body;
    if (!post_id || !mongoose.Types.ObjectId.isValid(post_id)) {
      return res.status(400).json({ error: 'Invalid post_id' });
    }

    const userId = req.user.user_id;

    const deleted = await SavedPost.findOneAndDelete({ user_id: userId, post_id });

    if (deleted) {
      if (deleted.content_type === 'article') {
        await Article.findByIdAndUpdate(post_id, { $inc: { bookmark_count: -1 } });
      } else {
        await Post.findByIdAndUpdate(post_id, { $inc: { bookmark_count: -1 } });
      }
    }

    try {
      await redis.sRem(savedKey(userId), post_id.toString());
    } catch { /* Redis failure is non-fatal */ }

    res.json({ success: true, bookmarked: false });
  } catch (error) {
    console.error('Bookmark remove error:', error);
    res.status(500).json({ error: 'Failed to remove bookmark' });
  }
});

// GET /api/bookmarks/saved — Get user's bookmarked posts (paginated)
router.get('/saved', async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.user_id;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const page = Math.max(1, parseInt(req.query.page as string) || 1);

    const total = await SavedPost.countDocuments({ user_id: userId });

    if (total === 0) {
      return res.json({ posts: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    const saves = await SavedPost.find({ user_id: userId })
      .sort({ saved_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const postIds: string[] = [];
    const articleIds: string[] = [];
    for (const s of saves as any[]) {
      if (s.content_type === 'article') articleIds.push(s.post_id.toString());
      else postIds.push(s.post_id.toString());
    }

    const posts = await Post.find({
      _id: { $in: postIds },
      status: 'approved',
      deleted: { $ne: true },
    })
      .select('slug title post_type author_username category_slug view_count comment_count format hero_image_url created_at')
      .lean();

    const articles = await Article.find({
      _id: { $in: articleIds },
      status: 'approved',
    })
      .select('slug title author_username category_slug view_count comment_count cover_image created_at reading_time')
      .lean();

    const contentMap = new Map<string, any>();
    for (const p of posts) contentMap.set((p._id as any).toString(), p);
    for (const a of articles) contentMap.set((a._id as any).toString(), a);

    const resultPosts = (saves as any[]).map((s) => {
      const pid = s.post_id.toString();
      const item = contentMap.get(pid);
      if (!item) return null;
      const isArticle = s.content_type === 'article';
      return {
        id: pid,
        slug: item.slug,
        title: item.title,
        post_type: isArticle ? 'article' : (item.post_type || 'list'),
        author_username: item.author_username,
        category_slug: item.category_slug,
        view_count: item.view_count,
        comment_count: item.comment_count,
        hero_image_url: isArticle ? item.cover_image : item.hero_image_url,
        created_at: item.created_at,
        saved_at: s.saved_at,
        reading_time: isArticle ? item.reading_time : undefined,
      };
    }).filter(Boolean);

    res.json({
      posts: resultPosts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Bookmarks list error:', error);
    res.status(500).json({ error: 'Failed to list bookmarks' });
  }
});

// GET /api/bookmarks/check?post_id= — Quick check if a post is bookmarked
router.get('/check', async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { post_id } = req.query;
    if (!post_id || typeof post_id !== 'string') {
      return res.status(400).json({ error: 'Missing post_id query parameter' });
    }

    const userId = req.user.user_id;

    // Try Redis first (O(1))
    let bookmarked = false;
    try {
      const member = await redis.sIsMember(savedKey(userId), post_id);
      if (member) {
        return res.json({ bookmarked: true });
      }
      // If key doesn't exist, sIsMember returns false — fall through to MongoDB
      // If key exists and member not found, confidently return false
      const keyExists = await redis.exists(savedKey(userId));
      if (keyExists) {
        return res.json({ bookmarked: false });
      }
    } catch { /* Redis down — fall through to MongoDB */ }

    // MongoDB fallback
    if (mongoose.Types.ObjectId.isValid(post_id)) {
      bookmarked = !!(await SavedPost.findOne({ user_id: userId, post_id }).lean());
    } else {
      // Look up by slug
      const post = await Post.findOne({ slug: post_id }).select('_id').lean();
      if (post) {
        bookmarked = !!(await SavedPost.findOne({ user_id: userId, post_id: post._id }).lean());
      }
    }

    res.json({ bookmarked });
  } catch (error) {
    console.error('Bookmark check error:', error);
    res.status(500).json({ error: 'Failed to check bookmark status' });
  }
});

export default router;
