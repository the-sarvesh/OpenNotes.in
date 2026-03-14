import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = express.Router();

// All notification routes require auth
router.use(authenticate);

// GET /api/notifications — list all my notifications
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const result = await db.execute({
      sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      args: [userId, limit, offset]
    });
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/unread/count — count unread notifications
router.get('/unread/count', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      args: [userId]
    });
    res.json({ count: Number(result.rows[0]?.count || 0) });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/mark-read — mark all as read
router.put('/mark-read', async (req: AuthRequest, res, next) => {
  try {
    await db.execute({
      sql: 'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      args: [req.user!.id as string]
    });
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/:id/read — mark specific as read
router.put('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    await db.execute({
      sql: 'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      args: [req.params.id as string, req.user!.id as string]
    });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;
