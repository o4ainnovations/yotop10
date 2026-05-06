import { Router, Request, Response } from 'express';
import { PlatformSnapshot } from '../models/PlatformSnapshot';
import { PageVisit } from '../models/PageVisit';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { UserEvent } from '../models/UserEvent';
import { AlertThreshold } from '../models/AlertThreshold';
import { redis } from '../lib/redis';
import { getClientIp } from '../middleware/fingerprint';

const router = Router();

function parseBrowser(ua: string): string {
  if (!ua) return 'unknown';
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'opera';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'chrome';
  if (/Chromium/.test(ua)) return 'chromium';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'safari';
  return 'other';
}

function parseOS(ua: string): string {
  if (!ua) return 'unknown';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac OS X/.test(ua)) return 'macos';
  if (/Linux/.test(ua) && !/Android/.test(ua)) return 'linux';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  return 'other';
}

function serveCached(res: Response, cacheKey: string, ttl: number, compute: () => Promise<unknown>) {
  return redis.get(cacheKey).then(async (cached) => {
    if (cached) return res.json(JSON.parse(cached));
    const data = await compute();
    await redis.set(cacheKey, JSON.stringify(data), 'EX', ttl);
    return res.json(data);
  }).catch(async () => {
    const data = await compute();
    return res.json(data);
  });
}

// POST /api/analytics/visit — Page visit beacon
router.post('/visit', async (req: Request, res: Response) => {
  try {
    const { path, referer, user_agent, fingerprint } = req.body;
    if (!path) return res.status(400).json({ error: 'path required' });

    await PageVisit.create({
      path, referer: (referer || '').substring(0, 500),
      user_agent: (user_agent || '').substring(0, 300),
      fingerprint: fingerprint || null,
      ip: getClientIp(req),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log visit' });
  }
});

// GET /api/admin/stats/overview
router.get('/stats/overview', async (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:overview', 300, async () => {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!snapshot) return { error: 'No data yet. Wait for first snapshot.' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPosts = await Post.countDocuments({ created_at: { $gte: today } });
    const todayComments = await Comment.countDocuments({ created_at: { $gte: today } });
    const todayUsers = await User.countDocuments({ created_at: { $gte: today } });
    const pending = await Post.countDocuments({ status: 'pending_review' });

    const c = snapshot.content as Record<string, unknown>;
    const co = snapshot.community as Record<string, unknown>;
    const m = snapshot.moderation as Record<string, unknown>;
    const posts = c.posts as Record<string, number>;

    return {
      posts: { total: posts.total || 0, today: todayPosts },
      comments: { total: (c.comments as Record<string, number>)?.total || 0, today: todayComments },
      users: { total: (co.users as Record<string, number>)?.total || 0, today: todayUsers },
      pending: pending,
      approved: posts.approved || 0,
      rejected: posts.rejected || 0,
      trust: { scholars: (co.trust as Record<string, number>)?.scholars || 0, trolls: (co.trust as Record<string, number>)?.trolls || 0 },
      queue: { pending, reviewed_today: (m as Record<string, number>)?.reviews_today || 0 },
    };
  });
});

// GET /api/admin/stats/content
router.get('/stats/content', (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:content', 300, async () => {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!snapshot) return { error: 'No data yet' };
    return snapshot.content;
  });
});

// GET /api/admin/stats/community
router.get('/stats/community', (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:community', 300, async () => {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!snapshot) return { error: 'No data yet' };

    const lurkers = (snapshot.community as Record<string, unknown>)?.users as Record<string, number>;
    const active30d = lurkers?.active_30d || 0;
    const total = lurkers?.total || 1;
    const lurkerCount = total - active30d;

    return {
      ...snapshot.community,
      lurkers: lurkerCount > 0 ? lurkerCount : 0,
      lurker_pct: Math.round((lurkerCount / total) * 100),
      active_pct: Math.round((active30d / total) * 100),
    };
  });
});

// GET /api/admin/stats/moderation
router.get('/stats/moderation', (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:moderation', 300, async () => {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!snapshot) return { error: 'No data yet' };

    const pending = (snapshot.moderation as Record<string, unknown>)?.pending_queue as Record<string, number>;
    const pendingCount = pending?.total || 0;
    const oldestPending = await Post.findOne({ status: 'pending_review' }).sort({ created_at: 1 }).select('created_at').lean();
    const ageHours = oldestPending ? Math.round((Date.now() - new Date(oldestPending.created_at).getTime()) / 3600000) : 0;

    return {
      ...snapshot.moderation,
      pending_queue: { total: pendingCount, oldest_age_hours: ageHours },
    };
  });
});

// GET /api/admin/stats/categories
router.get('/stats/categories', (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:categories', 300, async () => {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!snapshot) return { error: 'No data yet' };
    return snapshot.categories;
  });
});

// GET /api/admin/stats/trends
router.get('/stats/trends', (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:trends', 300, async () => {
    const snapshots = await PlatformSnapshot.find().sort({ date: -1 }).limit(14).lean();
    const weeks: Record<string, unknown>[] = [];
    for (const s of snapshots) {
      const c = s.content as Record<string, unknown>;
      const co = s.community as Record<string, unknown>;
      const m = s.moderation as Record<string, unknown>;
      weeks.push({
        date: s.date,
        posts_total: ((c.posts as Record<string, number>)?.total) || 0,
        posts_submitted: ((c.posts as Record<string, number>)?.submitted) || 0,
        comments_total: ((c.comments as Record<string, number>)?.total) || 0,
        users_total: ((co.users as Record<string, number>)?.total) || 0,
        users_new: ((co.users as Record<string, number>)?.new_today) || 0,
        reviews: (m as Record<string, number>)?.reviews_today || 0,
        pending: ((m as Record<string, unknown>)?.pending_queue as Record<string, number>)?.total || 0,
      });
    }
    return { weeks };
  });
});

// GET /api/admin/stats/quality
router.get('/stats/quality', (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:quality', 300, async () => {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!snapshot) return { error: 'No data yet' };

    const c = snapshot.content as Record<string, unknown>;
    const posts = c.posts as Record<string, number>;
    const submitted = posts.submitted || 0;
    const inRevision = posts.in_revision || 0;
    const revisionRate = submitted > 0 ? Math.round((inRevision / submitted) * 100) : 0;

    return {
      revision_rate: revisionRate,
      rejection_reasons: (snapshot.moderation as Record<string, unknown>)?.rejection_reasons || {},
    };
  });
});

// GET /api/admin/stats/traffic
router.get('/stats/traffic', (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:traffic', 300, async () => {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    const today = new Date().toISOString().substring(0, 10);
    const todayStart = new Date(today + 'T00:00:00.000Z');

    const todayVisits = await PageVisit.countDocuments({ created_at: { $gte: todayStart } });
    const uniqueToday = (await PageVisit.distinct('fingerprint', { created_at: { $gte: todayStart }, fingerprint: { $ne: null } })).length;

    const topPaths = await PageVisit.aggregate([
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const browsers = await PageVisit.aggregate([
      { $match: { created_at: { $gte: todayStart } } },
      { $group: { _id: '$user_agent', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]);

    const browserMap: Record<string, number> = {};
    for (const b of browsers) browserMap[parseBrowser(b._id)] = (browserMap[parseBrowser(b._id)] || 0) + b.count;

    const osMap: Record<string, number> = {};
    for (const b of browsers) osMap[parseOS(b._id)] = (osMap[parseOS(b._id)] || 0) + b.count;

    return {
      visits_today: todayVisits,
      unique_today: uniqueToday,
      top_paths: topPaths.map((p: Record<string, unknown>) => ({ path: p._id, count: p.count })),
      browsers: browserMap,
      os: osMap,
      ...(snapshot?.engagement || {}),
    };
  });
});

// GET /api/admin/stats/submissions
router.get('/stats/submissions', (req: Request, res: Response) => {
  serveCached(res, 'admin:stats:submissions', 300, async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const byHour = await Post.aggregate([
      { $match: { created_at: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const byDay = await Post.aggregate([
      { $match: { created_at: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dayOfWeek: '$created_at' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const byType = await Post.aggregate([
      { $group: { _id: '$post_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const avgItems = await Post.aggregate([
      { $lookup: { from: 'listitems', localField: '_id', foreignField: 'post_id', as: 'items' } },
      { $group: { _id: null, avg: { $avg: { $size: '$items' } } } },
    ]);

    return {
      by_hour: byHour.map((h: Record<string, unknown>) => ({ hour: h._id, count: h.count })),
      by_day: byDay.map((d: Record<string, unknown>) => ({ day: d._id, count: d.count })),
      by_type: byType.map((t: Record<string, unknown>) => ({ type: t._id, count: t.count })),
      avg_items_per_post: Math.round((avgItems[0]?.avg as number) || 0),
    };
  });
});

// GET /api/admin/stats/alerts
router.get('/stats/alerts', async (req: Request, res: Response) => {
  const alerts = await AlertThreshold.find({ enabled: true }).lean();
  const active: unknown[] = [];
  for (const a of alerts) {
    const cached = await redis.get(`alert:${a.metric}`);
    if (cached) active.push(JSON.parse(cached));
  }
  res.json({ thresholds: alerts, active });
});

// GET /api/admin/stats/export?scope=content
router.get('/stats/export', async (req: Request, res: Response) => {
  const { scope } = req.query;
  const filename = `analytics_${scope || 'all'}_${new Date().toISOString().substring(0, 10)}.csv`;

  let data: Record<string, unknown> = {};
  if (scope === 'overview') {
    const cached = await redis.get('admin:stats:overview');
    if (cached) data = JSON.parse(cached);
  } else {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (snapshot) data = snapshot.toObject ? snapshot.toObject() : snapshot;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Object.entries(data).map(([k, v]) => `${k},${JSON.stringify(v)}`).join('\n'));
});

export default router;
