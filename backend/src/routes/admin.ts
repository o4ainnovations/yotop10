import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/AdminUser';
import { SetupToken } from '../models/SetupToken';
import { adminAuthMiddleware, generateAdminToken, generateSetupToken, AdminAuthRequest } from '../lib/adminAuth';

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

export default router;
