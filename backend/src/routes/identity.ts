/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { User } from '../models/User';
import { UserDevice } from '../models/UserDevice';
import { AuthChallenge } from '../models/AuthChallenge';
import { generateChallenge, verifySignature, hashPublicKey, verifyPublicKeyHash } from '../lib/identityCrypto';
import { logAudit } from '../lib/auditWriter';
import { getClientIp } from '../middleware/fingerprint';
import {
  generateKeySchema,
  claimChallengeSchema,
  claimVerifySchema,
  linkDeviceSchema,
} from '../schemas/identity';

const router: Router = Router();

function userId(req: any): string {
  return (req.admin?.id as string) || req.user?.user_id || 'unknown';
}

function requireUser(req: any, res: any): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  return true;
}

// GET /api/identity/status — Check identity status
router.get('/status', async (req: any, res: any) => {
  if (!requireUser(req, res)) return;
  try {
    const user = await User.findOne({ user_id: req.user.user_id }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const deviceCount = await UserDevice.countDocuments({ user_id: req.user.user_id });
    res.json({
      has_seed: !!user.authority_id,
      authority_id: user.authority_id || null,
      seed_generated_at: user.seed_generated_at || null,
      devices_linked: deviceCount,
    });
  } catch (e) { console.error('[identity] status error:', e); res.status(500).json({ error: 'Failed' }); }
});

// POST /api/identity/generate-key — Generate seed identity
router.post('/generate-key', async (req: any, res: any) => {
  if (!requireUser(req, res)) return;
  try {
    const body = generateKeySchema.parse(req.body);

    const existing = await User.findOne({ user_id: req.user.user_id });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.authority_id) {
      return res.status(409).json({ code: 'SEED_EXISTS', error: 'This account already has a seed phrase' });
    }

    const existingAuth = await User.findOne({ authority_id: body.authority_id });
    if (existingAuth) {
      return res.status(409).json({ code: 'AUTHORITY_TAKEN', error: 'This identity key is already claimed by another account' });
    }

    const keyHash = await hashPublicKey(body.authority_id);

    await User.updateOne(
      { user_id: req.user.user_id },
      { authority_id: body.authority_id, public_key_hash: keyHash, seed_generated_at: new Date() }
    );

    const fp = req.body.device_fingerprint || req.fingerprint;
    await UserDevice.findOneAndUpdate(
      { device_fingerprint: fp },
      { device_fingerprint: fp, user_id: req.user.user_id, authority_id: body.authority_id, linked_at: new Date() },
      { upsert: true, new: true }
    );

    logAudit({ admin_id: userId(req), action: 'generate_identity_key', ip: getClientIp(req), metadata: { user_id: req.user.user_id, authority_id: body.authority_id }, user_agent: req.headers['user-agent'] || '' });

    res.status(201).json({ success: true, authority_id: body.authority_id, device_linked: true });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('[identity] generate-key error:', e);
    res.status(500).json({ error: 'Failed to generate identity key' });
  }
});

// POST /api/identity/claim — Request challenge for identity claim
router.post('/claim', async (req: any, res: any) => {
  try {
    const body = claimChallengeSchema.parse(req.body);

    const user = await User.findOne({ authority_id: body.authority_id });
    if (!user) return res.status(404).json({ code: 'AUTHORITY_NOT_FOUND', error: 'No account found with this identity key' });

    const challenge = generateChallenge();
    await AuthChallenge.create({
      challenge,
      authority_id: body.authority_id,
      device_fingerprint: body.device_fingerprint,
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    });

    res.json({ challenge });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('[identity] claim challenge error:', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/identity/claim/verify — Verify signed challenge and complete claim
router.post('/claim/verify', async (req: any, res: any) => {
  try {
    const body = claimVerifySchema.parse(req.body);

    const user = await User.findOne({ authority_id: body.authority_id });
    if (!user) return res.status(404).json({ code: 'AUTHORITY_NOT_FOUND', error: 'No account found with this identity key' });

    const challengeDoc = await AuthChallenge.findOne({
      challenge: body.challenge,
      authority_id: body.authority_id,
      device_fingerprint: body.device_fingerprint,
      used: false,
    });

    if (!challengeDoc) return res.status(410).json({ code: 'CHALLENGE_EXPIRED', error: 'Challenge expired or already used' });
    if (challengeDoc.expires_at < new Date()) {
      return res.status(410).json({ code: 'CHALLENGE_EXPIRED', error: 'Challenge expired' });
    }

    const valid = verifySignature(body.authority_id, body.challenge, body.signature);
    if (!valid) return res.status(403).json({ code: 'SIGNATURE_INVALID', error: 'Signature verification failed' });

    if (!user.public_key_hash) {
      return res.status(500).json({ error: 'Account has no stored public key hash — seed may not have been generated properly' });
    }

    const hashValid = await verifyPublicKeyHash(body.authority_id, user.public_key_hash);
    if (!hashValid) return res.status(403).json({ code: 'SIGNATURE_INVALID', error: 'Public key verification failed' });

    await AuthChallenge.updateOne({ _id: challengeDoc._id }, { used: true });

    await UserDevice.findOneAndUpdate(
      { device_fingerprint: body.device_fingerprint },
      { device_fingerprint: body.device_fingerprint, user_id: user.user_id, authority_id: body.authority_id, linked_at: new Date() },
      { upsert: true, new: true }
    );

    // Release fingerprint from any previous owner, then assign to claiming user
    await User.updateOne(
      { device_fingerprint: body.device_fingerprint, user_id: { $ne: user.user_id } },
      { $set: { device_fingerprint: `released_${body.device_fingerprint}_${Date.now()}` } }
    );
    await User.updateOne(
      { user_id: user.user_id },
      { device_fingerprint: body.device_fingerprint }
    );

    logAudit({ admin_id: user.user_id, action: 'claim_identity', ip: getClientIp(req), metadata: { user_id: user.user_id, authority_id: body.authority_id, device_fingerprint: body.device_fingerprint }, user_agent: req.headers['user-agent'] || '' });

    res.json({
      success: true,
      user: {
        user_id: user.user_id,
        username: user.username,
        custom_display_name: user.custom_display_name,
        trust_score: user.trust_score,
      },
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    console.error('[identity] verifyClaim error:', e);
    res.status(500).json({ error: `Failed: ${e?.message || e}` });
  }
});

// POST /api/identity/link — Link additional device fingerprint
router.post('/link', async (req: any, res: any) => {
  if (!requireUser(req, res)) return;
  try {
    const body = linkDeviceSchema.parse(req.body);

    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.authority_id) {
      return res.status(400).json({ code: 'NO_SEED_IDENTITY', error: 'You must generate a seed phrase before linking devices' });
    }

    const fp = body.device_fingerprint || req.fingerprint;

    await UserDevice.findOneAndUpdate(
      { device_fingerprint: fp },
      { device_fingerprint: fp, user_id: user.user_id, authority_id: user.authority_id, linked_at: new Date() },
      { upsert: true, new: true }
    );

    const deviceCount = await UserDevice.countDocuments({ user_id: user.user_id });

    logAudit({ admin_id: userId(req), action: 'link_device', ip: getClientIp(req), metadata: { user_id: user.user_id, device_fingerprint: fp }, user_agent: req.headers['user-agent'] || '' });

    res.json({ success: true, devices_linked: deviceCount });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'VALIDATION', error: e.issues.map((i: any) => i.message).join('; ') });
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/identity/devices — List linked devices
router.get('/devices', async (req: any, res: any) => {
  if (!requireUser(req, res)) return;
  try {
    const user = await User.findOne({ user_id: req.user.user_id }).lean();
    if (!user || !user.authority_id) {
      return res.json({ devices: [] });
    }

    const devices = await UserDevice.find({ user_id: req.user.user_id })
      .sort({ linked_at: -1 })
      .lean();

    const currentFp = user.device_fingerprint;

    res.json({
      devices: devices.map((d: Record<string, unknown>) => ({
        device_fingerprint: d.device_fingerprint,
        label: d.label || null,
        linked_at: d.linked_at,
        is_current: d.device_fingerprint === currentFp,
      })),
    });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// DELETE /api/identity/devices/:fingerprint — Unlink a device
router.delete('/devices/:fingerprint', async (req: any, res: any) => {
  if (!requireUser(req, res)) return;
  try {
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const targetFp = req.params.fingerprint;

    if (targetFp === req.fingerprint || targetFp === user.device_fingerprint) {
      return res.status(400).json({ code: 'CANNOT_UNLINK_CURRENT', error: 'Cannot unlink your current device' });
    }

    const result = await UserDevice.deleteOne({ device_fingerprint: targetFp, user_id: req.user.user_id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    logAudit({ admin_id: userId(req), action: 'unlink_device', ip: getClientIp(req), metadata: { user_id: req.user.user_id, device_fingerprint: targetFp }, user_agent: req.headers['user-agent'] || '' });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
