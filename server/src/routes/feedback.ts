import { Router } from "express";
import db from "../db/database.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/feedback — submit feedback after order completion
router.post("/", authenticate, async (req: any, res) => {
  const userId = req.user.id;
  const { trigger_type, reference_id, rating, message } = req.body;

  if (!trigger_type || !reference_id) {
    return res.status(400).json({ error: "trigger_type and reference_id are required" });
  }

  if (!['buyer', 'seller'].includes(trigger_type)) {
    return res.status(400).json({ error: "trigger_type must be 'buyer' or 'seller'" });
  }

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return res.status(400).json({ error: "rating must be between 1 and 5" });
  }

  try {
    // 1. Check for duplicate submission (idempotency)
    const existingRes = await db.execute({
      sql: `SELECT id FROM app_feedback
            WHERE user_id = ? AND trigger_type = ? AND reference_id = ?`,
      args: [userId, trigger_type, reference_id],
    });

    if (existingRes.rows.length > 0) {
      return res.status(409).json({
        error: "Feedback already submitted for this transaction",
        detail: "You have already provided feedback for this order"
      });
    }

    // 2. Verify user participated in the referenced order
    const orderRes = await db.execute({
      sql: `SELECT o.id, o.status, o.buyer_id
            FROM orders o
            WHERE o.id = ?`,
      args: [reference_id],
    });

    const order = orderRes.rows[0] as any;

    if (!order) {
      return res.status(403).json({
        error: "Invalid reference",
        detail: "Order not found or you do not have access to it"
      });
    }

    // Verify participation based on trigger_type
    if (trigger_type === 'buyer') {
      // Must be the buyer
      if (order.buyer_id !== userId) {
        return res.status(403).json({
          error: "Unauthorized",
          detail: "You are not the buyer for this order"
        });
      }
    } else if (trigger_type === 'seller') {
      // Must be a seller in this order
      const sellerCheck = await db.execute({
        sql: `SELECT id FROM order_items
              WHERE order_id = ? AND seller_id = ?
              LIMIT 1`,
        args: [reference_id, userId],
      });

      if (sellerCheck.rows.length === 0) {
        return res.status(403).json({
          error: "Unauthorized",
          detail: "You are not a seller for this order"
        });
      }
    }

    // Verify order is completed
    if (order.status !== 'completed') {
      return res.status(403).json({
        error: "Order not eligible",
        detail: "Feedback can only be submitted for completed orders"
      });
    }

    // 3. Insert feedback
    const id = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO app_feedback (id, user_id, trigger_type, reference_id, rating, message)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, userId, trigger_type, reference_id, rating ?? null, message?.trim() || null],
    });

    return res.json({ success: true, message: "Thanks for your feedback!" });
  } catch (err: any) {
    console.error("[Feedback] insert error:", err.message);
    return res.status(500).json({ error: "Failed to save feedback" });
  }
});

export default router;