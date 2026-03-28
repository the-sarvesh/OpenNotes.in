import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { sendTelegramPreview } from '../utils/telegram.js';


const router = express.Router();

// All message routes require auth
router.use(authenticate);

// Helper to generate a consistent conversation ID between two users
const getConversationId = (userId1: string, userId2: string) => {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

// GET /api/messages/check/:receiverId/:listingId — check if order exists & convo started
router.get('/check/:receiverId/:listingId', async (req: AuthRequest, res, next) => {
  try {
    const senderId = req.user!.id;
    const { receiverId, listingId } = req.params;

    // 1. Check if an order exists
    const orderCheck = await db.execute({
      sql: `
        SELECT o.id 
        FROM orders o 
        JOIN order_items oi ON o.id = oi.order_id 
        WHERE oi.listing_id = ? 
          AND ((o.buyer_id = ? AND oi.seller_id = ?) OR (o.buyer_id = ? AND oi.seller_id = ?))
        LIMIT 1
      `,
      args: [listingId as string, senderId as string, receiverId as string, receiverId as string, senderId as string]
    });

    // 2. Check if a conversation ID exists in messages table
    const conversationId = getConversationId(senderId as string, receiverId as string);
    const convoCheck = await db.execute({
      sql: 'SELECT id FROM messages WHERE conversation_id = ? LIMIT 1',
      args: [conversationId as string]
    });

    res.json({
      canMessage: orderCheck.rows.length > 0,
      hasConversation: convoCheck.rows.length > 0,
      conversationId
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/messages/conversations — list all my conversations
router.get("/conversations", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const convos = await db.execute({
      sql: `
        SELECT m.conversation_id,
               MAX(m.created_at) as last_message_at,
               GROUP_CONCAT(DISTINCT l.id) as listing_ids,
               GROUP_CONCAT(DISTINCT l.title) as listing_titles,
               GROUP_CONCAT(DISTINCT l.image_url) as listing_images,
               CASE 
                 WHEN m.sender_id = ? THEN m.receiver_id 
                 ELSE m.sender_id 
               END as other_user_id,
               u.name as other_user_name,
               u.profile_image_url as other_user_profile_image,
               u.last_seen_at as other_user_last_seen,
               (SELECT COUNT(*) FROM messages m2 
                WHERE m2.conversation_id = m.conversation_id 
                  AND m2.receiver_id = ? 
                  AND m2.is_read = 0) as unread_count,
               (SELECT content FROM messages m3 
                WHERE m3.conversation_id = m.conversation_id 
                ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT sender_id FROM messages m4 
                WHERE m4.conversation_id = m.conversation_id 
                ORDER BY created_at DESC LIMIT 1) as last_sender_id,
               (SELECT COUNT(*) FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE ((o.buyer_id = m.sender_id AND oi.seller_id = m.receiver_id) 
                    OR (o.buyer_id = m.receiver_id AND oi.seller_id = m.sender_id))
                  AND oi.status NOT IN ('completed', 'cancelled')) as active_order_count
        FROM messages m
        JOIN listings l ON m.listing_id = l.id
        JOIN users u ON u.id = (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END)
        WHERE m.sender_id = ? OR m.receiver_id = ?
        GROUP BY m.conversation_id
        ORDER BY last_message_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [userId, userId, userId, userId, userId, limit, offset]
    });

    const results = convos.rows.map(convo => ({
      conversationId: convo.conversation_id,
      listingIds: String(convo.listing_ids || "").split(','),
      listingTitles: String(convo.listing_titles || "").split(','),
      listingImages: String(convo.listing_images || "").split(','),
      otherUserId: convo.other_user_id,
      otherUserName: String(convo.other_user_name || "User"),
      otherUserProfileImage: convo.other_user_profile_image,
      otherUserLastSeen: convo.other_user_last_seen || null,
      unreadCount: Number(convo.unread_count || 0),
      lastMessage: String(convo.last_message || ""),
      lastMessageAt: convo.last_message_at,
      lastMessageIsMe: convo.last_sender_id === userId,
      hasActiveOrder: Number(convo.active_order_count || 0) > 0
    }));

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /api/messages/unread/count — total unread count for badge
router.get('/unread/count', async (req: AuthRequest, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0',
      args: [req.user!.id]
    });
    res.json({ count: Number(result.rows[0]?.count || 0) });
  } catch (error) {
    next(error);
  }
});

// GET /api/messages/:conversationId — get messages in a conversation
router.get('/:conversationId', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    // Verify user is part of this conversation
    const check = await db.execute({
      sql: 'SELECT id FROM messages WHERE conversation_id = ? AND (sender_id = ? OR receiver_id = ?) LIMIT 1',
      args: [conversationId as string, userId as string, userId as string]
    });

    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'Not part of this conversation' });
    }

    // Mark messages as read
    await db.execute({
      sql: 'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ?',
      args: [conversationId as string, userId as string]
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('unread_count_changed');
    }

    const messages = await db.execute({
      sql: `
        SELECT m.id, m.conversation_id, m.sender_id, m.receiver_id, m.listing_id, 
               m.content, m.type, m.metadata, m.is_read, m.created_at, u.name as sender_name 
        FROM messages m 
        JOIN users u ON m.sender_id = u.id 
        WHERE m.conversation_id = ? 
        ORDER BY m.created_at ASC
      `,
      args: [conversationId as string]
    });

    res.json(messages.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/messages — send a message
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const senderId = req.user!.id;
    const { receiver_id, listing_id, content } = req.body;

    if (!receiver_id || !listing_id || !content?.trim()) {
      return res.status(400).json({ error: 'receiver_id, listing_id, and content are required' });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({ error: 'Message content matches maximum limit of 2000 characters' });
    }

    if (receiver_id === senderId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // NEW PREFERENCE: Verify that an active order exists between these two users for this listing
    // Active = status is NOT 'completed' and NOT 'cancelled'
    const orderCheck = await db.execute({
      sql: `
        SELECT oi.id 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id 
        WHERE oi.listing_id = ? 
          AND ((o.buyer_id = ? AND oi.seller_id = ?) OR (o.buyer_id = ? AND oi.seller_id = ?))
          AND oi.status NOT IN ('completed', 'cancelled')
        LIMIT 1
      `,
      args: [listing_id, senderId, receiver_id, receiver_id, senderId]
    });

    if (orderCheck.rows.length === 0) {
      return res.status(403).json({ error: 'This conversation is closed. You can only message if there is an active transaction.' });
    }

    const conversationId = getConversationId(senderId, receiver_id);
    const messageId = uuidv4();

    await db.execute({
      sql: `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, content) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [messageId, conversationId, senderId, receiver_id, listing_id, content.trim()]
    });

    // Notify receiver
    const senderRes = await db.execute({
      sql: 'SELECT name FROM users WHERE id = ?',
      args: [senderId]
    });
    const senderName = senderRes.rows[0]?.name || 'Someone';

    // ── In-app notification ──────────────────────────────────────────────────────
    await createNotification(
      receiver_id,
      'message',
      'New Message! 💬',
      `${senderName} sent you a message.`,
      '/messages',
      null,
      { conversationId, senderName, content: content.trim() }
    );

    // ── Socket.IO real-time broadcast ────────────────────────────────────────
    const io = req.app.get('io');
    if (io) {
      const messagePayload = {
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: receiver_id,
        listing_id: listing_id,
        sender_name: senderName,
        content: content.trim(),
        is_read: false,
        created_at: new Date().toISOString(),
      };

      // Broadcast to everyone in the conversation room
      io.to(`conv:${conversationId}`).emit('new_message', messagePayload);
      // Notify receiver to update unread badge
      io.to(`user:${receiver_id}`).emit('unread_count_changed');
    }

    // ── Telegram preview — fire-and-forget ─────────────────────────────────
    // Skip if receiver is actively viewing this conversation in real time
    const io2 = req.app.get('io');
    const convoRoom = io2?.sockets?.adapter?.rooms?.get(`conv:${conversationId}`);
    const receiverAlreadyOnline = convoRoom && convoRoom.size > 0;

    if (!receiverAlreadyOnline) {
      // Non-blocking: don't await so it never delays the HTTP response
      sendTelegramPreview(
        receiver_id as string,
        senderName as string,
        content.trim(),
        conversationId,
        listing_id ? String(listing_id) : undefined
      ).catch((err) => console.error('[Telegram] Preview fire-and-forget error:', err));
    }

    res.status(201).json({
      id: messageId,
      conversationId,
      message: 'Message sent'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
