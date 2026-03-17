import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { initTelegramBot, getBot } from '../utils/telegram.js';

const router = express.Router();

/**
 * Telegram Webhook Endpoint
 */
router.post('/webhook', async (req, res) => {
  const bot = getBot();
  if (bot) {
    try {
      await bot.handleUpdate(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error('[Telegram Webhook] Error:', err);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(404);
  }
});

/**
 * Generate a linking token for the authenticated user
 */
router.get('/generate-token', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const token = `tl-${uuidv4()}`;

    await db.execute({
      sql: 'UPDATE users SET telegram_link_token = ? WHERE id = ?',
      args: [token, userId]
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'OpenNotesInBot';
    const link = `https://t.me/${botUsername}?start=${token}`;

    console.log(`[Telegram] Generated link for user ${userId}: ${link}`);

    res.json({ token, link });
  } catch (err) {
    console.error('[Telegram API] Failed to generate token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Unlink Telegram from the authenticated user
 */
router.post('/unlink', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.id;

    await db.execute({
      sql: 'UPDATE users SET telegram_chat_id = NULL, telegram_link_token = NULL WHERE id = ?',
      args: [userId]
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Telegram API] Failed to unlink:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Check Telegram link status
 */
router.get('/status', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const result = await db.execute({
      sql: 'SELECT telegram_chat_id FROM users WHERE id = ?',
      args: [userId]
    });

    const isLinked = !!(result.rows[0] as any)?.telegram_chat_id;
    res.json({ isLinked });
  } catch (err) {
    console.error('[Telegram API] Failed to check status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
