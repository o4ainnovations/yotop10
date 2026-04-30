import { Router, Request, Response } from 'express';

const router: Router = Router();
router.get('/', (_req: Request, res: Response) => res.status(501).json({ error: 'Not implemented' }));
router.get('/suggestions', (_req: Request, res: Response) => res.status(501).json({ error: 'Not implemented' }));

export default router;
