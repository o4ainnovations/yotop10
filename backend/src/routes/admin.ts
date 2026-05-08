import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AdminUser } from '../models/AdminUser';
import { User } from '../models/User';
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
import { trustScoreWorker } from '../lib/trustScoreWorker';

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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { status: 'pending_review' };
    if (req.query.category_slug) query.category_slug = req.query.category_slug;
    if (req.query.post_type) query.post_type = req.query.post_type;
    if (req.query.author) query.author_username = { $regex: req.query.author, $options: 'i' };
    if (req.query.date_from || req.query.date_to) {
      query.created_at = {};
      if (req.query.date_from) (query.created_at as Record<string, unknown>).$gte = new Date(req.query.date_from as string);
      if (req.query.date_to) (query.created_at as Record<string, unknown>).$lte = new Date(req.query.date_to as string);
    }

    const sortField = (req.query.sort as string) === 'newest' ? 'created_at' : 'created_at';
    const sortDir = (req.query.sort as string) === 'newest' ? -1 : 1;
    const sortObj: Record<string, 1 | -1> = { [sortField]: sortDir as 1 | -1 };

    const [posts, total] = await Promise.all([
      Post.find(query).sort(sortObj).skip(skip).limit(limit).select('-__v').lean(),
      Post.countDocuments(query),
    ]);

    res.json({ posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch pending posts' }); }
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
 * POST /api/admin/posts/bulk/approve — Bulk approve multiple posts
 */
router.post('/posts/bulk/approve', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 post IDs' });
    }

    let approved = 0; let skipped = 0; const errors: string[] = [];
    for (const id of ids) {
      try {
        const post = await Post.findById(id);
        if (!post) { skipped++; continue; }
        if (post.status === 'approved') { skipped++; continue; }
        post.status = 'approved'; post.published_at = new Date();
        await post.save();
        await trustScoreWorker.queueUpdate(post.author_id, (post._id as { toString(): string }).toString(), 'approve');
        const { grantBoost, BoostType } = await import('../lib/ladderSystem');
        await grantBoost(post.author_id.toString(), BoostType.POST_APPROVED);
        await createNotification({ user_id: post.author_id, type: 'post_approved', post_id: (post._id as { toString(): string }).toString(), post_title: post.title, message: `Your list "${post.title}" was approved.` });
        approved++;
      } catch (e) { errors.push(`Post ${id}: ${(e as Error).message}`); }
    }

    res.json({ success: true, approved, skipped, errors: errors.length > 0 ? errors.slice(0, 5) : [] });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk approve failed' }); }
});

/**
 * POST /api/admin/posts/bulk/reject — Bulk reject multiple posts
 */
router.post('/posts/bulk/reject', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 post IDs' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Rejection reason is required' });
    }

    let rejected = 0; let skipped = 0; const errors: string[] = [];
    for (const id of ids) {
      try {
        const post = await Post.findById(id);
        if (!post) { skipped++; continue; }
        if (post.status === 'rejected') { skipped++; continue; }
        post.status = 'rejected'; post.rejection_reason = reason.trim();
        await post.save();
        await trustScoreWorker.queueUpdate(post.author_id, (post._id as { toString(): string }).toString(), 'reject');
        await createNotification({ user_id: post.author_id, type: 'post_rejected', post_id: (post._id as { toString(): string }).toString(), post_title: post.title, message: `Your list "${post.title}" was not approved. Reason: ${reason.trim()}` });
        rejected++;
      } catch (e) { errors.push(`Post ${id}: ${(e as Error).message}`); }
    }

    res.json({ success: true, rejected, skipped, errors: errors.length > 0 ? errors.slice(0, 5) : [] });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk reject failed' }); }
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

// ═══ M10.4 All Posts Management ══════════════════════════════════

// 1. List all posts
router.get('/posts', async (req: AdminAuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { $or: [{ deleted: false }, { deleted: { $exists: false } }] };
    if (req.query.status) {
      if (req.query.status === 'deleted') { query.$or = [{ deleted: true }]; }
      else { query.status = req.query.status; }
    }
    if (req.query.category_slug) query.category_slug = req.query.category_slug;
    if (req.query.post_type) query.post_type = req.query.post_type;
    if (req.query.author) query.author_username = { $regex: req.query.author, $options: 'i' };
    if (req.query.search) query.$or = [{ title: { $regex: req.query.search, $options: 'i' } }, { intro: { $regex: req.query.search, $options: 'i' } }];
    if (req.query.date_from || req.query.date_to) { query.created_at = {}; if (req.query.date_from) (query.created_at as Record<string, unknown>).$gte = new Date(req.query.date_from as string); if (req.query.date_to) (query.created_at as Record<string, unknown>).$lte = new Date(req.query.date_to as string); }

    const sortMap: Record<string, string> = { newest: 'created_at', oldest: 'created_at', most_comments: 'comment_count', most_views: 'view_count', most_fire: 'fire_count' };
    const sortField = sortMap[req.query.sort as string] || 'created_at';
    const sortDir = (req.query.sort as string) === 'oldest' ? 1 : -1;
    const fields = req.query.fields ? (req.query.fields as string).split(',').join(' ') : '-__v';

    const [posts, total] = await Promise.all([
      Post.find(query).sort({ [sortField]: sortDir }).skip(skip).limit(limit).select(fields).lean(),
      Post.countDocuments(query),
    ]);

    // Enrich with comment fire count
    const postIds = posts.map(p => p._id);
    const fireAgg = postIds.length > 0 ? await require('../models/Comment').Comment.aggregate([
      { $match: { post_id: { $in: postIds } } },
      { $group: { _id: '$post_id', total_fire: { $sum: '$fire_count' } } },
    ]) : [];
    const fireMap = new Map(fireAgg.map((f: { _id: { toString(): string }; total_fire: number }) => [f._id.toString(), f.total_fire]));
    const enrichedPosts = posts.map(p => ({ ...p, fire_count: fireMap.get((p._id as { toString(): string }).toString()) || 0 }));

    const result: Record<string, unknown> = { posts: enrichedPosts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    if (req.query.stats === 'true') {
      const [pp, approved, rejected, del] = await Promise.all([
        Post.countDocuments({ status: 'pending_review', deleted: false }),
        Post.countDocuments({ status: 'approved', deleted: false }),
        Post.countDocuments({ status: 'rejected', deleted: false }),
        Post.countDocuments({ deleted: true }),
      ]);
      result.stats = { total, pending: pp, approved, rejected, deleted: del, featured: await Post.countDocuments({ featured: true }), locked: await Post.countDocuments({ comments_locked: true }) };
    }

    res.json(result);
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch posts' }); }
});

// 2. Edit post
router.patch('/posts/:id', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });

    if (req.body.version !== undefined && req.body.version !== post.version) {
      return res.status(409).json({ code: 'CONFLICT', error: 'Post was modified by another session. Reload and retry.' });
    }

    if (req.body.title) { post.title = req.body.title; post.slug = require('../models/Post').generateUniqueSlug(post.title, (post._id as { toString(): string }).toString()); }
    if (req.body.intro !== undefined) post.intro = req.body.intro;
    if (req.body.category_slug) { const cat = await require('../models/Category').Category.findOne({ slug: req.body.category_slug }); if (!cat) return res.status(400).json({ code: 'NOT_FOUND', error: 'Category not found' }); post.category_slug = req.body.category_slug; }
    if (req.body.editorial_note !== undefined) post.editorial_note = req.body.editorial_note || null;
    await post.save();

    if (req.body.items && Array.isArray(req.body.items)) {
      const { ListItem } = await import('../models/ListItem');
      await ListItem.deleteMany({ post_id: post._id });
      if (req.body.items.length > 0) {
        await ListItem.insertMany(req.body.items.map((item: { rank: number; title: string; justification: string }) => ({ post_id: post._id, rank: item.rank, title: item.title, justification: item.justification })));
      }
    }

    res.json({ success: true, post });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to edit post' }); }
});

// 3. Soft delete
router.delete('/posts/:id', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    post.deleted = true; post.deleted_at = new Date(); post.auto_hard_delete_at = new Date(Date.now() + 30 * 86400000);
    await post.save();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to delete post' }); }
});

// 4. Restore soft-deleted
router.post('/posts/:id/restore', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.deleted) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found or not deleted' });
    post.deleted = false; post.deleted_at = null; post.auto_hard_delete_at = null;
    await post.save();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to restore post' }); }
});

// 5. Hard delete (permanent)
router.delete('/posts/:id/permanent', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    const { ListItem } = await import('../models/ListItem');
    await ListItem.deleteMany({ post_id: post._id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to permanently delete post' }); }
});

// 6. Feature
router.post('/posts/:id/feature', async (req: AdminAuthRequest, res: Response) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.featured = true; post.featured_at = new Date();
  if (req.body.editorial_note) post.editorial_note = req.body.editorial_note;
  await post.save();
  res.json({ success: true, post });
});

// 7. Unfeature
router.post('/posts/:id/unfeature', async (req: AdminAuthRequest, res: Response) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.featured = false; post.featured_at = null; post.editorial_note = null;
  await post.save();
  res.json({ success: true, post });
});

// 8. Lock comments
router.post('/posts/:id/lock', async (req: AdminAuthRequest, res: Response) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.comments_locked = true;
  await post.save();
  res.json({ success: true });
});

// 9. Unlock comments
router.post('/posts/:id/unlock', async (req: AdminAuthRequest, res: Response) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.comments_locked = false;
  await post.save();
  res.json({ success: true });
});

// 10. Bump
router.post('/posts/:id/bump', async (req: AdminAuthRequest, res: Response) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.bumped_at = new Date();
  await post.save();
  res.json({ success: true, post });
});

// 11. Quick stats
router.get('/posts/stats', async (req: AdminAuthRequest, res: Response) => {
  const [total, pending, approved, rejected, del, featured, locked] = await Promise.all([
    Post.countDocuments({ deleted: false }), Post.countDocuments({ status: 'pending_review', deleted: false }), Post.countDocuments({ status: 'approved', deleted: false }), Post.countDocuments({ status: 'rejected', deleted: false }), Post.countDocuments({ deleted: true }), Post.countDocuments({ featured: true }), Post.countDocuments({ comments_locked: true }),
  ]);
  res.json({ total, pending, approved, rejected, deleted: del, featured, locked });
});

// 12-14. Item-level operations
router.patch('/posts/:id/items/:itemId', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { ListItem } = await import('../models/ListItem');
    const item = await ListItem.findOneAndUpdate({ _id: req.params.itemId, post_id: req.params.id }, { $set: req.body }, { new: true });
    if (!item) return res.status(404).json({ code: 'NOT_FOUND', error: 'Item not found' });
    res.json({ success: true, item });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to edit item' }); }
});
router.post('/posts/:id/items', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    const { ListItem } = await import('../models/ListItem');
    const item = await ListItem.create({ ...req.body, post_id: post._id });
    res.status(201).json({ success: true, item });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to add item' }); }
});
router.delete('/posts/:id/items/:itemId', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { ListItem } = await import('../models/ListItem');
    await ListItem.findOneAndDelete({ _id: req.params.itemId, post_id: req.params.id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to delete item' }); }
});

// 15-17. Bulk operations
router.post('/posts/bulk/delete', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 post IDs' });
    const result = await Post.updateMany({ _id: { $in: ids } }, { $set: { deleted: true, deleted_at: new Date(), auto_hard_delete_at: new Date(Date.now() + 30 * 86400000) } });
    res.json({ success: true, deleted: result.modifiedCount });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk delete failed' }); }
});
router.post('/posts/bulk/change-category', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { ids, category_slug } = req.body;
    if (!Array.isArray(ids) || !category_slug) return res.status(400).json({ code: 'VALIDATION', error: 'Provide ids array and category_slug' });
    const cat = await require('../models/Category').Category.findOne({ slug: category_slug });
    if (!cat) return res.status(400).json({ code: 'NOT_FOUND', error: 'Category not found' });
    const result = await Post.updateMany({ _id: { $in: ids } }, { $set: { category_slug } });
    res.json({ success: true, changed: result.modifiedCount });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk recategorize failed' }); }
});
router.post('/posts/bulk/status', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !['approved', 'rejected', 'pending_review'].includes(status)) return res.status(400).json({ code: 'VALIDATION', error: 'Provide ids and valid status' });
    let changed = 0;
    for (const id of ids) {
      const post = await Post.findById(id);
      if (!post || post.status === status) continue;
      post.status = status;
      if (status === 'approved') post.published_at = new Date();
      await post.save();
      await trustScoreWorker.queueUpdate(post.author_id, (post._id as { toString(): string }).toString(), status === 'approved' ? 'approve' : 'reject');
      changed++;
    }
    res.json({ success: true, changed });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk status change failed' }); }
});

// 18. Export
router.get('/posts/export', async (req: AdminAuthRequest, res: Response) => {
  try {
    const query: Record<string, unknown> = { deleted: false };
    if (req.query.status) query.status = req.query.status;
    const posts = await Post.find(query).sort({ created_at: -1 }).limit(10000).lean();
    const header = 'ID,Title,Author,Category,Type,Status,Fire,Comments,Views,Created,Published\n';
    const rows = posts.map(p => [`"${p._id}"`, `"${(p.title || '').replace(/"/g, '""')}"`, p.author_username, p.category_slug, p.post_type, p.status, p.fire_count, p.comment_count, p.view_count, p.created_at, p.published_at || ''].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="posts_export_${new Date().toISOString().substring(0,10)}.csv"`);
    res.send(header + rows);
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Export failed' }); }
});

// 19. Revisions
router.get('/posts/:id/revisions', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id).select('status_history title intro created_at updated_at').lean();
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    res.json({ revisions: post.status_history || [], current: { title: post.title, intro: post.intro, created_at: post.created_at, updated_at: post.updated_at } });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch revisions' }); }
});

// 20. Compare
router.get('/posts/compare', async (req: AdminAuthRequest, res: Response) => {
  try {
    const ids = (req.query.ids as string || '').split(',');
    if (ids.length !== 2) return res.status(400).json({ code: 'VALIDATION', error: 'Provide exactly 2 IDs' });
    const [p1, p2] = await Promise.all([Post.findById(ids[0]).select('title intro post_type category_slug items created_at').lean(), Post.findById(ids[1]).select('title intro post_type category_slug items created_at').lean()]);
    res.json({ post1: p1, post2: p2 });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Compare failed' }); }
});

// 21. Duplicate
router.post('/posts/:id/duplicate', async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    const copy = await Post.create({ ...post, _id: undefined, status: 'pending_review', published_at: undefined, created_at: undefined, updated_at: undefined, slug: '', normalized_title: '', view_count: 0, comment_count: 0, fire_count: 0, version: 0, deleted: false, deleted_at: null, featured: false, comments_locked: false });
    res.status(201).json({ success: true, post: copy });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Duplicate failed' }); }
});

// 22. Activity
router.get('/posts/:id/activity', async (req: AdminAuthRequest, res: Response) => {
  try {
    const logs = await AuditLog.find({ 'metadata.post_id': req.params.id }).sort({ created_at: -1 }).limit(50).lean();
    res.json({ activity: logs });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch activity' }); }
});

// 23. Admin view comments
router.get('/posts/:id/comments', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { Comment } = await import('../models/Comment');
    const comments = await Comment.find({ post_id: req.params.id }).sort({ created_at: -1 }).limit(100).lean();
    res.json({ comments });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch comments' }); }
});

// 24. Quality check
router.post('/posts/quality-check', async (req: AdminAuthRequest, res: Response) => {
  try {
    const flags = await Post.find({ status: 'approved', deleted: false, intro: { $exists: true, $not: { $regex: /.{100,}/ } } }).select('title intro').lean();
    res.json({ low_quality_count: flags.length, flagged: flags.slice(0, 20) });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Quality check failed' }); }
});

// ═══ M10.5 All Comments Management ════════════════════════════════

// 1. List all comments
router.get('/comments', async (req: AdminAuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};
    if (req.query.post_id) query.post_id = req.query.post_id;
    if (req.query.author) query.author_username = { $regex: req.query.author, $options: 'i' };
    if (req.query.type === 'item_anchored') query.list_item_id = { $ne: null };
    if (req.query.type === 'post_comment') query.list_item_id = null;
    if (req.query.search) query.content = { $regex: req.query.search, $options: 'i' };
    if (req.query.date_from || req.query.date_to) { query.created_at = {}; if (req.query.date_from) (query.created_at as Record<string, unknown>).$gte = new Date(req.query.date_from as string); if (req.query.date_to) (query.created_at as Record<string, unknown>).$lte = new Date(req.query.date_to as string); }
    if (req.query.has_replies === 'yes') query.reply_count = { $gt: 0 };
    if (req.query.has_replies === 'no') query.reply_count = 0;

    const sortMap: Record<string, string> = { newest: 'created_at', oldest: 'created_at', most_fire: 'fire_count', most_replies: 'reply_count', highest_spark: 'spark_score' };
    const sortField = sortMap[req.query.sort as string] || 'created_at';
    const sortDir = (req.query.sort as string) === 'oldest' ? 1 : -1;

    const [comments, total] = await Promise.all([
      Comment.find(query).sort({ [sortField]: sortDir }).skip(skip).limit(limit).lean(),
      Comment.countDocuments(query),
    ]);

    const enriched = comments.map(c => ({ ...c, id: c._id, post_id: c.post_id, is_item_anchored: !!c.list_item_id, depth_badge: c.depth > 0 ? `L${c.depth}` : null }));

    // Enrich with post slugs
    const postIds = [...new Set(enriched.map((c: Record<string, unknown>) => c.post_id))];
    const posts = postIds.length > 0 ? await Post.find({ _id: { $in: postIds } }).select('slug title').lean() : [];
    const slugMap = new Map(posts.map((p: Record<string, unknown>) => [(p._id as { toString(): string }).toString(), p.slug]));
    const titleMap = new Map(posts.map((p: Record<string, unknown>) => [(p._id as { toString(): string }).toString(), p.title]));
    const withSlugs = enriched.map((c: Record<string, unknown>) => ({ ...c, post_slug: slugMap.get((c.post_id as { toString(): string }).toString()) || null, post_title: titleMap.get((c.post_id as { toString(): string }).toString()) || null }));

    const result: Record<string, unknown> = { comments: withSlugs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    if (req.query.stats === 'true') {
      const [totalAll, del, hid, hi] = await Promise.all([
        Comment.countDocuments({}), Comment.countDocuments({ deleted: true }), Comment.countDocuments({ hidden: true }), Comment.countDocuments({ highlighted: true }),
      ]);
      result.stats = { total: totalAll, deleted: del, hidden: hid, highlighted: hi };
    }
    res.json(result);
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch comments' }); }
});

// 2. Admin edit comment (any age, override 2hr window)
router.patch('/comments/:id', async (req: AdminAuthRequest, res: Response) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
    if (req.body.content) comment.content = req.body.content.substring(0, 2000);
    await comment.save();
    res.json({ success: true, comment });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to edit comment' }); }
});

// 3. Soft delete
router.delete('/comments/:id', async (req: AdminAuthRequest, res: Response) => {
  try {
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
    c.deleted = true; c.deleted_at = new Date();
    await c.save();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to delete comment' }); }
});

// 4. Restore
router.post('/comments/:id/restore', async (req: AdminAuthRequest, res: Response) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.deleted = false; c.deleted_at = null;
  await c.save();
  res.json({ success: true });
});

// 5. Hard delete
router.delete('/comments/:id/permanent', async (req: AdminAuthRequest, res: Response) => {
  const c = await Comment.findByIdAndDelete(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  res.json({ success: true });
});

// 6-7. Hide / Unhide
router.post('/comments/:id/hide', async (req: AdminAuthRequest, res: Response) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.hidden = true; c.hidden_reason = req.body.reason || null;
  await c.save();
  res.json({ success: true });
});
router.post('/comments/:id/unhide', async (req: AdminAuthRequest, res: Response) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.hidden = false; c.hidden_reason = null;
  await c.save();
  res.json({ success: true });
});

// 8-9. Highlight / Unhighlight
router.post('/comments/:id/highlight', async (req: AdminAuthRequest, res: Response) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.highlighted = true;
  await c.save();
  res.json({ success: true });
});
router.post('/comments/:id/unhighlight', async (req: AdminAuthRequest, res: Response) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.highlighted = false;
  await c.save();
  res.json({ success: true });
});

// 10-11. Bulk
router.post('/comments/bulk/delete', async (req: AdminAuthRequest, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 IDs' });
  const r = await Comment.updateMany({ _id: { $in: ids } }, { $set: { deleted: true, deleted_at: new Date() } });
  res.json({ success: true, deleted: r.modifiedCount });
});
router.post('/comments/bulk/hide', async (req: AdminAuthRequest, res: Response) => {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 IDs' });
  const r = await Comment.updateMany({ _id: { $in: ids } }, { $set: { hidden: true, hidden_reason: reason || null } });
  res.json({ success: true, hidden: r.modifiedCount });
});

// 12. Quick stats
router.get('/comments/stats', async (req: AdminAuthRequest, res: Response) => {
  const [total, del, hid, hi, itemAnchored, postComment] = await Promise.all([
    Comment.countDocuments({}), Comment.countDocuments({ deleted: true }), Comment.countDocuments({ hidden: true }), Comment.countDocuments({ highlighted: true }), Comment.countDocuments({ list_item_id: { $ne: null } }), Comment.countDocuments({ list_item_id: null }),
  ]);
  res.json({ total, deleted: del, hidden: hid, highlighted: hi, item_anchored: itemAnchored, post_comment: postComment });
});

// 13. Export
router.get('/comments/export', async (req: AdminAuthRequest, res: Response) => {
  const comments = await Comment.find({}).sort({ created_at: -1 }).limit(10000).lean();
  const header = 'ID,Content,Author,PostID,Type,Fire,Replies,SparkScore,Depth,Created\n';
  const rows = comments.map(c => [`"${c._id}"`, `"${(c.content || '').substring(0, 200).replace(/"/g, '""')}"`, c.author_username, c.post_id, c.list_item_id ? 'item_anchored' : 'post_comment', c.fire_count, c.reply_count, c.spark_score, c.depth, c.created_at].join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="comments_export_${new Date().toISOString().substring(0,10)}.csv"`);
  res.send(header + rows);
});

// 14. Activity
router.get('/comments/:id/activity', async (req: AdminAuthRequest, res: Response) => {
  const c = await Comment.findById(req.params.id).select('content_history').lean();
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  res.json({ content_history: c.content_history || [] });
});

// 15. Apply penalty
router.post('/comments/:id/apply-penalty', async (req: AdminAuthRequest, res: Response) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });

    const minutes = Math.min(12 * 60, Math.max(1, parseInt(req.body.minutes) || 5));
    const trustPenalty = Math.max(-1.0, Math.min(0, parseFloat(req.body.trust_penalty) || -0.01));

    const user = await User.findOne({ user_id: comment.author_id });
    if (user) {
      const newTrust = Math.max(0.1, (user.trust_score || 1.0) + trustPenalty);
      const newRestricted = new Date(Date.now() + minutes * 60 * 1000);
      await User.findByIdAndUpdate(user._id, { trust_score: newTrust, restricted_until: newRestricted });
    }

    await Comment.findByIdAndUpdate(req.params.id, { $set: { flag_type: null, flag_evidence: null } });

    res.json({ success: true, penalty: { minutes, trust_penalty: trustPenalty } });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to apply penalty' }); }
});

// 16. Dismiss flag
router.post('/comments/:id/dismiss-flag', async (req: AdminAuthRequest, res: Response) => {
  await Comment.findByIdAndUpdate(req.params.id, { $set: { flag_type: null, flag_evidence: null } });
  res.json({ success: true });
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
    const [mongoState, redisPing, esPing, heartbeats, mongoLatency, redisInfo] = await Promise.all([
      mongoose.connection.readyState,
      redis.ping().then(() => 'ok').catch(() => 'down'),
      (async () => { try { const { es } = await import('../lib/elasticsearch'); await es.ping(); return 'ok'; } catch { return 'down'; } })(),
      redis.hGetAll('cron:heartbeats'),
      (async () => { try { const start = Date.now(); await mongoose.connection.db.admin().ping(); return Date.now() - start; } catch { return null; } })(),
      (async () => { try { return await redis.info('memory'); } catch { return ''; } })(),
    ]);

    const parseHb = (raw: string) => { try { return JSON.parse(raw); } catch { return {}; } };
    const mem = process.memoryUsage();
    const redisUsedMatch = redisInfo.match(/used_memory:(\d+)/);
    const redisMaxMatch = redisInfo.match(/maxmemory:(\d+)/);
    const redisUsed = redisUsedMatch ? parseInt(redisUsedMatch[1]) : null;
    const redisMax = redisMaxMatch ? parseInt(redisMaxMatch[1]) : null;

    const downServices: string[] = [];
    if (mongoState !== 1) downServices.push('mongodb');
    if (redisPing !== 'ok') downServices.push('redis');
    if (esPing !== 'ok') downServices.push('elasticsearch');

    const deps = require('../data/serviceDependencies.json') as Record<string, { depends_on: string[]; degradation: string }>;
    const affectedFeatures = downServices.length > 0
      ? Object.entries(deps).filter(([, v]) => v.depends_on.some((s: string) => downServices.includes(s)))
          .map(([feature, info]) => ({ feature, depends_on: info.depends_on, degradation: info.degradation }))
      : [];

    res.json({
      uptime_seconds: Math.round(process.uptime()),
      memory: { heap_mb: Math.round(mem.heapUsed / 1024 / 1024), rss_mb: Math.round(mem.rss / 1024 / 1024) },
      services: {
        mongodb: mongoState === 1 ? 'connected' : 'disconnected',
        mongodb_latency_ms: mongoLatency,
        redis: redisPing,
        redis_memory_pct: redisUsed && redisMax ? Math.round((redisUsed / redisMax) * 100) : null,
        redis_memory_mb: redisUsed ? Math.round(redisUsed / 1024 / 1024) : null,
        elasticsearch: esPing,
      },
      crons: Object.fromEntries(Object.entries(heartbeats as Record<string, string>).map(([k, v]) => [k, parseHb(v)])),
      dependency_map: deps,
      affected_features_count: affectedFeatures.length,
      affected_features: affectedFeatures,
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 2. Overview (enhanced)
router.get('/stats/overview', async (req: AdminAuthRequest, res: Response) => {
  try {
    const snapshot = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!snapshot) return res.json({ error: 'No data yet.' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600000);
    const [tp, tc, tu, pn, orphans, peakQueueHour, peakSubmitHour] = await Promise.all([
      Post.countDocuments({ created_at: { $gte: today } }),
      Comment.countDocuments({ created_at: { $gte: today } }),
      User.countDocuments({ created_at: { $gte: today } }),
      Post.countDocuments({ status: 'pending_review' }),
      Post.countDocuments({ status: 'pending_review', created_at: { $lt: new Date(Date.now() - 72 * 3600000) }, revision_guidance: null }),
      Post.aggregate([{ $match: { status: 'pending_review' } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
      Post.aggregate([{ $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
    ]);
    const peakHr = peakQueueHour[0] || {}; const peakSubHr = peakSubmitHour[0] || {};
    const c = snapshot.content as Record<string, unknown>; const co = snapshot.community as Record<string, unknown>; const m = snapshot.moderation as Record<string, unknown>; const p = c.posts as Record<string, number>; const cm = c.comments as Record<string, number>; const u = co.users as Record<string, number>; const t = co.trust as Record<string, number>; const pq = (m as Record<string, unknown>)?.pending_queue as Record<string, number>;
    res.json({ posts: { total: p.total || 0, today: tp, submitted: p.submitted || 0, approved: p.approved || 0, rejected: p.rejected || 0 }, comments: { total: cm?.total || 0, today: tc }, users: { total: u?.total || 0, today: tu }, pending: pn, queue: { pending: pn, reviewed_today: (m as Record<string, number>)?.reviews_today || 0, oldest_age_hours: pq?.oldest_age_hours || 0, peak_queue_hour: peakHr._id || null, peak_queue_hour_count: peakHr.count || 0 }, trust: { scholars: t?.scholars || 0, neutrals: t?.neutrals || 0, trolls: t?.trolls || 0 }, trolls_active: (co as Record<string, number>)?.trolls_active_24h || 0, orphans_72h_no_guidance: orphans, peak_submission_hour: peakSubHr._id || null, peak_submission_hour_count: peakSubHr.count || 0 });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 3. Content + age distribution + approval gap + throughput
router.get('/stats/content', async (req: AdminAuthRequest, res: Response) => {
  try {
    const s = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    const now = new Date();
    const [ageBuckets, approvalGap, throughput7d] = await Promise.all([
      Post.aggregate([{ $bucket: { groupBy: { $subtract: [now, '$created_at'] }, boundaries: [0, 3600000, 86400000, 259200000, 604800000, 2592000000, 31536000000], default: 'ancient', output: { count: { $sum: 1 } } } }]),
      Post.aggregate([{ $match: { status: 'approved', published_at: { $ne: null } } }, { $project: { gap_hours: { $divide: [{ $subtract: ['$published_at', '$created_at'] }, 3600000] } } }, { $group: { _id: null, avg_hours: { $avg: '$gap_hours' }, max_hours: { $max: '$gap_hours' }, min_hours: { $min: '$gap_hours' } } }]),
      Post.aggregate([{ $match: { status: { $in: ['approved', 'rejected'] }, updated_at: { $gte: new Date(Date.now() - 7 * 86400000) } } }, { $group: { _id: { $dayOfWeek: '$updated_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    const bucketMap: Record<string, number> = {};
    for (const b of ageBuckets) { const key = String(b._id).replace(/\d+/g, m => { const v = parseInt(m); return v < 3600000 ? '<1h' : v < 86400000 ? '1-24h' : v < 259200000 ? '1-3d' : v < 604800000 ? '3-7d' : v < 2592000000 ? '7-30d' : '30d+'; }) || 'ancient'; bucketMap[key] = (bucketMap[key] || 0) + b.count; }
    const gap = approvalGap[0] || {};
    res.json({ ...(s?.content || {}), age_distribution: bucketMap, approval_gap: { avg_hours: gap.avg_hours ? Math.round(gap.avg_hours) : null, max_hours: gap.max_hours ? Math.round(gap.max_hours) : null, min_hours: gap.min_hours ? Math.round(gap.min_hours) : null }, throughput_7d: throughput7d.map((t: Record<string, unknown>) => ({ day: t._id, count: t.count })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 4. Community + fan-out + churn + conversion + tiers + retained + lurker depth
router.get('/stats/community', async (req: AdminAuthRequest, res: Response) => {
  try {
    const s = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    if (!s) return res.json({});
    const co = s.community as Record<string, unknown>; const u = co.users as Record<string, number>;
    const active = u?.active_30d || 0; const total = u?.total || 1;
    const monthAgo = new Date(Date.now() - 30 * 86400000);
    const [newUsers24hConverted, usersOver30d, powerUsersAgg, retainedCreators, lurkerDeep] = await Promise.all([
      UserEvent.aggregate([{ $match: { event: 'post_submitted' } }, { $sort: { created_at: 1 } }, { $group: { _id: '$user_id', first_post: { $first: '$created_at' }, first_created: { $first: '$created_at' } } }, { $project: { converted_24h: { $cond: [{ $lte: [{ $subtract: ['$first_post', '$first_created'] }, 86400000] }, 1, 0] } } }, { $group: { _id: null, count: { $sum: '$converted_24h' }, total: { $sum: 1 } } }]),
      User.countDocuments({ created_at: { $lt: monthAgo } }),
      Post.aggregate([{ $group: { _id: '$author_id', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Post.aggregate([{ $match: { created_at: { $gte: monthAgo } } }, { $group: { _id: '$author_id' } }, { $lookup: { from: 'posts', let: { uid: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$author_id', '$$uid'] }, { $lt: ['$created_at', monthAgo] }] } } }, { $limit: 1 }], as: 'prev' } }, { $match: { prev: { $ne: [] } } }, { $count: 'count' }]),
      PageVisit.aggregate([{ $group: { _id: '$fingerprint', count: { $sum: 1 } } }, { $match: { count: { $gt: 10 }, _id: { $ne: null } } }, { $lookup: { from: 'posts', localField: '_id', foreignField: 'author_id', as: 'posts' } }, { $match: { posts: [] } }, { $count: 'count' }]),
    ]);
    const cv = newUsers24hConverted[0] as Record<string, number> | undefined;
    const usersLastMonth = usersOver30d || 0;
    const churn = total > 0 && usersLastMonth > 0 ? Math.round((1 - (active / usersLastMonth)) * 100) : null;
    const sortedPosts = powerUsersAgg as { _id: string; count: number }[];
    const top5Posts = sortedPosts.slice(0, 5).reduce((a, b) => a + b.count, 0);
    const totalPosts = sortedPosts.reduce((a, b) => a + b.count, 0);
    const fanOut = active > 0 ? Math.round(((s.content as Record<string, unknown>)?.posts as Record<string, number>)?.total || 0 / active) : 0;
    res.json({ ...s.community, lurkers: Math.max(0, total - active), lurker_pct: Math.round((Math.max(0, total - active) / total) * 100), active_pct: Math.round((active / total) * 100), fan_out: fanOut, churn_pct: churn, new_user_conversion_24h_pct: cv && cv.total > 0 ? Math.round((cv.count / cv.total) * 100) : null, maturity_pct: Math.round((usersLastMonth / total) * 100), user_tiers: { casual: sortedPosts.filter((p: { count: number }) => p.count <= 2).length, regular: sortedPosts.filter((p: { count: number }) => p.count >= 3 && p.count <= 9).length, power: sortedPosts.filter((p: { count: number }) => p.count >= 10).length }, pareto_pct: totalPosts > 0 ? Math.round((top5Posts / totalPosts) * 100) : 0, retained_creators: (retainedCreators?.[0] as Record<string, number>)?.count || 0, lurker_depth_10plus: (lurkerDeep?.[0] as Record<string, number>)?.count || 0 });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 5. Moderation + velocity + weekend gap + decision confidence
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const [weekendReviews, peakModHour, decisionFlips] = await Promise.all([
      Post.aggregate([{ $match: { status: { $in: ['approved', 'rejected'] }, updated_at: { $gte: sevenDaysAgo } } }, { $group: { _id: { $dayOfWeek: '$updated_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      AuditLog.aggregate([{ $match: { action: { $in: ['approve_post', 'reject_post', 'retry_post'] }, created_at: { $gte: sevenDaysAgo } } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
      Post.countDocuments({ status: 'rejected', 'status_history.2': { $exists: true }, 'status_history.status': 'approved' }),
    ]);
    const peakHr = peakModHour[0] || {};
    const weekendDays = [1, 7]; // Sunday=1, Saturday=7
    const weekendCount = weekendReviews.filter((r: Record<string, unknown>) => weekendDays.includes(r._id as number)).reduce((a: number, r: Record<string, number>) => a + (r.count || 0), 0);
    const weekdayCount = weekendReviews.filter((r: Record<string, unknown>) => !weekendDays.includes(r._id as number)).reduce((a: number, r: Record<string, number>) => a + (r.count || 0), 0);
    res.json({ ...s.moderation, pending_queue: { total: pending, oldest_age_hours: ageHours }, queue_velocity: { avg_reviews_per_day: Math.round(avgReviews * 10) / 10, days_to_clear: avgReviews > 0 ? Math.ceil(pending / avgReviews) : null }, reviews_by_day_of_week: weekendReviews.map((r: Record<string, unknown>) => ({ day: r._id, count: r.count })), weekend_vs_weekday: { weekend: weekendCount, weekday: weekdayCount, weekend_pct: (weekendCount + weekdayCount) > 0 ? Math.round((weekendCount / (weekendCount + weekdayCount)) * 100) : 0 }, peak_moderation_hour: peakHr._id || null, peak_moderation_hour_count: peakHr.count || 0, decision_flips: decisionFlips });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 6. Categories + engagement per category
router.get('/stats/categories', async (req: AdminAuthRequest, res: Response) => {
  try {
    const s = await PlatformSnapshot.findOne().sort({ date: -1 }).lean();
    const engagementByCat = await Post.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category_slug', post_count: { $sum: 1 }, total_comments: { $sum: '$comment_count' }, total_views: { $sum: '$view_count' } } },
      { $project: { slug: '$_id', post_count: 1, avg_comments: { $cond: [{ $gt: ['$post_count', 0] }, { $divide: ['$total_comments', '$post_count'] }, 0] }, avg_views: { $cond: [{ $gt: ['$post_count', 0] }, { $divide: ['$total_views', '$post_count'] }, 0] } } },
      { $sort: { post_count: -1 } },
    ]);
    res.json({ ...(s?.categories || {}), per_category_engagement: engagementByCat });
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
    const [visitsToday, uniqueFps, topPaths, browsers, peakHours, referrers, countries, itemEngagement, newUserByRef] = await Promise.all([
      PageVisit.countDocuments({ created_at: { $gte: todayStart } }),
      PageVisit.distinct('fingerprint', { created_at: { $gte: todayStart }, fingerprint: { $ne: null } }),
      PageVisit.aggregate([{ $group: { _id: '$path', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: todayStart } } }, { $group: { _id: '$user_agent', count: { $sum: 1 } } }, { $limit: 100 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: sevenDaysAgo } } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: todayStart }, referer: { $ne: null, $ne: '' } } }, { $group: { _id: '$referer', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: sevenDaysAgo }, country: { $ne: null } } }, { $group: { _id: '$country', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]),
      Comment.aggregate([{ $match: { list_item_id: { $ne: null } } }, { $group: { _id: '$list_item_id', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }, { $lookup: { from: 'listitems', localField: '_id', foreignField: '_id', as: 'item' } }, { $unwind: '$item' }, { $project: { item_title: '$item.title', item_rank: '$item.rank', comment_count: '$count' } }]),
      PageVisit.aggregate([{ $match: { fingerprint: { $ne: null }, created_at: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $sort: { created_at: 1 } }, { $group: { _id: '$fingerprint', first_visit: { $first: '$created_at' }, first_referer: { $first: '$referer' } } }, { $lookup: { from: 'users', localField: '_id', foreignField: 'device_fingerprint', as: 'u' } }, { $unwind: '$u' }, { $match: { $expr: { $gte: ['$u.created_at', '$first_visit'] } } }, { $group: { _id: { $cond: [{ $regexMatch: { input: '$first_referer', regex: /google\.|bing\.|duckduckgo\.|yahoo\./i } }, 'search', { $cond: [{ $eq: ['$first_referer', null] }, 'direct', 'other'] }] }, count: { $sum: 1 } } }]),
    ]);
    const browserMap: Record<string, number> = {}; const osMap: Record<string, number> = {};
    for (const b of browsers) { browserMap[parseBrowser(b._id)] = (browserMap[parseBrowser(b._id)] || 0) + b.count; osMap[parseOS(b._id)] = (osMap[parseOS(b._id)] || 0) + b.count; }
    const extractDomain = (ref: string) => { try { return new URL(ref).hostname.replace('www.', ''); } catch { return ref.substring(0, 50); } };
    const topRefs = referrers.map((r: Record<string, unknown>) => ({ domain: extractDomain(r._id as string), count: r.count }));
    let population: Record<string, number> = {};
    try { population = require('../data/countryPopulation.json'); } catch {}
    const countriesWithPop = countries.map((c: Record<string, unknown>) => {
      const code = c._id as string;
      const pop = population[code] || null;
      return { code, count: c.count, population: pop, visits_per_million: pop ? Math.round((c.count as number / pop) * 1000000 * 100) / 100 : null };
    });
    const engagement = await Post.aggregate([
      { $match: { status: 'approved', view_count: { $gt: 0 } } },
      { $project: { title: 1, slug: 1, comment_count: 1, fire_count: 1, view_count: 1, ratio: { $divide: [{ $add: ['$comment_count', '$fire_count'] }, '$view_count'] } } },
      { $sort: { ratio: -1 } }, { $limit: 10 }
    ]);
    res.json({ visits_today: visitsToday, unique_today: uniqueFps.length, top_paths: topPaths.map((p: Record<string, unknown>) => ({ path: p._id, count: p.count })), browsers: browserMap, os: osMap, peak_hours: peakHours.map((h: Record<string, unknown>) => ({ hour: h._id, count: h.count })), top_referrers: topRefs, countries: countriesWithPop, top_engaged: engagement.map((e: Record<string, unknown>) => ({ slug: e.slug, title: e.title, ratio: Math.round((e.ratio as number) * 1000) / 10 })), top_engaged_items: itemEngagement.map((i: Record<string, unknown>) => ({ title: i.item_title, rank: i.item_rank, comment_count: i.comment_count })), new_users_by_referrer: newUserByRef.map((r: Record<string, unknown>) => ({ source: r._id, count: r.count })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 9b. Traffic Lurkers — Ghost ratio
router.get('/stats/traffic/lurkers', async (req: AdminAuthRequest, res: Response) => {
  try {
    const allFingerprints = await PageVisit.distinct('fingerprint', { fingerprint: { $ne: null } });
    const posters = await Post.distinct('author_id');
    const posterSet = new Set(posters);
    const neverPosted = allFingerprints.filter((fp: string) => !posterSet.has(fp));

    const visitCounts = await PageVisit.aggregate([
      { $match: { fingerprint: { $in: neverPosted } } },
      { $group: { _id: '$fingerprint', total_visits: { $sum: 1 } } },
    ]);

    const ghosts = visitCounts.filter((v: Record<string, number>) => v.total_visits === 1).length;
    const repeat = visitCounts.filter((v: Record<string, number>) => v.total_visits > 1 && v.total_visits <= 10).length;
    const deep = visitCounts.filter((v: Record<string, number>) => v.total_visits > 10).length;
    const totalLurkers = neverPosted.length || 1;

    res.json({ total_lurkers: neverPosted.length, ghosts, repeat_lurkers: repeat, deep_lurkers: deep, ghosts_pct: Math.round((ghosts / totalLurkers) * 100), repeat_pct: Math.round((repeat / totalLurkers) * 100), deep_pct: Math.round((deep / totalLurkers) * 100) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 9c. Content That Converts Lurkers
router.get('/stats/traffic/conversion', async (req: AdminAuthRequest, res: Response) => {
  try {
    const convertingPaths = await UserEvent.aggregate([
      { $match: { event: 'post_submitted' } },
      { $sort: { created_at: 1 } },
      { $group: { _id: '$user_id', fingerprint: { $first: '$fingerprint' }, first_post: { $first: '$created_at' } } },
      { $lookup: { from: 'pagevisits', let: { fp: '$fingerprint', fpDate: '$first_post' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$fingerprint', '$$fp'] }, { $lt: ['$created_at', '$$fpDate'] }, { $gt: ['$created_at', { $subtract: ['$$fpDate', 86400000] }] }] } } },
          { $sort: { created_at: -1 } }, { $limit: 1 },
          { $project: { path: 1 } }
        ], as: 'last_visit' } },
      { $unwind: { path: '$last_visit', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$last_visit.path', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 20 },
    ]);
    res.json({ converting_paths: convertingPaths.map((p: Record<string, unknown>) => ({ path: p._id, count: p.count })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 9d. Re-Engagement Triggers
router.get('/stats/users/reengagement', async (req: AdminAuthRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const reengaged = await UserEvent.aggregate([
      { $match: { event: 'post_submitted' } },
      { $sort: { fingerprint: 1, created_at: 1 } },
      { $group: { _id: '$fingerprint', posts: { $push: '$created_at' }, last_post: { $last: '$created_at' } } },
      { $match: { $expr: { $and: [{ $gt: [{ $size: '$posts' }, 1] }, { $gt: ['$last_post', thirtyDaysAgo] }, { $lt: [{ $arrayElemAt: ['$posts', { $subtract: [{ $size: '$posts' }, 2] }] }, thirtyDaysAgo] }] } } },
      { $lookup: { from: 'pagevisits', let: { fp: '$_id', fpDate: '$last_post' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$fingerprint', '$$fp'] }, { $lt: ['$created_at', '$$fpDate'] }, { $gt: ['$created_at', { $subtract: ['$$fpDate', 86400000] }] }] } } },
          { $sort: { created_at: -1 } }, { $limit: 1 },
          { $project: { path: 1 } }
        ], as: 'last_visit' } },
      { $unwind: { path: '$last_visit', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$last_visit.path', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 20 },
    ]);
    res.json({ reengaged_users: reengaged.reduce((a: number, r: Record<string, number>) => a + r.count, 0), triggers: reengaged.map((p: Record<string, unknown>) => ({ path: p._id, count: p.count })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 10. Submissions + type migration
router.get('/stats/submissions', async (req: AdminAuthRequest, res: Response) => {
  try {
    const d = new Date(); d.setDate(d.getDate() - 7);
    const [byHour, byType, avgItems, typeMigration, typePaths] = await Promise.all([
      Post.aggregate([{ $match: { created_at: { $gte: d } } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Post.aggregate([{ $group: { _id: '$post_type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Post.aggregate([{ $lookup: { from: 'listitems', localField: '_id', foreignField: 'post_id', as: 'items' } }, { $group: { _id: null, avg: { $avg: { $size: '$items' } } } }]),
      Post.aggregate([{ $sort: { author_id: 1, created_at: 1 } }, { $group: { _id: '$author_id', types: { $push: '$post_type' }, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $project: { switched: { $cond: [{ $gt: [{ $size: { $setUnion: ['$types', []] } }, 1] }, 1, 0] }, total: 1 } }, { $group: { _id: null, switched: { $sum: '$switched' }, multi_type_users: { $sum: 1 } } }]),
      Post.aggregate([{ $sort: { author_id: 1, created_at: 1 } }, { $group: { _id: '$author_id', types: { $push: '$post_type' } } }, { $match: { $expr: { $gt: [{ $size: '$types' }, 1] } } }, { $project: { paths: { $reduce: { input: { $range: [0, { $subtract: [{ $size: '$types' }, 1] }] }, initialValue: [], in: { $concatArrays: ['$$value', [{ from: { $arrayElemAt: ['$types', '$$this'] }, to: { $arrayElemAt: ['$types', { $add: ['$$this', 1] }] } }]] } } } } }, { $unwind: '$paths' }, { $match: { $expr: { $ne: ['$paths.from', '$paths.to'] } } }, { $group: { _id: { from: '$paths.from', to: '$paths.to' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    ]);
    const migration = typeMigration[0] as Record<string, number> | undefined;
    res.json({ by_hour: byHour.map((h: Record<string, unknown>) => ({ hour: h._id, count: h.count })), by_type: byType.map((t: Record<string, unknown>) => ({ type: t._id || 'unknown', count: t.count })), avg_items_per_post: Math.round((avgItems[0]?.avg as number) || 0), type_migration: { multi_type_users: migration?.multi_type_users || 0, switched_types: migration?.switched || 0, paths: typePaths.map((p: Record<string, unknown>) => ({ from: (p._id as Record<string, string>).from, to: (p._id as Record<string, string>).to, count: p.count })) } });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 11. User Lifecycle + activation gap + time-to-second + drop-off + lifetime
router.get('/stats/users/lifecycle', async (req: AdminAuthRequest, res: Response) => {
  try {
    const [pipeline, activationGap, dropOff, lifetime, allUsers] = await Promise.all([
      UserEvent.aggregate([{ $match: { event: 'post_submitted' } }, { $sort: { created_at: 1 } }, { $group: { _id: '$user_id', posts: { $push: '$created_at' } } }, { $project: { first_post: { $arrayElemAt: ['$posts', 0] }, second_post: { $arrayElemAt: ['$posts', 1] } } }, { $match: { second_post: { $ne: null } } }, { $project: { days_between: { $divide: [{ $subtract: ['$second_post', '$first_post'] }, 86400000] } } }, { $bucket: { groupBy: '$days_between', boundaries: [0, 1, 4, 8, 31, 365], default: 'never', output: { count: { $sum: 1 } } } }]),
      UserEvent.aggregate([{ $match: { event: 'post_submitted', created_at: { $exists: true } } }, { $sort: { created_at: 1 } }, { $group: { _id: '$user_id', first: { $first: '$created_at' }, user_created: { $first: '$created_at' } } }, { $lookup: { from: 'users', localField: '_id', foreignField: 'user_id', as: 'user' } }, { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }, { $project: { gap_hours: { $cond: [{ $and: [{ $ne: ['$user.created_at', null] }, { $gt: [{ $subtract: ['$first', '$user.created_at'] }, 0] }] }, { $divide: [{ $subtract: ['$first', '$user.created_at'] }, 3600000] }, null] } } }, { $match: { gap_hours: { $ne: null } } }, { $group: { _id: null, avg_hours: { $avg: '$gap_hours' }, total: { $sum: 1 } } }]),
      Post.aggregate([{ $group: { _id: '$author_id', count: { $sum: 1 } } }, { $group: { _id: '$count', users: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Post.aggregate([{ $group: { _id: '$author_id', count: { $sum: 1 } } }, { $group: { _id: null, avg: { $avg: '$count' }, total: { $sum: 1 } } }]),
      Post.distinct('author_id'),
    ]);
    const buckets = pipeline.map((b: Record<string, unknown>) => ({ bucket: String(b._id).replace(/[0-9.]+/g, (m: string) => { const v = parseFloat(m); return v < 1 ? 'same_day' : v < 4 ? '1-3d' : v < 8 ? '4-7d' : v < 31 ? '8-30d' : '30d+'; }) || 'never', count: b.count }));
    const gap = activationGap[0] as Record<string, number> | undefined;
    const oneAndDone = dropOff.filter((d: Record<string, unknown>) => d._id === 1).reduce((a: number, d: Record<string, number>) => a + (d.users || 0), 0);
    const allPosters = dropOff.reduce((a: number, d: Record<string, number>) => a + (d.users || 0), 0);
    const lv = lifetime[0] as Record<string, number> | undefined;
    const converted24h = (activationGap[0] as Record<string, number> | undefined)?.total || 0;
    res.json({ lifecycle: buckets, activation_gap_hours: gap ? Math.round(gap.avg_hours) : null, converted_within_24h: converted24h, one_and_done_pct: allPosters > 0 ? Math.round((oneAndDone / allPosters) * 100) : 0, drop_off_distribution: dropOff.map((d: Record<string, unknown>) => ({ posts_made: d._id, users: d.users })), avg_lifetime_posts: lv ? Math.round(lv.avg) : 0, total_posters: allUsers.length });

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
