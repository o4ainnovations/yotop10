import { Router, Request, Response } from 'express';
import { logPageVisit, getClientIp } from '../lib/pageVisitWriter';

const router = Router();

router.post('/visit', async (req: Request, res: Response) => {
  try {
    const { path, referer, user_agent, fingerprint } = req.body;
    if (!path) return res.status(400).json({ error: 'path required' });
    logPageVisit({ path, referer, user_agent, fingerprint, ip: getClientIp(req) });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
