/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { Post } from '../models/Post';
import { User } from '../models/User';
import { ListItem } from '../models/ListItem';
import { computeExploreScore, trackExploreView, type ExploreSignals } from '../lib/exploreScore';

const router: Router = Router();

router.get('/', async (req: any, res: any) => {
  try {
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit as string) || 20));
    const page = Math.max(1, parseInt(req.query.page as string) || 1);

    const posts = await Post.find({ status: 'approved', deleted: { $ne: true } })
      .sort({ created_at: -1 })
      .limit(200)
      .lean();

    if (posts.length === 0) {
      return res.json({ posts: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    const recentlyViewed: string[] = [];
    if (req.user) {
      try {
        const user = await User.findOne({ user_id: req.user.user_id }).select('last_viewed_categories').lean();
        if ((user as any)?.last_viewed_categories) {
          recentlyViewed.push(...((user as any).last_viewed_categories as string[]));
        }
      } catch { /* user not found — fresh */ }
    }

    const scores = await Promise.all(
      posts.map(async (post) => {
        const signals: ExploreSignals = {
          published_at: post.published_at || post.created_at,
          comment_count: post.comment_count || 0,
          view_count: post.view_count || 0,
          bookmark_count: (post as any).bookmark_count || 0,
          author_trust_score: 1.0,
          category_slug: (post as any).category_slug || '',
          bumped_at: post.bumped_at || null,
        };

        try {
          const userDoc = await User.findOne({ user_id: post.author_id }).select('trust_score').lean();
          if (userDoc) signals.author_trust_score = userDoc.trust_score;
        } catch { /* default 1.0 */ }

        const score = await computeExploreScore((post._id as any).toString(), signals, recentlyViewed);
        return { ...score, slug: post.slug, title: post.title, post_type: post.post_type, category_slug: signals.category_slug, author_username: post.author_username, author_display_name: post.author_display_name, comment_count: signals.comment_count, view_count: signals.view_count, format: (post as any).format || 'list_only', hero_image_url: (post as any).hero_image_url || null, created_at: post.created_at, topItems: [] as Array<{ rank: number; title: string }> };
      })
    );

    const allItems = await ListItem.find({ post_id: { $in: posts.map((p) => p._id) } }).sort({ rank: 1 }).select('post_id rank title').lean();
    const itemsByPost: Record<string, Array<{ rank: number; title: string }>> = {};
    for (const item of allItems) {
      const pid = (item as any).post_id?.toString() || '';
      if (!itemsByPost[pid]) itemsByPost[pid] = [];
      if (itemsByPost[pid].length < 3) itemsByPost[pid].push({ rank: item.rank, title: item.title });
    }

    for (const s of scores) {
      const pid = scores.find((x) => x.post_id === s.post_id);
      if (pid) pid.topItems = itemsByPost[pid.post_id] || [];
    }

    scores.sort((a, b) => b.score - a.score);

    const start = (page - 1) * limit;
    const paginated = scores.slice(start, start + limit);

    res.json({
      posts: paginated.map((s) => ({
        id: s.post_id,
        slug: s.slug,
        title: s.title,
        post_type: s.post_type,
        category_slug: s.category_slug,
        author_username: s.author_username,
        author_display_name: s.author_display_name,
        comment_count: s.comment_count,
        view_count: s.view_count,
        format: s.format,
        hero_image_url: s.hero_image_url,
        topItems: s.topItems,
        explore_score: s.score,
        created_at: s.created_at,
      })),
      pagination: { page, limit, total: scores.length, totalPages: Math.ceil(scores.length / limit) },
    });
  } catch (e) {
    console.error('Explore error:', e);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/view', async (req: any, res: any) => {
  try {
    const { post_id } = req.body;
    if (post_id) {
      await trackExploreView(post_id);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
