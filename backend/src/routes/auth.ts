import { Router, Request, Response } from 'express';

const router: Router = Router();

// Login
router.post('/login', (req: Request, res: Response) => {
  res.json({ message: 'Login endpoint' });
});

// Register
router.post('/register', (req: Request, res: Response) => {
  res.json({ message: 'Register endpoint' });
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logout endpoint' });
});

export default router;
