import { Router, Request, Response } from 'express';

const router: Router = Router();
router.get('/', (req: Request, res: Response) => res.json({ message: 'Categories endpoint' }));
router.get('/:id', (req: Request, res: Response) => res.json({ message: 'Category by ID' }));
router.post('/', (req: Request, res: Response) => res.json({ message: 'Create category' }));
router.put('/:id', (req: Request, res: Response) => res.json({ message: 'Update category' }));
router.delete('/:id', (req: Request, res: Response) => res.json({ message: 'Delete category' }));

export default router;
