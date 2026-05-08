import { Router, Request, Response } from 'express';

const router: Router = Router();
router.get('/', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.get('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.post('/', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.put('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.delete('/:id', (_req, res) => res.status(501).json({ error: 'Not implemented' }));

export default router;
