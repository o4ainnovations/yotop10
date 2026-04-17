import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/AdminUser';
import { SetupToken } from '../models/SetupToken';
import { Post } from '../models/Post';
import { adminAuthMiddleware, generateAdminToken, generateSetupToken, AdminAuthRequest } from '../lib/adminAuth';
import { trustScoreWorker } from '../lib/trustScoreWorker';

const router: Router = Router();

/**
 * POST /api/admin/login
 * Admin login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const admin = await AdminUser.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordValid = await bcrypt.compare(password, admin.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateAdminToken(admin._id.toString(), admin.username);

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/admin/setup
 * Complete initial admin setup with one-time token
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { token, username, password } = req.body;

    // Validate token
    const setupToken = await SetupToken.findOne({
      token,
      expires_at: { $gt: new Date() },
      used: false,
    });

    if (!setupToken) {
      return res.status(400).json({ error: 'Invalid or expired setup token' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Delete all existing admins
    await AdminUser.deleteMany({});

    // Create new admin
    const admin = await AdminUser.create({
      username,
      password_hash: passwordHash,
    });

    // Mark token as used
    await SetupToken.findByIdAndUpdate(setupToken._id, { used: true });

    // Generate session token
    const authToken = generateAdminToken(admin._id.toString(), admin.username);

    res.cookie('admin_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

/**
 * GET /api/admin/me
 * Get current admin user
 */
router.get('/me', adminAuthMiddleware, async (req: AdminAuthRequest, res: Response) => {
  res.json({
    id: req.admin!.id,
    username: req.admin!.username,
  });
});

/**
 * POST /api/admin/logout
 * Invalidate admin session
 */
router.post('/logout', adminAuthMiddleware, async (req: AdminAuthRequest, res: Response) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

/**
 * GET /api/admin/setup/validate
 * Validate setup token
 */
router.get('/setup/validate', async (req: Request, res: Response) => {
  const { token } = req.query;

  const setupToken = await SetupToken.findOne({
    token,
    expires_at: { $gt: new Date() },
    used: false,
  });

  res.json({
    valid: !!setupToken,
  });
});

/**
 * GET /api/admin/posts/pending
 * List pending posts for admin review
 * Auth: Admin only
 */
router.get('/posts/pending', adminAuthMiddleware, async (req: AdminAuthRequest, res: Response) => {
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
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching pending posts:', error);
    res.status(500).json({ error: 'Failed to fetch pending posts' });
  }
});

/**
 * GET /api/admin/posts/pending/:id
 * Get full pending post preview
 * Auth: Admin only
 */
router.get('/posts/pending/:id', adminAuthMiddleware, async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.status !== 'pending_review') {
      return res.status(400).json({ error: 'Post is not pending review' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching pending post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

/**
 * PATCH /api/admin/posts/:id/approve
 * Approve post and publish to public feed
 * Auth: Admin only
 */
router.patch('/posts/:id/approve', adminAuthMiddleware, async (req: AdminAuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.status === 'approved') {
      return res.status(400).json({ error: 'Post is already approved' });
    }

    post.status = 'approved';
    post.published_at = new Date();
    await post.save();

    // Queue trust score update
    await trustScoreWorker.queueUpdate(post.author_id, post._id.toString(), 'approve');

    // Elasticsearch index stub - no implementation yet
    // TODO: Implement Elasticsearch indexing

    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Error approving post:', error);
    res.status(500).json({ error: 'Failed to approve post' });
  }
});

/**
 * PATCH /api/admin/posts/:id/reject
 * Reject pending post
 * Auth: Admin only
 */
router.patch('/posts/:id/reject', adminAuthMiddleware, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.status === 'rejected') {
      return res.status(400).json({ error: 'Post is already rejected' });
    }

    post.status = 'rejected';
    post.rejection_reason = reason.trim();
    await post.save();

    // Queue trust score update
    await trustScoreWorker.queueUpdate(post.author_id, post._id.toString(), 'reject');

    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Error rejecting post:', error);
    res.status(500).json({ error: 'Failed to reject post' });
  }
});

export default router;
