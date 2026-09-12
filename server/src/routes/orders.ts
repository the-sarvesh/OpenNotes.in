import express from "express";
import { v4 as uuidv4 } from "uuid";
import { randomInt } from "crypto";
import db from "../db/database.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { createNotification } from "../utils/notifications.js";
import { applyCoupon, calculateOrderFees } from "../utils/orders.js";
import { io } from "../socket.js";
import { sendTelegramMessage, telegramTemplates } from "../utils/telegram.js";
import { getSetting } from "../utils/settings.js";
import { normalizeOrderItems } from "../utils/validation.js";


const router = express.Router();

/** Generate a cryptographically secure 4-digit PIN */
const generateSecurePin = () =>
  randomInt(1000, 9999).toString().padStart(4, "0");

/** Consistent conversation ID between two users */
const getConversationId = (
  userId1: string,
  userId2: string,
) => {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

// Frontend calls this to preview its subtotal, fees, and cash at meetup upfront
router.post("/quote", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { items, coupon_code } = req.body;
    const normalized = normalizeOrderItems(items);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    let subtotal = 0;
    for (const item of normalized.items) {
      const listingRes = await db.execute({
        sql: "SELECT price FROM listings WHERE id = ? AND status = 'active'",
        args: [item.listing_id],
      });
      const listing = listingRes.rows[0] as any;
      if (listing) {
        subtotal += Number(listing.price) * (Number(item.quantity) || 1);
      }
    }

    const feeResult = await calculateOrderFees(subtotal, coupon_code);

    return res.json({
      subtotal: feeResult.subtotal,
      platformFee: feeResult.platformFee,
      cashAtMeetup: feeResult.subtotal - feeResult.platformFee,
      couponValid: feeResult.couponValid,
      couponMessage: feeResult.couponMessage,
      rawPlatformFee: feeResult.rawPlatformFee
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/orders/validate-coupon ────────────────────────────────────────
// @deprecated Use /quote instead for a full picture.
router.post("/validate-coupon", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { coupon_code, order_total } = req.body;

    if (!coupon_code) {
      return res.status(400).json({ error: "coupon_code is required" });
    }
    const feeResult = await calculateOrderFees(Number(order_total) || 0, coupon_code);

    if (!feeResult.couponValid) {
      return res.status(400).json({ error: feeResult.couponMessage });
    }

    return res.json({
      valid: true,
      message: feeResult.couponMessage,
      originalFee: feeResult.rawPlatformFee,
      finalFee: feeResult.platformFee,
      feeWaived: feeResult.feeWaived
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/orders — Create Order (checkout) ───────────────────────────────
router.post("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const buyerId = req.user!.id;
    const idempotencyKey = String(
      req.get("idempotency-key") || req.body?.client_request_id || "",
    ).trim();

    if (idempotencyKey && !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: "Invalid checkout request identifier" });
    }

    if (idempotencyKey) {
      const existingOrder = await db.execute({
        sql: "SELECT id, total_amount, platform_fee, platform_fee_waived, coupon_code FROM orders WHERE buyer_id = ? AND idempotency_key = ?",
        args: [buyerId, idempotencyKey],
      });
      if (existingOrder.rows[0]) {
        const order = existingOrder.rows[0] as any;
        return res.status(200).json({
          message: "Order already created",
          orderId: order.id,
          totalAmount: order.total_amount,
          platformFee: order.platform_fee,
          feeWaived: Boolean(order.platform_fee_waived),
          couponApplied: order.coupon_code,
          idempotentReplay: true,
        });
      }
    }
    const {
      items,
      buyer_location,
      buyer_preferred_spot,
      buyer_availability,
      buyer_note,
      buyer_meetup_details,
      coupon_code,
    } = req.body;

    const normalized = normalizeOrderItems(items);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const cleanAvailability = String(buyer_availability || '').trim();
    const cleanBuyerLocation = String(buyer_location || '').trim().slice(0, 120);
    const cleanPreferredSpot = String(buyer_preferred_spot || '').trim().slice(0, 120);
    const cleanBuyerNote = String(buyer_note || '').trim().slice(0, 500);
    const cleanMeetupDetails = String(buyer_meetup_details || '').trim().slice(0, 500);

    if (!cleanAvailability || cleanAvailability.length > 120) {
      return res
        .status(400)
        .json({ error: "You must provide your availability for meetup." });
    }

    const normalizedItems = normalized.items;

    let subtotal = 0;
    const orderId = uuidv4();
    const orderItemsToInsert: any[] = [];

    // ── Validate all items first (before touching DB state) ──────────────────
    for (const item of normalizedItems) {
      const listingRes = await db.execute({
        sql: "SELECT id, seller_id, price, quantity, title, image_url FROM listings WHERE id = ? AND status = ?",
        args: [item.listing_id, "active"],
      });

      const listing = listingRes.rows[0];

      if (!listing) {
        return res.status(404).json({
          error: `Listing ${item.listing_id} not found or no longer active`,
        });
      }

      // Prevent self-purchase
      if (listing.seller_id === buyerId) {
        return res
          .status(400)
          .json({ error: "You cannot purchase your own listing" });
      }

      if (Number(listing.quantity) < item.quantity) {
        return res.status(400).json({
          error: `Not enough stock for "${listing.title}"`,
        });
      }

      subtotal += Number(listing.price) * item.quantity;

      orderItemsToInsert.push({
        id: uuidv4(),
        order_id: orderId,
        listing_id: item.listing_id,
        seller_id: listing.seller_id,
        quantity: item.quantity,
        price_at_purchase: listing.price,
        title: listing.title,
        image_url: listing.image_url,
        meetup_pin: generateSecurePin(),
      });
    }

    // ── Coupon / fee logic ────────────────────────────────────────────────────
    const feeResult = await calculateOrderFees(subtotal, coupon_code);
    
    if (coupon_code && !feeResult.couponValid) {
      return res.status(400).json({ error: feeResult.couponMessage });
    }

    const totalAmount = feeResult.subtotal;
    const platformFee = feeResult.platformFee;
    const feeWaived = feeResult.feeWaived;
    const appliedCouponCode = feeResult.appliedCouponCode;
    const appliedCouponId = feeResult.couponId;

    // ── Insert order atomically ───────────────────────────────────────────────
    const tx = await db.transaction("write");

    try {
      // ── Re-validate all items INSIDE the transaction to prevent race conditions ──
      for (const item of normalizedItems) {
        const listingRes = await tx.execute({
          sql: "SELECT id, seller_id, price, quantity, title, status FROM listings WHERE id = ?",
          args: [item.listing_id],
        });

        const listing = listingRes.rows[0] as any;

        if (!listing || listing.status !== "active") {
          const conflict = new Error(`Listing "${listing?.title || item.listing_id}" is no longer active.`) as Error & { status?: number };
          conflict.status = 409;
          throw conflict;
        }

        if (Number(listing.quantity) < item.quantity) {
          const conflict = new Error(`Not enough stock for "${listing.title}". Available: ${listing.quantity}`) as Error & { status?: number };
          conflict.status = 409;
          throw conflict;
        }
      }

      await tx.execute({
        sql: `INSERT INTO orders
                (id, buyer_id, total_amount, platform_fee, platform_fee_waived,
                 coupon_code, status, buyer_location, buyer_preferred_spot,
                 buyer_availability, buyer_note, buyer_meetup_details, platform_fee_paid,
                 idempotency_key)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          orderId,
          buyerId,
          totalAmount,
          platformFee,
          feeWaived ? 1 : 0,
          appliedCouponCode,
          "pending_meetup",
          cleanBuyerLocation || null,
          cleanPreferredSpot || null,
          cleanAvailability,
          cleanBuyerNote || null,
          cleanMeetupDetails || null,
          1,
          idempotencyKey || null,
        ],
      });

      for (const orderItem of orderItemsToInsert) {
        await tx.execute({
          sql: `INSERT INTO order_items
                  (id, order_id, listing_id, seller_id, quantity,
                   price_at_purchase, status, meetup_pin)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            orderItem.id,
            orderItem.order_id,
            orderItem.listing_id,
            orderItem.seller_id,
            orderItem.quantity,
            orderItem.price_at_purchase,
            "pending_meetup",
            orderItem.meetup_pin,
          ],
        });

        // Decrement inventory
        await tx.execute({
          sql: "UPDATE listings SET quantity = quantity - ? WHERE id = ?",
          args: [orderItem.quantity, orderItem.listing_id],
        });

        // Auto-archive if sold out
        await tx.execute({
          sql: "UPDATE listings SET status = 'archived' WHERE id = ? AND quantity <= 0",
          args: [orderItem.listing_id],
        });

        // Auto-send initial chat message from buyer to seller
        const conversationId = getConversationId(
          buyerId as string,
          orderItem.seller_id as string,
        );
        const messageId = uuidv4();
        
        const itemSubtotal = orderItem.price_at_purchase * orderItem.quantity;
        const itemPlatformFee = totalAmount > 0 ? Math.round((itemSubtotal / totalAmount) * platformFee) : 0;
        const totalToCollect = itemSubtotal - itemPlatformFee;

        // Structured purchase message
        const initialMessage = `Hi! I just purchased your "${orderItem.title}".\n\nI'm based in ${cleanBuyerLocation || "BITS"}${cleanPreferredSpot ? ` and prefer meeting at ${cleanPreferredSpot}` : ""}.\n\nAvailability: ${cleanAvailability}${cleanMeetupDetails ? `\nDetails: ${cleanMeetupDetails}` : ""}`;
        const metadata = JSON.stringify({
          type: 'purchase_notice',
          listingId: orderItem.listing_id,
          listingTitle: orderItem.title,
          listingImage: orderItem.image_url,
          orderItemId: orderItem.id,
          meetupPin: orderItem.meetup_pin,
          buyerLocation: cleanBuyerLocation,
          buyerPreferredSpot: cleanPreferredSpot,
          buyerAvailability: cleanAvailability,
          buyerNote: cleanBuyerNote,
          buyerMeetupDetails: cleanMeetupDetails,
          price: orderItem.price_at_purchase,
          quantity: orderItem.quantity,
          totalToCollect: totalToCollect
        });

        await tx.execute({
          sql: `INSERT INTO messages
                  (id, conversation_id, sender_id, receiver_id, listing_id, content, type, metadata)
                VALUES (?, ?, ?, ?, ?, ?, 'purchase_notice', ?)`,
          args: [
            messageId,
            conversationId,
            buyerId as string,
            orderItem.seller_id as string,
            orderItem.listing_id as string,
            initialMessage,
            metadata
          ],
        });

        // Notify seller — sale
        await createNotification(
          orderItem.seller_id,
          "sold",
          "Item Sold! 🎉",
          `A buyer has purchased ${orderItem.quantity}x "${orderItem.title}".`,
          "/orders",
          tx,
          { skipTelegram: true },
        );

        // Notify seller — message
        const buyerRes = await tx.execute({
          sql: "SELECT name FROM users WHERE id = ?",
          args: [buyerId],
        });
        const buyerName = (buyerRes.rows[0] as any)?.name || "A buyer";

        await createNotification(
          orderItem.seller_id,
          "message",
          "New Meetup Details 💬",
          `${buyerName} sent their meetup availability.`,
          "/messages",
          tx,
          { skipTelegram: true },
        );
      }

      // Increment coupon usage counter
      if (appliedCouponId) {
        await tx.execute({
          sql: "UPDATE coupon_codes SET used_count = used_count + 1 WHERE id = ?",
          args: [appliedCouponId],
        });
      }

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      if (idempotencyKey && String((err as any)?.message || err).toLowerCase().includes("unique")) {
        const existingOrder = await db.execute({
          sql: "SELECT id, total_amount, platform_fee, platform_fee_waived, coupon_code FROM orders WHERE buyer_id = ? AND idempotency_key = ?",
          args: [buyerId, idempotencyKey],
        });
        if (existingOrder.rows[0]) {
          const order = existingOrder.rows[0] as any;
          return res.status(200).json({
            message: "Order already created",
            orderId: order.id,
            totalAmount: order.total_amount,
            platformFee: order.platform_fee,
            feeWaived: Boolean(order.platform_fee_waived),
            couponApplied: order.coupon_code,
            idempotentReplay: true,
          });
        }
      }
      throw err;
    }

    // ── Transaction Success ──

    // Emit live socket messages for each purchase notice
    if (io) {
      for (const orderItem of orderItemsToInsert) {
        const conversationId = getConversationId(buyerId as string, orderItem.seller_id as string);

        const buyerRes = await db.execute({
          sql: "SELECT name FROM users WHERE id = ?",
          args: [buyerId],
        });
        const buyerName = (buyerRes.rows[0] as any)?.name || "Buyer";

        const messagePayload = {
          id: uuidv4(), // Client needs unique ID for rendering
          conversation_id: conversationId,
          sender_id: buyerId,
          receiver_id: orderItem.seller_id,
          listing_id: orderItem.listing_id,
          sender_name: buyerName,
          content: `Hi! I just purchased your "${orderItem.title}".`,
          type: 'purchase_notice',
          metadata: JSON.stringify({
            type: 'purchase_notice',
            listingId: orderItem.listing_id,
            listingTitle: orderItem.title,
            listingImage: orderItem.image_url,
            orderItemId: orderItem.id,
            meetupPin: orderItem.meetup_pin,
            buyerLocation: cleanBuyerLocation,
            buyerPreferredSpot: cleanPreferredSpot,
            buyerAvailability: cleanAvailability,
            buyerNote: cleanBuyerNote,
            buyerMeetupDetails: cleanMeetupDetails,
            price: orderItem.price_at_purchase,
            quantity: orderItem.quantity,
            totalToCollect: orderItem.price_at_purchase * orderItem.quantity - (totalAmount > 0 ? Math.round(((orderItem.price_at_purchase * orderItem.quantity) / totalAmount) * platformFee) : 0)
          }),

          is_read: false,
          created_at: new Date().toISOString(),
        };

        io.to(`conv:${conversationId}`).emit("new_message", messagePayload);
        io.to(`user:${orderItem.seller_id}`).emit("unread_count_changed");
      }
    }

    // ── Telegram Order Notifications ──────────────────────────────────────────
    try {
      const buyerRow = await db.execute({
        sql: 'SELECT name, telegram_chat_id FROM users WHERE id = ?',
        args: [buyerId]
      });
      const buyer = buyerRow.rows[0] as any;

      for (const orderItem of orderItemsToInsert) {
        const sellerRow = await db.execute({
          sql: 'SELECT name, telegram_chat_id FROM users WHERE id = ?',
          args: [orderItem.seller_id]
        });
        const seller = sellerRow.rows[0] as any;

        const itemSubtotal = orderItem.price_at_purchase * orderItem.quantity;
        // Proportional fee calculation: (itemSubtotal / totalAmount) * platformFee
        const itemPlatformFee = totalAmount > 0 ? Math.round((itemSubtotal / totalAmount) * platformFee) : 0;

        // Notify buyer with Full Info
        if (buyer?.telegram_chat_id) {
          const meetupObj = {
            location: cleanBuyerLocation,
            spot: cleanPreferredSpot,
            availability: cleanAvailability,
            note: cleanBuyerNote,
            details: cleanMeetupDetails
          };
          const template = telegramTemplates.orderPlaced(buyer.name, orderItem.title, orderItem.price_at_purchase, orderItem.quantity, seller.name, orderItem.meetup_pin, orderItem.id, meetupObj, itemSubtotal, itemPlatformFee);
          await sendTelegramMessage(buyer.telegram_chat_id, template.text, template.reply_markup);
        }

        // Notify seller with Full Info
        if (seller?.telegram_chat_id) {
          const meetupObj = {
            location: cleanBuyerLocation,
            spot: cleanPreferredSpot,
            availability: cleanAvailability,
            note: cleanBuyerNote,
            details: cleanMeetupDetails
          };
          const template = telegramTemplates.newOrder(seller.name, orderItem.title, orderItem.price_at_purchase, orderItem.quantity, buyer.name, orderItem.id, meetupObj, itemSubtotal, itemPlatformFee);
          await sendTelegramMessage(seller.telegram_chat_id, template.text, template.reply_markup);
        }
      }
    } catch (err) {
      console.error('[Telegram] Order notification failed:', err);
    }

    res.status(201).json({
      message: "Order created successfully",
      orderId,
      totalAmount,
      platformFee,
      feeWaived,
      couponApplied: appliedCouponCode,
      items: orderItemsToInsert,
      buyer_location: cleanBuyerLocation || null,
      buyer_preferred_spot: cleanPreferredSpot || null,
      buyer_availability: cleanAvailability,
      buyer_note: cleanBuyerNote || null,
      buyer_meetup_details: cleanMeetupDetails || null,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/orders/my-orders (buyer) ───────────────────────────────────────
router.get("/my-orders", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const ordersRes = await db.execute({
      sql: "SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      args: [req.user!.id, limit, offset],
    });

    const orders = ordersRes.rows;
    if (orders.length === 0) {
      return res.json([]);
    }

    // Get all item IDs to fetch items in one go (N+1 fix)
    const orderIds = orders.map(o => o.id);
    const placeholders = orderIds.map(() => "?").join(",");

    const itemsRes = await db.execute({
      sql: `
        SELECT
          oi.*,
          l.title, l.course_code, l.image_url, l.seller_id, l.delivery_method,
          l.meetup_location, l.condition, l.semester, l.material_type, l.location,
          l.cohort, l.created_at AS listing_created_at,
          u.name as seller_name, u.email as seller_email
        FROM order_items oi
        JOIN listings l ON oi.listing_id = l.id
        JOIN users u ON l.seller_id = u.id
        WHERE oi.order_id IN (${placeholders})
      `,
      args: orderIds,
    });

    // Map items to their respective orders
    const itemsByOrder = itemsRes.rows.reduce((acc: Record<string, any[]>, item: any) => {
      const orderId = String(item.order_id);
      if (!acc[orderId]) acc[orderId] = [];
      acc[orderId].push(item);
      return acc;
    }, {});

    const enrichedOrders = orders.map(order => ({
      ...order,
      items: (itemsByOrder[String(order.id)] || []).map(item => ({
        ...item,
        seller_email: order.status === 'cancelled' ? '[Hidden]' : item.seller_email
      }))
    }));

    res.json(enrichedOrders);
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/orders/my-sales (seller) ───────────────────────────────────────
router.get("/my-sales", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const sellerId = req.user!.id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const salesRes = await db.execute({
      sql: `
        SELECT oi.*, o.status as order_status, o.created_at as order_date, o.buyer_id,
               o.delivery_details, o.collection_date, o.platform_fee,
               o.platform_fee_waived, o.coupon_code,
               o.buyer_location, o.buyer_preferred_spot, o.buyer_availability, o.buyer_meetup_details,
               l.title, l.course_code, l.image_url, l.price as listing_price,
               l.meetup_location,
               u.name as buyer_name, u.email as buyer_email
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN listings l ON oi.listing_id = l.id
        JOIN users u ON o.buyer_id = u.id
        WHERE oi.seller_id = ?
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [sellerId, limit, offset],
    });

    const totalEarnings = salesRes.rows.reduce(
      (sum: number, row: any) =>
        sum + Number(row.price_at_purchase) * Number(row.quantity),
      0,
    );

    const feeSetting = await getSetting("platform_fee_percentage", "0");
    const dynamicFeePercentage = Number(feeSetting);

    const platformFeeTotal = salesRes.rows.reduce((sum: number, row: any) => {
      const itemSubtotal = Number(row.price_at_purchase) * Number(row.quantity);
      const orderTotal = Number(row.total_amount) || itemSubtotal; // Fallback if total_amount is missing
      const orderFee = Number(row.platform_fee) || 0;
      
      // Proportional fee for this item
      const itemFee = orderTotal > 0 ? Math.round((itemSubtotal / orderTotal) * orderFee) : 0;
      return sum + itemFee;
    }, 0);

    const processedSales = salesRes.rows.map(row => ({
      ...row,
      buyer_email: row.order_status === 'cancelled' ? '[Hidden]' : row.buyer_email,
      buyer_location: row.order_status === 'cancelled' ? '[Hidden]' : row.buyer_location,
      buyer_preferred_spot: row.order_status === 'cancelled' ? '[Hidden]' : row.buyer_preferred_spot,
      buyer_availability: row.order_status === 'cancelled' ? '[Hidden]' : row.buyer_availability,
      buyer_meetup_details: row.order_status === 'cancelled' ? '[Hidden]' : row.buyer_meetup_details,
    }));

    res.json({
      sales: processedSales,
      summary: {
        totalEarnings,
        platformFeeTotal,
        netEarnings: totalEarnings - platformFeeTotal,
        totalSales: salesRes.rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/orders/items/:itemId/acknowledge (seller) ────────────────────
router.post(
  "/items/:itemId/acknowledge",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const sellerId = req.user!.id;
      const { itemId } = req.params;

      const itemRes = await db.execute({
        sql: `
          SELECT oi.*, o.id as order_id, o.buyer_id, o.buyer_location, o.buyer_preferred_spot, o.buyer_availability, o.buyer_note, o.buyer_meetup_details, l.title
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN listings l ON oi.listing_id = l.id
          WHERE oi.id = ? AND oi.seller_id = ?
        `,
        args: [itemId as string, sellerId as string],
      });

      const item = itemRes.rows[0];

      if (!item) {
        return res.status(404).json({
          error: "Order item not found or you are not the seller",
        });
      }

      if (item.status !== "pending_meetup") {
        return res
          .status(400)
          .json({ error: `This item is already ${item.status}` });
      }

      // Mark this item as acknowledged
      await db.execute({
        sql: "UPDATE order_items SET status = 'acknowledged' WHERE id = ?",
        args: [itemId as string],
      });

      // Update the associated purchase_notice message status to 'acknowledged'
      const convoId = getConversationId(item.buyer_id as string, sellerId as string);
      const msgRes = await db.execute({
        sql: "SELECT id, metadata FROM messages WHERE conversation_id = ? AND type = 'purchase_notice'",
        args: [convoId]
      });

      for (const row of msgRes.rows as any[]) {
        const meta = JSON.parse(row.metadata || '{}');
        if (meta.orderItemId === itemId) {
          meta.status = 'acknowledged';
          await db.execute({
            sql: "UPDATE messages SET metadata = ? WHERE id = ?",
            args: [JSON.stringify(meta), row.id]
          });
          
          if (io) {
            io.to(`conv:${convoId}`).emit("meetup_status_changed", { 
              proposalId: itemId,
              status: 'acknowledged', 
              messageId: row.id 
            });
          }
          break;
        }
      }

      await createNotification(
        item.buyer_id as string,
        "order_update",
        "Order Acknowledged! ✅",
        `The seller has acknowledged your purchase of "${item.title}". You can now coordinate the meetup.`,
        "/orders",
        undefined,
        { skipTelegram: true },
      );

      // Telegram Notifications (Acknowledge)
      try {
        const [buyerRow, sellerRow] = await Promise.all([
          db.execute({ sql: 'SELECT name, telegram_chat_id FROM users WHERE id = ?', args: [item.buyer_id] }),
          db.execute({ sql: 'SELECT name, telegram_chat_id FROM users WHERE id = ?', args: [sellerId] })
        ]);
        const buyer = buyerRow.rows[0] as any;
        const seller = sellerRow.rows[0] as any;

        if (buyer?.telegram_chat_id) {
          const meetupObj = {
            location: item.buyer_location,
            spot: item.buyer_preferred_spot,
            availability: item.buyer_availability,
            note: item.buyer_note,
            details: item.buyer_meetup_details
          };
          const itemSubtotal = (item.price_at_purchase as number) * (item.quantity as number);
          const orderTotal = (item as any).total_amount || itemSubtotal;
          const orderFee = (item as any).platform_fee || 0;
          const itemFee = orderTotal > 0 ? Math.round((itemSubtotal / orderTotal) * orderFee) : 0;

          const template = telegramTemplates.orderAcknowledged(buyer.name, item.title as string, item.price_at_purchase as number, item.quantity as number, 'Buyer', seller.name, itemId, meetupObj, itemSubtotal, itemFee);
          await sendTelegramMessage(buyer.telegram_chat_id, template.text, template.reply_markup);
        }
        if (seller?.telegram_chat_id) {
          const meetupObj = {
            location: item.buyer_location,
            spot: item.buyer_preferred_spot,
            availability: item.buyer_availability,
            note: item.buyer_note,
            details: item.buyer_meetup_details
          };
          const itemSubtotal = (item.price_at_purchase as number) * (item.quantity as number);
          const orderTotal = (item as any).total_amount || itemSubtotal;
          const orderFee = (item as any).platform_fee || 0;
          const itemFee = orderTotal > 0 ? Math.round((itemSubtotal / orderTotal) * orderFee) : 0;

          const template = telegramTemplates.orderAcknowledged(seller.name, item.title as string, item.price_at_purchase as number, item.quantity as number, 'Seller', buyer.name, itemId, meetupObj, itemSubtotal, itemFee);
          await sendTelegramMessage(seller.telegram_chat_id, template.text, template.reply_markup);
        }
      } catch (tgErr) {
        console.error('[Telegram] Acknowledge notification failed:', tgErr);
      }

      res.json({ message: "Order acknowledged successfully" });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/orders/items/:itemId/verify-pin (seller) ──────────────────────
router.post(
  "/items/:itemId/verify-pin",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const sellerId = req.user!.id;
      const { itemId } = req.params;
      const { pin } = req.body;

      if (!pin) {
        return res.status(400).json({ error: "PIN is required" });
      }

      const itemRes = await db.execute({
        sql: `
          SELECT oi.*, o.id as order_id, o.status as order_status, o.buyer_id, o.total_amount, o.platform_fee, l.title
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN listings l ON oi.listing_id = l.id
          WHERE oi.id = ? AND oi.seller_id = ?
        `,
        args: [itemId as string, sellerId as string],
      });

      const item = itemRes.rows[0];

      if (!item) {
        return res.status(404).json({
          error: "Order item not found or you are not the seller",
        });
      }

      if (item.status === "completed" || item.status === "cancelled") {
        return res
          .status(400)
          .json({ error: "Transaction closed for this item" });
      }

      if (item.status !== "pending_meetup" && item.status !== "acknowledged") {
        return res
          .status(400)
          .json({ error: "This item is not ready for PIN verification" });
      }

      // Check for PIN lockout
      if (Number(item.pin_attempts) >= 3) {
        const lastAttempt = new Date(item.last_pin_attempt_at as string).getTime();
        const now = Date.now();
        const diffMinutes = (now - lastAttempt) / (1000 * 60);

        if (diffMinutes < 30) {
          return res.status(403).json({
            error: `PIN verification is locked for ${Math.ceil(30 - diffMinutes)} more minutes due to repeated incorrect attempts. Please check the PIN with the buyer.`
          });
        }
        
        // Cooldown passed, reset internal counter for this attempt session
        item.pin_attempts = 0;
      }

      if (item.meetup_pin !== pin) {
        await db.execute({
          sql: "UPDATE order_items SET pin_attempts = pin_attempts + 1, last_pin_attempt_at = CURRENT_TIMESTAMP WHERE id = ?",
          args: [itemId]
        });
        return res.status(400).json({
          error: `Incorrect PIN. Attempt ${Number(item.pin_attempts) + 1} of 3. Please ask the buyer to show their PIN.`,
        });
      }

      // Mark this item as completed
      await db.execute({
        sql: "UPDATE order_items SET status = 'completed', pin_attempts = 0 WHERE id = ?",
        args: [itemId as string],
      });

      // Update the associated purchase_notice message status to 'completed'
      const convoId = getConversationId(item.buyer_id as string, sellerId as string);
      const msgRes = await db.execute({
        sql: "SELECT id, metadata FROM messages WHERE conversation_id = ? AND type = 'purchase_notice'",
        args: [convoId]
      });

      // Find the specific message for this order item and update it
      for (const row of msgRes.rows as any[]) {
        const meta = JSON.parse(row.metadata || '{}');
        if (meta.orderItemId === itemId) {
          meta.status = 'completed';
          await db.execute({
            sql: "UPDATE messages SET metadata = ? WHERE id = ?",
            args: [JSON.stringify(meta), row.id]
          });
          
          // Emit socket update if needed (optional but good for real-time)
          if (io) {
            io.to(`conv:${convoId}`).emit("meetup_status_changed", { 
              proposalId: itemId,
              status: 'completed', 
              messageId: row.id,
              orderId: item.order_id,
              buyerId: item.buyer_id,
              sellerId: item.seller_id,
              itemTitle: item.title,
            });
          }
          break;
        }
      }

      // Check if ALL items in this order are now completed
      const allItemsRes = await db.execute({
        sql: "SELECT status FROM order_items WHERE order_id = ?",
        args: [item.order_id],
      });

      const allCompleted = (allItemsRes.rows as any[]).every(
        (r: any) => r.status === "completed",
      );

      if (allCompleted) {
        await db.execute({
          sql: "UPDATE orders SET status = 'completed' WHERE id = ?",
          args: [item.order_id],
        });
      }

      // Notify buyer
      await createNotification(
        item.buyer_id as string,
        "order_update",
        "Exchange Completed! ✅",
        `"${item.title}" has been handed over. ${allCompleted ? "Your full order is now complete!" : "Waiting for remaining items."}`,
        "/orders",
        undefined,
        { skipTelegram: true },
      );

      // ── Telegram Notifications ──────────────────────────────────────────────
      try {
        // Fetch buyer and seller names/chatIDs
        const [buyerRow, sellerRow] = await Promise.all([
          db.execute({ sql: 'SELECT name, telegram_chat_id FROM users WHERE id = ?', args: [item.buyer_id] }),
          db.execute({ sql: 'SELECT name, telegram_chat_id FROM users WHERE id = ?', args: [sellerId] })
        ]);

        const buyer = buyerRow.rows[0] as any;
        const seller = sellerRow.rows[0] as any;

        const itemSubtotal = Number(item.price_at_purchase) * Number(item.quantity);
        const orderTotal = Number(item.total_amount) || itemSubtotal;
        const orderFee = Number(item.platform_fee) || 0;
        const itemFee = orderTotal > 0 ? Math.round((itemSubtotal / orderTotal) * orderFee) : 0;

        if (buyer?.telegram_chat_id) {
          await sendTelegramMessage(buyer.telegram_chat_id,
            telegramTemplates.orderCompleted(buyer.name, item.title as string, Number(item.price_at_purchase), Number(item.quantity), 'Buyer', seller.name, itemSubtotal, itemFee)
          );
        }

        if (seller?.telegram_chat_id) {
          await sendTelegramMessage(seller.telegram_chat_id,
            telegramTemplates.orderCompleted(seller.name, item.title as string, Number(item.price_at_purchase), Number(item.quantity), 'Seller', buyer.name, itemSubtotal, itemFee)
          );
        }
      } catch (tgErr) {
        console.error('[Telegram] Post-completion notification failed:', tgErr);
      }

      res.json({
        message: "PIN verified. Item marked as completed.",
        orderCompleted: allCompleted,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
