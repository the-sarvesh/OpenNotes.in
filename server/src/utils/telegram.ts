import { Telegraf } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

let bot: Telegraf | null = null;

// Track state for multi-step interactions (e.g., entering PIN)
// Key: chatId, Value: { type: 'awaiting_pin', itemId: string }
const botState = new Map<string, any>();

// Per-conversation Telegram message cooldown (prevents spam on rapid messages)
// Key: conversationId, Value: last notification timestamp (ms)
const telegramMsgCooldowns = new Map<string, number>();
const _rawCooldown = parseInt(process.env.TELEGRAM_MSG_COOLDOWN_MS ?? '', 10);
const TELEGRAM_MSG_COOLDOWN_MS: number =
  Number.isFinite(_rawCooldown) && _rawCooldown >= 0
    ? _rawCooldown
    : 30_000;
if (process.env.TELEGRAM_MSG_COOLDOWN_MS && !Number.isFinite(_rawCooldown)) {
  console.warn('[Telegram] Invalid TELEGRAM_MSG_COOLDOWN_MS env value — falling back to 30000ms');
}

// Helper to generate a consistent conversation ID between two users
const getConversationId = (userId1: string, userId2: string) => {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

export const initTelegramBot = () => {
  if (!botToken) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not found in environment. Telegram notifications will be disabled.');
    return;
  }

  bot = new Telegraf(botToken);

  // Handle /start command for deep linking
  bot.start(async (ctx) => {
    // In Telegraf v4, the deep-link payload is typically in ctx.startPayload
    const payload = ctx.startPayload || (ctx as any).payload || '';
    const fromId = ctx.from?.id.toString();
    
    console.info(`[Telegram] Start received. Raw Payload: "${payload}", From ID: ${fromId}`);

    if (!payload || !payload.startsWith('tl-')) {
      return ctx.reply('Welcome to OpenNotes.in Bot! 👋\n\nTo link your account, please click the "Connect Telegram" button in your profile settings on the website.');
    }

    if (!fromId) {
      return ctx.reply('❌ Error: Could not identify your Telegram account ID.');
    }

    try {
      // Find user with this linking token
      const result = await db.execute({
        sql: 'SELECT id, name, telegram_chat_id FROM users WHERE telegram_link_token = ?',
        args: [payload]
      });

      if (result.rows.length === 0) {
        // This usually happens if:
        // 1. The token actually expired/was used.
        // 2. A local dev server (polling) stole the webhook message but checks a local DB.
        console.warn(`[Telegram] Invalid/Expired token attempt: "${payload}" from ID ${fromId}. Ensure no local dev servers are polling!`);
        return ctx.reply(`❌ Invalid or expired linking token.\n\nToken received: ${payload}\n\nPlease generate a new one from your profile settings on the website.`);
      }

      const user = result.rows[0] as any;

      // Link the fromId and clear the token
      await db.execute({
        sql: 'UPDATE users SET telegram_chat_id = ?, telegram_link_token = NULL WHERE id = ?',
        args: [fromId, user.id]
      });

      console.info(`[Telegram] Linked user ${user.name} (ID: ${user.id}) to Telegram: ${fromId}`);
      return ctx.reply(`✅ Success! Your account (${user.name}) is now linked to Telegram ID: ${fromId}.\n\nYou'll now receive real-time updates for orders and messages!`);
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
        await ctx.answerCbQuery();
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
        if (!item) return; // Already answered

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
      } 
      else if (action === 'ack_ord') {
        await ctx.answerCbQuery('Acknowledging Order...');
        const itemRes = await db.execute({
          sql: `SELECT oi.*, 
                       o.total_amount, o.platform_fee,
                       o.buyer_id, o.buyer_location, o.buyer_preferred_spot, o.buyer_availability, o.buyer_note, o.buyer_meetup_details,
                       u.name as buyer_name, u.telegram_chat_id as buyer_chat,
                       s.id as seller_id, s.name as seller_name, s.telegram_chat_id as seller_chat
                FROM order_items oi 
                JOIN orders o ON oi.order_id = o.id 
                JOIN users u ON o.buyer_id = u.id 
                JOIN users s ON oi.seller_id = s.id 
                WHERE oi.id = ?`,
          args: [id]
        });
        const item = itemRes.rows[0] as any;
        if (!item) return; // Already answered

        if (item.status !== "pending_meetup") {
          return await ctx.reply(`❌ Order is already ${item.status}`);
        }

        // Update DB
        await db.execute({
          sql: "UPDATE order_items SET status = 'acknowledged' WHERE id = ?",
          args: [id]
        });

        // Update chat metadata
        const convoId = getConversationId(item.buyer_id as string, item.seller_id as string);
        const msgRes = await db.execute({
          sql: "SELECT id, metadata FROM messages WHERE conversation_id = ? AND type = 'purchase_notice'",
          args: [convoId]
        });

        for (const row of msgRes.rows as any[]) {
          const meta = JSON.parse(row.metadata || '{}');
          if (meta.orderItemId === id) {
            meta.status = 'acknowledged';
            await db.execute({
              sql: "UPDATE messages SET metadata = ? WHERE id = ?",
              args: [JSON.stringify(meta), row.id]
            });
            
            const { io } = await import('../socket.js');
            if (io) {
              io.to(`conv:${convoId}`).emit("meetup_status_changed", { 
                proposalId: id,
                status: 'acknowledged', 
                messageId: row.id 
              });
            }
            break;
          }
        }

        // Notify Buyer on website
        const { createNotification } = await import('./notifications.js');
        await createNotification(
          item.buyer_id,
          "order_update",
          "Order Acknowledged! ✅",
          `${item.seller_name} has acknowledged your purchase of "${item.title}".`,
          "/orders"
        );

        // Notify via Telegram (Buyer & Seller)
        try {
          const meetupObj = {
            location: item.buyer_location,
            spot: item.buyer_preferred_spot,
            availability: item.buyer_availability,
            note: item.buyer_note,
            details: item.buyer_meetup_details
          };

          const itemSubtotal = item.price_at_purchase * item.quantity;
          const orderTotal = item.total_amount || itemSubtotal;
          const orderFee = item.platform_fee || 0;
          const itemFee = orderTotal > 0 ? Math.round((itemSubtotal / orderTotal) * orderFee) : 0;

          if (item.buyer_chat) {
            const template = telegramTemplates.orderAcknowledged(item.buyer_name, item.title, item.price_at_purchase, item.quantity, 'Buyer', item.seller_name, id, meetupObj, itemSubtotal, itemFee);
            await sendTelegramMessage(item.buyer_chat, template.text, template.reply_markup);
          }
          if (item.seller_chat) {
            const template = telegramTemplates.orderAcknowledged(item.seller_name, item.title, item.price_at_purchase, item.quantity, 'Seller', item.buyer_name, id, meetupObj, itemSubtotal, itemFee);
            await sendTelegramMessage(item.seller_chat, template.text, template.reply_markup);
          }
        } catch (tgErr) {
          console.error('[Telegram] Acknowledge notification failed:', tgErr);
        }

        await ctx.reply('✅ Order acknowledged! Coordination details sent to the buyer.');
      }
      else if (action === 'im_here') {
        try {
          await ctx.answerCbQuery();
          
          if (!id) {
            return await ctx.reply('❌ Error: Missing order identification in button data.');
          }

          const result = await db.execute({
            sql: `SELECT oi.id, oi.seller_id, oi.status, oi.meetup_signal_count, o.buyer_id, u.telegram_chat_id as buyer_chat, s.telegram_chat_id as seller_chat, u.name as buyer_name, s.name as seller_name
                  FROM order_items oi
                  JOIN orders o ON oi.order_id = o.id
                  JOIN users u ON o.buyer_id = u.id
                  JOIN users s ON oi.seller_id = s.id
                  WHERE oi.id = ?`,
            args: [id]
          });

          const item = result.rows[0] as any;
          if (!item) {
            console.error(`[Telegram] Order item not found for im_here ID: ${id}`);
            return await ctx.reply('❌ Error: This order session could not be found or has expired.');
          }

          if (item.status === 'completed' || item.status === 'cancelled') {
            return await ctx.reply('❌ This transaction is already closed.');
          }

          // Important: Link via 'from.id' instead of 'chat.id' to be more reliable in callbacks
          const effectiveChatId = ctx.from?.id.toString() || chatId;
          const userRes = await db.execute({
            sql: 'SELECT id, name FROM users WHERE telegram_chat_id = ?',
            args: [effectiveChatId]
          });
          const sender = userRes.rows[0] as any;
          if (!sender) {
            console.warn(`[Telegram] Sender not found for effectiveChatId: ${effectiveChatId}`);
            return await ctx.reply(`❌ Your account (${effectiveChatId}) is not linked to your OpenNotes profile. Please click "Connect Telegram" in your website profile settings.`);
          }

          // Limit "I'm here" signals to 3
          if (item.meetup_signal_count >= 3) {
            return await ctx.reply('⚠️ Signaling Limit Reached: You\'ve already notified the other party 3 times. Please coordinate via the message section on the site.');
          }

          const isBuyer = sender.id === item.buyer_id;
          const targetChatId = isBuyer ? item.seller_chat : item.buyer_chat;
          const targetUserId = isBuyer ? item.seller_id : item.buyer_id;
          const targetName = isBuyer ? item.seller_name : item.buyer_name;

          // Increment signal count
          await db.execute({
            sql: 'UPDATE order_items SET meetup_signal_count = meetup_signal_count + 1, last_meetup_signal_at = CURRENT_TIMESTAMP WHERE id = ?',
            args: [id]
          });

          // Notify via Telegram if they have it linked
          let tgOk = false;
          if (targetChatId) {
            tgOk = await sendTelegramMessage(targetChatId, `📍 <b>Arrival Alert!</b>\n\n<b>${sender.name}</b> has arrived at the meetup spot.`);
          }

          // Notify via Website
          try {
            const { createNotification } = await import('./notifications.js');
            await createNotification(
              targetUserId,
              'meetup_update',
              'Arrived! 📍',
              `${sender.name} has signaled they are at the meetup spot.`,
              '/messages'
            );
          } catch (notifErr) {
            console.error('[Telegram] App notification failed but continuing:', notifErr);
          }

          await ctx.reply(`✅ Signal Sent! ${targetName} has been notified on ${tgOk ? 'Telegram and the Website' : 'the Website'}. (Signal ${item.meetup_signal_count + 1}/3)`);
        } catch (err: any) {
          console.error('[Telegram] im_here handler failure:', err);
          await ctx.reply(`❌ Operation failed: ${err.message || 'Unknown error'}. Please use the website chat to communicate.`);
        }
      }
      else if (action === 'msg_reply') {
        await ctx.answerCbQuery();
        botState.set(chatId, { type: 'awaiting_reply', convoId: id });
        await ctx.reply('✍️ Type your reply below:');
      }
      else if (action === 'show_pin') {
        const stateKey = `pin_${chatId}_${id}`;
        const queryTracker = botState.get(stateKey) || { count: 0, lastAt: 0 };
        const now = Date.now();

        if (queryTracker.count >= 3) {
          return await ctx.answerCbQuery('Limit reached (3/3). Please view your PIN securely on the OpenNotes website.', { show_alert: true });
        }

        if (now - queryTracker.lastAt < 30000) {
          return await ctx.answerCbQuery('Please wait 30 seconds before requesting again.', { show_alert: true });
        }

        await ctx.answerCbQuery();
        const result = await db.execute({
          sql: 'SELECT meetup_pin, status FROM order_items WHERE id = ?',
          args: [id]
        });
        const item = result.rows[0] as any;
        if (item?.status === 'completed' || item?.status === 'cancelled') {
          return await ctx.reply('❌ Transaction closed.');
        }

        if (item?.meetup_pin) {
          queryTracker.count += 1;
          queryTracker.lastAt = now;
          botState.set(stateKey, queryTracker);
          await ctx.reply(`🔑 Your Exchange PIN: <code>${item.meetup_pin}</code>\n\nShare this with the seller at the meetup.\n\n<i>(Viewed ${queryTracker.count}/3 times)</i>`, { parse_mode: 'HTML' });
        }
      }
      else if (action === 'enter_pin') {
        await ctx.answerCbQuery();
        const result = await db.execute({
          sql: 'SELECT pin_attempts, last_pin_attempt_at FROM order_items WHERE id = ?',
          args: [id]
        });
        const item = result.rows[0] as any;

        if (item?.pin_attempts >= 3) {
          const lastAttempt = new Date(item.last_pin_attempt_at).getTime();
          const now = Date.now();
          const diffMinutes = (now - lastAttempt) / (1000 * 60);

          if (diffMinutes < 30) {
            return await ctx.reply(`❌ <b>Secure Verification Locked</b>\n\nIncorrect PIN 3 times. Telegram verification is locked for <b>${Math.ceil(30 - diffMinutes)} more minutes</b> to prevent spam.\n\nYou can still verify this PIN on the <a href="${process.env.FRONTEND_URL || 'https://opennotes.in'}/profile">Sales Dashboard</a> right now. Please check the 4-digit PIN with the buyer.`, { parse_mode: 'HTML' });
          }
        }

        botState.set(chatId, { type: 'awaiting_pin', itemId: id });
        await ctx.reply('⌨️ Please type the 4-digit PIN provided by the buyer:');
      }
    } catch (err) {
      console.error('[Telegram] Interaction error:', err);
      try { await ctx.answerCbQuery('An error occurred.'); } catch(e) {}
    }
  });

  // Handle Text Messages (for PIN entry and Chat Replies)
  bot.on('text', async (ctx, next) => {
    const chatId = ctx.chat.id.toString();
    const state = botState.get(chatId);
    if (!state) return next();

    const text = ctx.message.text.trim();

    if (state.type === 'awaiting_pin') {
      // Lenient validation: find the first 4-digit number
      const digitsMatch = text.match(/\d{4}/);
      if (!digitsMatch) {
        return ctx.reply('❌ Invalid format. Please enter a 4-digit PIN (e.g., 1234):');
      }
      const pin = digitsMatch[0];

      try {
        const itemRes = await db.execute({
          sql: `SELECT oi.*, l.title, o.buyer_id, o.id as order_id 
                FROM order_items oi 
                JOIN listings l ON oi.listing_id = l.id 
                JOIN orders o ON oi.order_id = o.id
                WHERE oi.id = ?`,
          args: [state.itemId]
        });
        const item = itemRes.rows[0] as any;

        if (!item) return ctx.reply('❌ Order item not found.');

        if (item.status === 'completed' || item.status === 'cancelled') {
          botState.delete(chatId);
          return ctx.reply('❌ This order is already finalized.');
        }

        if (item.meetup_pin !== pin) {
          const newAttempts = (item.pin_attempts || 0) + 1;
          await db.execute({
            sql: "UPDATE order_items SET pin_attempts = ?, last_pin_attempt_at = CURRENT_TIMESTAMP WHERE id = ?",
            args: [newAttempts, state.itemId]
          });

          if (newAttempts >= 3) {
            botState.delete(chatId);
            return ctx.reply(`❌ <b>Verification Final Lockout</b>\n\nIncorrect PIN 3 times. This interactive session has ended. Telegram verification is locked for 30 minutes.\n\nUse the <a href="${process.env.FRONTEND_URL || 'https://opennotes.in'}/profile">Website Dashboard</a> to verify if you have the correct PIN from the buyer.`, { parse_mode: 'HTML' });
          }

          return ctx.reply(`❌ Incorrect PIN (Attempt ${newAttempts}/3). Please ask the buyer to show their PIN and try again:`);
        }

        // Mark as completed
        await db.execute({
          sql: "UPDATE order_items SET status = 'completed', pin_attempts = 0 WHERE id = ?",
          args: [state.itemId]
        });

        // Update chat metadata
        const convoId = getConversationId(item.buyer_id as string, item.seller_id as string);
        const msgRes = await db.execute({
          sql: "SELECT id, metadata FROM messages WHERE conversation_id = ? AND type = 'purchase_notice'",
          args: [convoId]
        });

        for (const row of msgRes.rows as any[]) {
          const meta = JSON.parse(row.metadata || '{}');
          if (meta.orderItemId === state.itemId) {
            meta.status = 'completed';
            await db.execute({
              sql: "UPDATE messages SET metadata = ? WHERE id = ?",
              args: [JSON.stringify(meta), row.id]
            });
            
            const { io } = await import('../socket.js');
            if (io) {
              io.to(`conv:${convoId}`).emit("meetup_status_changed", { 
                proposalId: state.itemId,
                status: 'completed', 
                messageId: row.id 
              });
            }
            break;
          }
        }

        // Check if entire order is complete
        const allItems = await db.execute({
          sql: "SELECT status FROM order_items WHERE order_id = ?",
          args: [item.order_id]
        });
        const allCompleted = (allItems.rows as any[]).every(r => r.status === 'completed');
        if (allCompleted) {
          await db.execute({
            sql: "UPDATE orders SET status = 'completed' WHERE id = ?",
            args: [item.order_id]
          });
        }

        // Trigger notifications
        const { createNotification } = await import('./notifications.js');
        await createNotification(
          item.buyer_id,
          "order_update",
          "Exchange Completed! ✅",
          `"${item.title}" has been handed over. ${allCompleted ? "Your full order is now complete!" : "Waiting for remaining items."}`,
          "/orders"
        );

        botState.delete(chatId);
        return ctx.reply(`✅ PIN Verified! Order completed successfully. ${allCompleted ? 'The entire order is now complete.' : ''}`);
      } catch (err) {
        console.error('[Telegram] PIN verification error:', err);
        return ctx.reply('❌ An error occurred during verification.');
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
          // Check for active order before sending
          const activeOrder = await db.execute({
            sql: `SELECT oi.id FROM order_items oi
                  JOIN orders o ON o.id = oi.order_id
                  WHERE ((o.buyer_id = ? AND oi.seller_id = ?) OR (o.buyer_id = ? AND oi.seller_id = ?))
                    AND oi.listing_id = ?
                    AND oi.status NOT IN ('completed', 'cancelled')
                  LIMIT 1`,
            args: [userId, receiverId, receiverId, userId, listingId]
          });

          if (activeOrder.rows.length === 0) {
            botState.delete(chatId);
            return ctx.reply('❌ This conversation is closed because the transaction is complete or cancelled.');
          }

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
      const user = userRes.rows[0] as any;
      if (!user) return ctx.reply('Please link your account first using /start.');

      return ctx.reply(`💳 <b>Your Current Balance</b>\n\n₹<b>${user.balance || 0}</b>`, { parse_mode: 'HTML' });
    } catch (err) {
      return ctx.reply('Error fetching balance.');
    }
  });

  // Registration (Webhook or Polling) is now handled centrally in index.ts
  // to avoid redundant calls and conflicts between the two mechanisms.
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

const formatOrderDetails = (item: string, price: string | number, qty: string | number, otherParty: string, role: 'Buyer' | 'Seller', total: number, platformFee: number) => {
  const priceDisplay = Number(price) === 0 ? 'FREE' : `₹${price}`;
  const cashAmount = Math.round(total - platformFee);
  
  let details = `📦 <b>Item:</b> ${item}\n💰 <b>Price:</b> ${priceDisplay} x ${qty}\n👤 <b>${role === 'Seller' ? 'Buyer' : 'Seller'}:</b> ${otherParty}\n\n`;
  
  if (role === 'Buyer') {
    details += `💰 <b>Total Bill:</b> ₹${Math.round(total)}\n`;
    details += `📱 <b>Paid Online:</b> ₹${Math.round(platformFee)}\n`;
    details += `💵 <b>Cash to Pay Seller:</b> ₹${cashAmount}`;
  } else {
    details += `💰 <b>Total Sale:</b> ₹${Math.round(total)}\n`;
    details += `💵 <b>Cash to Collect:</b> ₹${cashAmount}`;
  }
  
  return details;
};

const formatMeetupCard = (location: string, spot: string, availability: string, note?: string, details?: string) => {
  let card = `\n📍 <b>Location:</b> ${location || 'BITS'}\n📍 <b>Spot:</b> ${spot || 'Not specified'}\n🕒 <b>Availability:</b> ${availability}`;
  if (note) card += `\n📝 <b>Note:</b> ${note}`;
  if (details) card += `\nℹ️ <b>Instructions:</b> ${details}`;
  return card + '\n';
};

export const telegramTemplates = {
  orderPlaced: (name: string, item: string, price: number, qty: number, sellerName: string, pin: string, itemId: string, meetup: any, total: number, platformFee: number) => ({
    text: `🆕 <b>Order Placed</b>\n\nHi <b>${name}</b>, your order is pending confirmation.\n\n${formatOrderDetails(item, price, qty, sellerName, 'Buyer', total, platformFee)}\n${formatMeetupCard(meetup.location, meetup.spot, meetup.availability, meetup.note, meetup.details)}\n<i>Coordinate the meetup via chat once acknowledged.</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔑 Show PIN', callback_data: `show_pin:${itemId}` },
          { text: '📍 I\'m Here', callback_data: `im_here:${itemId}` }
        ],
        [{ text: '💬 Chat on Application', url: `${process.env.FRONTEND_URL || 'https://opennotes.in'}/messages` }],
        [{ text: '📋 View All Details', callback_data: `ord_det:${itemId}` }]
      ]
    }
  }),
  
  newOrder: (name: string, item: string, price: number, qty: number, buyerName: string, itemId: string, meetup: any, total: number, platformFee: number) => ({
    text: `🔔 <b>New Order Received!</b>\n\nHi <b>${name}</b>, you have a new request.\n\n${formatOrderDetails(item, price, qty, buyerName, 'Seller', total, platformFee)}\n${formatMeetupCard(meetup.location, meetup.spot, meetup.availability, meetup.note, meetup.details)}\n📨 <i>Coordinate the meetup via chat.</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Acknowledge', callback_data: `ack_ord:${itemId}` },
          { text: '⌨️ Enter PIN', callback_data: `enter_pin:${itemId}` }
        ],
        [{ text: '💬 Chat on Application', url: `${process.env.FRONTEND_URL || 'https://opennotes.in'}/messages` }],
        [{ text: '📍 I\'m Here', callback_data: `im_here:${itemId}` }],
        [{ text: '📋 View All Details', callback_data: `ord_det:${itemId}` }]
      ]
    }
  }),
  
  orderAcknowledged: (name: string, item: string, price: number, qty: number, role: 'Buyer' | 'Seller', otherParty: string, itemId: string, meetup: any, total: number, platformFee: number) => ({
    text: `✅ <b>Meetup Confirmed</b>\n\nHi <b>${name}</b>, the ${role === 'Seller' ? 'buyer' : 'seller'} (${otherParty}) is ready.\n\n${formatOrderDetails(item, price, qty, otherParty, role === 'Seller' ? 'Seller' : 'Buyer', total, platformFee)}\n${formatMeetupCard(meetup.location, meetup.spot, meetup.availability, meetup.note, meetup.details)}\n🤝 <i>Meetup is now in progress.</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📍 I\'m Here', callback_data: `im_here:${itemId}` },
          { text: role === 'Seller' ? '⌨️ Enter PIN' : '🔑 Show PIN', callback_data: role === 'Seller' ? `enter_pin:${itemId}` : `show_pin:${itemId}` }
        ],
        [{ text: '💬 Chat on Application', url: `${process.env.FRONTEND_URL || 'https://opennotes.in'}/messages` }]
      ]
    }
  }),

  orderCompleted: (name: string, item: string, price: number, qty: number, role: 'Buyer' | 'Seller', otherParty: string, total: number, platformFee: number) =>
    `🎉 <b>Exchange Completed!</b>\n\nHi <b>${name}</b>, the exchange was successful.\n\n${formatOrderDetails(item, price, qty, otherParty, role === 'Seller' ? 'Seller' : 'Buyer', total, platformFee)}\n\n${role === 'Seller' ? '✅ Earnings added to your balance.' : '✅ Purchase confirmed.'}\n\n<a href="${process.env.FRONTEND_URL || 'https://opennotes.in'}/">Open OpenNotes.in →</a>`,

  newMessage: (name: string, senderName: string, content: string, convoId: string, listingTitle?: string) => {
    const MAX = 120;
    const preview = content.length > MAX ? content.slice(0, MAX) + '\u2026' : content;
    const safeSender  = escapeHtml(senderName);
    const safePreview = escapeHtml(preview);
    const appUrl = process.env.FRONTEND_URL || 'https://opennotes.in';
    
    const text = `💬 <b>New Message from ${safeSender}</b>` +
      (listingTitle ? `\n📦 <i>Re: ${escapeHtml(listingTitle)}</i>` : '') +
      `\n\n"${safePreview}"`;
      
    return {
      text,
      reply_markup: {
        inline_keyboard: [
          // Use URL instead of callback_data because UUID_UUID (73 chars) exceeds Telegram's 64-byte limit
          [{ text: '💬 Open Conversation', url: `${appUrl}/messages?conv=${convoId}` }]
        ]
      }
    };
  },

  generic: (title: string, message: string, linkUrl?: string) => 
    `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}${linkUrl ? `\n\n<a href="${linkUrl}">Open in OpenNotes →</a>` : `\n\n<a href="${process.env.FRONTEND_URL || 'https://opennotes.in'}/">Open OpenNotes.in →</a>`}`
};

/** Escape user-supplied strings so they're safe inside Telegram HTML parse_mode. */
export const escapeHtml = (str: string): string =>
  str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m] || m));

/**
 * Sends a rich message preview for personal messages.
 * Respects a 30-second per-conversation cooldown and skips if the bot token is not configured.
 * Safe to call fire-and-forget — all errors are caught internally.
 */
export const sendTelegramPreview = async (
  receiverId: string,
  senderName: string,
  content: string,
  conversationId: string,
  listingId?: string
): Promise<void> => {
  if (!botToken) {
    console.warn('[Telegram] Skip preview: TELEGRAM_BOT_TOKEN not configured.');
    return;
  }

  try {
    // ── Cooldown guard (atomic: reserve slot before any await) ───────────────
    const lastNotified = telegramMsgCooldowns.get(conversationId);
    if (lastNotified && Date.now() - lastNotified < TELEGRAM_MSG_COOLDOWN_MS) {
      return; // Silently skip to follow cooldown rules
    }
    telegramMsgCooldowns.set(conversationId, Date.now());

    // ── Look up receiver ──────────────────────────────────────────────────────
    let userRes;
    try {
      userRes = await db.execute({
        sql: 'SELECT name, telegram_chat_id FROM users WHERE id = ?',
        args: [receiverId],
      });
    } catch (dbErr) {
      telegramMsgCooldowns.delete(conversationId);
      throw dbErr;
    }
    
    const user = userRes.rows[0] as any;
    if (!user?.telegram_chat_id) {
      // Not linked — skip
      return; 
    }

    // ── Optionally fetch listing title for context ─────────────────────────────
    let listingTitle: string | undefined;
    if (listingId) {
      try {
        const listingRes = await db.execute({
          sql: 'SELECT title FROM listings WHERE id = ?',
          args: [listingId],
        });
        listingTitle = listingRes.rows[0]?.title as string | undefined;
      } catch { /* non-critical */ }
    }

    // ── Send ──────────────────────────────────────────────────────────────────
    const template = telegramTemplates.newMessage(
      user.name, senderName, content, conversationId, listingTitle
    );
    
    const sent = await sendTelegramMessage(
      user.telegram_chat_id, template.text, template.reply_markup
    );

    if (!sent) {
      telegramMsgCooldowns.delete(conversationId);
      console.warn(`[Telegram] Failed to send preview to ${user.telegram_chat_id}`);
    }

    // ── Evict oldest entries if cache grows too large ────────────────────────
    if (telegramMsgCooldowns.size > 500) {
      const oldest = [...telegramMsgCooldowns.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, 100)
        .map(([k]) => k);
      oldest.forEach((k) => telegramMsgCooldowns.delete(k));
    }
  } catch (err) {
    console.error('[Telegram] sendTelegramPreview failed:', err);
  }
};
