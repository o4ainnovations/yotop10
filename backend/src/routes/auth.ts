import { Router } from 'express';

const router: Router = Router();

router.post('/login', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.post('/register', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.post('/logout', (_req, res) => res.status(501).json({ error: 'Not implemented' }));

export default router;
