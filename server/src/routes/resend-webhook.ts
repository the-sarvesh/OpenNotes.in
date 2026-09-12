import crypto from "crypto";
import { Router } from "express";
import { Webhook } from "svix";
import db from "../db/database.js";
import { createNotification } from "../utils/notifications.js";

const router = Router();
const TRACKED_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
]);

router.post("/", async (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "Email webhook is not configured" });
  }

  try {
    const payload = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    const event = new Webhook(secret).verify(payload, {
      "svix-id": req.get("svix-id") || "",
      "svix-timestamp": req.get("svix-timestamp") || "",
      "svix-signature": req.get("svix-signature") || "",
    }) as any;

    if (!TRACKED_EVENTS.has(String(event.type))) {
      return res.json({ received: true });
    }

    const providerId = String(event.data?.email_id || event.data?.id || "");
    const status = String(event.type).replace("email.", "");
    const recipient = Array.isArray(event.data?.to)
      ? String(event.data.to[0] || "").toLowerCase()
      : String(event.data?.to || "").toLowerCase();

    const updated = providerId
      ? await db.execute({
          sql: "UPDATE email_delivery_logs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE provider_id = ?",
          args: [status, providerId],
        })
      : { rowsAffected: 0 };

    if (!updated.rowsAffected && recipient) {
      await db.execute({
        sql: `INSERT INTO email_delivery_logs
              (id, recipient, purpose, provider_id, status)
              VALUES (?, ?, 'other', ?, ?)`,
        args: [crypto.randomUUID(), recipient, providerId || null, status],
      });
    }

    if (["bounced", "complained", "suppressed"].includes(status)) {
      const admins = await db.execute(
        "SELECT id FROM users WHERE role = 'admin' AND (status IS NULL OR status != 'blocked')",
      );
      await Promise.allSettled(admins.rows.map((admin) =>
        createNotification(
          String(admin.id),
          "email_delivery",
          `Email ${status}`,
          `${recipient || "A recipient"} could not receive an OpenNotes email.`,
          "/admin?tab=issues",
        ),
      ));
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[Resend Webhook] Rejected event:", error);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }
});

export default router;
