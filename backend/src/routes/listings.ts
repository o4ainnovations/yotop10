import { Router, Request, Response } from 'express';

const router: Router = Router();
router.get('/', (req: Request, res: Response) => res.json({ message: 'Listings endpoint' }));
router.get('/:id', (req: Request, res: Response) => res.json({ message: 'Listing by ID' }));
router.post('/', (req: Request, res: Response) => res.json({ message: 'Create listing' }));
router.put('/:id', (req: Request, res: Response) => res.json({ message: 'Update listing' }));
router.delete('/:id', (req: Request, res: Response) => res.json({ message: 'Delete listing' }));

export default router;
