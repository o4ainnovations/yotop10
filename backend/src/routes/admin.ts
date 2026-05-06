import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AdminUser } from '../models/AdminUser';
import { SetupToken } from '../models/SetupToken';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import { Notification, createNotification } from '../models/Notification';
import { AuditLog } from '../models/AuditLog';
import { logAudit, getAuditStats } from '../lib/auditWriter';
import { getClientIp } from '../middleware/fingerprint';
import {
  adminAuthMiddleware,
  generateAdminToken,
  checkAccountLock,
  recordFailedLogin,
  resetLoginAttempts,
  AdminAuthRequest,
} from '../lib/adminAuth';
import { PlatformSnapshot } from '../models/PlatformSnapshot';
import { PageVisit } from '../models/PageVisit';
import { User } from '../models/User';
import { Comment } from '../models/Comment';
import { AlertThreshold } from '../models/AlertThreshold';
import { AlertHistory } from '../models/AlertHistory';
import { UserEvent } from '../models/UserEvent';
import { redis } from '../lib/redis';

const router: Router = Router();

const PUBLIC_PATHS = new Set(['/login', '/setup', '/setup/validate']);

router.use((req: AdminAuthRequest, res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  return adminAuthMiddleware(req, res, next);
});

/**
 * POST /api/admin/login
 * Public — brute-force protected via IP rate limit + account lock
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const clientIp = getClientIp(req);
    const rateLimitKey = `admin_login:${clientIp}`;
    const maxIpAttempts = 10;
    const windowSeconds = 15 * 60;

    // Audit: log every login attempt BEFORE rate limit (never blocked by throttling)
    logAudit({
      admin_id: null,
      action: 'login_failed',
      ip: clientIp,
      metadata: { username_attempted: (username || '').substring(0, 100), stage: 'attempt_start' },
      user_agent: req.headers['user-agent'] || '',
    });

    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, windowSeconds);
    if (attempts > maxIpAttempts) {
      return res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many attempts. Try again in 15 minutes.' });
    }

    const admin = await AdminUser.findOne({ username });
    if (!admin) {
      logAudit({
        admin_id: null,
        action: 'login_failed',
        ip: clientIp,
        metadata: { username_attempted: (username || '').substring(0, 100), stage: 'no_admin_found' },
      });
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' });
    }

    const locked = await checkAccountLock(admin);
    if (locked) {
      return res.status(429).json({ code: 'ACCOUNT_LOCKED', error: 'Account temporarily locked. Try again later.' });
    }

    const passwordValid = await bcrypt.compare(password, admin.password_hash);
    if (!passwordValid) {
      await recordFailedLogin(admin);
      logAudit({
        admin_id: (admin._id as { toString(): string }).toString(),
        action: 'login_failed',
        ip: clientIp,
        metadata: { username: admin.username, stage: 'wrong_password' },
      });
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' });
    }

    await resetLoginAttempts(admin._id);

    logAudit({
      admin_id: (admin._id as { toString(): string }).toString(),
      action: 'login_success',
      ip: clientIp,
      metadata: { username: admin.username },
    });

    const token = generateAdminToken(
      (admin._id as { toString(): string }).toString(),
      admin.username,
      admin.token_version
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      admin: { id: admin._id, username: admin.username },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Login failed' });
  }
});

/**
 * POST /api/admin/setup
 * Public — one-time setup token required
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { token, username, password } = req.body;

    const setupToken = await SetupToken.findOne({
      token,
      expires_at: { $gt: new Date() },
      used: false,
    });

    if (!setupToken) {
      return res.status(400).json({ code: 'TOKEN_INVALID', error: 'Invalid or expired setup token' });
    }

    if (!username || username.length < 3) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Username must be at least 3 characters' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await AdminUser.deleteMany({});

    const admin = await AdminUser.create({
      username,
      password_hash: passwordHash,
    });

    await SetupToken.findByIdAndUpdate(setupToken._id, { used: true });

    const authToken = generateAdminToken(
      (admin._id as { toString(): string }).toString(),
      admin.username,
      admin.token_version
    );

    res.cookie('admin_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      admin: { id: admin._id, username: admin.username },
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Setup failed' });
  }
});

/**
 * GET /api/admin/setup/validate
 * Public — checks if a setup token is still valid
 */
router.get('/setup/validate', async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string' || token.length < 8) {
    return res.json({ valid: false });
  }

  const setupToken = await SetupToken.findOne({
    token,
    expires_at: { $gt: new Date() },
    used: false,
  });

  res.json({ valid: !!setupToken });
});

/**
 * GET /api/admin/me
 * Protected — get current admin user
 */
router.get('/me', async (req: AdminAuthRequest, res: Response) => {
  res.json({
    id: req.admin!.id,
    username: req.admin!.username,
  });
});

/**
 * POST /api/admin/logout
 * Protected — invalidate admin session
 */
router.post('/logout', async (req: AdminAuthRequest, res: Response) => {
  await AdminUser.findByIdAndUpdate(req.admin!.id, { $inc: { token_version: 1 } });
  logAudit({
    admin_id: req.admin!.id,
    action: 'logout',
    ip: getClientIp(req),
    metadata: { username: req.admin!.username },
  });
  res.clearCookie('admin_token');
  res.json({ success: true });
});

/**
 * GET /api/admin/posts/pending
 * Protected — list pending posts for review
 */
router.get('/posts/pending', async (req: AdminAuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ status: 'pending_review' })
      .sort({ created_at: 1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Post.countDocuments({ status: 'pending_review' });

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching pending posts:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch pending posts' });
  }
});

/**
 * GET /api/admin/posts/pending/:id
 * Protected — get full pending post preview
 */
router.get('/posts/pending/:id', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    }

    if (post.status !== 'pending_review') {
      return res.status(400).json({ code: 'INVALID_STATUS', error: 'Post is not pending review' });
    }

    const rawItems = await ListItem.find({ post_id: post._id })
      .sort({ rank: 1 })
      .select('rank title justification')
      .lean();

    const items = rawItems.map((item: Record<string, unknown>) => ({
      id: (item._id as mongoose.Types.ObjectId).toString(),
      rank: item.rank,
      title: item.title,
      justification: item.justification,
    }));

    res.json({ post: { ...post.toObject(), items } });
  } catch (error) {
    console.error('Error fetching pending post:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch post' });
  }
});

/**
 * PATCH /api/admin/posts/:id/approve
 * Protected — approve post and publish to public feed
 */
router.patch('/posts/:id/approve', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    }

    if (post.status === 'approved') {
      return res.status(400).json({ code: 'ALREADY_APPROVED', error: 'Post is already approved' });
    }

    post.status = 'approved';
    post.published_at = new Date();
    await post.save();

    await trustScoreWorker.queueUpdate(
      post.author_id,
      (post._id as { toString(): string }).toString(),
      'approve'
    );

    const { grantBoost, BoostType } = await import('../lib/ladderSystem');
    await grantBoost(post.author_id.toString(), BoostType.POST_APPROVED);

    await createNotification({
      user_id: post.author_id,
      type: 'post_approved',
      post_id: (post._id as { toString(): string }).toString(),
      post_title: post.title,
      message: `Your list "${post.title}" was approved and is now live on the feed.`,
    });

    res.json({ success: true, post });
  } catch (error) {
    console.error('Error approving post:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to approve post' });
  }
});

/**
 * POST /api/admin/posts/:id/retry
 * Protected — request revision without trust score penalty
 */
router.post('/posts/:id/retry', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { guidance } = req.body;

    if (!guidance || typeof guidance !== 'string' || guidance.trim().length === 0) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Revision guidance is required' });
    }

    if (guidance.length > 2000) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Guidance must be less than 2000 characters' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    }

    if (post.status !== 'pending_review') {
      return res.status(400).json({ code: 'INVALID_STATUS', error: 'Only pending posts can receive revision guidance' });
    }

    post.revision_guidance = guidance.trim();
    post.revision_requested_at = new Date();
    post.revision_count = (post.revision_count || 0) + 1;
    await post.save();

    // Explicit: no trust score update, no boost grant for retry

    await createNotification({
      user_id: post.author_id,
      type: 'revision_requested',
      post_id: (post._id as { toString(): string }).toString(),
      post_title: post.title,
      message: `The admin reviewed "${post.title}" and sent revision feedback. Check your profile.`,
    });

    res.json({ success: true, post });
  } catch (error) {
    console.error('Error requesting revision:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to request revision' });
  }
});

/**
 * PATCH /api/admin/posts/:id/reject
 * Protected — reject pending post
 */
router.patch('/posts/:id/reject', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Rejection reason is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    }

    if (post.status === 'rejected') {
      return res.status(400).json({ code: 'ALREADY_REJECTED', error: 'Post is already rejected' });
    }

    post.status = 'rejected';
    post.rejection_reason = reason.trim();
    await post.save();

    await trustScoreWorker.queueUpdate(
      post.author_id,
      (post._id as { toString(): string }).toString(),
      'reject'
    );

    await createNotification({
      user_id: post.author_id,
      type: 'post_rejected',
      post_id: (post._id as { toString(): string }).toString(),
      post_title: post.title,
      message: `Your list "${post.title}" was not approved. Reason: ${reason.trim()}`,
    });

    res.json({ success: true, post });
  } catch (error) {
    console.error('Error rejecting post:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to reject post' });
  }
});

/**
 * GET /api/admin/audit-logs/stats
 * Protected — quick dashboard summary, Redis-cached 30s
 */
router.get('/audit-logs/stats', async (req: AdminAuthRequest, res: Response) => {
  try {
    const stats = await getAuditStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch audit stats' });
  }
});

/**
 * GET /api/admin/audit-logs
 * Protected — paginated, filterable audit trail
 */
router.get('/audit-logs', async (req: AdminAuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (req.query.action) query.action = req.query.action;
    if (req.query.ip) query.ip = { $regex: req.query.ip, $options: 'i' };
    if (req.query.date_from || req.query.date_to) {
      query.created_at = {};
      if (req.query.date_from) query.created_at.$gte = new Date(req.query.date_from as string);
      if (req.query.date_to) query.created_at.$lte = new Date(req.query.date_to as string);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch audit logs' });
  }
});

// ═══ Stats Endpoints ═══════════════════════════════════════════════

const SNAPSHOT_OR_LIVE = async (req: Request, computeSnapshot: () => Promise<unknown>, computeLive: () => Promise<unknown>) => {
  if (req.query.from || req.query.to) return computeLive();
  return computeSnapshot();
};

function parseBrowser(ua: string) { if (!ua) return 'unknown'; if (/Edg/.test(ua)) return 'edge'; if (/Opera|OPR/.test(ua)) return 'opera'; if (/Chrome/.test(ua)) return 'chrome'; if (/Firefox/.test(ua)) return 'firefox'; if (/Safari/.test(ua)) return 'safari'; return 'other'; }
function parseOS(ua: string) { if (!ua) return 'unknown'; if (/Windows/.test(ua)) return 'windows'; if (/Mac/.test(ua)) return 'macos'; if (/Linux/.test(ua) && !/Android/.test(ua)) return 'linux'; if (/Android/.test(ua)) return 'android'; if (/iPhone|iPad|iPod/.test(ua)) return 'ios'; return 'other'; }

// 1. Health Pulse
router.get('/stats/health', async (req: AdminAuthRequest, res: Response) => {
  try {
    const [mongoState, redisPing, esPing, heartbeats] = await Promise.all([
      mongoose.connection.readyState,
      redis.ping().then(() => 'ok').catch(() => 'down'),
      (async () => { try { const { es } = await import('../lib/elasticsearch'); await es.ping(); return 'ok'; } catch { return 'down'; } })(),
      redis.hGetAll('cron:heartbeats'),
    ]);

    const parseHb = (raw: string) => { try { return JSON.parse(raw); } catch { return {}; } };
    const mem = process.memoryUsage();

    res.json({
      uptime_seconds: Math.round(process.uptime()),
      memory: { heap_mb: Math.round(mem.heapUsed / 1024 / 1024), rss_mb: Math.round(mem.rss / 1024 / 1024) },
      services: { mongodb: mongoState === 1 ? 'connected' : 'disconnected', redis: redisPing, elasticsearch: esPing },
      crons: Object.fromEntries(Object.entries(heartbeats as Record<string, string>).map(([k, v]) => [k, parseHb(v)])),
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 2. Overview (enhanced)
router.get('/stats/overview', async (req: AdminAuthRequest, res: Response) => {
  try {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!snapshot) return res.json({ error: 'No data yet.' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [tp, tc, tu, pn] = await Promise.all([Post.countDocuments({ created_at: { $gte: today } }), Comment.countDocuments({ created_at: { $gte: today } }), User.countDocuments({ created_at: { $gte: today } }), Post.countDocuments({ status: 'pending_review' })]);
    const c = snapshot.content as Record<string, unknown>; const co = snapshot.community as Record<string, unknown>; const m = snapshot.moderation as Record<string, unknown>; const p = c.posts as Record<string, number>; const cm = c.comments as Record<string, number>; const u = co.users as Record<string, number>; const t = co.trust as Record<string, number>; const pq = (m as Record<string, unknown>)?.pending_queue as Record<string, number>;
    res.json({ posts: { total: p.total || 0, today: tp, submitted: p.submitted || 0, approved: p.approved || 0, rejected: p.rejected || 0 }, comments: { total: cm?.total || 0, today: tc }, users: { total: u?.total || 0, today: tu }, pending: pn, queue: { pending: pn, reviewed_today: (m as Record<string, number>)?.reviews_today || 0, oldest_age_hours: pq?.oldest_age_hours || 0 }, trust: { scholars: t?.scholars || 0, neutrals: t?.neutrals || 0, trolls: t?.trolls || 0 }, trolls_active: (co as Record<string, number>)?.trolls_active_24h || 0 });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 3. Content + age distribution
router.get('/stats/content', async (req: AdminAuthRequest, res: Response) => {
  try {
    const s = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    const ageBuckets = await Post.aggregate([
      { $bucket: { groupBy: { $subtract: [new Date(), '$created_at'] }, boundaries: [0, 3600000, 86400000, 259200000, 604800000, 2592000000, 31536000000], default: 'ancient', output: { count: { $sum: 1 } } } }
    ]);
    const bucketMap: Record<string, number> = {};
    for (const b of ageBuckets) { const key = String(b._id).replace(/\d+/g, m => { const v = parseInt(m); return v < 3600000 ? '<1h' : v < 86400000 ? '1-24h' : v < 259200000 ? '1-3d' : v < 604800000 ? '3-7d' : v < 2592000000 ? '7-30d' : '30d+'; }) || 'ancient'; bucketMap[key] = (bucketMap[key] || 0) + b.count; }
    res.json({ ...(s?.content || {}), age_distribution: bucketMap });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 4. Community + fan-out
router.get('/stats/community', async (req: AdminAuthRequest, res: Response) => {
  try {
    const s = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!s) return res.json({});
    const co = s.community as Record<string, unknown>; const u = co.users as Record<string, number>;
    const active = u?.active_30d || 0; const total = u?.total || 1;
    const fanOut = total > 0 ? Math.round((s.content as Record<string, unknown>)?.posts as Record<string, number>)?.total || 0 / active : 0;
    res.json({ ...s.community, lurkers: Math.max(0, total - active), lurker_pct: Math.round((Math.max(0, total - active) / total) * 100), active_pct: Math.round((active / total) * 100), fan_out: active > 0 ? Math.round(((s.content as Record<string, unknown>)?.posts as Record<string, number>)?.total || 0 / active) : 0 });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 5. Moderation + velocity
router.get('/stats/moderation', async (req: AdminAuthRequest, res: Response) => {
  try {
    const snapshots = await PlatformSnapshot.find().sort({ date: -1 }).limit(8).lean();
    const s = snapshots[0]; if (!s) return res.json({});
    const oldest = await Post.findOne({ status: 'pending_review' }).sort({ created_at: 1 }).select('created_at').lean();
    const ageHours = oldest ? Math.round((Date.now() - new Date(oldest.created_at).getTime()) / 3600000) : 0;
    const pastReviews = snapshots.slice(1).map(sn => ((sn.moderation as Record<string, unknown>) as Record<string, number>)?.reviews_today || 0);
    const avgReviews = pastReviews.length > 0 ? pastReviews.reduce((a: number, b: number) => a + b, 0) / pastReviews.length : 0;
    const pq = ((s.moderation as Record<string, unknown>)?.pending_queue as Record<string, number>);
    const pending = pq?.total || 0;
    res.json({ ...s.moderation, pending_queue: { total: pending, oldest_age_hours: ageHours }, queue_velocity: { avg_reviews_per_day: Math.round(avgReviews * 10) / 10, days_to_clear: avgReviews > 0 ? Math.ceil(pending / avgReviews) : null } });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 6. Categories
router.get('/stats/categories', async (req: AdminAuthRequest, res: Response) => {
  try {
    const s = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    res.json(s?.categories || {});
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 7. Trends + deltas (enhanced)
router.get('/stats/trends', async (req: AdminAuthRequest, res: Response) => {
  try {
    const snapshots = await PlatformSnapshot.find().sort({ date: -1 }).limit(14).lean();
    const weeks = snapshots.map(s => { const c = s.content as Record<string, unknown>; const co = s.community as Record<string, unknown>; const m = s.moderation as Record<string, unknown>; const p = c.posts as Record<string, number>; const cu = co.users as Record<string, number>; return { date: s.date, posts_total: p?.total || 0, posts_submitted: p?.submitted || 0, comments_total: (c.comments as Record<string, number>)?.total || 0, users_total: cu?.total || 0, users_new: cu?.new_today || 0, reviews: (m as Record<string, number>)?.reviews_today || 0, pending: ((m as Record<string, unknown>)?.pending_queue as Record<string, number>)?.total || 0 }; });
    const withDeltas = weeks.map((w, i) => {
      if (i >= weeks.length - 1) return w;
      const prev = weeks[i + 1];
      const delta = (field: string, goodWhenUp: boolean) => {
        const cur = (w as Record<string, number>)[field] || 0;
        const prv = (prev as Record<string, number>)[field] || 0;
        const pct = prv > 0 ? Math.round(((cur - prv) / prv) * 100) : (cur > 0 ? 100 : 0);
        const dir = pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat';
        const color = goodWhenUp ? (dir === 'up' ? 'green' : dir === 'down' ? 'red' : 'grey') : (dir === 'up' ? 'red' : dir === 'down' ? 'green' : 'grey');
        return { from: prv, to: cur, delta_pct: pct, direction: dir, color };
      };
      return { ...w, deltas: { posts_total: delta('posts_total', true), posts_submitted: delta('posts_submitted', true), comments_total: delta('comments_total', true), users_total: delta('users_total', true), users_new: delta('users_new', true), reviews: delta('reviews', true), pending: delta('pending', false) } };
    });
    res.json({ weeks: withDeltas });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 8. Quality + correlations
router.get('/stats/quality', async (req: AdminAuthRequest, res: Response) => {
  try {
    const s = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    const c = s?.content as Record<string, unknown>; const p = c?.posts as Record<string, number>;
    const revisionRate = (p?.submitted || 0) > 0 ? Math.round(((p?.in_revision || 0) / (p?.submitted || 1)) * 100) : 0;
    const correlations = await Post.aggregate([
      { $project: { intro_len: { $strLenCP: '$intro' }, comment_count: 1, fire_count: 1 } },
      { $bucket: { groupBy: '$intro_len', boundaries: [0, 50, 100, 200, 500, 1000, 2000, 10000], default: 'other', output: { count: { $sum: 1 }, avg_comments: { $avg: '$comment_count' }, avg_fire: { $avg: '$fire_count' } } } }
    ]);
    res.json({ revision_rate: revisionRate, rejection_reasons: (s?.moderation as Record<string, unknown>)?.rejection_reasons || {}, intro_length_correlation: correlations.map((c: Record<string, unknown>) => ({ bucket: String(c._id), count: c.count, avg_comments: Math.round((c.avg_comments as number) * 10) / 10, avg_fire: Math.round((c.avg_fire as number) * 10) / 10 })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 9. Traffic (enhanced)
router.get('/stats/traffic', async (req: AdminAuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().substring(0, 10);
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [visitsToday, uniqueFps, topPaths, browsers, peakHours, referrers, countries] = await Promise.all([
      PageVisit.countDocuments({ created_at: { $gte: todayStart } }),
      PageVisit.distinct('fingerprint', { created_at: { $gte: todayStart }, fingerprint: { $ne: null } }),
      PageVisit.aggregate([{ $group: { _id: '$path', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: todayStart } } }, { $group: { _id: '$user_agent', count: { $sum: 1 } } }, { $limit: 100 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: sevenDaysAgo } } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: todayStart }, referer: { $ne: null, $ne: '' } } }, { $group: { _id: '$referer', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: sevenDaysAgo }, country: { $ne: null } } }, { $group: { _id: '$country', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]),
    ]);
    const browserMap: Record<string, number> = {}; const osMap: Record<string, number> = {};
    for (const b of browsers) { browserMap[parseBrowser(b._id)] = (browserMap[parseBrowser(b._id)] || 0) + b.count; osMap[parseOS(b._id)] = (osMap[parseOS(b._id)] || 0) + b.count; }
    const extractDomain = (ref: string) => { try { return new URL(ref).hostname.replace('www.', ''); } catch { return ref.substring(0, 50); } };
    const topRefs = referrers.map((r: Record<string, unknown>) => ({ domain: extractDomain(r._id as string), count: r.count }));
    const engagement = await Post.aggregate([
      { $match: { status: 'approved', view_count: { $gt: 0 } } },
      { $project: { title: 1, slug: 1, comment_count: 1, fire_count: 1, view_count: 1, ratio: { $divide: [{ $add: ['$comment_count', '$fire_count'] }, '$view_count'] } } },
      { $sort: { ratio: -1 } }, { $limit: 10 }
    ]);
    res.json({ visits_today: visitsToday, unique_today: uniqueFps.length, top_paths: topPaths.map((p: Record<string, unknown>) => ({ path: p._id, count: p.count })), browsers: browserMap, os: osMap, peak_hours: peakHours.map((h: Record<string, unknown>) => ({ hour: h._id, count: h.count })), top_referrers: topRefs, countries: countries.map((c: Record<string, unknown>) => ({ code: c._id, count: c.count })), top_engaged: engagement.map((e: Record<string, unknown>) => ({ slug: e.slug, title: e.title, ratio: Math.round((e.ratio as number) * 1000) / 10 })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 10. Submissions
router.get('/stats/submissions', async (req: AdminAuthRequest, res: Response) => {
  try {
    const d = new Date(); d.setDate(d.getDate() - 7);
    const [byHour, byType, avgItems] = await Promise.all([
      Post.aggregate([{ $match: { created_at: { $gte: d } } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Post.aggregate([{ $group: { _id: '$post_type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Post.aggregate([{ $lookup: { from: 'listitems', localField: '_id', foreignField: 'post_id', as: 'items' } }, { $group: { _id: null, avg: { $avg: { $size: '$items' } } } }]),
    ]);
    res.json({ by_hour: byHour.map((h: Record<string, unknown>) => ({ hour: h._id, count: h.count })), by_type: byType.map((t: Record<string, unknown>) => ({ type: t._id || 'unknown', count: t.count })), avg_items_per_post: Math.round((avgItems[0]?.avg as number) || 0) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 11. User Lifecycle
router.get('/stats/users/lifecycle', async (req: AdminAuthRequest, res: Response) => {
  try {
    const pipeline = await UserEvent.aggregate([
      { $match: { event: 'post_submitted' } },
      { $sort: { created_at: 1 } },
      { $group: { _id: '$user_id', posts: { $push: '$created_at' } } },
      { $project: { first_post: { $arrayElemAt: ['$posts', 0] }, second_post: { $arrayElemAt: ['$posts', 1] } } },
      { $match: { second_post: { $ne: null } } },
      { $project: { days_between: { $divide: [{ $subtract: ['$second_post', '$first_post'] }, 86400000] } } },
      { $bucket: { groupBy: '$days_between', boundaries: [0, 1, 4, 8, 31, 365], default: 'never', output: { count: { $sum: 1 } } } },
    ]);
    const buckets = pipeline.map((b: Record<string, unknown>) => ({ bucket: String(b._id).replace(/[0-9.]+/g, (m: string) => { const v = parseFloat(m); return v < 1 ? 'same_day' : v < 4 ? '1-3d' : v < 8 ? '4-7d' : v < 31 ? '8-30d' : '30d+'; }) || 'never', count: b.count }));
    res.json({ lifecycle: buckets });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 12. Alerts
router.get('/stats/alerts', async (req: AdminAuthRequest, res: Response) => {
  try {
    const [thresholds, history, active] = await Promise.all([
      AlertThreshold.find({ enabled: true }).lean(),
      AlertHistory.find().sort({ triggered_at: -1 }).limit(20).lean(),
      (async () => { const keys = await redis.keys('alert:*'); const results: unknown[] = []; for (const k of keys) { const v = await redis.get(k); if (v) results.push(JSON.parse(v)); } return results; })(),
    ]);
    res.json({ thresholds, history, active });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 13. Comparison Mode
router.get('/stats/compare', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { date1, date2 } = req.query;
    if (!date1 || !date2) return res.status(400).json({ error: 'date1 and date2 required' });
    const [s1, s2] = await Promise.all([
      PlatformSnapshot.findOne({ date: date1 as string }).lean(),
      PlatformSnapshot.findOne({ date: date2 as string }).lean(),
    ]);
    res.json({ date1: s1?.content || {}, date2: s2?.content || {} });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 14. Notification Analytics
router.get('/stats/notifications', async (req: AdminAuthRequest, res: Response) => {
  try {
    const [total, delivered, clicked, byType] = await Promise.all([
      Notification.countDocuments({}),
      Notification.countDocuments({ delivered_at: { $ne: null } }),
      Notification.countDocuments({ clicked_at: { $ne: null } }),
      Notification.aggregate([{ $group: { _id: '$type', sent: { $sum: 1 }, delivered: { $sum: { $cond: [{ $ne: ['$delivered_at', null] }, 1, 0] } }, clicked: { $sum: { $cond: [{ $ne: ['$clicked_at', null] }, 1, 0] } } } }]),
    ]);
    res.json({ total_sent: total, total_delivered: delivered, total_clicked: clicked, delivery_rate: total > 0 ? Math.round((delivered / total) * 100) : 0, click_rate: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0, by_type: byType.map((b: Record<string, unknown>) => ({ type: b._id, sent: b.sent, delivered: b.delivered, clicked: b.clicked })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
