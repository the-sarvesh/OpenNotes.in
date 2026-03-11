import express from "express";
import { v4 as uuidv4 } from "uuid";
import { randomInt } from "crypto";
import db from "../db/database.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { createNotification } from "./notifications.js";

const router = express.Router();

const PLATFORM_FEE_PERCENTAGE = 10;

/** Generate a cryptographically secure 4-digit PIN */
const generateSecurePin = () =>
  randomInt(1000, 9999).toString().padStart(4, "0");

/** Consistent conversation ID between two users about a listing */
const getConversationId = (
  userId1: string,
  userId2: string,
  listingId: string,
) => {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}_${listingId}`;
};

// ─── Validate & apply a coupon code ──────────────────────────────────────────
// Returns { valid, discountType, discountValue, feeWaived, finalFee, message }
const applyCoupon = async (
  code: string,
  originalFee: number,
): Promise<{
  valid: boolean;
  discountType: string;
  discountValue: number;
  feeWaived: boolean;
  finalFee: number;
  couponId: string;
  message: string;
}> => {
  const result = await db.execute({
    sql: `SELECT * FROM coupon_codes
          WHERE code = ?
            AND is_active = 1
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            AND (max_uses IS NULL OR used_count < max_uses)`,
    args: [code.toUpperCase().trim()],
  });

  if (result.rows.length === 0) {
    return {
      valid: false,
      discountType: "percentage",
      discountValue: 0,
      feeWaived: false,
      finalFee: originalFee,
      couponId: "",
      message: "Invalid, expired, or already fully used coupon code.",
    };
  }

  const coupon = result.rows[0] as any;
  let finalFee = originalFee;
  let feeWaived = false;

  if (coupon.discount_type === "percentage") {
    const discount = Math.round(originalFee * (coupon.discount_value / 100));
    finalFee = Math.max(0, originalFee - discount);
    if (coupon.discount_value >= 100) feeWaived = true;
  } else if (coupon.discount_type === "fixed") {
    finalFee = Math.max(0, originalFee - coupon.discount_value);
    if (finalFee === 0) feeWaived = true;
  }

  return {
    valid: true,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    feeWaived,
    finalFee,
    couponId: coupon.id,
    message: feeWaived
      ? "✅ Platform fee fully waived!"
      : `✅ Coupon applied — fee reduced to ₹${finalFee}.`,
  };
};

// ─── POST /api/orders/validate-coupon ────────────────────────────────────────
// Frontend calls this to preview the discount before placing the order
router.post("/validate-coupon", authenticate, async (req: AuthRequest, res) => {
  try {
    const { coupon_code, order_total } = req.body;

    if (!coupon_code) {
      return res.status(400).json({ error: "coupon_code is required" });
    }
    if (!order_total || isNaN(Number(order_total))) {
      return res.status(400).json({ error: "order_total is required" });
    }

    const originalFee = Math.round(
      Number(order_total) * (PLATFORM_FEE_PERCENTAGE / 100),
    );
    const result = await applyCoupon(coupon_code, originalFee);

    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({
      valid: true,
      message: result.message,
      originalFee,
      finalFee: result.finalFee,
      feeWaived: result.feeWaived,
      discountType: result.discountType,
      discountValue: result.discountValue,
    });
  } catch (error) {
    console.error("Validate coupon error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/orders — Create Order (checkout) ───────────────────────────────
router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const buyerId = req.user!.id;
    const {
      items,
      buyer_location,
      buyer_availability,
      buyer_note,
      coupon_code,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Order items are required" });
    }

    if (!buyer_availability) {
      return res
        .status(400)
        .json({ error: "You must provide your availability for meetup." });
    }

    let subtotal = 0;
    const orderId = uuidv4();
    const orderItemsToInsert: any[] = [];

    // ── Validate all items first (before touching DB state) ──────────────────
    for (const item of items) {
      const listingRes = await db.execute({
        sql: "SELECT id, seller_id, price, quantity, title FROM listings WHERE id = ? AND status = ?",
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
        meetup_pin: generateSecurePin(),
      });
    }

    // ── Coupon / fee logic ────────────────────────────────────────────────────
    const totalAmount = subtotal;
    const rawPlatformFee = Math.round(
      totalAmount * (PLATFORM_FEE_PERCENTAGE / 100),
    );

    let platformFee = rawPlatformFee;
    let feeWaived = false;
    let appliedCouponCode: string | null = null;
    let appliedCouponId: string | null = null;

    // ── PAYMENT GATEWAY HOOK ─────────────────────────────────────────────────
    // TODO: When a real payment gateway (e.g. Razorpay) is integrated:
    //   1. Remove the coupon bypass below.
    //   2. Create a Razorpay order here for `platformFee` amount.
    //   3. Return the `razorpay_order_id` to the frontend.
    //   4. Frontend completes payment and sends back `razorpay_payment_id`.
    //   5. Verify signature here before inserting the DB order.
    // ────────────────────────────────────────────────────────────────────────

    if (coupon_code && coupon_code.trim()) {
      const couponResult = await applyCoupon(coupon_code, rawPlatformFee);
      if (!couponResult.valid) {
        return res.status(400).json({ error: couponResult.message });
      }
      platformFee = couponResult.finalFee;
      feeWaived = couponResult.feeWaived;
      appliedCouponCode = coupon_code.toUpperCase().trim();
      appliedCouponId = couponResult.couponId;
    }

    // ── Insert order atomically ───────────────────────────────────────────────
    await db.execute({ sql: "BEGIN", args: [] }).catch(() => {});

    try {
      await db.execute({
        sql: `INSERT INTO orders
                (id, buyer_id, total_amount, platform_fee, platform_fee_waived,
                 coupon_code, status, buyer_location, buyer_availability,
                 buyer_note, platform_fee_paid)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          orderId,
          buyerId,
          totalAmount,
          platformFee,
          feeWaived ? 1 : 0,
          appliedCouponCode,
          "pending_meetup",
          buyer_location || null,
          buyer_availability,
          buyer_note || null,
          1, // platform_fee_paid = true (fee collected or waived via coupon)
        ],
      });

      for (const orderItem of orderItemsToInsert) {
        await db.execute({
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
        await db.execute({
          sql: "UPDATE listings SET quantity = quantity - ? WHERE id = ?",
          args: [orderItem.quantity, orderItem.listing_id],
        });

        // Auto-archive if sold out
        await db.execute({
          sql: "UPDATE listings SET status = 'archived' WHERE id = ? AND quantity <= 0",
          args: [orderItem.listing_id],
        });

        // Auto-send initial chat message from buyer to seller
        const conversationId = getConversationId(
          buyerId as string,
          orderItem.seller_id as string,
          orderItem.listing_id as string,
        );
        const messageId = uuidv4();
        let initialMessage = `Hi! I just purchased your "${orderItem.title}".\n\nI'm based in ${buyer_location || "BITS"} and available on: ${buyer_availability}.`;
        if (buyer_note) {
          initialMessage += `\n\nNote: ${buyer_note}`;
        }

        await db.execute({
          sql: `INSERT INTO messages
                  (id, conversation_id, sender_id, receiver_id, listing_id, content)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            messageId,
            conversationId,
            buyerId as string,
            orderItem.seller_id as string,
            orderItem.listing_id as string,
            initialMessage,
          ],
        });

        // Notify seller — sale
        await createNotification(
          orderItem.seller_id,
          "sold",
          "Item Sold! 🎉",
          `A buyer has purchased ${orderItem.quantity}x "${orderItem.title}".`,
          "/orders",
        );

        // Notify seller — message
        const buyerRes = await db.execute({
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
        );
      }

      // Increment coupon usage counter
      if (appliedCouponId) {
        await db.execute({
          sql: "UPDATE coupon_codes SET used_count = used_count + 1 WHERE id = ?",
          args: [appliedCouponId],
        });
      }

      await db.execute({ sql: "COMMIT", args: [] }).catch(() => {});
    } catch (err) {
      await db.execute({ sql: "ROLLBACK", args: [] }).catch(() => {});
      throw err;
    }

    res.status(201).json({
      message: "Order created successfully",
      orderId,
      totalAmount,
      platformFee,
      feeWaived,
      couponApplied: appliedCouponCode,
      items: orderItemsToInsert, // contains meetup_pin per item
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/orders/my-orders (buyer) ───────────────────────────────────────
router.get("/my-orders", authenticate, async (req: AuthRequest, res) => {
  try {
    const ordersRes = await db.execute({
      sql: "SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC",
      args: [req.user!.id],
    });

    const orders = ordersRes.rows;

    for (const order of orders) {
      const itemsRes = await db.execute({
        sql: `
          SELECT
            oi.*,
            l.title, l.course_code, l.image_url, l.seller_id, l.delivery_method,
            l.meetup_location, l.condition, l.semester, l.material_type, l.location,
            u.name as seller_name, u.email as seller_email
          FROM order_items oi
          JOIN listings l ON oi.listing_id = l.id
          JOIN users u ON l.seller_id = u.id
          WHERE oi.order_id = ?
        `,
        args: [order.id],
      });
      (order as any).items = itemsRes.rows;
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/orders/my-sales (seller) ───────────────────────────────────────
router.get("/my-sales", authenticate, async (req: AuthRequest, res) => {
  try {
    const sellerId = req.user!.id;

    const salesRes = await db.execute({
      sql: `
        SELECT oi.*, o.status as order_status, o.created_at as order_date, o.buyer_id,
               o.delivery_details, o.collection_date, o.platform_fee,
               o.platform_fee_waived, o.coupon_code,
               l.title, l.course_code, l.image_url, l.price as listing_price,
               l.meetup_location,
               u.name as buyer_name, u.email as buyer_email
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN listings l ON oi.listing_id = l.id
        JOIN users u ON o.buyer_id = u.id
        WHERE oi.seller_id = ?
        ORDER BY o.created_at DESC
      `,
      args: [sellerId],
    });

    const totalEarnings = salesRes.rows.reduce(
      (sum: number, row: any) =>
        sum + Number(row.price_at_purchase) * Number(row.quantity),
      0,
    );

    const platformFeeTotal = salesRes.rows.reduce((sum: number, row: any) => {
      const itemTotal = Number(row.price_at_purchase) * Number(row.quantity);
      return sum + Math.round(itemTotal * (PLATFORM_FEE_PERCENTAGE / 100));
    }, 0);

    res.json({
      sales: salesRes.rows,
      summary: {
        totalEarnings,
        platformFeeTotal,
        netEarnings: totalEarnings - platformFeeTotal,
        totalSales: salesRes.rows.length,
      },
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/orders/items/:itemId/verify-pin (seller) ──────────────────────
router.post(
  "/items/:itemId/verify-pin",
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const sellerId = req.user!.id;
      const { itemId } = req.params;
      const { pin } = req.body;

      if (!pin) {
        return res.status(400).json({ error: "PIN is required" });
      }

      const itemRes = await db.execute({
        sql: `
          SELECT oi.*, o.id as order_id, o.status as order_status, o.buyer_id, l.title
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
          .json({ error: "This item is not pending meetup" });
      }

      if (item.meetup_pin !== pin) {
        return res.status(400).json({
          error: "Incorrect PIN. Please ask the buyer to show their PIN.",
        });
      }

      // Mark this item as completed
      await db.execute({
        sql: "UPDATE order_items SET status = 'completed' WHERE id = ?",
        args: [itemId as string],
      });

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
      );

      res.json({
        message: "PIN verified. Item marked as completed.",
        orderCompleted: allCompleted,
      });
    } catch (error) {
      console.error("Verify PIN error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
