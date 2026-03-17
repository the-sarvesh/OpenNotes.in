import { Telegraf } from 'telegraf';
import db from '../db/database.js';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

let bot: Telegraf | null = null;

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
      return ctx.reply('Welcome to OpenNotes.in Bot! To link your account, please click the "Connect Telegram" button in your profile settings on the website.');
    }

    try {
      // Find user with this linking token
      const result = await db.execute({
        sql: 'SELECT id, name FROM users WHERE telegram_link_token = ?',
        args: [payload]
      });

      if (result.rows.length === 0) {
        return ctx.reply('Invalid or expired linking token. Please generate a new one from your profile settings.');
      }

      const user = result.rows[0] as any;
      const chatId = ctx.chat.id.toString();

      // Link the chat ID and clear the token
      await db.execute({
        sql: 'UPDATE users SET telegram_chat_id = ?, telegram_link_token = NULL WHERE id = ?',
        args: [chatId, user.id]
      });

      return ctx.reply(`Success! Your account (${user.name}) is now linked to Telegram. You will receive notifications here.`);
    } catch (err) {
      console.error('[Telegram] Linking error:', err);
      return ctx.reply('An error occurred while linking your account. Please try again later.');
    }
  });

  // NOTE: In production (Railway), we use webhooks. In local dev, we use polling.
  // The webhook registration is handled in index.ts
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
export const sendTelegramMessage = async (chatId: string, text: string) => {
  if (!botToken) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
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

export const telegramTemplates = {
  orderPlaced: (name: string, item: string, price: number, qty: number, sellerName: string, pin: string) => 
    `🆕 <b>Order Confirmation</b>\n\nHi <b>${name}</b>, your order has been placed!\n\n${formatOrderDetails(item, price, qty, sellerName, 'Buyer')}\n\n📍 <b>Meetup PIN:</b> <code>${pin}</code>\n<i>Share this with the seller at the meetup.</i>\n\n<a href="https://open-notes-in-client.vercel.app/">Manage Order →</a>`,
  
  newOrder: (name: string, item: string, price: number, qty: number, buyerName: string) => 
    `🔔 <b>New Sale!</b>\n\nHi <b>${name}</b>, you have a new order.\n\n${formatOrderDetails(item, price, qty, buyerName, 'Seller')}\n\n📨 <i>Coordinate the meetup via messages.</i>\n\n<a href="https://open-notes-in-client.vercel.app/profile?tab=earnings">View Sale Details →</a>`,
  
  orderAcknowledged: (name: string, item: string, price: number, qty: number, role: 'Buyer' | 'Seller', otherParty: string) =>
    `✅ <b>Meetup Acknowledged</b>\n\nHi <b>${name}</b>, the ${role === 'Seller' ? 'buyer' : 'seller'} (${otherParty}) has acknowledged the meetup for:\n\n${formatOrderDetails(item, price, qty, otherParty, role === 'Seller' ? 'Seller' : 'Buyer')}\n\n🤝 <i>Meetup is now in progress.</i>\n\n<a href="https://open-notes-in-client.vercel.app/">View Order →</a>`,

  orderCompleted: (name: string, item: string, price: number, qty: number, role: 'Buyer' | 'Seller', otherParty: string) =>
    `🎉 <b>Exchange Completed!</b>\n\nHi <b>${name}</b>, the exchange is successful.\n\n${formatOrderDetails(item, price, qty, otherParty, role === 'Seller' ? 'Seller' : 'Buyer')}\n\n${role === 'Seller' ? '✅ Earnings added to your balance.' : '✅ Purchase confirmed.'}\n\n<a href="https://open-notes-in-client.vercel.app/">Open OpenNotes.in →</a>`,

  generic: (title: string, message: string, linkUrl?: string) => 
    `<b>${title}</b>\n\n${message}${linkUrl ? `\n\n<a href="${linkUrl}">Open in OpenNotes →</a>` : '\n\n<a href="https://open-notes-in-client.vercel.app/">Open OpenNotes.in →</a>'}`
};
