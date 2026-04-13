import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AdminUser } from '../models/AdminUser';

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-me-in-production';
const JWT_EXPIRY = '24h';

export interface AdminAuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
  };
}

/**
 * Generate JWT token for admin
 */
export const generateAdminToken = (adminId: string, username: string): string => {
  return jwt.sign({ id: adminId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

/**
 * Admin auth middleware - protects all /api/admin routes
 */
export const adminAuthMiddleware = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.admin_token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    
    const admin = await AdminUser.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.admin = {
      id: admin._id.toString(),
      username: admin.username,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Generate one-time setup token
 */
export const generateSetupToken = (): { token: string; expiresAt: Date } => {
  const token = require('crypto').randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  return { token, expiresAt };
};
