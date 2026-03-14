import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// All notification routes require auth
router.use(authenticate);

// GET /api/notifications — list all my notifications
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await db.execute({
      sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      args: [userId]
    });
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notifications/unread/count — count unread notifications
router.get('/unread/count', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      args: [userId]
    });
    res.json({ count: Number(result.rows[0]?.count || 0) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/mark-read — mark all as read
router.put('/mark-read', async (req: AuthRequest, res) => {
  try {
    await db.execute({
      sql: 'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      args: [req.user!.id as string]
    });
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:id/read — mark specific as read
router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    await db.execute({
      sql: 'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      args: [req.params.id as string, req.user!.id as string]
    });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Utility function to create a notification (to be exported/used by other routes)
 */
export const createNotification = async (userId: string, type: string, title: string, message: string, link: string = '') => {
  try {
    await db.execute({
      sql: 'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)',
      args: [uuidv4(), userId, type, title, message, link]
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

export default router;
