import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import webpush from 'web-push';

// Configure Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@opennotes.in',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

import { io } from '../socket.js';
import { sendTelegramMessage } from './telegram.js';

/**
 * Utility function to create a notification and trigger web push
 */
export const createNotification = async (userId: string, type: string, title: string, message: string, link: string = '', tx?: any) => {
  try {
    const notificationId = uuidv4();
    const createdAt = new Date().toISOString();

    const executor = tx || db;
    await executor.execute({
      sql: 'INSERT INTO notifications (id, user_id, type, title, message, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [notificationId, userId, type, title, message, link, createdAt]
    });

    // Emit real-time notification via Socket.IO
    if (io) {
      io.to(`user:${userId}`).emit('new_notification', {
        id: notificationId,
        type,
        title,
        message,
        link,
        is_read: 0,
        created_at: createdAt
      });
      // Also update unread count for badge
      io.to(`user:${userId}`).emit('unread_count_changed');
    } else {
      console.warn('[Socket] Global io instance is undefined in createNotification');
    }

    // Trigger Web Push
    sendPushNotification(userId, {
      title,
      body: message,
      url: link,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: type
    });

    // Send Telegram Notification
    try {
      const appUrl = process.env.FRONTEND_URL || 'https://open-notes-in-client.vercel.app';
      const telegramResult = await db.execute({
        sql: 'SELECT telegram_chat_id FROM users WHERE id = ?',
        args: [userId],
      });
      const chatId = (telegramResult.rows[0] as any)?.telegram_chat_id;
      if (chatId) {
        const linkUrl = link ? `${appUrl}${link}` : appUrl;
        const text = `<b>${title}</b>\n\n${message}${link ? `\n\n<a href="${linkUrl}">Open in OpenNotes →</a>` : ''}`;
        await sendTelegramMessage(chatId, text);
      }
    } catch (err) {
      console.error('[Telegram] Notification send failed:', err);
    }

    return true;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return false;
  }
};

/**
 * Send push notification to all subscriptions of a user
 */
export const sendPushNotification = async (userId: string, payload: any) => {
  try {
    const subs = await db.execute({
      sql: 'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
      args: [userId]
    });

    const body = JSON.stringify(payload);

    const results = await Promise.all(subs.rows.map(async (row: any) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth
        }
      };

      try {
        await webpush.sendNotification(subscription, body);
        return { success: true };
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or no longer valid — remove it
          await db.execute({
            sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
            args: [row.endpoint]
          });
        }
        return { success: false, error: err };
      }
    }));

    return results;
  } catch (err) {
    console.error('Push broadcast error:', err);
    return [];
  }
};
