/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import mongoose from 'mongoose';
import { SavedPost } from '../models/SavedPost';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
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

    const { post_id } = req.body;
    if (!post_id || !mongoose.Types.ObjectId.isValid(post_id)) {
      return res.status(400).json({ error: 'Invalid post_id' });
    }

    const userId = req.user.user_id;

    const existing = await SavedPost.findOne({ user_id: userId, post_id }).lean();
    if (existing) {
      return res.json({ success: true, bookmarked: true, already: true });
    }

    await SavedPost.create({ user_id: userId, post_id });

    await Post.findByIdAndUpdate(post_id, { $inc: { bookmark_count: 1 } });

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
      await Post.findByIdAndUpdate(post_id, { $inc: { bookmark_count: -1 } });
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

    const postIds = saves.map((s: any) => s.post_id);

    const posts = await Post.find({
      _id: { $in: postIds },
      status: 'approved',
      deleted: { $ne: true },
    })
      .select('slug title post_type author_username category_slug view_count comment_count format hero_image_url created_at')
      .lean();

    const postsMap = new Map<string, any>();
    for (const p of posts) {
      postsMap.set((p._id as any).toString(), p);
    }

    const allItems = await ListItem.find({ post_id: { $in: postIds } })
      .sort({ rank: 1 })
      .select('post_id rank title')
      .lean();

    const itemsByPost: Record<string, Array<{ rank: number; title: string }>> = {};
    for (const item of allItems) {
      const pid = ((item as any).post_id?.toString() || '') as string;
      if (!itemsByPost[pid]) itemsByPost[pid] = [];
      if (itemsByPost[pid].length < 3) itemsByPost[pid].push({ rank: item.rank, title: item.title });
    }

    const resultPosts = saves.map((s: any) => {
      const pid = s.post_id.toString();
      const post = postsMap.get(pid);
      if (!post) return null;
      return {
        id: pid,
        slug: post.slug,
        title: post.title,
        post_type: post.post_type,
        author_username: post.author_username,
        category_slug: post.category_slug,
        view_count: post.view_count,
        comment_count: post.comment_count,
        format: post.format,
        hero_image_url: post.hero_image_url,
        created_at: post.created_at,
        saved_at: s.saved_at,
        topItems: itemsByPost[pid] || [],
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
