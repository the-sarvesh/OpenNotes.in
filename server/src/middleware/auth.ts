import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import db from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'opennotes-dev-secret-change-in-prod';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
    }
    interface Request {
      user?: User;
    }
  }
}

export type AuthRequest = Request;

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Read from cookie first (preferred), then fallback to header
  let token = req.cookies?.auth_token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

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
export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token = req.cookies?.auth_token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const result = await db.execute({
      sql: 'SELECT id, email, role, status FROM users WHERE id = ?',
      args: [decoded.id]
    });

    const user = result.rows[0];
    if (user && user.status !== 'blocked') {
      req.user = {
        id: user.id as string,
        email: user.email as string,
        role: (user.role as string) || 'user'
      };
    }
  } catch (error) {
    // Ignore invalid token in optional auth
  }
  next();
};
