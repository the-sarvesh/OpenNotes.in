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

/**
 * Utility function to create a notification and trigger web push
 */
export const createNotification = async (userId: string, type: string, title: string, message: string, link: string = '', tx?: any, metadata?: any) => {
  try {
    const notificationId = uuidv4();
    const createdAt = new Date().toISOString();

    const executor = tx || db;
    await executor.execute({
      sql: 'INSERT INTO notifications (id, user_id, type, title, message, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [notificationId, userId, type, title, message, link, createdAt]
    });

    // Persist external delivery work alongside the notification. This keeps
    // push/Telegram failures from slowing or rolling back orders and messages.
    try {
      await executor.execute({
        sql: `INSERT OR IGNORE INTO notification_delivery_jobs
              (id, notification_id, user_id, payload_json)
              VALUES (?, ?, ?, ?)`,
        args: [
          uuidv4(),
          notificationId,
          userId,
          JSON.stringify({ type, title, message, link, metadata: metadata || null }),
        ],
      });
    } catch (queueError) {
      console.error('[Notifications] Failed to queue external delivery:', queueError);
    }

    // Emit real-time notification via Socket.IO
    if (io) {
      io.to(`user:${userId}`).emit('new_notification', {
        id: notificationId,
        type,
        title,
        message,
        link,
        is_read: 0,
        created_at: createdAt,
        metadata
      });
      // Also update unread count for badge
      io.to(`user:${userId}`).emit('unread_count_changed');
    }

    return true;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return false;
  }
};

const deliverExternalNotification = async (userId: string, payload: any) => {
  const { type, title, message, link, metadata } = payload;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const pushResults = await sendPushNotification(userId, {
      title,
      body: message,
      url: link,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: type,
    });
    if (pushResults.some((result: any) => !result.success)) {
      throw new Error('One or more push deliveries failed');
    }
  }

  if (metadata?.skipTelegram || !process.env.TELEGRAM_BOT_TOKEN) return;
  const { escapeHtml, sendTelegramPreview, sendTelegramMessage } = await import('./telegram.js');
  if (type === 'message' && metadata?.conversationId) {
    let receiverAlreadyOnline = false;
    if (io) {
      const convoRoom = io.sockets.adapter.rooms.get(`conv:${metadata.conversationId}`);
      const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
      receiverAlreadyOnline = Boolean(userRoom && convoRoom && [...userRoom].some((sid) => convoRoom.has(sid)));
    }
    if (!receiverAlreadyOnline) {
      await sendTelegramPreview(
        userId,
        metadata.senderName || 'Someone',
        metadata.content || message,
        metadata.conversationId,
        metadata.listingId,
      );
    }
    return;
  }

  const telegramResult = await db.execute({
    sql: 'SELECT telegram_chat_id FROM users WHERE id = ?',
    args: [userId],
  });
  const user = telegramResult.rows[0] as any;
  if (!user?.telegram_chat_id) return;
  const appUrl = process.env.FRONTEND_URL || 'https://opennotes.in';
  const linkUrl = link ? `${appUrl}${link}` : appUrl;
  const text = `<b>${escapeHtml(String(title))}</b>\n\n${escapeHtml(String(message))}${link ? `\n\n<a href="${linkUrl}">Open in OpenNotes →</a>` : ''}`;
  const sent = await sendTelegramMessage(user.telegram_chat_id, text);
  if (!sent) throw new Error('Telegram delivery failed');
};

let deliveryWorkerRunning = false;

/** Process a bounded batch of durable push/Telegram jobs with backoff. */
export const processNotificationDeliveryJobs = async () => {
  if (deliveryWorkerRunning) return;
  deliveryWorkerRunning = true;
  try {
    await db.execute("UPDATE notification_delivery_jobs SET status = 'pending' WHERE status = 'processing' AND updated_at < datetime('now', '-10 minutes')");
    const jobs = await db.execute(`
      SELECT id, user_id, payload_json, attempts
      FROM notification_delivery_jobs
      WHERE status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP
      ORDER BY created_at ASC
      LIMIT 20
    `);

    for (const job of jobs.rows as any[]) {
      const claimed = await db.execute({
        sql: "UPDATE notification_delivery_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
        args: [job.id],
      });
      if (!claimed.rowsAffected) continue;

      try {
        await deliverExternalNotification(String(job.user_id), JSON.parse(String(job.payload_json)));
        await db.execute({
          sql: "UPDATE notification_delivery_jobs SET status = 'sent', updated_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?",
          args: [job.id],
        });
      } catch (error: any) {
        const attempts = Number(job.attempts || 0) + 1;
        const status = attempts >= 5 ? 'failed' : 'pending';
        const delayMinutes = Math.min(60, 2 ** attempts);
        await db.execute({
          sql: `UPDATE notification_delivery_jobs
                SET status = ?, attempts = ?, last_error = ?,
                    next_attempt_at = datetime('now', ?), updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          args: [status, attempts, String(error?.message || error).slice(0, 500), `+${delayMinutes} minutes`, job.id],
        });
      }
    }
  } catch (error) {
    console.error('[Notifications] Delivery worker failed:', error);
  } finally {
    deliveryWorkerRunning = false;
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
          return { success: true, expired: true };
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
