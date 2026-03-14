import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import db from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'opennotes-dev-secret-change-in-prod';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    
    // Check user status in database
    const result = await db.execute({
      sql: 'SELECT id, email, role, status FROM users WHERE id = ?',
      args: [decoded.id]
    });

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User no longer exists' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ 
        error: 'ACCOUNT_BLOCKED',
        message: 'Your account has been blocked by an administrator.' 
      });
    }

    req.user = {
      id: user.id as string,
      email: user.email as string,
      role: (user.role as string) || 'user'
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
