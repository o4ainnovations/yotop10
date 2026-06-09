import { Router } from 'express';
import { User } from '../models/User';
import { UserDevice } from '../models/UserDevice';
import { redis } from '../lib/redis';

const router: Router = Router();

// GET /api/fingerprint/merge-status — Check if there's a pending merge for a token
router.get('/merge-status', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token || token.length < 32) {
      return res.json({ pending: false });
    }

    const data = await redis.get(`fingerprint:merge:${token}`);
    if (!data) {
      return res.json({ pending: false });
    }

    const request = JSON.parse(data);
    return res.json({
      pending: !request.confirmed,
      confirmed: request.confirmed === true,
      created_at: request.created_at,
    });
  } catch (error) {
    console.error('[FingerprintMerge] Status check error:', error);
    res.status(500).json({ error: 'Failed to check merge status' });
  }
});

// POST /api/fingerprint/confirm-merge — Confirm a pending fingerprint merge
router.post('/confirm-merge', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string' || token.length < 32) {
      return res.status(400).json({ error: 'Invalid merge token' });
    }

    const data = await redis.get(`fingerprint:merge:${token}`);
    if (!data) {
      return res.status(404).json({ error: 'Merge request not found or expired' });
    }

    const request = JSON.parse(data);
    if (request.confirmed) {
      return res.json({ success: true, message: 'Already merged' });
    }

    const { from_fingerprint, to_user_id } = request;

    // Atomically transfer the existing user's identity to the new fingerprint
    const updated = await User.findOneAndUpdate(
      { user_id: to_user_id, device_fingerprint: { $ne: from_fingerprint } },
      { $set: { device_fingerprint: from_fingerprint } },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({ error: 'User already has this fingerprint or was modified concurrently' });
    }

    // Record the device link for reverse lookup
    await UserDevice.findOneAndUpdate(
      { user_id: to_user_id, device_fingerprint: from_fingerprint },
      { user_id: to_user_id, device_fingerprint: from_fingerprint, linked_at: new Date() },
      { upsert: true, new: true }
    );

    // Mark merge as confirmed in Redis
    request.confirmed = true;
    await redis.setEx(`fingerprint:merge:${token}`, 300, JSON.stringify(request));

    console.log(`[FingerprintMerge] User ${to_user_id} merged with fingerprint ${from_fingerprint.substring(0, 8)}...`);

    res.json({ success: true, user_id: to_user_id });
  } catch (error) {
    console.error('[FingerprintMerge] Confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm merge' });
  }
});

export default router;
