import { Router, Request, Response } from 'express';
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
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { tier1, tier2, hash } = req.body;

    if (!tier1 || !tier2 || !hash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Look for existing user match
    const matchingUserId = await findMatchingUser(tier1, tier2);

    if (matchingUserId && req.user) {
      // Existing user detected for new fingerprint
      await storeFingerprintObservation(req.user.user_id, hash, tier1, tier2);
      
      // Adjust trust score silently for existing device
      if (req.user.trust_score === 1.0) {
        await User.findOneAndUpdate(
          { user_id: req.user.user_id },
          { trust_score: 0.7 }
        );
      }

      return res.json({
        match_found: true,
        trust_score: Math.min(req.user.trust_score, 0.7)
      });
    }

    // Store new observation
    if (req.user) {
      await storeFingerprintObservation(req.user.user_id, hash, tier1, tier2);
    }

    return res.json({
      match_found: false
    });

  } catch (error) {
    console.error('Fingerprint submission error:', error);
    return res.status(500).json({ error: 'Failed to process fingerprint' });
  }
});

export default router;
