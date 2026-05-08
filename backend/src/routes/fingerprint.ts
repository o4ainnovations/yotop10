/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any -- Express middleware type chains */
import { Router } from 'express';
import { findMatchingUser, storeFingerprintObservation } from '../lib/fingerprintMatching';
import { User } from '../models/User';

const router: Router = Router();

/**
 * POST /api/fingerprint/submit
 * Submit full fingerprint data for matching
 * 
 * Auth: Public
 * Request body: { tier1, tier2, hash }
 * Response: { match_found: boolean, trust_score?: number }
 */
router.post('/submit', async (req, res) => {
  try {
    const { tier0, tier1, tier2, hash } = req.body;

    if (!tier1 || !tier2 || !hash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const matchedUserId = await findMatchingUser(tier0 || {}, tier1, tier2);

    if (matchedUserId && req.user) {
      await storeFingerprintObservation(req.user.user_id, hash, tier0 || {}, tier1, tier2);

      if (req.user.trust_score === 1.0) {
        await User.findOneAndUpdate({ user_id: req.user.user_id }, { trust_score: 0.7 });
      }

      return res.json({ match_found: true, matched_user: matchedUserId !== req.user.user_id ? 'different' : 'same' });
    }

    if (req.user) {
      await storeFingerprintObservation(req.user.user_id, hash, tier0 || {}, tier1, tier2);
    }

    res.json({ match_found: false });
  } catch (error) { res.status(500).json({ error: 'Failed to process fingerprint' }); }
});

export default router;
