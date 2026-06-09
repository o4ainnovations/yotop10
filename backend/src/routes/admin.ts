/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- dynamic MongoDB queries + Express middleware require type casts */
import { Router, Request } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AdminUser } from '../models/AdminUser';
import { User } from '../models/User';
import { SetupToken } from '../models/SetupToken';
import { Post, generateUniqueSlug } from '../models/Post';
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
} from '../lib/adminAuth';
import { autoPermissionGuard, PERMISSION_CATALOG, isValidPermission } from '../lib/permissionGuard';
import { PlatformSnapshot } from '../models/PlatformSnapshot';
import { Category } from '../models/Category';
import { PageVisit } from '../models/PageVisit';
import { Comment } from '../models/Comment';
import { AlertThreshold } from '../models/AlertThreshold';
import { AlertHistory } from '../models/AlertHistory';
import { AlertNotificationModel } from '../models/AlertNotification';
import { AdminMessage } from '../models/AdminMessage';
import { MessageTemplate } from '../models/MessageTemplate';
import { UserEvent } from '../models/UserEvent';
import { TrustScoreLog } from '../models/TrustScoreLog';
import { SystemConfig as _SystemConfig } from '../models/SystemConfig';
import { HallOfFame } from '../models/HallOfFame';
import { getConfig, updateConfig, getConfigVersions } from '../lib/systemConfig';
import { redis } from '../lib/redis';
import { trustScoreWorker } from '../lib/trustScoreWorker';
import { indexPost, removePost, indexComment, removeComment } from '../elasticsearch/lib/indexWriter';

const router: Router = Router();

const PUBLIC_PATHS = new Set(['/login', '/setup', '/setup/validate']);

router.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  return adminAuthMiddleware(req, res, next);
});

router.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  return autoPermissionGuard(req, res, next);
});

/**
 * POST /api/admin/login
 * Public — brute-force protected via IP rate limit + account lock
 */
router.post('/login', async (req, res) => {
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

    const token = await generateAdminToken(
      (admin._id as { toString(): string }).toString(),
      admin.username,
      admin.token_version,
      admin.role,
      admin.permissions || [],
      admin.permissions_version ?? 0
    );

    const cookieMaxAge = admin.role === 'super_admin'
      ? 24 * 60 * 60 * 1000
      : 4 * 60 * 60 * 1000;

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge,
    });

    res.json({
      success: true,
      admin: { id: admin._id, username: admin.username, role: admin.role },
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
router.post('/setup', async (req, res) => {
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
      role: 'super_admin',
      permissions_version: 1,
    });

    await SetupToken.findByIdAndUpdate(setupToken._id, { used: true });

    const authToken = await generateAdminToken(
      (admin._id as { toString(): string }).toString(),
      admin.username,
      admin.token_version,
      admin.role,
      admin.permissions || [],
      admin.permissions_version ?? 0
    );

    const cookieMaxAge = admin.role === 'super_admin'
      ? 24 * 60 * 60 * 1000
      : 4 * 60 * 60 * 1000;

    res.cookie('admin_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge,
    });

    res.json({
      success: true,
      admin: { id: admin._id, username: admin.username, role: admin.role },
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
router.get('/setup/validate', async (req, res) => {
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
router.get('/me', async (req, res) => {
  res.json({
    id: req.admin!.id,
    username: req.admin!.username,
    role: req.admin!.role,
    permissions: req.admin!.permissions,
    permissions_version: req.admin!.permissions_version,
  });
});

/**
 * POST /api/admin/logout
 * Protected — invalidate admin session
 */
router.post('/logout', async (req, res) => {
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
 *
 * DOUBLE-BLIND MODERATION: Author trust score is intentionally hidden.
 * Review decisions must be based on content quality, not author reputation.
 */
router.get('/posts/pending', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { status: 'pending_review' };
    if (req.query.category_slug) query.category_slug = req.query.category_slug;
    if (req.query.post_type) query.post_type = req.query.post_type;
    if (req.query.author) {
      const escaped = (req.query.author as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.author_username = { $regex: escaped, $options: 'i' };
    }
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

    // Detect title collisions: for each pending post, find any other pending
    // post with >80% similar title and mark the LATER one with collision info
    const allPending = await Post.find({ status: 'pending_review', deleted: false })
      .select('title created_at')
      .sort({ created_at: 1 })
      .lean();

    const { checkTitleMatch } = await import('../lib/titleSimilarity');
    const enriched = posts.map((p: Record<string, unknown>) => {
      const myTime = new Date(p.created_at as string).getTime();
      for (const other of allPending) {
        if (String(other._id) === String(p._id)) continue;
        const result = checkTitleMatch(p.title as string, other.title as string);
        if (result.similarity >= 80) {
          const otherTime = new Date((other as any).created_at).getTime();
          if (myTime > otherTime) {
            return {
              ...p,
              collision: {
                title: other.title,
                submitted_at: (other as any).created_at,
                first: false,
              },
            };
          }
        }
      }
      return p;
    });

    res.json({ posts: enriched, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch pending posts' }); }
});

/**
 * GET /api/admin/posts/pending/:id
 * Protected — get full pending post preview
 *
 * DOUBLE-BLIND MODERATION: Author trust score is intentionally hidden.
 * Review decisions must be based on content quality, not author reputation.
 */
router.get('/posts/pending/:id', async (req, res) => {
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
 *
 * DOUBLE-BLIND: Trust score recalculation happens AFTER admin decision.
 * Admins never see author trust scores during review.
 */
router.patch('/posts/:id/approve', async (req, res) => {
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

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'approve_post',
      ip: getClientIp(req),
      metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title },
    });

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

    indexPost(post as unknown as Record<string, unknown>);

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
router.post('/posts/:id/retry', async (req, res) => {
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

    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'retry_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title, guidance: guidance.trim() }, user_agent: req.headers['user-agent'] || '' });

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
 *
 * DOUBLE-BLIND: Trust score recalculation happens AFTER admin decision.
 * Admins never see author trust scores during review.
 */
router.patch('/posts/:id/reject', async (req, res) => {
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

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'reject_post',
      ip: getClientIp(req),
      metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title, reason: reason.trim() },
    });

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

    indexPost(post as unknown as Record<string, unknown>);

    res.json({ success: true, post });
  } catch (error) {
    console.error('Error rejecting post:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to reject post' });
  }
});

/**
 * POST /api/admin/posts/bulk/approve — Bulk approve multiple posts
 */
router.post('/posts/bulk/approve', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 post IDs' });
    }

    const { processBatch } = await import('../lib/batchProcessor');
    let skipped = 0;
    const result = await processBatch(ids, async (id) => {
      const post = await Post.findById(id);
      if (!post) { skipped++; return; }
      if (post.status === 'approved') { skipped++; return; }
      post.status = 'approved'; post.published_at = new Date();
      await post.save();
      await trustScoreWorker.queueUpdate(post.author_id, (post._id as { toString(): string }).toString(), 'approve');
      const { grantBoost, BoostType } = await import('../lib/ladderSystem');
      await grantBoost(post.author_id.toString(), BoostType.POST_APPROVED);
      await createNotification({ user_id: post.author_id, type: 'post_approved', post_id: (post._id as { toString(): string }).toString(), post_title: post.title, message: `Your list "${post.title}" was approved.` });
      indexPost(post as unknown as Record<string, unknown>);
    });

    res.json({ success: true, approved: result.succeeded, skipped, errors: result.errors.slice(0, 5) });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk approve failed' }); }
});

/**
 * POST /api/admin/posts/bulk/reject — Bulk reject multiple posts
 */
router.post('/posts/bulk/reject', async (req, res) => {
  try {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 post IDs' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Rejection reason is required' });
    }

    const { processBatch } = await import('../lib/batchProcessor');
    let skipped = 0;
    const result = await processBatch(ids, async (id) => {
      const post = await Post.findById(id);
      if (!post) { skipped++; return; }
      if (post.status === 'rejected') { skipped++; return; }
      post.status = 'rejected'; post.rejection_reason = reason.trim();
      await post.save();
      await trustScoreWorker.queueUpdate(post.author_id, (post._id as { toString(): string }).toString(), 'reject');
      await createNotification({ user_id: post.author_id, type: 'post_rejected', post_id: (post._id as { toString(): string }).toString(), post_title: post.title, message: `Your list "${post.title}" was not approved. Reason: ${reason.trim()}` });
      indexPost(post as unknown as Record<string, unknown>);
    });

    res.json({ success: true, rejected: result.succeeded, skipped, errors: result.errors.slice(0, 5) });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk reject failed' }); }
});

/**
 * GET /api/admin/audit-logs/stats
 * Protected — quick dashboard summary, Redis-cached 30s
 */
router.get('/audit-logs/stats', async (req, res) => {
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
router.get('/audit-logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (req.query.action) query.action = req.query.action;
    if (req.query.ip) {
      const escaped = (req.query.ip as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.ip = { $regex: escaped, $options: 'i' };
    }
    if (req.query.date_from || req.query.date_to) {
      query.created_at = {} as Record<string, unknown>;
      if (req.query.date_from) (query.created_at as Record<string, unknown>).$gte = new Date(req.query.date_from as string);
      if (req.query.date_to) (query.created_at as Record<string, unknown>).$lte = new Date(req.query.date_to as string);
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

// GET /api/admin/audit-logs/export — CSV export for compliance
router.get('/audit-logs/export', async (req, res) => {
  try {
    const query: Record<string, unknown> = {};
    if (req.query.action) query.action = req.query.action;
    if (req.query.admin_id) query.admin_id = req.query.admin_id;
    if (req.query.date_from || req.query.date_to) {
      query.created_at = {};
      if (req.query.date_from) (query.created_at as Record<string, unknown>).$gte = new Date(req.query.date_from as string);
      if (req.query.date_to) (query.created_at as Record<string, unknown>).$lte = new Date(req.query.date_to as string);
    }

    const logs = await AuditLog.find(query).sort({ created_at: -1 }).limit(5000).lean();
    const header = 'ID,AdminID,Action,IP,UserAgent,Metadata,CreatedAt\n';
    const rows = logs.map((l: Record<string, unknown>) => [
      `"${l._id}"`, `"${l.admin_id || ''}"`, `"${l.action}"`, `"${l.ip || ''}"`,
      `"${((l.user_agent as string) || '').replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.metadata || {}).replace(/"/g, '""')}"`,
      l.created_at,
    ].join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_export_${new Date().toISOString().substring(0, 10)}.csv"`);
    res.send(header + rows);
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ M10.4 All Posts Management ══════════════════════════════════

// 1. List all posts
router.get('/posts', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { $or: [{ deleted: false }, { deleted: { $exists: false } }] };
    if (req.query.status) {
      if (req.query.status === 'deleted') { query.deleted = true; }
      else if (req.query.status) { query.status = req.query.status; }
    }
    if (req.query.category_slug) query.category_slug = req.query.category_slug;
    if (req.query.post_type) query.post_type = req.query.post_type;
    if (req.query.author) {
      const escaped = (req.query.author as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.author_username = { $regex: escaped, $options: 'i' };
    }
    if (req.query.search) {
      const escaped = (req.query.search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchOr = [{ title: { $regex: escaped, $options: 'i' } }, { intro: { $regex: escaped, $options: 'i' } }];
      query.$or = query.$or ? [...(query.$or as Array<Record<string, unknown>>), ...searchOr] : searchOr;
    }
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
    const fireAgg = postIds.length > 0 ? await Comment.aggregate([
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
router.patch('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });

    if (req.body.version !== undefined && req.body.version !== post.version) {
      return res.status(409).json({ code: 'CONFLICT', error: 'Post was modified by another session. Reload and retry.' });
    }

    if (req.body.title) { post.title = req.body.title; post.slug = generateUniqueSlug(post.title, (post._id as { toString(): string }).toString()); }
    if (req.body.intro !== undefined) post.intro = req.body.intro;
    if (req.body.category_slug) { const cat = await Category.findOne({ slug: req.body.category_slug }); if (!cat) return res.status(400).json({ code: 'NOT_FOUND', error: 'Category not found' }); post.category_slug = req.body.category_slug; }
    if (req.body.editorial_note !== undefined) post.editorial_note = req.body.editorial_note || null;
    await post.save();

    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'edit_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });

    if (req.body.items && Array.isArray(req.body.items)) {
      const { ListItem } = await import('../models/ListItem');
      const postId = post._id;

      // Journal: save old items for rollback
      const oldItems = await ListItem.find({ post_id: postId }).lean();

      try {
        await ListItem.deleteMany({ post_id: postId });
        if (req.body.items.length > 0) {
          await ListItem.insertMany(req.body.items.map((item: { rank: number; title: string; justification: string }) => ({ post_id: postId, rank: item.rank, title: item.title, justification: item.justification })));
        }
      } catch (itemsError) {
        // Rollback: restore old items on failure
        console.error('[PostEdit] Items update failed, rolling back:', itemsError);
        await ListItem.deleteMany({ post_id: postId });
        if (oldItems.length > 0) {
          await ListItem.insertMany(oldItems.map((item: Record<string, unknown>) => ({
            post_id: postId,
            rank: item.rank,
            title: item.title,
            justification: item.justification,
          })));
        }
        throw itemsError;
      }
    }

    indexPost(post as unknown as Record<string, unknown>);

    res.json({ success: true, post });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to edit post' }); }
});

// 3. Soft delete
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    post.deleted = true; post.deleted_at = new Date(); post.auto_hard_delete_at = new Date(Date.now() + 30 * 86400000);
    await post.save();
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'delete_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });
    removePost((post._id as { toString(): string }).toString());
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to delete post' }); }
});

// 4. Restore soft-deleted
router.post('/posts/:id/restore', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.deleted) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found or not deleted' });
    post.deleted = false; post.deleted_at = null; post.auto_hard_delete_at = null;
    await post.save();
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'restore_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });
    indexPost(post as unknown as Record<string, unknown>);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to restore post' }); }
});

// 5. Hard delete (permanent)
router.delete('/posts/:id/permanent', async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    const { ListItem } = await import('../models/ListItem');
    await ListItem.deleteMany({ post_id: post._id });
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'hard_delete_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });
    removePost((post._id as { toString(): string }).toString());
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to permanently delete post' }); }
});

// 6. Feature
router.post('/posts/:id/feature', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.featured = true; post.featured_at = new Date();
  if (req.body.editorial_note) post.editorial_note = req.body.editorial_note;
  await post.save();

  await HallOfFame.findOneAndUpdate(
    { post_id: post._id },
    { post_id: post._id, featured_at: new Date(), created_by: req.admin?.username || 'admin', sort_order: 0 },
    { upsert: true, new: true }
  );

  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'feature_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });
  indexPost(post as unknown as Record<string, unknown>);
  res.json({ success: true, post });
});

// 7. Unfeature
router.post('/posts/:id/unfeature', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.featured = false; post.featured_at = null; post.editorial_note = null;
  await post.save();

  await HallOfFame.deleteOne({ post_id: post._id });

  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'unfeature_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });
  indexPost(post as unknown as Record<string, unknown>);
  res.json({ success: true, post });
});

// 8. Lock comments
router.post('/posts/:id/lock', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.comments_locked = true;
  await post.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'lock_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });
  indexPost(post as unknown as Record<string, unknown>);
  res.json({ success: true });
});

// 9. Unlock comments
router.post('/posts/:id/unlock', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.comments_locked = false;
  await post.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'unlock_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });
  indexPost(post as unknown as Record<string, unknown>);
  res.json({ success: true });
});

// 10. Bump
router.post('/posts/:id/bump', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
  post.bumped_at = new Date();
  await post.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'bump_post', ip: getClientIp(req), metadata: { post_id: (post._id as { toString(): string }).toString(), post_title: post.title }, user_agent: req.headers['user-agent'] || '' });
  indexPost(post as unknown as Record<string, unknown>);
  res.json({ success: true, post });
});

// 11. Quick stats
router.get('/posts/stats', async (req, res) => {
  const [total, pending, approved, rejected, del, featured, locked] = await Promise.all([
    Post.countDocuments({ deleted: false }), Post.countDocuments({ status: 'pending_review', deleted: false }), Post.countDocuments({ status: 'approved', deleted: false }), Post.countDocuments({ status: 'rejected', deleted: false }), Post.countDocuments({ deleted: true }), Post.countDocuments({ featured: true }), Post.countDocuments({ comments_locked: true }),
  ]);
  res.json({ total, pending, approved, rejected, deleted: del, featured, locked });
});

// 12-14. Item-level operations
router.patch('/posts/:id/items/:itemId', async (req, res) => {
  try {
    const { ListItem } = await import('../models/ListItem');
    const item = await ListItem.findOneAndUpdate({ _id: req.params.itemId, post_id: req.params.id }, { $set: req.body }, { new: true });
    if (!item) return res.status(404).json({ code: 'NOT_FOUND', error: 'Item not found' });
    res.json({ success: true, item });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to edit item' }); }
});
router.post('/posts/:id/items', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    const { ListItem } = await import('../models/ListItem');
    const item = await ListItem.create({ ...req.body, post_id: post._id });
    res.status(201).json({ success: true, item });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to add item' }); }
});
router.delete('/posts/:id/items/:itemId', async (req, res) => {
  try {
    const { ListItem } = await import('../models/ListItem');
    await ListItem.findOneAndDelete({ _id: req.params.itemId, post_id: req.params.id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to delete item' }); }
});

// 15-17. Bulk operations
router.post('/posts/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 post IDs' });
    const result = await Post.updateMany({ _id: { $in: ids } }, { $set: { deleted: true, deleted_at: new Date(), auto_hard_delete_at: new Date(Date.now() + 30 * 86400000) } });
    for (const id of ids) removePost(id);
    res.json({ success: true, deleted: result.modifiedCount });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk delete failed' }); }
});
router.post('/posts/bulk/change-category', async (req, res) => {
  try {
    const { ids, category_slug } = req.body;
    if (!Array.isArray(ids) || !category_slug) return res.status(400).json({ code: 'VALIDATION', error: 'Provide ids array and category_slug' });
    const cat = await Category.findOne({ slug: category_slug });
    if (!cat) return res.status(400).json({ code: 'NOT_FOUND', error: 'Category not found' });
    const result = await Post.updateMany({ _id: { $in: ids } }, { $set: { category_slug } });
    res.json({ success: true, changed: result.modifiedCount });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk recategorize failed' }); }
});
router.post('/posts/bulk/status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !['approved', 'rejected', 'pending_review'].includes(status)) return res.status(400).json({ code: 'VALIDATION', error: 'Provide ids and valid status' });
    const { processBatch } = await import('../lib/batchProcessor');
    const result = await processBatch(ids, async (id) => {
      const post = await Post.findById(id);
      if (!post || post.status === status) return;
      post.status = status;
      if (status === 'approved') post.published_at = new Date();
      await post.save();
      await trustScoreWorker.queueUpdate(post.author_id, (post._id as { toString(): string }).toString(), status === 'approved' ? 'approve' : 'reject');
      indexPost(post as unknown as Record<string, unknown>);
    });
    res.json({ success: true, changed: result.succeeded });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Bulk status change failed' }); }
});

// 18. Export
router.get('/posts/export', async (req, res) => {
  try {
    const query: Record<string, unknown> = { deleted: false };
    if (req.query.status) query.status = req.query.status;
    const posts = await Post.find(query).sort({ created_at: -1 }).limit(10000).lean();
    const header = 'ID,Title,Author,Category,Type,Status,Fire,Comments,Views,Created,Published\n';
    const rows = posts.map(p => [`"${p._id}"`, `"${(p.title || '').replace(/"/g, '""')}"`, p.author_username, p.category_slug, p.post_type, p.status, (p as any).fire_count, p.comment_count, p.view_count, p.created_at, p.published_at || ''].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="posts_export_${new Date().toISOString().substring(0,10)}.csv"`);
    res.send(header + rows);
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Export failed' }); }
});

// 19. Revisions
router.get('/posts/:id/revisions', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select('status_history title intro created_at updated_at').lean();
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    res.json({ revisions: post.status_history || [], current: { title: post.title, intro: post.intro, created_at: post.created_at, updated_at: post.updated_at } });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch revisions' }); }
});

// 20. Compare
router.get('/posts/compare', async (req, res) => {
  try {
    const ids = (req.query.ids as string || '').split(',');
    if (ids.length !== 2) return res.status(400).json({ code: 'VALIDATION', error: 'Provide exactly 2 IDs' });
    const [p1, p2] = await Promise.all([Post.findById(ids[0]).select('title intro post_type category_slug items created_at').lean(), Post.findById(ids[1]).select('title intro post_type category_slug items created_at').lean()]);
    res.json({ post1: p1, post2: p2 });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Compare failed' }); }
});

// 21. Duplicate
router.post('/posts/:id/duplicate', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    const copy = await Post.create({ ...post, _id: undefined, status: 'pending_review', published_at: undefined, created_at: undefined, updated_at: undefined, slug: '', normalized_title: '', view_count: 0, comment_count: 0, fire_count: 0, version: 0, deleted: false, deleted_at: null, featured: false, comments_locked: false });
    indexPost(copy as unknown as Record<string, unknown>);
    res.status(201).json({ success: true, post: copy });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Duplicate failed' }); }
});

// 22. Activity
router.get('/posts/:id/activity', async (req, res) => {
  try {
    const logs = await AuditLog.find({ 'metadata.post_id': req.params.id }).sort({ created_at: -1 }).limit(50).lean();
    res.json({ activity: logs });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch activity' }); }
});

// 23. Admin view comments
router.get('/posts/:id/comments', async (req, res) => {
  try {
    const { Comment } = await import('../models/Comment');
    const comments = await Comment.find({ post_id: req.params.id }).sort({ created_at: -1 }).limit(100).lean();
    res.json({ comments });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch comments' }); }
});

// 24. Quality check
router.post('/posts/quality-check', async (req, res) => {
  try {
    const flags = await Post.find({ status: 'approved', deleted: false, intro: { $exists: true, $not: { $regex: /.{100,}/ } } }).select('title intro').lean();
    res.json({ low_quality_count: flags.length, flagged: flags.slice(0, 20) });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Quality check failed' }); }
});

// ═══ M10.5 All Comments Management ════════════════════════════════

// 1. List all comments
router.get('/comments', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};
    if (req.query.filter === 'deleted') query.deleted = true;
    else if (req.query.filter === 'hidden') query.hidden = true;
    else if (req.query.filter === 'flagged') query.flag_type = { $ne: null };
    else if (req.query.filter === 'highlighted') query.highlighted = true;
    if (req.query.post_id) query.post_id = req.query.post_id;
    if (req.query.author) {
      const escaped = (req.query.author as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.author_username = { $regex: escaped, $options: 'i' };
    }
    if (req.query.type === 'item_anchored') query.list_item_id = { $ne: null };
    if (req.query.type === 'post_comment') query.list_item_id = null;
    if (req.query.search) {
      const escaped = (req.query.search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.content = { $regex: escaped, $options: 'i' };
    }
    if (req.query.date_from || req.query.date_to) { query.created_at = {}; if (req.query.date_from) (query.created_at as Record<string, unknown>).$gte = new Date(req.query.date_from as string); if (req.query.date_to) (query.created_at as Record<string, unknown>).$lte = new Date(req.query.date_to as string); }
    if (req.query.has_replies === 'yes') query.reply_count = { $gt: 0 };
    if (req.query.has_replies === 'no') query.reply_count = 0;

    const sortMap: Record<string, string> = { newest: 'created_at', oldest: 'created_at', most_fire: 'fire_count', most_replies: 'reply_count', highest_spark: 'spark_score' };
    const sortField = sortMap[req.query.sort as string] || 'created_at';
    const sortDir = (req.query.sort as string) === 'oldest' ? 1 : -1;

    const [comments, total] = await Promise.all([
      Comment.find(query).sort({ flag_type: -1, deleted: 1, [sortField]: sortDir }).skip(skip).limit(limit).lean(),
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
      const [totalAll, del, hid, hi, flg, itemAnch, postCmt] = await Promise.all([
        Comment.countDocuments({}), Comment.countDocuments({ deleted: true }), Comment.countDocuments({ hidden: true }), Comment.countDocuments({ highlighted: true }), Comment.countDocuments({ deleted: { $ne: true }, flag_type: { $ne: null } }),
        Comment.countDocuments({ list_item_id: { $ne: null } }), Comment.countDocuments({ list_item_id: null }),
      ]);
      result.stats = { total: totalAll, deleted: del, hidden: hid, highlighted: hi, flagged: flg, item_anchored: itemAnch, post_comment: postCmt };
    }
    res.json(result);
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch comments' }); }
});

// 2. Admin edit comment (any age, override 2hr window)
router.patch('/comments/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
    if (req.body.content) comment.content = req.body.content.substring(0, 2000);
    await comment.save();
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'edit_comment', ip: getClientIp(req), metadata: { comment_id: (comment._id as { toString(): string }).toString(), content: req.body.content?.substring(0, 100) }, user_agent: req.headers['user-agent'] || '' });
    indexComment(comment as unknown as Record<string, unknown>);
    res.json({ success: true, comment });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to edit comment' }); }
});

// 3. Soft delete
router.delete('/comments/:id', async (req, res) => {
  try {
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
    c.deleted = true; c.deleted_at = new Date(); c.flag_type = null; c.flag_evidence = null;
    await c.save();
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'delete_comment', ip: getClientIp(req), metadata: { comment_id: (c._id as { toString(): string }).toString() }, user_agent: req.headers['user-agent'] || '' });
    removeComment((c._id as { toString(): string }).toString());
    res.json({ success: true });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to delete comment' }); }
});

// 4. Restore
router.post('/comments/:id/restore', async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.deleted = false; c.deleted_at = null;
  await c.save();
  indexComment(c as unknown as Record<string, unknown>);
  res.json({ success: true });
});

// 5. Hard delete
router.delete('/comments/:id/permanent', async (req, res) => {
  const c = await Comment.findByIdAndDelete(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'hard_delete_comment', ip: getClientIp(req), metadata: { comment_id: (c._id as { toString(): string }).toString() }, user_agent: req.headers['user-agent'] || '' });
  removeComment((c._id as { toString(): string }).toString());
  res.json({ success: true });
});

// 6-7. Hide / Unhide
router.post('/comments/:id/hide', async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.hidden = true; c.hidden_reason = req.body.reason || null; c.flag_type = null; c.flag_evidence = null;
  await c.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'hide_comment', ip: getClientIp(req), metadata: { comment_id: (c._id as { toString(): string }).toString(), reason: req.body.reason || null }, user_agent: req.headers['user-agent'] || '' });
  removeComment((c._id as { toString(): string }).toString());
  res.json({ success: true });
});
router.post('/comments/:id/unhide', async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.hidden = false; c.hidden_reason = null;
  await c.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'unhide_comment', ip: getClientIp(req), metadata: { comment_id: (c._id as { toString(): string }).toString() }, user_agent: req.headers['user-agent'] || '' });
  indexComment(c as unknown as Record<string, unknown>);
  res.json({ success: true });
});

// 8-9. Highlight / Unhighlight
router.post('/comments/:id/highlight', async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.highlighted = true;
  await c.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'highlight_comment', ip: getClientIp(req), metadata: { comment_id: (c._id as { toString(): string }).toString() }, user_agent: req.headers['user-agent'] || '' });
  indexComment(c as unknown as Record<string, unknown>);
  res.json({ success: true });
});
router.post('/comments/:id/unhighlight', async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  c.highlighted = false;
  await c.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'unhighlight_comment', ip: getClientIp(req), metadata: { comment_id: (c._id as { toString(): string }).toString() }, user_agent: req.headers['user-agent'] || '' });
  indexComment(c as unknown as Record<string, unknown>);
  res.json({ success: true });
});

// 10-11. Bulk
router.post('/comments/bulk/delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 IDs' });
  const r = await Comment.updateMany({ _id: { $in: ids } }, { $set: { deleted: true, deleted_at: new Date(), flag_type: null, flag_evidence: null } });
  for (const id of ids) removeComment(id);
  res.json({ success: true, deleted: r.modifiedCount });
});
router.post('/comments/bulk/hide', async (req, res) => {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 IDs' });
  const r = await Comment.updateMany({ _id: { $in: ids } }, { $set: { hidden: true, hidden_reason: reason || null, flag_type: null, flag_evidence: null } });
  for (const id of ids) removeComment(id);
  res.json({ success: true, hidden: r.modifiedCount });
});

// 12. Quick stats
router.get('/comments/stats', async (req, res) => {
    const [total, del, hid, hi, itemAnchored, postComment, flagged] = await Promise.all([
      Comment.countDocuments({}), Comment.countDocuments({ deleted: true }), Comment.countDocuments({ hidden: true }), Comment.countDocuments({ highlighted: true }), Comment.countDocuments({ list_item_id: { $ne: null } }), Comment.countDocuments({ list_item_id: null }), Comment.countDocuments({ deleted: { $ne: true }, flag_type: { $ne: null } }),
    ]);
    res.json({ total, deleted: del, hidden: hid, highlighted: hi, item_anchored: itemAnchored, post_comment: postComment, flagged });
});

// 13. Export
router.get('/comments/export', async (req, res) => {
  const comments = await Comment.find({}).sort({ created_at: -1 }).limit(10000).lean();
  const header = 'ID,Content,Author,PostID,Type,Fire,Replies,SparkScore,Depth,Created\n';
  const rows = comments.map(c => [`"${c._id}"`, `"${(c.content || '').substring(0, 200).replace(/"/g, '""')}"`, c.author_username, c.post_id, c.list_item_id ? 'item_anchored' : 'post_comment', c.fire_count, c.reply_count, c.spark_score, c.depth, c.created_at].join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="comments_export_${new Date().toISOString().substring(0,10)}.csv"`);
  res.send(header + rows);
});

// 14. Activity
router.get('/comments/:id/activity', async (req, res) => {
  const c = await Comment.findById(req.params.id).select('content_history').lean();
  if (!c) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  res.json({ content_history: c.content_history || [] });
});

// 15. Apply penalty
router.post('/comments/:id/apply-penalty', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });

    const minutes = Math.min(7200, Math.max(1, parseInt(req.body.minutes) || 5)); // max 5 days
    const trustPenalty = Math.max(-1.0, Math.min(0, parseFloat(req.body.trust_penalty) || -0.01));

    const user = await User.findOne({ user_id: comment.author_id });
    if (user) {
      const newTrust = Math.max(0.1, (user.trust_score || 1.0) + trustPenalty);
      const newRestricted = new Date(Date.now() + minutes * 60 * 1000);
      await User.findByIdAndUpdate(user._id, { trust_score: newTrust, restricted_until: newRestricted });
    }

    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'apply_penalty', ip: getClientIp(req), metadata: { comment_id: (comment._id as { toString(): string }).toString(), minutes, trust_penalty: trustPenalty }, user_agent: req.headers['user-agent'] || '' });

    res.json({ success: true, penalty: { minutes, trust_penalty: trustPenalty } });
  } catch (error) { res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to apply penalty' }); }
});

// 16. Dismiss flag
router.post('/comments/:id/dismiss-flag', async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  comment.flag_type = null;
  comment.flag_evidence = null;
  await comment.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'dismiss_flag', ip: getClientIp(req), metadata: { comment_id: (comment._id as { toString(): string }).toString() }, user_agent: req.headers['user-agent'] || '' });
  indexComment(comment as unknown as Record<string, unknown>);
  res.json({ success: true });
});

// 17. Manual flag
router.post('/comments/:id/flag', async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ code: 'NOT_FOUND', error: 'Comment not found' });
  comment.flag_type = req.body.flag_type || 'manual';
  comment.flag_evidence = req.body.evidence || { flagged_by: 'admin' };
  await comment.save();
  logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'flag_comment', ip: getClientIp(req), metadata: { comment_id: (comment._id as { toString(): string }).toString(), flag_type: req.body.flag_type || 'manual' }, user_agent: req.headers['user-agent'] || '' });
  indexComment(comment as unknown as Record<string, unknown>);
  res.json({ success: true });
});

// 18. Bulk flag
router.post('/comments/bulk/flag', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 IDs' });
  const r = await Comment.updateMany({ _id: { $in: ids } }, { $set: { flag_type: 'manual', flag_evidence: { flagged_by: 'admin', bulk: true } } });
  res.json({ success: true, flagged: r.modifiedCount });
});

// 19. Bulk unflag
router.post('/comments/bulk/unflag', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return res.status(400).json({ code: 'VALIDATION', error: 'Provide 1-50 IDs' });
  const r = await Comment.updateMany({ _id: { $in: ids } }, { $set: { flag_type: null, flag_evidence: null } });
  res.json({ success: true, unflagged: r.modifiedCount });
});

// ═══ Stats Endpoints ═══════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SNAPSHOT_OR_LIVE = async (req: Request, computeSnapshot: () => Promise<unknown>, computeLive: () => Promise<unknown>) => {
  if (req.query.from || req.query.to) return computeLive();
  return computeSnapshot();
};

function parseBrowser(ua: string) { if (!ua) return 'unknown'; if (/Edg/.test(ua)) return 'edge'; if (/Opera|OPR/.test(ua)) return 'opera'; if (/Chrome/.test(ua)) return 'chrome'; if (/Firefox/.test(ua)) return 'firefox'; if (/Safari/.test(ua)) return 'safari'; return 'other'; }
function parseOS(ua: string) { if (!ua) return 'unknown'; if (/Windows/.test(ua)) return 'windows'; if (/Mac/.test(ua)) return 'macos'; if (/Linux/.test(ua) && !/Android/.test(ua)) return 'linux'; if (/Android/.test(ua)) return 'android'; if (/iPhone|iPad|iPod/.test(ua)) return 'ios'; return 'other'; }

// 1. Health Pulse
router.get('/stats/health', async (req, res) => {
  try {
    const [mongoState, redisPing, esPing, heartbeats, mongoLatency, redisInfo, orphanedPosts] = await Promise.all([
      mongoose.connection.readyState,
      redis.ping().then(() => 'ok').catch(() => 'down'),
      (async () => { try { const { es } = await import('../lib/elasticsearch'); await es.ping(); return 'ok'; } catch { return 'down'; } })(),
      redis.hGetAll('cron:heartbeats'),
      (async () => { try { const start = Date.now(); await mongoose.connection.db?.admin().ping(); return Date.now() - start; } catch { return null; } })(),
      (async () => { try { return await redis.info('memory'); } catch { return ''; } })(),
      Post.countDocuments({ category_slug: '__orphan__' }),
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

    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
      orphaned_posts: orphanedPosts,
      dependency_map: deps,
      affected_features_count: affectedFeatures.length,
      affected_features: affectedFeatures,
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 2. Overview (fully live)
router.get('/stats/overview', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const _threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600000);
    const [tp, tc, tu, pn, orphans, peakQueueHour, peakSubmitHour, totalPosts, approved, rejected, totalComments] = await Promise.all([
      Post.countDocuments({ created_at: { $gte: today }, deleted: false }),
      Comment.countDocuments({ created_at: { $gte: today }, deleted: false, hidden: false }),
      User.countDocuments({ created_at: { $gte: today } }),
      Post.countDocuments({ status: 'pending_review', deleted: false }),
      Post.countDocuments({ status: 'pending_review', created_at: { $lt: new Date(Date.now() - 72 * 3600000) }, revision_guidance: null, deleted: false }),
      Post.aggregate([{ $match: { status: 'pending_review', deleted: false } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
      Post.aggregate([{ $match: { deleted: false } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
      Post.countDocuments({ deleted: false }),
      Post.countDocuments({ status: 'approved', deleted: false }),
      Post.countDocuments({ status: 'rejected', deleted: false }),
      Comment.countDocuments({ deleted: false, hidden: false }),
    ]);
    const peakHr = peakQueueHour[0] || {}; const peakSubHr = peakSubmitHour[0] || {};
    const [scholars, neutrals, trolls, trolls24h, totalUsers] = await Promise.all([
      User.countDocuments({ trust_score: { $gte: 1.8 } }),
      User.countDocuments({ trust_score: { $gte: 0.5, $lt: 1.8 } }),
      User.countDocuments({ trust_score: { $lt: 0.5 } }),
      User.countDocuments({ trust_score: { $lt: 0.5 }, updated_at: { $gte: new Date(Date.now() - 24 * 3600000) } }),
      User.countDocuments({}),
    ]);
    res.json({ posts: { total: totalPosts, today: tp, submitted: tp, approved, rejected }, comments: { total: totalComments, today: tc }, users: { total: totalUsers, today: tu }, pending: pn, queue: { pending: pn, oldest_age_hours: 0, peak_queue_hour: peakHr._id || null, peak_queue_hour_count: peakHr.count || 0 }, trust: { scholars, neutrals, trolls }, trolls_active: trolls24h, orphans_72h_no_guidance: orphans, peak_submission_hour: peakSubHr._id || null, peak_submission_hour_count: peakSubHr.count || 0 });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 3. Content + age distribution + approval gap + throughput (fully live)
router.get('/stats/content', async (req, res) => {
  try {
    const now = new Date(); const today = new Date(); today.setHours(0,0,0,0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const [totalPosts, totalApproved, totalRejected, totalPending, inRevision, totalComments, commentsToday, commentsWeek, ageBuckets, approvalGap, throughput7d] = await Promise.all([
      Post.countDocuments({ deleted: false }),
      Post.countDocuments({ status: 'approved', deleted: false }),
      Post.countDocuments({ status: 'rejected', deleted: false }),
      Post.countDocuments({ status: 'pending_review', deleted: false }),
      Post.countDocuments({ status: 'pending_review', revision_guidance: { $ne: null }, deleted: false }),
      Comment.countDocuments({ deleted: false, hidden: false }),
      Comment.countDocuments({ created_at: { $gte: today }, deleted: false, hidden: false }),
      Comment.countDocuments({ created_at: { $gte: new Date(Date.now() - 7 * 86400000) }, deleted: false, hidden: false }),
      Post.aggregate([{ $match: { deleted: false } }, { $bucket: { groupBy: { $subtract: [now, '$created_at'] }, boundaries: [0, 3600000, 86400000, 259200000, 604800000, 2592000000, 31536000000], default: 'ancient', output: { count: { $sum: 1 } } } }]),
      Post.aggregate([{ $match: { status: 'approved', published_at: { $ne: null }, deleted: false } }, { $project: { gap_hours: { $divide: [{ $subtract: ['$published_at', '$created_at'] }, 3600000] } } }, { $group: { _id: null, avg_hours: { $avg: '$gap_hours' }, max_hours: { $max: '$gap_hours' }, min_hours: { $min: '$gap_hours' } } }]),
      Post.aggregate([{ $match: { status: { $in: ['approved', 'rejected'] }, updated_at: { $gte: sevenDaysAgo }, deleted: false } }, { $group: { _id: { $dayOfWeek: '$updated_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    const bucketMap: Record<string, number> = {};
    for (const b of ageBuckets) { const key = String(b._id).replace(/\d+/g, m => { const v = parseInt(m); return v < 3600000 ? '<1h' : v < 86400000 ? '1-24h' : v < 259200000 ? '1-3d' : v < 604800000 ? '3-7d' : v < 2592000000 ? '7-30d' : '30d+'; }) || 'ancient'; bucketMap[key] = (bucketMap[key] || 0) + b.count; }
    const gap = approvalGap[0] || {};
    res.json({ posts: { total: totalPosts, submitted: totalPending + totalApproved + totalRejected, approved: totalApproved, rejected: totalRejected, pending: totalPending, in_revision: inRevision }, comments: { total: totalComments, today: commentsToday, this_week: commentsWeek }, age_distribution: bucketMap, approval_gap: { avg_hours: gap.avg_hours ? Math.round(gap.avg_hours) : null, max_hours: gap.max_hours ? Math.round(gap.max_hours) : null, min_hours: gap.min_hours ? Math.round(gap.min_hours) : null }, throughput_7d: throughput7d.map((t: Record<string, unknown>) => ({ day: t._id, count: t.count })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 4. Community + fan-out (fully live)
router.get('/stats/community', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0); const weekAgo = new Date(Date.now() - 7*86400000); const monthAgo = new Date(Date.now() - 30*86400000);
    const [total, newToday, newWeek, active30d, active7d, scholars, neutrals, trolls, trolls24h, usersOver30d, powerUsers, postersThisMonth, postersLastMonth, lurkerDeep] = await Promise.all([
      User.countDocuments({}), User.countDocuments({ created_at: { $gte: today } }), User.countDocuments({ created_at: { $gte: weekAgo } }), User.countDocuments({ created_at: { $lte: new Date(), $gte: monthAgo } }), User.countDocuments({ created_at: { $lte: new Date(), $gte: weekAgo } }),
      User.countDocuments({ trust_score: { $gte: 1.8 } }), User.countDocuments({ trust_score: { $gte: 0.5, $lt: 1.8 } }), User.countDocuments({ trust_score: { $lt: 0.5 } }), User.countDocuments({ trust_score: { $lt: 0.5 }, updated_at: { $gte: new Date(Date.now() - 24*3600000) } }),
      User.countDocuments({ created_at: { $lt: monthAgo } }),
      Post.aggregate([{ $match: { deleted: false } }, { $group: { _id: '$author_id', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Post.distinct('author_id', { created_at: { $gte: monthAgo }, deleted: false }),
      Post.distinct('author_id', { created_at: { $lt: monthAgo, $gte: new Date(Date.now() - 60*86400000) }, deleted: false }),
      PageVisit.aggregate([{ $group: { _id: '$fingerprint', count: { $sum: 1 } } }, { $match: { count: { $gt: 10 }, _id: { $ne: null } } }, { $lookup: { from: 'posts', localField: '_id', foreignField: 'author_id', as: 'posts' } }, { $match: { posts: [] } }, { $count: 'count' }]),
    ]);
    const sorted = powerUsers as { _id: string; count: number }[]; const top5 = sorted.slice(0,5).reduce((a,b)=>a+b.count,0); const allPosts = sorted.reduce((a,b)=>a+b.count,0);
    const active = active30d || 0; const lurkerCount = Math.max(0, total - active);
    const retained = postersThisMonth.filter((id: string) => (postersLastMonth as string[]).includes(id)).length;
    res.json({ users: { total, new_today: newToday, new_this_week: newWeek, active_30d: active, active_7d: active7d }, trust: { scholars, neutrals, trolls }, trolls_active_24h: trolls24h, lurkers: lurkerCount, lurker_pct: Math.round((lurkerCount/total)*100), active_pct: Math.round((active/total)*100), fan_out: active>0?Math.round(allPosts/active):0, churn_pct: usersOver30d>0?Math.round((1-active/usersOver30d)*100):null, maturity_pct: Math.round((usersOver30d/total)*100), user_tiers: { casual: sorted.filter((p:{count:number})=>p.count<=2).length, regular: sorted.filter((p:{count:number})=>p.count>=3&&p.count<=9).length, power: sorted.filter((p:{count:number})=>p.count>=10).length }, pareto_pct: allPosts>0?Math.round((top5/allPosts)*100):0, retained_creators: retained, lurker_depth_10plus: (lurkerDeep?.[0] as Record<string,number>)?.count||0 });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 5. Moderation (fully live)
router.get('/stats/moderation', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0); const sevenDaysAgo = new Date(Date.now() - 7*86400000);
    const [pending, approvedToday, rejectedToday, retryToday, oldestPending, weekendReviews, peakModHour, decisionFlips] = await Promise.all([
      Post.countDocuments({ status: 'pending_review', deleted: false }),
      Post.countDocuments({ status: 'approved', published_at: { $gte: today }, deleted: false }),
      Post.countDocuments({ status: 'rejected', updated_at: { $gte: today }, deleted: false }),
      Post.countDocuments({ revision_count: { $gt: 0 }, updated_at: { $gte: today }, deleted: false }),
      Post.findOne({ status: 'pending_review', deleted: false }).sort({ created_at: 1 }).select('created_at').lean(),
      Post.aggregate([{ $match: { status: { $in: ['approved', 'rejected'] }, updated_at: { $gte: sevenDaysAgo }, deleted: false } }, { $group: { _id: { $dayOfWeek: '$updated_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      AuditLog.aggregate([{ $match: { action: { $in: ['approve_post', 'reject_post', 'retry_post'] }, created_at: { $gte: sevenDaysAgo } } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
      Post.countDocuments({ status: 'rejected', 'status_history.status': 'approved', deleted: false }),
    ]);
    const ageHours = oldestPending ? Math.round((Date.now() - new Date(oldestPending.created_at).getTime()) / 3600000) : 0;
    const reviewsToday = approvedToday + rejectedToday + retryToday;
    const weekendDays = [1, 7]; const wc = weekendReviews.filter((r: Record<string,unknown>)=>weekendDays.includes(r._id as number)).reduce((a:number,r:Record<string,number>)=>a+(r.count||0),0);
    const wdc = weekendReviews.filter((r: Record<string,unknown>)=>!weekendDays.includes(r._id as number)).reduce((a:number,r:Record<string,number>)=>a+(r.count||0),0);
    const peakHr = peakModHour[0] || {};
    // 7-day rolling average
    const past7Snapshots = await PlatformSnapshot.find().sort({ date: -1 }).limit(7).lean();
    const pastReviews = past7Snapshots.map(sn => ((sn.moderation as Record<string,unknown>) as Record<string,number>)?.reviews_today || 0);
    const avgReviews = pastReviews.length > 0 ? pastReviews.reduce((a,b)=>a+b,0) / pastReviews.length : 0;
    res.json({ reviews_today: reviewsToday, approved_today: approvedToday, rejected_today: rejectedToday, retry_today: retryToday, pending_queue: { total: pending, oldest_age_hours: ageHours }, queue_velocity: { avg_reviews_per_day: Math.round(avgReviews*10)/10, days_to_clear: avgReviews>0?Math.ceil(pending/avgReviews):null }, reviews_by_day_of_week: weekendReviews.map((r: Record<string,unknown>)=>({day:r._id,count:r.count})), weekend_vs_weekday: { weekend: wc, weekday: wdc, weekend_pct: (wc+wdc)>0?Math.round((wc/(wc+wdc))*100):0 }, peak_moderation_hour: peakHr._id||null, peak_moderation_hour_count: peakHr.count||0, decision_flips: decisionFlips });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 6. Categories (fully live)
router.get('/stats/categories', async (req, res) => {
  try {
    const [categoryDocs, engagementByCat] = await Promise.all([
      Category.find({ is_archived: false }).select('slug name post_count parent_id').lean(),
      Post.aggregate([{ $match: { status: 'approved', deleted: false } }, { $group: { _id: '$category_slug', post_count: { $sum: 1 }, total_comments: { $sum: '$comment_count' }, total_views: { $sum: '$view_count' } } }, { $project: { slug: '$_id', post_count: 1, avg_comments: { $cond: [{ $gt: ['$post_count', 0] }, { $divide: ['$total_comments', '$post_count'] }, 0] }, avg_views: { $cond: [{ $gt: ['$post_count', 0] }, { $divide: ['$total_views', '$post_count'] }, 0] } } }, { $sort: { post_count: -1 } }]),
    ]);
    const children = categoryDocs.filter((c: Record<string,unknown>) => c.parent_id);
    const top = [...categoryDocs].sort((a: Record<string,unknown>, b: Record<string,unknown>) => (b.post_count as number) - (a.post_count as number)).slice(0,10).map((c: Record<string,unknown>) => ({ slug: c.slug, post_count: c.post_count }));
    const emptyChildren = children.filter((c: Record<string,unknown>) => (c.post_count as number) === 0).length;
    res.json({ top_by_posts: top, empty_children: emptyChildren, utilization_pct: children.length>0?Math.round(((children.length-emptyChildren)/children.length)*100):0, per_category_engagement: engagementByCat });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 7. Trends + deltas (enhanced)
router.get('/stats/trends', async (req, res) => {
  try {
    const snapshots = await PlatformSnapshot.find().sort({ date: -1 }).limit(14).lean();
    const weeks = snapshots.map(s => { const c = s.content as Record<string, unknown>; const co = s.community as Record<string, unknown>; const m = s.moderation as Record<string, unknown>; const p = c.posts as Record<string, number>; const cu = co.users as Record<string, number>; return { date: s.date, posts_total: p?.total || 0, posts_submitted: p?.submitted || 0, comments_total: (c.comments as Record<string, number>)?.total || 0, users_total: cu?.total || 0, users_new: cu?.new_today || 0, reviews: (m as Record<string, number>)?.reviews_today || 0, pending: ((m as Record<string, unknown>)?.pending_queue as Record<string, number>)?.total || 0 }; });
    const withDeltas = weeks.map((w, i) => {
      if (i >= weeks.length - 1) return w;
      const prev = weeks[i + 1];
      const delta = (field: string, goodWhenUp: boolean) => {
        const cur = (w as Record<string, any>)[field] || 0;
        const prv = (prev as Record<string, any>)[field] || 0;
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

// 8. Quality (fully live)
router.get('/stats/quality', async (req, res) => {
  try {
    const [totalSubmissions, inRevision, rejectionReasons, correlations] = await Promise.all([
      Post.countDocuments({ deleted: false }),
      Post.countDocuments({ revision_guidance: { $ne: null }, deleted: false }),
      Post.aggregate([{ $match: { status: 'rejected', deleted: false } }, { $group: { _id: '$rejection_reason', count: { $sum: 1 } } }]),
      Post.aggregate([{ $match: { deleted: false } }, { $project: { intro_len: { $strLenCP: '$intro' }, comment_count: 1, fire_count: 1 } }, { $bucket: { groupBy: '$intro_len', boundaries: [0, 50, 100, 200, 500, 1000, 2000, 10000], default: 'other', output: { count: { $sum: 1 }, avg_comments: { $avg: '$comment_count' }, avg_fire: { $avg: '$fire_count' } } } }]),
    ]);
    const rrMap: Record<string,number> = {}; for (const r of rejectionReasons) rrMap[r._id || 'other'] = (rrMap[r._id || 'other'] || 0) + r.count;
    res.json({ revision_rate: totalSubmissions>0?Math.round((inRevision/totalSubmissions)*100):0, rejection_reasons: rrMap, intro_length_correlation: correlations.map((c: Record<string,unknown>)=>({bucket:String(c._id),count:c.count,avg_comments:Math.round((c.avg_comments as number)*10)/10,avg_fire:Math.round((c.avg_fire as number)*10)/10})) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 9. Traffic (fully live)
router.get('/stats/traffic', async (req, res) => {
  try {
    const today = new Date().toISOString().substring(0,10); const todayStart = new Date(today+'T00:00:00.000Z'); const sevenDaysAgo = new Date(Date.now()-7*86400000);
    const [visitsToday, uniqueFpsCount, topPaths, browsers, peakHours, referrers, countries, itemEngagement, newUserByRef, engagement] = await Promise.all([
      PageVisit.countDocuments({ created_at: { $gte: todayStart } }),
      PageVisit.aggregate([
        { $match: { created_at: { $gte: todayStart }, fingerprint: { $ne: null } } },
        { $group: { _id: '$fingerprint' } },
        { $count: 'count' },
      ]).then((r: Array<{ count: number }>) => r.length > 0 ? r[0].count : 0),
      PageVisit.aggregate([{ $group: { _id: '$path', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: todayStart } } }, { $group: { _id: '$user_agent', count: { $sum: 1 } } }, { $limit: 100 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: sevenDaysAgo } } }, { $group: { _id: { $hour: '$created_at' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: todayStart }, referer: { $nin: [null, ''] } } }, { $group: { _id: '$referer', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      PageVisit.aggregate([{ $match: { created_at: { $gte: sevenDaysAgo }, country: { $ne: null } } }, { $group: { _id: '$country', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]),
      Comment.aggregate([{ $match: { list_item_id: { $ne: null }, deleted: false, hidden: false } }, { $group: { _id: '$list_item_id', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }, { $lookup: { from: 'listitems', localField: '_id', foreignField: '_id', as: 'item' } }, { $unwind: '$item' }, { $project: { item_title: '$item.title', item_rank: '$item.rank', comment_count: '$count' } }]),
      PageVisit.aggregate([{ $match: { fingerprint: { $ne: null }, created_at: { $gte: new Date(Date.now()-30*86400000) } } }, { $sort: { created_at: 1 } }, { $group: { _id: '$fingerprint', first_referer: { $first: '$referer' } } }, { $lookup: { from: 'users', localField: '_id', foreignField: 'device_fingerprint', as: 'u' } }, { $unwind: '$u' }, { $group: { _id: { $cond: [{ $regexMatch: { input: '$first_referer', regex: /google\.|bing\.|duckduckgo\.|yahoo\./i } }, 'search', { $cond: [{ $eq: ['$first_referer', null] }, 'direct', 'other'] }] }, count: { $sum: 1 } } }]),
      Post.aggregate([{ $match: { status: 'approved', view_count: { $gt: 0 }, deleted: false } }, { $project: { title: 1, slug: 1, comment_count: 1, fire_count: 1, view_count: 1, ratio: { $divide: [{ $add: ['$comment_count', '$fire_count'] }, '$view_count'] } } }, { $sort: { ratio: -1 } }, { $limit: 10 }]),
    ]);
    const browserMap: Record<string,number>={}; const osMap: Record<string,number>={};
    for (const b of browsers) { browserMap[parseBrowser(b._id)]=(browserMap[parseBrowser(b._id)]||0)+b.count; osMap[parseOS(b._id)]=(osMap[parseOS(b._id)]||0)+b.count; }
    const extractDomain = (ref: string) => { try { return new URL(ref).hostname.replace('www.',''); } catch { return ref.substring(0,50); } };
    const refAgg = referrers.map((r: Record<string,unknown>) => { const domain = extractDomain(r._id as string); return { domain, count: r.count as number }; });
    const topRefs: Array<{ domain: string; count: number }> = [];
    for (const r of refAgg) {
      const existing = topRefs.find(t => t.domain === r.domain);
      if (existing) { existing.count += r.count; }
      else { topRefs.push(r); }
    }
    let population: Record<string,number>={}; try { population = require('../data/countryPopulation.json'); } catch { /* file may not exist in dev */ }
    const countriesWithPop = countries.map((c: Record<string,unknown>)=>{const code=c._id as string; const pop=population[code]||null; return {code,count:c.count,population:pop,visits_per_million:pop?Math.round((c.count as number/pop)*1000000*100)/100:null};});
    res.json({ visits_today: visitsToday, unique_today: uniqueFpsCount, top_paths: topPaths.map((p:Record<string,unknown>)=>({path:p._id,count:p.count})), browsers: browserMap, os: osMap, peak_hours: peakHours.map((h:Record<string,unknown>)=>({hour:h._id,count:h.count})), top_referrers: topRefs, countries: countriesWithPop, top_engaged: engagement.map((e:Record<string,unknown>)=>({slug:e.slug,title:e.title,ratio:Math.round((e.ratio as number)*1000)/10})), top_engaged_items: itemEngagement.map((i:Record<string,unknown>)=>({title:i.item_title,rank:i.item_rank,comment_count:i.comment_count})), new_users_by_referrer: newUserByRef.map((r:Record<string,unknown>)=>({source:r._id,count:r.count})) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 9b. Traffic Lurkers — Ghost ratio
router.get('/stats/traffic/lurkers', async (req, res) => {
  try {
    const allFingerprints = await PageVisit.distinct('fingerprint', { fingerprint: { $ne: null } });
    const posters = await Post.distinct('author_id');
    const posterSet = new Set(posters);
    const neverPosted = allFingerprints.filter((fp) => fp && !posterSet.has(fp));

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
router.get('/stats/traffic/conversion', async (req, res) => {
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
router.get('/stats/users/reengagement', async (req, res) => {
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
router.get('/stats/submissions', async (req, res) => {
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
router.get('/stats/users/lifecycle', async (req, res) => {
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
router.get('/stats/alerts', async (req, res) => {
  try {
    const [thresholds, history, active] = await Promise.all([
      AlertThreshold.find({ enabled: true }).lean(),
      AlertHistory.find().sort({ triggered_at: -1 }).limit(20).lean(),
      (async () => { const results: unknown[] = []; let cursor = 0; do { const scan = await redis.scan(cursor, { MATCH: 'alert:*', COUNT: 100 }); cursor = scan.cursor; for (const k of scan.keys) { const v = await redis.get(k); if (v) try { results.push(JSON.parse(v)); } catch { /* skip malformed alert */ } } } while (cursor !== 0); return results; })(),
    ]);
    res.json({ thresholds, history, active });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ Alert Management ═══════════════════════════════════════════════

import { createThresholdSchema, updateThresholdSchema, notificationQuerySchema, historyQuerySchema } from '../schemas/alert';
import { userListQuerySchema, restrictUserSchema, rateLimitOverrideSchema, trustAdjustSchema, trustHistoryQuerySchema, configUpdateSchema, configImpactQuerySchema, addToHallOfFameSchema, reorderHallOfFameSchema, updateHallOfFameNoteSchema, createModSchema, updateModSchema, resetPasswordSchema } from '../schemas/admin';

// Thresholds CRUD
router.get('/alerts/thresholds', async (req, res) => {
  try {
    const thresholds = await AlertThreshold.find().sort({ metric: 1 }).lean();
    res.json({ thresholds });
  } catch (e) { res.status(500).json({ error: 'Failed to list thresholds' }); }
});

router.post('/alerts/thresholds', async (req, res) => {
  try {
    const body = createThresholdSchema.parse(req.body);
    const exists = await AlertThreshold.findOne({ metric: body.metric });
    if (exists) return res.status(409).json({ code: 'DUPLICATE', error: `Threshold for ${body.metric} already exists. Use PATCH to update.` });
    const t = await AlertThreshold.create(body);
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'create_threshold', ip: getClientIp(req), metadata: { metric: body.metric, threshold: body.threshold, operator: body.operator, severity: body.severity }, user_agent: req.headers['user-agent'] || '' });
    res.status(201).json({ success: true, threshold: t });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ error: 'Failed to create threshold' });
  }
});

router.patch('/alerts/thresholds/:id', async (req, res) => {
  try {
    const body = updateThresholdSchema.parse(req.body);
    const t = await AlertThreshold.findByIdAndUpdate(req.params.id, { $set: body }, { new: true });
    if (!t) return res.status(404).json({ code: 'NOT_FOUND', error: 'Threshold not found' });
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'update_threshold', ip: getClientIp(req), metadata: { id: req.params.id, changes: body }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true, threshold: t });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ error: 'Failed to update threshold' });
  }
});

router.delete('/alerts/thresholds/:id', async (req, res) => {
  try {
    const t = await AlertThreshold.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ code: 'NOT_FOUND', error: 'Threshold not found' });
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'delete_threshold', ip: getClientIp(req), metadata: { id: req.params.id }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete threshold' }); }
});

router.patch('/alerts/thresholds/:id/toggle', async (req, res) => {
  try {
    const t = await AlertThreshold.findById(req.params.id);
    if (!t) return res.status(404).json({ code: 'NOT_FOUND', error: 'Threshold not found' });
    t.enabled = !t.enabled;
    await t.save();
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'toggle_threshold', ip: getClientIp(req), metadata: { id: req.params.id, metric: t.metric, enabled: t.enabled }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true, enabled: t.enabled });
  } catch (e) { res.status(500).json({ error: 'Failed to toggle threshold' }); }
});

// Notifications
router.get('/alerts/notifications', async (req, res) => {
  try {
    const { page, limit, severity, read } = notificationQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = { dismissed: false };
    if (severity) query.severity = severity;
    if (read === 'true') query.read = true;
    else if (read === 'false') query.read = false;

    const [notifications, total] = await Promise.all([
      AlertNotificationModel.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      AlertNotificationModel.countDocuments(query),
    ]);

    res.json({ notifications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

router.get('/alerts/notifications/count', async (req, res) => {
  try {
    const unread = await AlertNotificationModel.countDocuments({ read: false, dismissed: false });
    res.json({ unread });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.patch('/alerts/notifications/:id/read', async (req, res) => {
  try {
    const n = await AlertNotificationModel.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!n) return res.status(404).json({ code: 'NOT_FOUND', error: 'Notification not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.patch('/alerts/notifications/read-all', async (req, res) => {
  try {
    const result = await AlertNotificationModel.updateMany({ read: false }, { read: true });
    res.json({ success: true, marked: result.modifiedCount });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/alerts/notifications/:id', async (req, res) => {
  try {
    const n = await AlertNotificationModel.findByIdAndUpdate(req.params.id, { dismissed: true }, { new: true });
    if (!n) return res.status(404).json({ code: 'NOT_FOUND', error: 'Notification not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Get single alert notification with live metric value
router.get('/alerts/notifications/:id', async (req, res) => {
  try {
    const n = await AlertNotificationModel.findById(req.params.id).lean();
    if (!n) return res.status(404).json({ code: 'NOT_FOUND', error: 'Notification not found' });

    // Compute current metric value for the alert type
    let currentValue: number | null = null;
    try {
      const { computeMetric } = await import('../lib/alertEngine');
      currentValue = await computeMetric(n.alert_type);
    } catch { /* ignore */ }

    // Get the threshold config
    const threshold = await AlertThreshold.findOne({ metric: n.alert_type, enabled: true }).lean();

    // Check Redis for active status
    let active = false;
    try {
      active = !!(await redis.get(`alert:${n.alert_type}`));
    } catch { /* ignore */ }

    res.json({
      notification: n,
      current_value: currentValue,
      threshold_config: threshold,
      active,
      still_breaching: currentValue !== null && (threshold?.operator === 'gt' ? currentValue > (threshold?.threshold ?? 0) : currentValue < (threshold?.threshold ?? 0)),
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Settle alert notification (admin acknowledges and addresses)
router.patch('/alerts/notifications/:id/settle', async (req, res) => {
  try {
    const n = await AlertNotificationModel.findByIdAndUpdate(
      req.params.id,
      { settled: true, settled_at: new Date(), read: true },
      { new: true }
    );
    if (!n) return res.status(404).json({ code: 'NOT_FOUND', error: 'Notification not found' });
    res.json({ success: true, notification: n });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Settle all alert notifications
router.patch('/alerts/notifications/settle-all', async (req, res) => {
  try {
    const result = await AlertNotificationModel.updateMany(
      { $or: [{ settled: false }, { settled: { $exists: false } }], dismissed: false },
      { settled: true, settled_at: new Date(), read: true }
    );
    res.json({ success: true, settled: result.modifiedCount });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// History
router.get('/alerts/history', async (req, res) => {
  try {
    const { page, limit, metric, severity, resolved, date_from, date_to } = historyQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};
    if (metric) query.metric = metric;
    if (severity) query.severity = severity;
    if (resolved === 'true') query.resolved_at = { $ne: null };
    else if (resolved === 'false') query.resolved_at = null;
    if (date_from || date_to) { query.triggered_at = {}; if (date_from) (query.triggered_at as Record<string, unknown>).$gte = new Date(date_from); if (date_to) (query.triggered_at as Record<string, unknown>).$lte = new Date(date_to); }

    const [history, total] = await Promise.all([
      AlertHistory.find(query).sort({ triggered_at: -1 }).skip(skip).limit(limit).lean(),
      AlertHistory.countDocuments(query),
    ]);

    res.json({ history, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ error: 'Failed to list history' });
  }
});

// ═══ Outbound Messaging ════════════════════════════════════════════

import { sendMessageSchema, messageListQuerySchema, templateSchema } from '../schemas/message';

// Send individual or broadcast message
router.post('/messages', async (req, res) => {
  try {
    const body = sendMessageSchema.parse(req.body);

    const message = await AdminMessage.create({
      type: body.type,
      recipient_id: body.type === 'individual' ? body.recipient_id : null,
      title: body.title,
      body: body.body,
      priority: body.priority,
      created_by: req.admin?.username || 'admin',
      expires_at: new Date(Date.now() + body.expires_in_days * 86400000),
    });

    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'send_message', ip: getClientIp(req), metadata: { message_id: (message._id as { toString(): string }).toString(), type: body.type, title: body.title, recipient_id: body.type === 'individual' ? body.recipient_id : null }, user_agent: req.headers['user-agent'] || '' });

    res.status(201).json({ success: true, message });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// List sent messages
router.get('/messages', async (req, res) => {
  try {
    const { page, limit, type } = messageListQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};
    if (type) query.type = type;

    const [messages, total] = await Promise.all([
      AdminMessage.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      AdminMessage.countDocuments(query),
    ]);

    res.json({ messages, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

// Retract/expire a message
router.delete('/messages/:id', async (req, res) => {
  try {
    const m = await AdminMessage.findByIdAndUpdate(req.params.id, { expires_at: new Date() }, { new: true });
    if (!m) return res.status(404).json({ code: 'NOT_FOUND', error: 'Message not found' });
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'retract_message', ip: getClientIp(req), metadata: { message_id: req.params.id, type: m.type, title: m.title }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to retract message' }); }
});

// Delivery stats for one message
router.get('/messages/:id/stats', async (req, res) => {
  try {
    const m = await AdminMessage.findById(req.params.id).lean();
    if (!m) return res.status(404).json({ code: 'NOT_FOUND', error: 'Message not found' });

    res.json({
      message: m,
      stats: {
        dismissed: m.dismissed_by.length,
        type: m.type,
        target: m.type === 'broadcast' ? 'all users' : m.recipient_id,
      },
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Templates CRUD
router.post('/messages/templates', async (req, res) => {
  try {
    const body = templateSchema.parse(req.body);
    const t = await MessageTemplate.create(body);
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'create_template', ip: getClientIp(req), metadata: { template_id: (t._id as { toString(): string }).toString(), name: t.name }, user_agent: req.headers['user-agent'] || '' });
    res.status(201).json({ success: true, template: t });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.get('/messages/templates', async (req, res) => {
  try {
    const templates = await MessageTemplate.find().sort({ name: 1 }).lean();
    res.json({ templates });
  } catch (e) { res.status(500).json({ error: 'Failed to list templates' }); }
});

router.delete('/messages/templates/:id', async (req, res) => {
  try {
    const t = await MessageTemplate.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ code: 'NOT_FOUND', error: 'Template not found' });
    logAudit({ admin_id: (req.admin?.id as string) || 'unknown', action: 'delete_template', ip: getClientIp(req), metadata: { template_id: req.params.id, name: t.name }, user_agent: req.headers['user-agent'] || '' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete template' }); }
});

// ═══ Comparison & Notifications ════════════════════════════════════
router.get('/stats/compare', async (req, res) => {
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
router.get('/stats/notifications', async (req, res) => {
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

// ═══ Search Analytics ═══════════════════════════════════════════════

import { SearchEvent } from '../models/SearchEvent';
import { SearchClick } from '../models/SearchClick';
import { SearchDeadLetter } from '../models/SearchDeadLetter';
import { SearchDailyStats } from '../models/SearchDailyStats';

// Search overview
router.get('/stats/search/overview', async (req, res) => {
  try {
    const today = new Date().toISOString().substring(0, 10);
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

    const [todaySearches, todayZeroResults, todayUnique, todayRollup, yesterdayRollup] = await Promise.all([
      SearchEvent.countDocuments({ timestamp: { $gte: todayStart } }),
      SearchEvent.countDocuments({ timestamp: { $gte: todayStart }, zero_results: true }),
      SearchEvent.distinct('fingerprint', { timestamp: { $gte: todayStart }, fingerprint: { $ne: null } }),
      SearchDailyStats.findOne({ date: today }).lean(),
      SearchDailyStats.findOne({ date: yesterday }).lean(),
    ]);

    res.json({
      searches_today: todaySearches,
      zero_result_today: todayZeroResults,
      unique_searchers_today: todayUnique.length,
      zero_result_pct: todaySearches > 0 ? Math.round((todayZeroResults / todaySearches) * 100) : 0,
      rollup: todayRollup,
      yesterday_rollup: yesterdayRollup,
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Top queries
router.get('/stats/search/queries', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
    const since = new Date(Date.now() - days * 86400000);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 20));

    const [topQueries, zeroResultQueries] = await Promise.all([
      SearchEvent.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: '$normalized_query', count: { $sum: 1 }, zero_results: { $sum: { $cond: ['$zero_results', 1, 0] } } } },
        { $sort: { count: -1 } }, { $limit: limit },
      ]),
      SearchEvent.aggregate([
        { $match: { timestamp: { $gte: since }, zero_results: true } },
        { $group: { _id: '$normalized_query', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 20 },
      ]),
    ]);

    const totalSearches = await SearchEvent.countDocuments({ timestamp: { $gte: since } });

    res.json({
      top_queries: topQueries.map((q: Record<string, unknown>) => ({ query: q._id, count: q.count, zero_result_pct: Math.round(((q.zero_results as number || 0) / (q.count as number)) * 100) })),
      zero_result_queries: zeroResultQueries.map((q: Record<string, unknown>) => ({ query: q._id, count: q.count })),
      total_searches: totalSearches,
      period_days: days,
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Relevance
router.get('/stats/search/relevance', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
    const since = new Date(Date.now() - days * 86400000);

    const [clicks, searches, ctrByPos, avgResults] = await Promise.all([
      SearchClick.countDocuments({ timestamp: { $gte: since } }),
      SearchEvent.countDocuments({ timestamp: { $gte: since } }),
      SearchClick.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: '$result_position', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }, { $limit: 10 },
      ]),
      SearchEvent.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: null, avg_posts: { $avg: '$total_results.posts' }, avg_comments: { $avg: '$total_results.comments' } } },
      ]),
    ]);

    const ctrMap: Record<number, number> = {};
    for (const c of ctrByPos as Array<{ _id: number; count: number }>) ctrMap[c._id] = c.count;

    res.json({
      total_clicks: clicks,
      total_searches: searches,
      ctr: searches > 0 ? Math.round((clicks / searches) * 100) : 0,
      ctr_by_position: Array.from({ length: 10 }, (_, i) => ctrMap[i + 1] || 0),
      avg_results: (avgResults[0] as Record<string, number> | undefined) || { avg_posts: 0, avg_comments: 0 },
      period_days: days,
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Trends (daily query volume over time)
router.get('/stats/search/trends', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days as string) || 30));
    const since = new Date(Date.now() - days * 86400000);

    const [volume, suggestionRate, zeroRate] = await Promise.all([
      SearchEvent.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      SearchEvent.aggregate([
        { $match: { timestamp: { $gte: since }, had_suggestion: true } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, total: { $sum: 1 }, accepted: { $sum: { $cond: ['$suggestion_accepted', 1, 0] } } } },
        { $sort: { _id: 1 } },
      ]),
      SearchEvent.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, total: { $sum: 1 }, zero: { $sum: { $cond: ['$zero_results', 1, 0] } } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      volume: volume.map((v: Record<string, unknown>) => ({ date: v._id, count: v.count })),
      suggestion_rate: suggestionRate.map((s: Record<string, unknown>) => ({
        date: s._id, rate: (s.total as number) > 0 ? Math.round(((s.accepted as number) / (s.total as number)) * 100) : 0,
      })),
      zero_result_rate: zeroRate.map((z: Record<string, unknown>) => ({
        date: z._id, rate: (z.total as number) > 0 ? Math.round(((z.zero as number) / (z.total as number)) * 100) : 0,
      })),
      period_days: days,
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Infrastructure
router.get('/stats/search/infrastructure', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
    const since = new Date(Date.now() - days * 86400000);

    const [latency, dlqCount, rollups] = await Promise.all([
      SearchEvent.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: null, avg: { $avg: '$response_time_ms' }, p99: { $push: '$response_time_ms' } } },
      ]),
      SearchDeadLetter.countDocuments({}),
      SearchDailyStats.find({ date: { $gte: new Date(Date.now() - days * 86400000).toISOString().substring(0, 10) } })
        .select('date index_gap_pct dead_letter_count').sort({ date: 1 }).lean(),
    ]);

    const times = ((latency[0] as Record<string, unknown>)?.p99 as number[]) || [];
    times.sort((a, b) => a - b);
    const p99 = times.length > 0 ? times[Math.floor(times.length * 0.99)] : 0;

    const gapTrend = rollups.map((r: Record<string, unknown>) => ({ date: r.date, gap_pct: r.index_gap_pct, dlq: r.dead_letter_count }));

    res.json({
      avg_latency_ms: Math.round(((latency[0] as Record<string, unknown>)?.avg as number) || 0),
      p99_latency_ms: Math.round(p99),
      dead_letter_queue: dlqCount,
      index_gap_trend: gapTrend,
      period_days: days,
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Behavior
router.get('/stats/search/behavior', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
    const since = new Date(Date.now() - days * 86400000);

    const [searchSessions, postSessions, postViewFromSearch] = await Promise.all([
      SearchEvent.distinct('session_id', { timestamp: { $gte: since } }),
      PageVisit.distinct('session_id', {
        created_at: { $gte: since },
        path: { $regex: /^\/$/ },
      }),
      SearchClick.aggregate([
        { $match: { timestamp: { $gte: since }, result_type: 'post' } },
        { $group: { _id: '$search_event_id', count: { $sum: 1 } } },
      ]),
    ]);

    const searchSet = new Set(searchSessions.filter(Boolean));
    const postSet = new Set(postSessions.filter(Boolean));

    res.json({
      search_sessions: searchSet.size,
      search_and_post_ratio: postSet.size > 0 ? Math.round(([...searchSet].filter((s) => postSet.has(s)).length / postSet.size) * 100) : 0,
      total_clicks_from_search: postViewFromSearch.reduce((a: number, c: Record<string, number>) => a + c.count, 0),
      period_days: days,
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Trending queries — EMA spike detection (current hour vs 24h exponential moving average)
router.get('/stats/search/trending', async (req, res) => {
  try {
    const hourAgo = new Date(Date.now() - 3600000);
    const dayAgo = new Date(Date.now() - 86400000);

    // Current hour counts
    const currentHour = await SearchEvent.aggregate([
      { $match: { timestamp: { $gte: hourAgo } } },
      { $group: { _id: '$normalized_query', count: { $sum: 1 } } },
    ]);

    // Last 24h hourly counts for EMA baseline
    const last24h = await SearchEvent.aggregate([
      { $match: { timestamp: { $gte: dayAgo } } },
      { $group: { _id: '$normalized_query', count: { $sum: 1 } } },
    ]);

    const total24h = last24h.reduce((s, q) => s + q.count, 0) || 1;

    // EMA: smoothing factor α for 24-period
    const alpha = 2 / (24 + 1);
    const trending: Array<{ query: string; count: number; trending_score: number; level: string }> = [];

    for (const curr of currentHour as Array<{ _id: string; count: number }>) {
      const dayCount = last24h.find((d) => d._id === curr._id)?.count || 0;
      const ema = alpha * curr.count + (1 - alpha) * (dayCount / 24);
      const score = curr.count / (ema + 0.001);

      if (score >= 2.0) {
        trending.push({
          query: curr._id,
          count: curr.count,
          trending_score: Math.round(score * 10) / 10,
          level: score >= 4.0 ? 'hot' : 'trending',
        });
      }
    }

    trending.sort((a, b) => b.trending_score - a.trending_score);

    res.json({ trending: trending.slice(0, 20), total_queries_24h: total24h });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Popular queries — decay-weighted 7-day rank
router.get('/stats/search/popular', async (req, res) => {
  try {
    const days = Math.min(30, Math.max(7, parseInt(req.query.days as string) || 7));
    const since = new Date(Date.now() - days * 86400000);

    const daily = await SearchEvent.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: {
        _id: { query: '$normalized_query', day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } } },
        count: { $sum: 1 },
      } },
    ]);

    const today = new Date().toISOString().substring(0, 10);
    const scores: Record<string, number> = {};
    const totalCounts: Record<string, number> = {};
    const uniqueDays: Record<string, number> = {};

    for (const d of daily as Array<{ _id: { query: string; day: string }; count: number }>) {
      const query = d._id.query;
      const dayDiff = Math.round((new Date(today).getTime() - new Date(d._id.day).getTime()) / 86400000);
      const weight = Math.pow(0.95, dayDiff);
      scores[query] = (scores[query] || 0) + d.count * weight;
      totalCounts[query] = (totalCounts[query] || 0) + d.count;
      uniqueDays[query] = (uniqueDays[query] || 0) + 1;
    }

    const popular = Object.entries(scores)
      .map(([query, score]) => ({ query, popularity_score: Math.round(score * 10) / 10, total: totalCounts[query], days_present: uniqueDays[query] }))
      .sort((a, b) => b.popularity_score - a.popularity_score)
      .slice(0, 30);

    res.json({ popular });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Most engaged queries — Bayesian CTR smoothing
router.get('/stats/search/engaged', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
    const since = new Date(Date.now() - days * 86400000);

    const [impressions, clicks] = await Promise.all([
      SearchEvent.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: '$normalized_query', impressions: { $sum: 1 } } },
      ]),
      SearchClick.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: '$query', clicks: { $sum: 1 } } },
      ]),
    ]);

    // Bayesian smoothing with prior of 1% CTR (α=1, β=99)
    const ALPHA = 1;
    const BETA = 99;
    const engaged: Array<{ query: string; impressions: number; clicks: number; bayesian_ctr: number; engagement_score: number }> = [];

    for (const imp of impressions as Array<{ _id: string; impressions: number }>) {
      const clk = clicks.find((c) => c._id === imp._id)?.clicks || 0;
      const bayesianCtr = (clk + ALPHA) / (imp.impressions + ALPHA + BETA);
      const engagementScore = bayesianCtr * Math.log(imp.impressions + 1);
      engaged.push({
        query: imp._id,
        impressions: imp.impressions,
        clicks: clk,
        bayesian_ctr: Math.round(bayesianCtr * 1000) / 10,
        engagement_score: Math.round(engagementScore * 1000) / 1000,
      });
    }

    engaged.sort((a, b) => b.engagement_score - a.engagement_score);

    res.json({ engaged: engaged.slice(0, 30) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ M10.6-M10.11 Users & Config Management ═══════════════════════

// 1. GET /api/admin/users — User listing
router.get('/users', async (req, res) => {
  try {
    const query = userListQuerySchema.parse(req.query);
    const { page, limit, q, trust_tier, status, sort, sort_dir } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { username: { $regex: escaped, $options: 'i' } },
        { user_id: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (trust_tier === 'troll') {
      filter.trust_score = { $lt: 0.5 };
    } else if (trust_tier === 'neutral') {
      filter.trust_score = { $gte: 0.5, $lt: 1.8 };
    } else if (trust_tier === 'scholar') {
      filter.trust_score = { $gte: 1.8 };
    }

    const now = new Date();
    if (status === 'active') {
      filter.$or = [
        { restricted_until: null },
        { restricted_until: { $lte: now } },
      ];
    } else if (status === 'restricted') {
      filter.restricted_until = { $gt: now };
    }

    const sortMap: Record<string, string> = { created_at: 'created_at', trust_score: 'trust_score', post_count: 'post_count' };
    const sortField = sortMap[sort] || 'created_at';
    const sortDirVal = sort_dir === 'asc' ? 1 : -1;

    const userAgg = await User.aggregate([
      { $match: filter },
      { $sort: { [sortField]: sortDirVal } },
      {
        $lookup: {
          from: 'posts',
          localField: 'user_id',
          foreignField: 'author_id',
          as: 'posts_data',
        },
      },
      {
        $lookup: {
          from: 'comments',
          localField: 'user_id',
          foreignField: 'author_id',
          as: 'comments_data',
        },
      },
      {
        $addFields: {
          post_count: { $size: { $filter: { input: '$posts_data', as: 'p', cond: { $eq: ['$$p.deleted', false] } } } },
          comment_count: { $size: { $filter: { input: '$comments_data', as: 'c', cond: { $and: [{ $eq: ['$$c.deleted', false] }, { $eq: ['$$c.hidden', false] }] } } } },
        },
      },
      { $project: { posts_data: 0, comments_data: 0, last_50_reviews: 0, __v: 0 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const total = await User.countDocuments(filter);

    const [trollCount, neutralCount, scholarCount, activeCount, restrictedCount] = await Promise.all([
      User.countDocuments({ trust_score: { $lt: 0.5 } }),
      User.countDocuments({ trust_score: { $gte: 0.5, $lt: 1.8 } }),
      User.countDocuments({ trust_score: { $gte: 1.8 } }),
      User.countDocuments({ $or: [{ restricted_until: null }, { restricted_until: { $lte: now } }] }),
      User.countDocuments({ restricted_until: { $gt: now } }),
    ]);

    res.json({
      users: userAgg,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filter_counts: {
        trolls: trollCount,
        neutrals: neutralCount,
        scholars: scholarCount,
        active: activeCount,
        restricted: restrictedCount,
      },
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('Error fetching users:', e);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch users' });
  }
});

// 2. GET /api/admin/users/:user_id — Single user detail
router.get('/users/:user_id', async (req, res) => {
  try {
    const user = await User.findOne({ user_id: req.params.user_id });
    if (!user) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'User not found' });
    }

    const [postCount, commentCount, postsApproved, postsRejected] = await Promise.all([
      Post.countDocuments({ author_id: user.user_id, deleted: false }),
      Comment.countDocuments({ author_id: user.user_id, deleted: false, hidden: false }),
      Post.countDocuments({ author_id: user.user_id, status: 'approved', deleted: false }),
      Post.countDocuments({ author_id: user.user_id, status: 'rejected', deleted: false }),
    ]);

    const userObj = user.toObject();
    res.json({
      user: {
        ...userObj,
        post_count: postCount,
        comment_count: commentCount,
        posts_approved: postsApproved,
        posts_rejected: postsRejected,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch user' });
  }
});

// 3. PATCH /api/admin/users/:user_id/restrict — Ban/restrict user
router.patch('/users/:user_id/restrict', async (req, res) => {
  try {
    const body = restrictUserSchema.parse(req.body);
    const user = await User.findOne({ user_id: req.params.user_id });
    if (!user) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'User not found' });
    }

    const oldRestrictedUntil = user.restricted_until;

    if (body.restricted_until === null) {
      user.restricted_until = null;
      await user.save();
      logAudit({
        admin_id: (req.admin?.id as string) || 'unknown',
        action: 'unrestrict_user',
        ip: getClientIp(req),
        metadata: { user_id: user.user_id, username: user.username, old_restricted_until: oldRestrictedUntil },
        user_agent: req.headers['user-agent'] || '',
      });
    } else {
      user.restricted_until = new Date(body.restricted_until);
      await user.save();
      logAudit({
        admin_id: (req.admin?.id as string) || 'unknown',
        action: 'restrict_user',
        ip: getClientIp(req),
        metadata: { user_id: user.user_id, username: user.username, restricted_until: body.restricted_until },
        user_agent: req.headers['user-agent'] || '',
      });
    }

    res.json({ success: true, user });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to update restriction' });
  }
});

// 4. PATCH /api/admin/users/:user_id/rate-limits — Override rate limits
router.patch('/users/:user_id/rate-limits', async (req, res) => {
  try {
    const body = rateLimitOverrideSchema.parse(req.body);
    const user = await User.findOne({ user_id: req.params.user_id });
    if (!user) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'User not found' });
    }

    const oldOverride = user.rate_limit_override ? { ...user.rate_limit_override } : null;

    const currentOverride = user.rate_limit_override || { posts_per_hour: null, comments_per_hour: null };
    const newPostsPerHour = body.posts_per_hour !== undefined ? body.posts_per_hour : (currentOverride.posts_per_hour ?? null);
    const newCommentsPerHour = body.comments_per_hour !== undefined ? body.comments_per_hour : (currentOverride.comments_per_hour ?? null);

    const updateData: Record<string, unknown> = {};
    if (newPostsPerHour === null && newCommentsPerHour === null) {
      updateData.$unset = { rate_limit_override: 1 };
    } else {
      updateData.$set = {
        rate_limit_override: {
          posts_per_hour: newPostsPerHour,
          comments_per_hour: newCommentsPerHour,
        },
      };
    }

    const updated = await User.findByIdAndUpdate(user._id, updateData, { new: true });

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'override_rate_limits',
      ip: getClientIp(req),
      metadata: {
        user_id: user.user_id,
        username: user.username,
        old_override: oldOverride,
        new_override: (newPostsPerHour === null && newCommentsPerHour === null) ? null : { posts_per_hour: newPostsPerHour, comments_per_hour: newCommentsPerHour },
      },
      user_agent: req.headers['user-agent'] || '',
    });

    res.json({ success: true, user: updated });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to update rate limits' });
  }
});

// 5. PATCH /api/admin/users/:user_id/trust — Manual trust adjustment
router.patch('/users/:user_id/trust', async (req, res) => {
  try {
    const body = trustAdjustSchema.parse(req.body);
    const user = await User.findOne({ user_id: req.params.user_id });
    if (!user) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'User not found' });
    }

    const oldScore = user.trust_score;
    const oldLocked = user.trust_locked;

    if (body.trust_score !== undefined) {
      user.trust_score = body.trust_score;
      user.trust_locked = true;
      user.trust_version += 1;
      await user.save();

      await TrustScoreLog.create({
        user_id: user.user_id,
        post_id: `manual_${Date.now()}`,
        action: 'manual_adjust',
        delta: body.trust_score - oldScore,
        old_score: oldScore,
        new_score: body.trust_score,
        version: user.trust_version,
        multiplier: 1,
        base_delta: body.trust_score - oldScore,
        admin_id: (req.admin?.id as string) || 'unknown',
        reason: 'Manual trust adjustment by admin',
      });

      logAudit({
        admin_id: (req.admin?.id as string) || 'unknown',
        action: 'manual_trust_adjust',
        ip: getClientIp(req),
        metadata: { user_id: user.user_id, username: user.username, old_score: oldScore, new_score: body.trust_score },
        user_agent: req.headers['user-agent'] || '',
      });
    }

    if (body.trust_locked !== undefined && body.trust_locked !== oldLocked) {
      user.trust_locked = body.trust_locked;
      await user.save();
      logAudit({
        admin_id: (req.admin?.id as string) || 'unknown',
        action: body.trust_locked ? 'lock_trust' : 'unlock_trust',
        ip: getClientIp(req),
        metadata: { user_id: user.user_id, username: user.username },
        user_agent: req.headers['user-agent'] || '',
      });
    }

    res.json({ success: true, user });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('Error adjusting trust:', e);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to adjust trust' });
  }
});

// 6. GET /api/admin/users/:user_id/trust-history — Trust change log
router.get('/users/:user_id/trust-history', async (req, res) => {
  try {
    const { page, limit } = trustHistoryQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      TrustScoreLog.find({ user_id: req.params.user_id })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TrustScoreLog.countDocuments({ user_id: req.params.user_id }),
    ]);

    const entries = logs.map((l: Record<string, unknown>) => ({
      created_at: l.created_at,
      admin_id: l.admin_id || null,
      action: l.action,
      old_score: l.old_score,
      new_score: l.new_score,
      reason: l.reason || null,
    }));

    res.json({
      entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch trust history' });
  }
});

// 7. GET /api/admin/config — Get current config
router.get('/config', async (req, res) => {
  try {
    const config = getConfig();
    res.json({ config });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch config' });
  }
});

// 8. PUT /api/admin/config — Update config
router.put('/config', async (req, res) => {
  try {
    const body = configUpdateSchema.parse(req.body);

    // Double-blind can only be toggled by super admin
    if (body.trust_tiers?.double_blind !== undefined && req.admin?.role !== 'super_admin') {
      return res.status(403).json({
        code: 'FORBIDDEN',
        error: 'The double_blind setting requires super admin access.',
      });
    }

    const result = await updateConfig(body as Record<string, unknown>, (req.admin?.id as string) || 'unknown');

    res.json({ success: true, config: result, version: result.version });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to update config' });
  }
});

// 9. GET /api/admin/config/impact — Preview config change impact
router.get('/config/impact', async (req, res) => {
  try {
    const { changes: changesRaw } = configImpactQuerySchema.parse(req.query);
    if (!changesRaw) {
      return res.json({
        users_affected: 0,
        tier_changes: { to_scholar: 0, from_scholar: 0 },
        rate_changes: { increased: 0, decreased: 0 },
      });
    }

    let changes: Record<string, unknown>;
    try {
      changes = JSON.parse(changesRaw);
    } catch {
      return res.status(400).json({ code: 'VALIDATION', error: 'Invalid JSON in changes parameter' });
    }

    const current = getConfig();
    const currentScholar = current.trust_tiers.scholar_min;
    const currentTroll = current.trust_tiers.troll_max;

    const proposedTrust = (changes as Record<string, Record<string, number>>).trust_tiers || {};
    const newScholar = proposedTrust.scholar_min ?? currentScholar;
    const newTroll = proposedTrust.troll_max ?? currentTroll;

    // Compute tier changes via server-side aggregation (not loading all users)
    const tierChanges = await User.aggregate([
      {
        $project: {
          was_scholar: { $gte: ['$trust_score', currentScholar] },
          now_scholar: { $gte: ['$trust_score', newScholar] },
          trust_score: 1,
          has_override: {
            $or: [
              { $ne: [{ $type: '$rate_limit_override' }, 'missing'] },
              { $and: [
                { $ne: [{ $ifNull: ['$rate_limit_override.posts_per_hour', null] }, null] },
                { $ne: [{ $ifNull: ['$rate_limit_override.comments_per_hour', null] }, null] },
              ]},
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          to_scholar: { $sum: { $cond: [{ $and: [{ $eq: ['$was_scholar', false] }, { $eq: ['$now_scholar', true] }] }, 1, 0] } },
          from_scholar: { $sum: { $cond: [{ $and: [{ $eq: ['$was_scholar', true] }, { $eq: ['$now_scholar', false] }] }, 1, 0] } },
          without_override: { $push: { $cond: [{ $eq: ['$has_override', false] }, '$trust_score', '$$REMOVE'] } },
        },
      },
    ]).allowDiskUse(true);

    const tc = tierChanges[0] || { to_scholar: 0, from_scholar: 0, without_override: [] };
    const toScholar = (tc as Record<string, unknown>).to_scholar as number || 0;
    const fromScholar = (tc as Record<string, unknown>).from_scholar as number || 0;
    const scores = (tc as Record<string, unknown>).without_override as number[] || [];

    const proposedRates = (changes as Record<string, Record<string, Record<string, Record<string, number>>>>).rate_limits || {};
    const proposedTiers = proposedRates.tiers || {};

    let ratesIncreased = 0;
    let ratesDecreased = 0;

    for (const trustScore of scores) {
      const tier = trustScore >= newScholar ? 'scholar' : trustScore < newTroll ? 'troll' : 'neutral';
      const curTier = current.rate_limits.tiers[tier];
      const curTotal = (curTier.multiplier * current.rate_limits.base_posts_per_hour) + (curTier.multiplier * current.rate_limits.base_comments_per_hour);

      const newTierConfig = (proposedTiers as unknown as Record<string, Record<string, number>>)[tier] || {};
      const flatRates = proposedRates as unknown as Record<string, number>;
      const newBasePosts = flatRates.base_posts_per_hour ?? current.rate_limits.base_posts_per_hour;
      const newBaseComments = flatRates.base_comments_per_hour ?? current.rate_limits.base_comments_per_hour;
      const newMult = newTierConfig.multiplier ?? curTier.multiplier;
      const newTotal = (newMult * newBasePosts) + (newMult * newBaseComments);

      if (newTotal > curTotal) ratesIncreased++;
      else if (newTotal < curTotal) ratesDecreased++;
    }

    res.json({
      users_affected: toScholar + fromScholar + ratesIncreased + ratesDecreased,
      tier_changes: { to_scholar: toScholar, from_scholar: fromScholar },
      rate_changes: { increased: ratesIncreased, decreased: ratesDecreased },
    });
  } catch (error) {
    console.error('Error computing config impact:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to compute config impact' });
  }
});

// 10. GET /api/admin/config/versions — Config version history
router.get('/config/versions', async (req, res) => {
  try {
    const versions = getConfigVersions();
    res.json({ versions });
  } catch (error) {
    console.error('Error fetching config versions:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch config versions' });
  }
});

// ═══ M10.8 Hall of Fame Management ═════════════════════════════════

// GET /api/admin/hall-of-fame — List curated entries
router.get('/hall-of-fame', async (req, res) => {
  try {
    const entries = await HallOfFame.find()
      .sort({ sort_order: 1, featured_at: -1 })
      .populate('post_id', 'title slug author_username author_display_name comment_count view_count category_slug hero_image_url intro post_type format created_at deleted status')
      .lean();

    const populated = entries.map((entry: Record<string, unknown>) => {
      const post = entry.post_id as Record<string, unknown> | null;
      return {
        id: (entry._id as { toString(): string }).toString(),
        post_id: entry.post_id ? (entry.post_id as { toString(): string }).toString() : '',
        post: post && !post.deleted && post.status === 'approved' ? {
          id: (post._id as { toString(): string }).toString(),
          slug: post.slug || '',
          title: post.title || '',
          intro: post.intro || '',
          post_type: post.post_type || '',
          comment_count: post.comment_count || 0,
          view_count: post.view_count || 0,
          author_username: post.author_username || '',
          author_display_name: post.author_display_name || '',
          category_slug: post.category_slug || '',
          hero_image_url: post.hero_image_url || null,
          format: post.format || 'list_only',
          created_at: post.created_at || new Date().toISOString(),
        } : null,
        editorial_note: entry.editorial_note || null,
        featured_at: entry.featured_at || new Date().toISOString(),
        sort_order: entry.sort_order || 0,
        created_by: entry.created_by || '',
        status_warning: post ? (post.deleted ? 'deleted' : post.status !== 'approved' ? post.status : null) : null,
      };
    });

    res.json({ featured: populated, total: populated.length });
  } catch (error) {
    console.error('Error fetching Hall of Fame entries:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch Hall of Fame entries' });
  }
});

// POST /api/admin/hall-of-fame — Add post to Hall of Fame
router.post('/hall-of-fame', async (req, res) => {
  try {
    const body = addToHallOfFameSchema.parse(req.body);

    const post = await Post.findById(body.post_id);
    if (!post) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Post not found' });
    }
    if (post.status !== 'approved') {
      return res.status(400).json({ code: 'INVALID_STATUS', error: 'Only approved posts can be added to Hall of Fame' });
    }

    const existing = await HallOfFame.findOne({ post_id: body.post_id });
    if (existing) {
      return res.status(409).json({ code: 'ALREADY_FEATURED', error: 'Already featured' });
    }

    const maxEntry = await HallOfFame.findOne().sort({ sort_order: -1 }).select('sort_order').lean();
    const sortOrder = (maxEntry?.sort_order ?? -1) + 1;

    const entry = await HallOfFame.create({
      post_id: body.post_id,
      editorial_note: body.editorial_note || null,
      featured_at: new Date(),
      sort_order: sortOrder,
      created_by: req.admin?.username || 'admin',
    });

    post.featured = true;
    post.featured_at = new Date();
    await post.save();

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'hall_of_fame_add',
      ip: getClientIp(req),
      metadata: { entry_id: (entry._id as { toString(): string }).toString(), post_id: body.post_id, post_title: post.title },
      user_agent: req.headers['user-agent'] || '',
    });

    const populated = await HallOfFame.findById(entry._id)
      .populate('post_id', 'title slug author_username comment_count view_count category_slug hero_image_url')
      .lean();

    res.status(201).json({ entry: populated });
  } catch (e: any) {
    if (e?.code === 11000) return res.status(409).json({ code: 'ALREADY_FEATURED', error: 'Already featured' });
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('Error adding to Hall of Fame:', e);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to add to Hall of Fame' });
  }
});

// GET /api/admin/hall-of-fame/candidates — Auto-candidate suggestions
router.get('/hall-of-fame/candidates', async (req, res) => {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

    const existingPostIds = (await HallOfFame.find().select('post_id').lean())
      .map((e: Record<string, unknown>) => (e.post_id as { toString(): string }).toString());

    const candidates = await Post.find({
      _id: { $nin: existingPostIds },
      status: 'approved',
      deleted: false,
      created_at: { $gte: ninetyDaysAgo },
      $or: [
        { comment_count: { $gte: 10 } },
        { view_count: { $gte: 500 } },
      ],
    })
      .sort({ comment_count: -1, view_count: -1 })
      .limit(20)
      .select('title slug author_username comment_count view_count category_slug hero_image_url created_at')
      .lean();

    res.json({ candidates });
  } catch (error) {
    console.error('Error fetching HoF candidates:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch candidates' });
  }
});

// PATCH /api/admin/hall-of-fame/reorder — Reorder entries
router.patch('/hall-of-fame/reorder', async (req, res) => {
  try {
    const body = reorderHallOfFameSchema.parse(req.body);

    const bulkOps = body.entries.map((e) => ({
      updateOne: {
        filter: { _id: e.id },
        update: { $set: { sort_order: e.sort_order } },
      },
    }));

    await HallOfFame.bulkWrite(bulkOps);

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'hall_of_fame_reorder',
      ip: getClientIp(req),
      metadata: { count: body.entries.length },
      user_agent: req.headers['user-agent'] || '',
    });

    res.json({ success: true });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('Error reordering HoF:', e);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to reorder entries' });
  }
});

// PATCH /api/admin/hall-of-fame/:id — Edit editorial note
router.patch('/hall-of-fame/:id', async (req, res) => {
  try {
    const body = updateHallOfFameNoteSchema.parse(req.body);

    const sanitized = (body.editorial_note || '').replace(/<[^>]*>/g, '').substring(0, 500);

    const entry = await HallOfFame.findByIdAndUpdate(
      req.params.id,
      { editorial_note: sanitized || null },
      { new: true }
    ).populate('post_id', 'title slug author_username comment_count view_count category_slug hero_image_url');

    if (!entry) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Hall of Fame entry not found' });
    }

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'hall_of_fame_edit_note',
      ip: getClientIp(req),
      metadata: { entry_id: req.params.id, post_id: (entry.post_id as unknown as { _id: { toString(): string } })._id.toString() },
      user_agent: req.headers['user-agent'] || '',
    });

    res.json({ entry });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('Error editing HoF note:', e);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to update editorial note' });
  }
});

// DELETE /api/admin/hall-of-fame/:id — Remove from Hall of Fame
router.delete('/hall-of-fame/:id', async (req, res) => {
  try {
    const entry = await HallOfFame.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Hall of Fame entry not found' });
    }

    const postId = entry.post_id;
    await HallOfFame.findByIdAndDelete(req.params.id);

    await Post.findByIdAndUpdate(postId, { featured: false });

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'hall_of_fame_remove',
      ip: getClientIp(req),
      metadata: { entry_id: req.params.id, post_id: postId.toString() },
      user_agent: req.headers['user-agent'] || '',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from HoF:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to remove from Hall of Fame' });
  }
});

// ═══ M10.12 Mod Management ══════════════════════════════════════════

import { PermissionPreset } from '../models/PermissionPreset';

// POST /api/admin/mods — Create mod (super admin only)
router.post('/mods', async (req, res) => {
  try {
    const body = createModSchema.parse(req.body);

    const existingSuperAdmin = await AdminUser.findOne({ role: 'super_admin' });
    if (existingSuperAdmin && existingSuperAdmin.username === body.username) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Username matches super admin. Choose a different username.' });
    }

    const existingMod = await AdminUser.findOne({ username: body.username });
    if (existingMod) {
      return res.status(409).json({ code: 'DUPLICATE', error: 'A mod with this username already exists' });
    }

    const invalidPerms = body.permissions.filter((p) => !isValidPermission(p));
    if (invalidPerms.length > 0) {
      return res.status(400).json({
        code: 'VALIDATION',
        error: `Invalid permissions: ${invalidPerms.join(', ')}`,
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const mod = await AdminUser.create({
      username: body.username,
      password_hash: passwordHash,
      role: 'mod',
      permissions: body.permissions,
      permissions_version: 1,
      is_active: true,
      created_by: req.admin!.username,
    });

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'create_mod',
      ip: getClientIp(req),
      metadata: {
        mod_id: (mod._id as { toString(): string }).toString(),
        mod_username: mod.username,
        permissions: body.permissions,
        preset_name: body.preset_name || null,
      },
      user_agent: req.headers['user-agent'] || '',
    });

    res.status(201).json({
      success: true,
      mod: {
        id: mod._id,
        username: mod.username,
        role: mod.role,
        permissions: mod.permissions,
        is_active: mod.is_active,
        created_at: mod.created_at,
      },
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('Error creating mod:', e);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to create mod' });
  }
});

// GET /api/admin/mods — List all mods
router.get('/mods', async (req, res) => {
  try {
    const mods = await AdminUser.find({ role: 'mod' })
      .select('username role permissions is_active created_at')
      .sort({ created_at: -1 })
      .lean();

    res.json({ mods });
  } catch (error) {
    console.error('Error fetching mods:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch mods' });
  }
});

// GET /api/admin/mods/permissions — Full permission catalog
router.get('/mods/permissions', async (req, res) => {
  res.json({ permissions: PERMISSION_CATALOG });
});

// GET /api/admin/mods/presets — All permission presets
router.get('/mods/presets', async (req, res) => {
  try {
    const presets = await PermissionPreset.find().sort({ name: 1 }).lean();
    res.json({ presets });
  } catch (error) {
    console.error('Error fetching presets:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch presets' });
  }
});

// GET /api/admin/mods/:id — Single mod detail
router.get('/mods/:id', async (req, res) => {
  try {
    const mod = await AdminUser.findById(req.params.id).select('-password_hash -__v').lean();
    if (!mod || mod.role !== 'mod') {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Mod not found' });
    }

    res.json({ mod });
  } catch (error) {
    console.error('Error fetching mod:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to fetch mod' });
  }
});

// PATCH /api/admin/mods/:id — Update permissions, is_active
router.patch('/mods/:id', async (req, res) => {
  try {
    const body = updateModSchema.parse(req.body);

    const mod = await AdminUser.findById(req.params.id);
    if (!mod || mod.role !== 'mod') {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Mod not found' });
    }

    const updates: Record<string, unknown> = {};

    if (body.permissions) {
      const invalidPerms = body.permissions.filter((p) => !isValidPermission(p));
      if (invalidPerms.length > 0) {
        return res.status(400).json({
          code: 'VALIDATION',
          error: `Invalid permissions: ${invalidPerms.join(', ')}`,
        });
      }
      updates.permissions = body.permissions;
      updates.$inc = { permissions_version: 1 };
    }

    if (body.is_active !== undefined) {
      if (body.is_active === false && req.admin?.id === req.params.id) {
        return res.status(400).json({ code: 'VALIDATION', error: 'Cannot disable your own account' });
      }
      updates.is_active = body.is_active;
    }

    await AdminUser.findByIdAndUpdate(req.params.id, updates);

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'update_mod',
      ip: getClientIp(req),
      metadata: {
        mod_id: req.params.id,
        mod_username: mod.username,
        changes: body,
      },
      user_agent: req.headers['user-agent'] || '',
    });

    const updated = await AdminUser.findById(req.params.id).select('-password_hash -__v').lean();

    res.json({ success: true, mod: updated });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('Error updating mod:', e);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to update mod' });
  }
});

// DELETE /api/admin/mods/:id — Soft delete (set is_active=false)
router.delete('/mods/:id', async (req, res) => {
  try {
    const mod = await AdminUser.findById(req.params.id);
    if (!mod) {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Mod not found' });
    }

    if (mod.role === 'super_admin') {
      return res.status(400).json({ code: 'VALIDATION', error: 'Cannot disable super admin account' });
    }

    // Prevent a mod from disabling themselves
    if (req.admin?.id === req.params.id) {
      return res.status(400).json({ code: 'VALIDATION', error: 'Cannot disable your own account' });
    }

    mod.is_active = false;
    await mod.save();

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'disable_mod',
      ip: getClientIp(req),
      metadata: {
        mod_id: (mod._id as { toString(): string }).toString(),
        mod_username: mod.username,
      },
      user_agent: req.headers['user-agent'] || '',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error disabling mod:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to disable mod' });
  }
});

// POST /api/admin/mods/:id/reset-password — Force password change
router.post('/mods/:id/reset-password', async (req, res) => {
  try {
    const body = resetPasswordSchema.parse(req.body);

    const mod = await AdminUser.findById(req.params.id);
    if (!mod || mod.role !== 'mod') {
      return res.status(404).json({ code: 'NOT_FOUND', error: 'Mod not found' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    mod.password_hash = passwordHash;
    await AdminUser.findByIdAndUpdate(req.params.id, {
      password_hash: passwordHash,
      $inc: { permissions_version: 1 },
    });

    logAudit({
      admin_id: (req.admin?.id as string) || 'unknown',
      action: 'reset_mod_password',
      ip: getClientIp(req),
      metadata: {
        mod_id: req.params.id,
        mod_username: mod.username,
      },
      user_agent: req.headers['user-agent'] || '',
    });

    res.json({ success: true });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('Error resetting mod password:', e);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to reset password' });
  }
});

export default router;
