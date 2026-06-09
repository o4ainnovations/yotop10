import { Request, Response, NextFunction } from 'express';

const NOSQL_PATTERN = /(\$gt|\$gte|\$lt|\$lte|\$ne|\$in|\$nin|\$regex|\$exists|\$where|\$and|\$or|\$not|\$nor)/i;

export function sanitizeQueryParams(req: Request, res: Response, next: NextFunction): void {
  void req;
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      if (NOSQL_PATTERN.test(value)) {
        console.warn(`[Security] Blocked NoSQL injection attempt on query param "${key}": ${value.substring(0, 50)}`);
        res.status(400).json({ error: 'Invalid query parameter' });
        return;
      }
      if (value.length > 500) {
        res.status(400).json({ error: 'Query parameter too long' });
        return;
      }
    }
  }
  next();
}
