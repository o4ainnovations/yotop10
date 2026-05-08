import { Router } from 'express';
import { logPageVisit, getClientIp } from '../lib/pageVisitWriter';

const router = Router();

router.post('/visit', async (req, res) => {
  try {
    const { path, referer, user_agent, fingerprint } = req.body;
    if (!path) return res.status(400).json({ error: 'path required' });
    logPageVisit({ path, referer, user_agent, fingerprint, ip: getClientIp(req as any) });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
