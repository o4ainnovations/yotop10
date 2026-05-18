import { Router } from 'express';
import { HallOfFame } from '../models/HallOfFame';

const router: Router = Router();

// GET /api/hall-of-fame — Public: featured posts sorted by sort_order
router.get('/', async (_req, res) => {
  try {
    const entries = await HallOfFame.find()
      .sort({ sort_order: 1, featured_at: -1 })
      .populate('post_id')
      .lean();

    const valid = entries.filter((e: Record<string, unknown>) => {
      const post = e.post_id as Record<string, unknown> | null;
      if (!post) return false;
      if (post.deleted) return false;
      if (post.status !== 'approved') return false;
      return true;
    });

    const mapped = valid.map((e: Record<string, unknown>) => {
      const raw = e.post_id as Record<string, unknown>;
      return {
        id: (e._id as { toString(): string }).toString(),
        post_id: raw ? (raw._id as { toString(): string }).toString() : '',
        post: raw ? {
          id: (raw._id as { toString(): string }).toString(),
          slug: raw.slug || '',
          title: raw.title || '',
          intro: raw.intro || '',
          post_type: raw.post_type || '',
          comment_count: raw.comment_count || 0,
          view_count: raw.view_count || 0,
          author_username: raw.author_username || '',
          author_display_name: raw.author_display_name || '',
          category_slug: raw.category_slug || '',
          hero_image_url: raw.hero_image_url || null,
          format: raw.format || 'list_only',
          created_at: raw.created_at || new Date().toISOString(),
        } : null,
        editorial_note: e.editorial_note || null,
        featured_at: e.featured_at || new Date().toISOString(),
        sort_order: e.sort_order || 0,
        created_by: e.created_by || '',
      };
    });

    res.json({ featured: mapped });
  } catch (error) {
    console.error('Error fetching Hall of Fame:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch Hall of Fame entries' });
  }
});

export default router;
