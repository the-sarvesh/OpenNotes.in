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

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return res.status(400).json({ error: "rating must be between 1 and 5" });
  }

  try {
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
