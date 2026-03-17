import { Telegraf } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

let bot: Telegraf | null = null;

// Track state for multi-step interactions (e.g., entering PIN)
// Key: chatId, Value: { type: 'awaiting_pin', itemId: string }
const botState = new Map<string, any>();

export const initTelegramBot = () => {
  if (!botToken) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not found in environment. Telegram notifications will be disabled.');
    return;
  }

  bot = new Telegraf(botToken);

  // Handle /start command for deep linking
  bot.start(async (ctx) => {
    const payload = ctx.payload; // This is the token from /start <token>
    
    if (!payload || !payload.startsWith('tl-')) {
      return ctx.reply('Welcome to OpenNotes.in Bot! 👋\n\nTo link your account, please click the "Connect Telegram" button in your profile settings on the website.');
    }

    try {
      // Find user with this linking token
      const result = await db.execute({
        sql: 'SELECT id, name FROM users WHERE telegram_link_token = ?',
        args: [payload]
      });

      if (result.rows.length === 0) {
        return ctx.reply('❌ Invalid or expired linking token. Please generate a new one from your profile settings.');
      }

      const user = result.rows[0] as any;
      const chatId = ctx.chat.id.toString();

      // Link the chat ID and clear the token
      await db.execute({
        sql: 'UPDATE users SET telegram_chat_id = ?, telegram_link_token = NULL WHERE id = ?',
        args: [chatId, user.id]
      });

      return ctx.reply(`✅ Success! Your account (${user.name}) is now linked to Telegram. You will receive real-time order notifications and can manage them directly from here.`);
    } catch (err) {
      console.error('[Telegram] Linking error:', err);
      return ctx.reply('❌ An error occurred while linking your account. Please try again later.');
    }
  });

  // Handle Callback Queries (Buttons)
  bot.on('callback_query', async (ctx) => {
    const callbackData = (ctx.callbackQuery as any).data;
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    const [action, id] = callbackData.split(':');

    try {
      if (action === 'ord_det') {
        // Fetch detailed order info
        const result = await db.execute({
          sql: `SELECT oi.*, o.buyer_location, o.buyer_preferred_spot, o.buyer_availability, o.buyer_note, o.buyer_meetup_details, u.name as buyer_name, s.name as seller_name
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN users u ON o.buyer_id = u.id
                JOIN users s ON oi.seller_id = s.id
                WHERE oi.id = ?`,
          args: [id]
        });

        const item = result.rows[0] as any;
        if (!item) return ctx.answerCbQuery('Order not found.');

        const detailMsg = `📋 <b>Order Details: ${item.title}</b>\n\n` +
          `👤 <b>Buyer:</b> ${item.buyer_name}\n` +
          `👤 <b>Seller:</b> ${item.seller_name}\n` +
          `💰 <b>Total:</b> ₹${item.price_at_purchase * item.quantity}\n\n` +
          `📍 <b>Location:</b> ${item.buyer_location || 'BITS'}\n` +
          `📍 <b>Spot:</b> ${item.buyer_preferred_spot || 'Not specified'}\n` +
          `🕒 <b>Availability:</b> ${item.buyer_availability || 'Not specified'}\n` +
          (item.buyer_note ? `📝 <b>Note:</b> ${item.buyer_note}\n` : '') +
          (item.buyer_meetup_details ? `💬 <b>Meetup Info:</b> ${item.buyer_meetup_details}\n` : '');

        await ctx.reply(detailMsg, { parse_mode: 'HTML' });
        await ctx.answerCbQuery();
      } 
      else if (action === 'ack_ord') {
        const result = await db.execute({
          sql: `SELECT oi.*, u.name as buyer_name, s.name as seller_name FROM order_items oi 
                JOIN orders o ON oi.order_id = o.id 
                JOIN users u ON o.buyer_id = u.id 
                JOIN users s ON oi.seller_id = s.id 
                WHERE oi.id = ?`,
          args: [id]
        });
        const item = result.rows[0] as any;
        if (!item) return ctx.answerCbQuery('Order not found.');

        // Update DB
        await db.execute({
          sql: "UPDATE order_items SET status = 'acknowledged' WHERE id = ?",
          args: [id]
        });

        // Notify Buyer on website
        const { createNotification } = await import('./notifications.js');
        await createNotification(
          item.buyer_id,
          "order_update",
          "Order Acknowledged! ✅",
          `${item.seller_name} has acknowledged your purchase of "${item.title}".`,
          "/orders"
        );

        await ctx.reply('✅ Order acknowledged! Coordination can continue.');
        await ctx.answerCbQuery('Order Acknowledged');
      }
      else if (action === 'im_here') {
        const result = await db.execute({
          sql: `SELECT oi.seller_id, o.buyer_id, u.telegram_chat_id as buyer_chat, s.telegram_chat_id as seller_chat, u.name as buyer_name, s.name as seller_name
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN users u ON o.buyer_id = u.id
                JOIN users s ON oi.seller_id = s.id
                WHERE oi.id = ?`,
          args: [id]
        });

        const item = result.rows[0] as any;
        if (!item) return ctx.answerCbQuery('Order not found.');

        const userRes = await db.execute({
          sql: 'SELECT id, name FROM users WHERE telegram_chat_id = ?',
          args: [chatId]
        });
        const sender = userRes.rows[0] as any;
        
        const isBuyer = sender.id === item.buyer_id;
        const targetChatId = isBuyer ? item.seller_chat : item.buyer_chat;
        const targetUserId = isBuyer ? item.seller_id : item.buyer_id;
        const targetName = isBuyer ? item.seller_name : item.buyer_name;

        // Notify via Telegram
        if (targetChatId) {
          await sendTelegramMessage(targetChatId, `📍 <b>Arrived!</b>\n\n${sender.name} has arrived at the meetup spot.`);
        }

        // Notify via Website
        const { createNotification } = await import('./notifications.js');
        await createNotification(
          targetUserId,
          'meetup_update',
          'Arrived! 📍',
          `${sender.name} has signaled they are at the meetup spot.`,
          '/messages'
        );

        await ctx.reply(`✅ Notified ${targetName} that you've arrived.`);
        await ctx.answerCbQuery('Sent arrival alert');
      }
      else if (action === 'msg_reply') {
        botState.set(chatId, { type: 'awaiting_reply', convoId: id });
        await ctx.reply('✍️ Type your reply below:');
        await ctx.answerCbQuery();
      }
      else if (action === 'show_pin') {
        const result = await db.execute({
          sql: 'SELECT meetup_pin FROM order_items WHERE id = ?',
          args: [id]
        });
        const pin = (result.rows[0] as any)?.meetup_pin;
        if (pin) {
          await ctx.reply(`🔑 Your Exchange PIN: <code>${pin}</code>\n\nShare this with the seller at the meetup.`, { parse_mode: 'HTML' });
        }
        await ctx.answerCbQuery();
      }
      else if (action === 'enter_pin') {
        botState.set(chatId, { type: 'awaiting_pin', itemId: id });
        await ctx.reply('⌨️ Please type the 4-digit PIN provided by the buyer:');
        await ctx.answerCbQuery();
      }
    } catch (err) {
      console.error('[Telegram] Interaction error:', err);
      await ctx.answerCbQuery('An error occurred.');
    }
  });

  // Handle Text Messages (for PIN entry and Chat Replies)
  bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const state = botState.get(chatId);
    if (!state) return;

    const text = ctx.message.text;

    if (state.type === 'awaiting_pin') {
      const pin = text.trim();
      if (!/^\d{4}$/.test(pin)) {
        return ctx.reply('❌ Invalid format. Please enter a 4-digit PIN:');
      }

      try {
        const res = await fetch(`${process.env.BACKEND_URL || 'http://localhost:5000'}/api/orders/items/${state.itemId}/verify-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        
        const data = await res.json() as any;
        if (res.ok) {
          botState.delete(chatId);
          return ctx.reply(`✅ PIN Verified! Order completed successfully.`);
        } else {
          return ctx.reply(`❌ Verification failed: ${data.error || 'Incorrect PIN'}. Please try again:`);
        }
      } catch (err) {
        console.error('[Telegram] PIN verification error:', err);
        return ctx.reply('❌ An error occurred.');
      }
    }

    if (state.type === 'awaiting_reply') {
      try {
        const userRes = await db.execute({
          sql: 'SELECT id, name FROM users WHERE telegram_chat_id = ?',
          args: [chatId]
        });
        const user = userRes.rows[0] as any;
        const userId = user?.id;
        
        const [u1, u2] = state.convoId.split('_');
        const receiverId = u1 === userId ? u2 : u1;

        const msgRes = await db.execute({
          sql: 'SELECT listing_id FROM messages WHERE conversation_id = ? LIMIT 1',
          args: [state.convoId]
        });
        const listingId = msgRes.rows[0]?.listing_id;

        if (userId && receiverId && listingId) {
          const messageId = uuidv4();
          await db.execute({
            sql: `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, content) 
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [messageId, state.convoId, userId, receiverId, listingId, text.trim()]
          });

          // Emit to Socket.IO
          const { io } = await import('../socket.js');
          if (io) {
            io.to(`conv:${state.convoId}`).emit('new_message', {
              id: messageId,
              conversation_id: state.convoId,
              sender_id: userId,
              receiver_id: receiverId,
              listing_id: listingId,
              sender_name: user.name,
              content: text.trim(),
              is_read: false,
              created_at: new Date().toISOString()
            });
            io.to(`user:${receiverId}`).emit('unread_count_changed');
          }

          // Trigger internal notification for receiver
          const { createNotification } = await import('./notifications.js');
          await createNotification(
            receiverId,
            'message',
            'New Message! 💬',
            `${user.name} sent you a message.`,
            '/messages',
            null,
            { conversationId: state.convoId, senderName: user.name, content: text.trim() }
          );
          
          botState.delete(chatId);
          return ctx.reply('✅ Reply sent!');
        }
      } catch (err) {
        console.error('[Telegram] Reply error:', err);
        return ctx.reply('❌ Failed to send reply.');
      }
    }
  });

  // Commands
  bot.command('sales', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    try {
      const userRes = await db.execute({
        sql: 'SELECT id FROM users WHERE telegram_chat_id = ?',
        args: [chatId]
      });
      const userId = userRes.rows[0]?.id;
      if (!userId) return ctx.reply('Please link your account first using /start.');

      const salesRes = await db.execute({
        sql: `SELECT COUNT(*) as count, SUM(price_at_purchase * quantity) as revenue 
              FROM order_items 
              WHERE seller_id = ? AND status = 'completed'`,
        args: [userId]
      });
      const sales = salesRes.rows[0] as any;

      return ctx.reply(`📊 <b>Your Sales Summary</b>\n\n✅ <b>Completed Sales:</b> ${sales.count || 0}\n💰 <b>Total Earnings:</b> ₹${sales.revenue || 0}`, { parse_mode: 'HTML' });
    } catch (err) {
      return ctx.reply('Error fetching sales info.');
    }
  });

  bot.command('balance', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    try {
      const userRes = await db.execute({
        sql: 'SELECT balance FROM users WHERE telegram_chat_id = ?',
        args: [chatId]
      });
      const balance = userRes.rows[0] as any;
      if (!balance) return ctx.reply('Please link your account first using /start.');

      return ctx.reply(`💳 <b>Your Current Balance</b>\n\n₹<b>${balance.balance || 0}</b>`, { parse_mode: 'HTML' });
    } catch (err) {
      return ctx.reply('Error fetching balance.');
    }
  });

  // NOTE: In production (Railway), we use webhooks. In local dev, we use polling.
  const appUrl = process.env.BACKEND_URL;
  if (!appUrl || !appUrl.startsWith('https://')) {
    bot.launch().then(() => {
      console.log('[Telegram] Bot started in polling mode (Local Development)');
    }).catch(err => {
      console.error('[Telegram] Failed to start bot in polling mode:', err);
    });
  }
};

export const getBot = () => bot;

/**
 * Send a message to a user via Telegram
 */
export const sendTelegramMessage = async (chatId: string, text: string, reply_markup?: any) => {
  if (!botToken) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup,
        disable_web_page_preview: true
      }),
    });
    const data = await res.json() as any;
    return data.ok;
  } catch (err) {
    console.error(`[Telegram] Failed to send message to chat ${chatId}:`, err);
    return false;
  }
};

const formatOrderDetails = (item: string, price: string | number, qty: string | number, otherParty: string, role: 'Buyer' | 'Seller') => {
  return `📦 <b>Item:</b> ${item}\n💰 <b>Price:</b> ₹${price} x ${qty}\n👤 <b>${role === 'Seller' ? 'Buyer' : 'Seller'}:</b> ${otherParty}`;
};

const formatMeetupCard = (location: string, spot: string, availability: string, note?: string) => {
  return `\n📍 <b>Location:</b> ${location || 'BITS'}\n📍 <b>Spot:</b> ${spot || 'Not specified'}\n🕒 <b>Availability:</b> ${availability}\n${note ? `📝 <b>Note:</b> ${note}\n` : ''}`;
};

export const telegramTemplates = {
  orderPlaced: (name: string, item: string, price: number, qty: number, sellerName: string, pin: string, itemId: string, meetup: any) => ({
    text: `🆕 <b>Order Placed</b>\n\nHi <b>${name}</b>, your order is pending confirmation.\n\n${formatOrderDetails(item, price, qty, sellerName, 'Buyer')}\n${formatMeetupCard(meetup.location, meetup.spot, meetup.availability, meetup.note)}\n<i>Coordinate the meetup via chat once acknowledged.</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔑 Show PIN', callback_data: `show_pin:${itemId}` },
          { text: '📍 I\'m Here', callback_data: `im_here:${itemId}` }
        ],
        [{ text: '📋 View All Details', callback_data: `ord_det:${itemId}` }],
        [{ text: '🌐 Open Website', url: 'https://open-notes-in-client.vercel.app/' }]
      ]
    }
  }),
  
  newOrder: (name: string, item: string, price: number, qty: number, buyerName: string, itemId: string, meetup: any) => ({
    text: `🔔 <b>New Order Received!</b>\n\nHi <b>${name}</b>, you have a new request.\n\n${formatOrderDetails(item, price, qty, buyerName, 'Seller')}\n${formatMeetupCard(meetup.location, meetup.spot, meetup.availability, meetup.note)}\n📨 <i>Coordinate the meetup via chat.</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Acknowledge', callback_data: `ack_ord:${itemId}` },
          { text: '⌨️ Enter PIN', callback_data: `enter_pin:${itemId}` }
        ],
        [{ text: '📍 I\'m Here', callback_data: `im_here:${itemId}` }],
        [{ text: '📋 View All Details', callback_data: `ord_det:${itemId}` }]
      ]
    }
  }),
  
  orderAcknowledged: (name: string, item: string, price: number, qty: number, role: 'Buyer' | 'Seller', otherParty: string, itemId: string) => ({
    text: `✅ <b>Meetup Confirmed</b>\n\nHi <b>${name}</b>, the ${role === 'Seller' ? 'buyer' : 'seller'} (${otherParty}) is ready.\n\n${formatOrderDetails(item, price, qty, otherParty, role === 'Seller' ? 'Seller' : 'Buyer')}\n\n🤝 <i>Meetup is now in progress.</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📍 I\'m Here', callback_data: `im_here:${itemId}` },
          { text: role === 'Seller' ? '⌨️ Enter PIN' : '🔑 Show PIN', callback_data: role === 'Seller' ? `enter_pin:${itemId}` : `show_pin:${itemId}` }
        ],
        [{ text: '🌐 Open Chat', url: 'https://open-notes-in-client.vercel.app/messages' }]
      ]
    }
  }),

  orderCompleted: (name: string, item: string, price: number, qty: number, role: 'Buyer' | 'Seller', otherParty: string) =>
    `🎉 <b>Exchange Completed!</b>\n\nHi <b>${name}</b>, the exchange was successful.\n\n${formatOrderDetails(item, price, qty, otherParty, role === 'Seller' ? 'Seller' : 'Buyer')}\n\n${role === 'Seller' ? '✅ Earnings added to your balance.' : '✅ Purchase confirmed.'}\n\n<a href="https://open-notes-in-client.vercel.app/">Open OpenNotes.in →</a>`,

  newMessage: (name: string, senderName: string, content: string, convoId: string) => ({
    text: `💬 <b>New Message from ${senderName}</b>\n\n"${content}"`,
    reply_markup: {
      inline_keyboard: [
        [{ text: '✍️ Quick Reply', callback_data: `msg_reply:${convoId}` }],
        [{ text: '🌐 View in App', url: `https://open-notes-in-client.vercel.app/messages` }]
      ]
    }
  }),

  generic: (title: string, message: string, linkUrl?: string) => 
    `<b>${title}</b>\n\n${message}${linkUrl ? `\n\n<a href="${linkUrl}">Open in OpenNotes →</a>` : '\n\n<a href="https://open-notes-in-client.vercel.app/">Open OpenNotes.in →</a>'}`
};
