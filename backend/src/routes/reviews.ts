import { Router, Request, Response } from 'express';

const router: Router = Router();
router.get('/', (req: Request, res: Response) => res.json({ message: 'Reviews endpoint' }));
router.get('/:id', (req: Request, res: Response) => res.json({ message: 'Review by ID' }));
router.post('/', (req: Request, res: Response) => res.json({ message: 'Create review' }));
router.put('/:id', (req: Request, res: Response) => res.json({ message: 'Update review' }));
router.delete('/:id', (req: Request, res: Response) => res.json({ message: 'Delete review' }));

export default router;
