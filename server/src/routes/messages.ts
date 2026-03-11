import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// All message routes require auth
router.use(authenticate);

// Helper to generate a consistent conversation ID between two users about a listing
const getConversationId = (userId1: string, userId2: string, listingId: string) => {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}_${listingId}`;
};

// GET /api/messages/check/:receiverId/:listingId — check if order exists & convo started
router.get('/check/:receiverId/:listingId', async (req: AuthRequest, res) => {
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
    const conversationId = getConversationId(senderId as string, receiverId as string, listingId as string);
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages/conversations — list all my conversations
router.get('/conversations', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const convos = await db.execute({
      sql: `
        SELECT m.conversation_id, m.listing_id,
               MAX(m.created_at) as last_message_at,
               l.title as listing_title, l.image_url as listing_image,
               CASE 
                 WHEN m.sender_id = ? THEN m.receiver_id 
                 ELSE m.sender_id 
               END as other_user_id
        FROM messages m
        JOIN listings l ON m.listing_id = l.id
        WHERE m.sender_id = ? OR m.receiver_id = ?
        GROUP BY m.conversation_id
        ORDER BY last_message_at DESC
      `,
      args: [userId, userId, userId]
    });

    // Get other user names and unread counts
    const results = [];
    for (const convo of convos.rows) {
      const otherUser = await db.execute({
        sql: 'SELECT name FROM users WHERE id = ?',
        args: [convo.other_user_id]
      });

      const unread = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0',
        args: [convo.conversation_id, userId]
      });

      const lastMsg = await db.execute({
        sql: 'SELECT content, sender_id FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        args: [convo.conversation_id]
      });

      results.push({
        conversationId: convo.conversation_id,
        listingId: convo.listing_id,
        listingTitle: convo.listing_title,
        listingImage: convo.listing_image,
        otherUserId: convo.other_user_id,
        otherUserName: otherUser.rows[0]?.name || 'Unknown',
        unreadCount: Number(unread.rows[0]?.count || 0),
        lastMessage: lastMsg.rows[0]?.content || '',
        lastMessageIsMe: lastMsg.rows[0]?.sender_id === userId,
        lastMessageAt: convo.last_message_at,
      });
    }

    res.json(results);
  } catch (error) {
    console.error('Conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages/:conversationId — get messages in a conversation
router.get('/:conversationId', async (req: AuthRequest, res) => {
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

    const messages = await db.execute({
      sql: `
        SELECT m.*, u.name as sender_name 
        FROM messages m 
        JOIN users u ON m.sender_id = u.id 
        WHERE m.conversation_id = ? 
        ORDER BY m.created_at ASC
      `,
      args: [conversationId as string]
    });

    res.json(messages.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages — send a message
router.post('/', async (req: AuthRequest, res) => {
  try {
    const senderId = req.user!.id;
    const { receiver_id, listing_id, content } = req.body;

    if (!receiver_id || !listing_id || !content?.trim()) {
      return res.status(400).json({ error: 'receiver_id, listing_id, and content are required' });
    }

    if (receiver_id === senderId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // NEW PREFERENCE: Verify that an order exists between these two users for this listing
    const orderCheck = await db.execute({
      sql: `
        SELECT o.id 
        FROM orders o 
        JOIN order_items oi ON o.id = oi.order_id 
        WHERE oi.listing_id = ? 
          AND ((o.buyer_id = ? AND oi.seller_id = ?) OR (o.buyer_id = ? AND oi.seller_id = ?))
        LIMIT 1
      `,
      args: [listing_id, senderId, receiver_id, receiver_id, senderId]
    });

    if (orderCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You can only message users after purchasing their item' });
    }

    const conversationId = getConversationId(senderId, receiver_id, listing_id);
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

    await createNotification(
      receiver_id,
      'message',
      'New Message! 💬',
      `${senderName} sent you a message.`,
      '/messages'
    );

    res.status(201).json({ 
      id: messageId, 
      conversationId,
      message: 'Message sent' 
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET /api/messages/unread/count — total unread count for badge
router.get('/unread/count', async (req: AuthRequest, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0',
      args: [req.user!.id]
    });
    res.json({ count: Number(result.rows[0]?.count || 0) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
