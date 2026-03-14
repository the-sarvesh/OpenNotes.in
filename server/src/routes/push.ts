import express from 'express';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.use(authenticate);

// GET /api/push/key
router.get('/key', (req: AuthRequest, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
router.post('/subscribe', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    // Check if subscription already exists for this endpoint
    const existing = await db.execute({
      sql: 'SELECT id FROM push_subscriptions WHERE endpoint = ? LIMIT 1',
      args: [endpoint]
    });

    if (existing.rows.length > 0) {
      // Update user_id in case it changed (e.g. login/logout)
      await db.execute({
        sql: 'UPDATE push_subscriptions SET user_id = ? WHERE endpoint = ?',
        args: [userId, endpoint]
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)',
        args: [uuidv4(), userId, endpoint, keys.p256dh, keys.auth]
      });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', async (req: AuthRequest, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

    await db.execute({
      sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
      args: [endpoint]
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
