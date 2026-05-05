import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AdminUser } from '../models/AdminUser';
import { SetupToken } from '../models/SetupToken';
import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';
import {
  adminAuthMiddleware,
  generateAdminToken,
  checkAccountLock,
  recordFailedLogin,
  resetLoginAttempts,
  AdminAuthRequest,
} from '../lib/adminAuth';
import { trustScoreWorker } from '../lib/trustScoreWorker';
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
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `admin_login:${clientIp}`;
    const maxIpAttempts = 10;
    const windowSeconds = 15 * 60;

    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, windowSeconds);
    if (attempts > maxIpAttempts) {
      return res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many attempts. Try again in 15 minutes.' });
    }

    const admin = await AdminUser.findOne({ username });
    if (!admin) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' });
    }

    const locked = await checkAccountLock(admin);
    if (locked) {
      return res.status(429).json({ code: 'ACCOUNT_LOCKED', error: 'Account temporarily locked. Try again later.' });
    }

    const passwordValid = await bcrypt.compare(password, admin.password_hash);
    if (!passwordValid) {
      await recordFailedLogin(admin);
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid credentials' });
    }

    await resetLoginAttempts(admin._id);

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

    res.json({ success: true, post });
  } catch (error) {
    console.error('Error approving post:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to approve post' });
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

    res.json({ success: true, post });
  } catch (error) {
    console.error('Error rejecting post:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Failed to reject post' });
  }
});

export default router;
