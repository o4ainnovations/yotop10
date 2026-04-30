import { Router, Request, Response } from 'express';

const router: Router = Router();

router.post('/login', (_req: Request, res: Response) => res.status(501).json({ error: 'Not implemented' }));
router.post('/register', (_req: Request, res: Response) => res.status(501).json({ error: 'Not implemented' }));
router.post('/logout', (_req: Request, res: Response) => res.status(501).json({ error: 'Not implemented' }));

export default router;
