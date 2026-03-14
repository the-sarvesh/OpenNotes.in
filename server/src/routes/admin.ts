import express from "express";
import db from "../db/database.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { createNotification } from "../utils/notifications.js";


const router = express.Router();

// All admin routes require auth + admin role
router.use(authenticate);
router.use(requireAdmin as any);

// GET /api/admin/stats — overview statistics
router.get("/stats", async (_req, res, next) => {
  try {
    const stats = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM listings) as total_listings,
        (SELECT COUNT(*) FROM listings WHERE status = 'active') as active_listings,
        (SELECT COUNT(*) FROM listings WHERE status = 'active' AND quantity = 0) as out_of_stock,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COALESCE(SUM(platform_fee), 0) FROM orders) as platform_revenue,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders) as platform_volume
    `);

    const row = stats.rows[0];
    res.json({
      users: Number(row.users),
      totalListings: Number(row.total_listings),
      activeListings: Number(row.active_listings),
      outOfStock: Number(row.out_of_stock),
      orders: Number(row.orders),
      platformRevenue: Number(row.platform_revenue),
      platformVolume: Number(row.platform_volume),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/listings — all listings with seller info
router.get("/listings", async (req, res, next) => {
  try {
    const { status } = req.query;
    let query =
      "SELECT l.*, u.name as seller_name, u.email as seller_email FROM listings l JOIN users u ON l.seller_id = u.id";
    const args: any[] = [];

    if (status) {
      query += " WHERE l.status = ?";
      args.push(status);
    }

    query += " ORDER BY l.created_at DESC";

    const listings = await db.execute({ sql: query, args });
    res.json(listings.rows);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/listings/:id/archive — archive a listing
router.patch("/listings/:id/archive", async (req, res, next) => {
  try {
    await db.execute({
      sql: "UPDATE listings SET status = 'archived' WHERE id = ?",
      args: [req.params.id],
    });
    res.json({ message: "Listing archived" });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/listings/:id/activate — re-activate a listing
router.patch("/listings/:id/activate", async (req, res, next) => {
  try {
    await db.execute({
      sql: "UPDATE listings SET status = 'active' WHERE id = ?",
      args: [req.params.id],
    });
    res.json({ message: "Listing activated" });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/listings/:id — permanently delete a listing
router.delete("/listings/:id", async (req, res, next) => {
  try {
    await db.execute({
      sql: "DELETE FROM listing_subjects WHERE listing_id = ?",
      args: [req.params.id],
    });
    await db.execute({
      sql: "DELETE FROM listings WHERE id = ?",
      args: [req.params.id],
    });
    res.json({ message: "Listing deleted permanently" });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users — all users with aggregated stats
router.get("/users", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const users = await db.execute({
      sql: `
        SELECT
          u.id, u.email, u.name, u.upi_id, u.role, u.status, u.created_at,
          (SELECT COUNT(*) FROM listings WHERE seller_id = u.id) as listings_count,
          (SELECT COUNT(*) FROM orders WHERE buyer_id = u.id) as buy_count,
          (SELECT COALESCE(SUM(price_at_purchase * quantity), 0) FROM order_items WHERE seller_id = u.id) as total_earnings
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [limit, offset]
    });
    res.json(users.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id/activity — get specific listings and purchases for a user
router.get("/users/:id/activity", async (req, res, next) => {
  try {
    const userId = req.params.id;

    // User's listings
    const listings = await db.execute({
      sql: "SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC",
      args: [userId],
    });

    // User's purchases
    const orders = await db.execute({
      sql: `SELECT o.id, o.total_amount, o.status, o.created_at
            FROM orders o WHERE o.buyer_id = ?
            ORDER BY o.created_at DESC`,
      args: [userId],
    });

    res.json({
      listings: listings.rows,
      orders: orders.rows,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/role — change user role
router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    await db.execute({
      sql: "UPDATE users SET role = ? WHERE id = ?",
      args: [role, req.params.id],
    });
    res.json({ message: `User role updated to ${role}` });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/status — block/unblock user
router.patch("/users/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await db.execute({
      sql: "UPDATE users SET status = ? WHERE id = ?",
      args: [status, req.params.id],
    });
    res.json({ message: `User status updated to ${status}` });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/orders — all orders
router.get("/orders", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const ordersRes = await db.execute({
      sql: `SELECT o.*, u.name as buyer_name, u.email as buyer_email
            FROM orders o JOIN users u ON o.buyer_id = u.id
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?`,
      args: [limit, offset]
    });

    const orders = ordersRes.rows;
    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map(o => o.id);
    const placeholders = orderIds.map(() => "?").join(",");

    const itemsRes = await db.execute({
      sql: `SELECT oi.*, l.title, l.course_code, l.image_url, us.name as seller_name
            FROM order_items oi
            JOIN listings l ON oi.listing_id = l.id
            JOIN users us ON oi.seller_id = us.id
            WHERE oi.order_id IN (${placeholders})`,
      args: orderIds
    });

    const itemsByOrder = itemsRes.rows.reduce((acc: Record<string, any[]>, item: any) => {
      const orderId = String(item.order_id);
      if (!acc[orderId]) acc[orderId] = [];
      acc[orderId].push(item);
      return acc;
    }, {});

    const enrichedOrders = orders.map(order => ({
      ...order,
      items: itemsByOrder[String(order.id)] || []
    }));

    res.json(enrichedOrders);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/orders/:id/status — update order status
router.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "pending_payment",
      "paid",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await db.execute({
      sql: "UPDATE orders SET status = ? WHERE id = ?",
      args: [status, req.params.id],
    });
    res.json({ message: `Order status updated to ${status}` });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/orders/:id/release-funds — release escrow funds to seller
router.post("/orders/:id/release-funds", async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Verify order exists
    const orderRes = await db.execute({
      sql: "SELECT status FROM orders WHERE id = ?",
      args: [orderId],
    });

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update order status
    await db.execute({
      sql: "UPDATE orders SET status = 'completed' WHERE id = ?",
      args: [orderId],
    });

    // Update all item statuses
    await db.execute({
      sql: "UPDATE order_items SET status = 'completed' WHERE order_id = ?",
      args: [orderId],
    });

    // Notify sellers
    const sellersRes = await db.execute({
      sql: "SELECT DISTINCT seller_id FROM order_items WHERE order_id = ?",
      args: [orderId],
    });

    for (const row of sellersRes.rows) {
      await createNotification(
        row.seller_id as string,
        "funds_released",
        "Funds Released! 💰",
        "Admin has confirmed delivery and released funds to your account.",
        "/profile",
      );
    }

    res.json({ message: "Funds released and order completed" });
  } catch (error) {
    console.error("Release funds error:", error);
    next(error);
  }
});

// POST /api/admin/archive-out-of-stock — manually archive all out-of-stock listings
router.post("/archive-out-of-stock", async (_req, res, next) => {
  try {
    const result = await db.execute(
      "UPDATE listings SET status = 'archived' WHERE status = 'active' AND quantity = 0",
    );
    res.json({
      message: `Archived ${result.rowsAffected} out-of-stock listings`,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/chats — list all conversations
router.get("/chats", async (req, res, next) => {
  try {
    const chats = await db.execute(`
      SELECT DISTINCT m.conversation_id,
             u1.name as sender_name, u1.email as sender_email,
             u2.name as receiver_name, u2.email as receiver_email,
             l.title as listing_title,
             MAX(m.created_at) as last_message_at
      FROM messages m
      JOIN users u1 ON m.sender_id = u1.id
      JOIN users u2 ON m.receiver_id = u2.id
      LEFT JOIN listings l ON m.listing_id = l.id
      GROUP BY m.conversation_id
      ORDER BY last_message_at DESC
    `);
    res.json(chats.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/chats/:id/messages — view transcript
router.get("/chats/:id/messages", async (req, res, next) => {
  try {
    const messages = await db.execute({
      sql: `SELECT m.*, u.name as sender_name
            FROM messages m JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC`,
      args: [req.params.id],
    });
    res.json(messages.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/purge-data — delete all dummy data except users
router.post("/purge-data", async (_req, res, next) => {
  try {
    // Delete in reverse order of foreign keys
    await db.execute("DELETE FROM reviews");
    await db.execute("DELETE FROM messages");
    await db.execute("DELETE FROM notifications");
    await db.execute("DELETE FROM order_items");
    await db.execute("DELETE FROM orders");
    await db.execute("DELETE FROM listing_subjects");
    await db.execute("DELETE FROM listings");

    res.json({
      message: "All site data (except users) has been purged successfully.",
    });
  } catch (error) {
    console.error("Purge error:", error);
    next(error);
  }
});

// ─── COUPON MANAGEMENT ────────────────────────────────────────────────────────

// GET /api/admin/coupons — list all coupons
router.get("/coupons", async (_req, res, next) => {
  try {
    const result = await db.execute(
      "SELECT * FROM coupon_codes ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Admin coupons list error:", error);
    next(error);
  }
});

// POST /api/admin/coupons — create a new coupon
router.post("/coupons", async (req, res, next) => {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      max_uses,
      expires_at,
    } = req.body;

    if (!code || !discount_type || discount_value === undefined) {
      return res
        .status(400)
        .json({
          error: "code, discount_type, and discount_value are required",
        });
    }

    if (!["percentage", "fixed"].includes(discount_type)) {
      return res
        .status(400)
        .json({ error: "discount_type must be 'percentage' or 'fixed'" });
    }

    if (
      discount_type === "percentage" &&
      (Number(discount_value) < 1 || Number(discount_value) > 100)
    ) {
      return res
        .status(400)
        .json({ error: "Percentage discount must be between 1 and 100" });
    }

    if (discount_type === "fixed" && Number(discount_value) < 1) {
      return res
        .status(400)
        .json({ error: "Fixed discount must be at least ₹1" });
    }

    // Check for duplicate code
    const existing = await db.execute({
      sql: "SELECT id FROM coupon_codes WHERE code = ?",
      args: [code.toUpperCase().trim()],
    });
    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "A coupon with this code already exists" });
    }

    const { v4: uuidv4 } = await import("uuid");
    const couponId = uuidv4();

    await db.execute({
      sql: `INSERT INTO coupon_codes
              (id, code, description, discount_type, discount_value, max_uses, is_active, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        couponId,
        code.toUpperCase().trim(),
        description || null,
        discount_type,
        Number(discount_value),
        max_uses ? Number(max_uses) : null,
        expires_at || null,
      ],
    });

    res
      .status(201)
      .json({ message: "Coupon created successfully", id: couponId });
  } catch (error) {
    console.error("Admin create coupon error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/coupons/:id/toggle — activate or deactivate a coupon
router.patch("/coupons/:id/toggle", async (req, res, next) => {
  try {
    const current = await db.execute({
      sql: "SELECT is_active FROM coupon_codes WHERE id = ?",
      args: [req.params.id],
    });

    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const newStatus = (current.rows[0] as any).is_active === 1 ? 0 : 1;

    await db.execute({
      sql: "UPDATE coupon_codes SET is_active = ? WHERE id = ?",
      args: [newStatus, req.params.id],
    });

    res.json({
      message: `Coupon ${newStatus === 1 ? "activated" : "deactivated"} successfully`,
      is_active: newStatus,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/coupons/:id — update coupon details
router.patch("/coupons/:id", async (req, res, next) => {
  try {
    const { description, max_uses, expires_at, discount_value, discount_type } =
      req.body;

    const updates: string[] = [];
    const args: any[] = [];

    if (description !== undefined) {
      updates.push("description = ?");
      args.push(description || null);
    }
    if (max_uses !== undefined) {
      updates.push("max_uses = ?");
      args.push(max_uses ? Number(max_uses) : null);
    }
    if (expires_at !== undefined) {
      updates.push("expires_at = ?");
      args.push(expires_at || null);
    }
    if (discount_value !== undefined) {
      updates.push("discount_value = ?");
      args.push(Number(discount_value));
    }
    if (discount_type !== undefined) {
      updates.push("discount_type = ?");
      args.push(discount_type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    args.push(req.params.id);
    await db.execute({
      sql: `UPDATE coupon_codes SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    res.json({ message: "Coupon updated successfully" });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/coupons/:id — permanently delete a coupon
router.delete("/coupons/:id", async (req, res, next) => {
  try {
    const existing = await db.execute({
      sql: "SELECT id, code FROM coupon_codes WHERE id = ?",
      args: [req.params.id],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    await db.execute({
      sql: "DELETE FROM coupon_codes WHERE id = ?",
      args: [req.params.id],
    });

    res.json({ message: `Coupon deleted permanently` });
  } catch (error) {
    next(error);
  }
});

export default router;
