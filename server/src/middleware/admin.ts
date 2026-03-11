import { Response, NextFunction } from 'express';
import db from '../db/database.js';
import { AuthRequest } from './auth.js';

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await db.execute({
      sql: 'SELECT role FROM users WHERE id = ?',
      args: [req.user.id]
    });

    const user = result.rows[0];
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
