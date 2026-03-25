import { Router, Request, Response } from 'express';

const router: Router = Router();
router.get('/', (req: Request, res: Response) => res.json({ message: 'Users endpoint' }));
router.get('/:id', (req: Request, res: Response) => res.json({ message: 'User by ID' }));
router.put('/:id', (req: Request, res: Response) => res.json({ message: 'Update user' }));
router.delete('/:id', (req: Request, res: Response) => res.json({ message: 'Delete user' }));

export default router;
