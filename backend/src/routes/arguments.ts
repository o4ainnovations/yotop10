/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { ListItem } from '../models/ListItem';
import { redis } from '../lib/redis';
import { Category } from '../models/Category';
import { getCategoryNameMap } from '../lib/categoryCache';

const router: Router = Router();

const TIME_WINDOWS: Record<string, number> = {
  today: 24,
  week: 168,
  month: 720,
  all: 0,
};

router.get('/', async (req, res) => {
  try {
    const category = (req.query.category as string) || undefined;
    const time = (req.query.time as string) || 'all';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const hoursThreshold = TIME_WINDOWS[time] || 0;
    const timeCutoff = hoursThreshold > 0
      ? new Date(Date.now() - hoursThreshold * 3600000)
      : null;

    let resolvedCategoryId: string | null = null;
    if (category) {
      const cat = await Category.findOne({ slug: category });
      if (cat) {
        resolvedCategoryId = (cat._id as any).toString();
      }
    }

    let slugs: string[] = [];

    try {
      slugs = await redis.zRange('arguments:hot', 0, 199, { REV: true });
    } catch {
      slugs = [];
    }

    let posts: any[];

    if (slugs.length > 0) {
      const orderedSlugs = slugs;
      const baseQuery: Record<string, unknown> = {
        slug: { $in: orderedSlugs },
        status: 'approved',
        deleted: { $ne: true },
        post_type: { $in: ['this_vs_that', 'counter_list'] },
      };

      if (timeCutoff) {
        baseQuery.created_at = { $gte: timeCutoff };
      }

      if (resolvedCategoryId) {
        baseQuery.category_id = resolvedCategoryId;
      }

      const unordered = await Post.find(baseQuery).lean();
      const slugIndex = new Map(unordered.map((p) => [p.slug, p]));
      posts = orderedSlugs.map((s) => slugIndex.get(s)).filter(Boolean);
    } else {
      const fallbackQuery: Record<string, unknown> = {
        post_type: { $in: ['this_vs_that', 'counter_list'] },
        status: 'approved',
        deleted: { $ne: true },
      };

      if (timeCutoff) {
        fallbackQuery.created_at = { $gte: timeCutoff };
      }

      if (resolvedCategoryId) {
        fallbackQuery.category_id = resolvedCategoryId;
      }

      posts = await Post.find(fallbackQuery)
        .sort({ bumped_at: -1, created_at: -1 })
        .lean();
    }

    const total = posts.length;
    const paginated = posts.slice(skip, skip + limit);

    const postIds = paginated.map((p: any) => p._id);
    const comments = await Comment.find({
      post_id: { $in: postIds },
      list_item_id: { $ne: null },
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
      hidden: { $ne: true },
    })
      .sort({ fire_count: -1 })
      .lean();

    const commentsByPost: Record<string, any[]> = {};
    for (const c of comments) {
      const pid = c.post_id.toString();
      if (!commentsByPost[pid]) commentsByPost[pid] = [];
      commentsByPost[pid].push(c);
    }

    const listItemIds = [...new Set(comments.filter((c: any) => c.list_item_id).map((c: any) => c.list_item_id))];
    const items = await ListItem.find({ _id: { $in: listItemIds } })
      .select('_id title')
      .lean();
    const itemTitleMap = new Map(items.map((i: any) => [i._id.toString(), i.title]));

    const velocityKeys = paginated.map((p: any) => `arguments:velocity:${p._id}`);
    const velocities: Record<string, number> = {};
    if (velocityKeys.length > 0) {
      try {
        const vals = await redis.mGet(velocityKeys);
        paginated.forEach((p: any, i: number) => {
          velocities[p._id.toString()] = parseInt(vals[i] || '0', 10);
        });
      } catch {
        paginated.forEach((p: any) => {
          velocities[p._id.toString()] = 0;
        });
      }
    }

    const categoryNameMap = await getCategoryNameMap();
    const argCatName = (slug: string) => categoryNameMap.get(slug) || slug;

    const formatted = paginated.map((post: any) => {
      const pid = post._id.toString();
      const postComments = commentsByPost[pid] || [];
      const anchoredComments = postComments.filter((c: any) => c.list_item_id);
      const totalAnchored = anchoredComments.length;
      const supportCount = anchoredComments.filter((c: any) => c.fire_count >= 3).length;
      const contradictCount = anchoredComments.filter((c: any) => c.fire_count < 3).length;
      const supportPct = totalAnchored > 0 ? Math.round((supportCount / totalAnchored) * 100) : 0;
      const contradictPct = totalAnchored > 0 ? Math.round((contradictCount / totalAnchored) * 100) : 0;

      const topComments = anchoredComments.slice(0, 3).map((c: any) => ({
        rank: c.list_item_id ? 0 : 0,
        item_title: c.list_item_id ? itemTitleMap.get(c.list_item_id.toString()) || null : null,
        content: (c.content as string).substring(0, 100),
        author_username: c.author_username,
        fire_count: c.fire_count,
      }));

      const lastActivity = post.bumped_at || post.created_at;

      return {
        id: post._id,
        slug: post.slug,
        title: post.title,
        post_type: post.post_type,
        category_slug: post.category_slug,
        category_name: argCatName(post.category_slug),
        author_username: post.author_username,
        author_display_name: post.author_display_name,
        comment_count: post.comment_count,
        view_count: post.view_count,
        velocity: velocities[pid] || 0,
        last_active: lastActivity,
        top_comments: topComments,
        support_pct: supportPct,
        contradict_pct: contradictPct,
      };
    });

    res.json({
      arguments: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Arguments error:', error);
    res.status(500).json({ error: 'Failed to fetch arguments' });
  }
});

export default router;
