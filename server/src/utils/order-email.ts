import crypto from "crypto";
import db from "../db/database.js";
import { sendMail } from "./email.js";

export type OrderEmailEvent =
  | "placed"
  | "acknowledged"
  | "completed"
  | "cancelled"
  | "meetup_proposed"
  | "meetup_accepted"
  | "meetup_declined"
  | "meetup_cancelled"
  | "meetup_reminder";

export interface OrderEmailPayload {
  event: OrderEmailEvent;
  eventKey: string;
  recipientUserId: string;
  role: "buyer" | "seller";
  orderId?: string;
  orderItemId?: string;
  listingTitle?: string;
  quantity?: number;
  amount?: number;
  counterpartUserId?: string;
  meetupPin?: string;
  meetupLocation?: string;
  meetupTime?: string;
  actionPath?: "/orders" | "/messages";
  note?: string;
}

type Executor = {
  execute: (statement: any) => Promise<any>;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const eventContent: Record<OrderEmailEvent, {
  label: string;
  subject: (title: string) => string;
  heading: string;
  buyer: string;
  seller: string;
  cta: string;
  accent: string;
}> = {
  placed: {
    label: "ORDER CONFIRMED",
    subject: (title) => `Order confirmed: ${title}`,
    heading: "Your exchange is underway",
    buyer: "Your order is confirmed. The seller has been notified and will acknowledge it shortly.",
    seller: "You have a new order. Please review the meetup details and acknowledge it when you are ready.",
    cta: "View order",
    accent: "#2563eb",
  },
  acknowledged: {
    label: "SELLER ACKNOWLEDGED",
    subject: (title) => `Seller acknowledged: ${title}`,
    heading: "The order has been acknowledged",
    buyer: "The seller has confirmed that they saw your order. You can now coordinate the meetup.",
    seller: "You acknowledged this order. Coordinate the meetup with the buyer and complete the exchange using their PIN.",
    cta: "Coordinate meetup",
    accent: "#16a34a",
  },
  completed: {
    label: "EXCHANGE COMPLETE",
    subject: (title) => `Exchange completed: ${title}`,
    heading: "The exchange is complete",
    buyer: "The handover was confirmed successfully. Thank you for using OpenNotes.in.",
    seller: "The handover was confirmed successfully. This sale is now complete.",
    cta: "View completed order",
    accent: "#16a34a",
  },
  cancelled: {
    label: "ORDER CANCELLED",
    subject: (title) => `Order cancelled: ${title}`,
    heading: "This order was cancelled",
    buyer: "An administrator cancelled this order. The conversation is closed and the reserved stock has been restored.",
    seller: "An administrator cancelled this order. The reserved quantity has been returned to your listing.",
    cta: "View order status",
    accent: "#dc2626",
  },
  meetup_proposed: {
    label: "MEETUP PROPOSED",
    subject: (title) => `Meetup proposed: ${title}`,
    heading: "A meetup time was proposed",
    buyer: "A meetup proposal was added to this order. Review the time and location in Messages.",
    seller: "A meetup proposal was added to this order. Review the time and location in Messages.",
    cta: "Review proposal",
    accent: "#7c3aed",
  },
  meetup_accepted: {
    label: "MEETUP ACCEPTED",
    subject: (title) => `Meetup accepted: ${title}`,
    heading: "Your meetup is confirmed",
    buyer: "The meetup proposal was accepted. Check the confirmed details before you leave.",
    seller: "The meetup proposal was accepted. Check the confirmed details before you leave.",
    cta: "View meetup",
    accent: "#16a34a",
  },
  meetup_declined: {
    label: "MEETUP DECLINED",
    subject: (title) => `Meetup declined: ${title}`,
    heading: "A new meetup time is needed",
    buyer: "The meetup proposal was declined. Please coordinate another suitable time or place.",
    seller: "The meetup proposal was declined. Please coordinate another suitable time or place.",
    cta: "Propose another time",
    accent: "#ea580c",
  },
  meetup_cancelled: {
    label: "MEETUP CANCELLED",
    subject: (title) => `Meetup cancelled: ${title}`,
    heading: "The meetup proposal was cancelled",
    buyer: "The meetup proposal was cancelled. The order remains active, so you can arrange another meetup.",
    seller: "The meetup proposal was cancelled. The order remains active, so you can arrange another meetup.",
    cta: "Arrange another meetup",
    accent: "#ea580c",
  },
  meetup_reminder: {
    label: "MEETUP IN 30 MINUTES",
    subject: (title) => `Meetup reminder: ${title}`,
    heading: "Your meetup is coming up",
    buyer: "Your accepted meetup is scheduled in about 30 minutes. Bring your exchange PIN and confirm the listing before handover.",
    seller: "Your accepted meetup is scheduled in about 30 minutes. Confirm the listing and ask the buyer for their exchange PIN after handover.",
    cta: "Open meetup details",
    accent: "#7c3aed",
  },
};

const formatAmount = (amount?: number) => amount == null
  ? ""
  : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const formatMeetupTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

export function orderActivityEmail(
  payload: OrderEmailPayload,
  recipientName: string,
  counterpartName?: string,
) {
  const content = eventContent[payload.event];
  const title = payload.listingTitle || (payload.orderId ? `Order #${payload.orderId.slice(-8).toUpperCase()}` : "your OpenNotes order");
  const firstName = recipientName.trim().split(/\s+/)[0] || "there";
  const frontendUrl = (process.env.FRONTEND_URL || "https://opennotes.in").replace(/\/$/, "");
  const actionUrl = `${frontendUrl}${payload.actionPath || (payload.event.startsWith("meetup_") ? "/messages" : "/orders")}`;
  const rows = [
    payload.orderId && ["Order", `#${payload.orderId.slice(-8).toUpperCase()}`],
    payload.listingTitle && ["Listing", payload.listingTitle],
    payload.quantity != null && ["Quantity", String(payload.quantity)],
    payload.amount != null && [payload.role === "seller" ? "Sale value" : "Order value", formatAmount(payload.amount)],
    counterpartName && [payload.role === "buyer" ? "Seller" : "Buyer", counterpartName],
    payload.meetupTime && ["Meetup time", formatMeetupTime(payload.meetupTime)],
    payload.meetupLocation && ["Meetup place", payload.meetupLocation],
    payload.role === "buyer" && payload.meetupPin && ["Exchange PIN", payload.meetupPin],
  ].filter(Boolean) as string[][];

  const detailsHtml = rows.length ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
      ${rows.map(([label, value], index) => `<tr>
        <td style="padding:${index === 0 ? "18px" : "10px"} 18px 10px;color:#64748b;font-size:13px;${index > 0 ? "border-top:1px solid #e2e8f0;" : ""}">${escapeHtml(label)}</td>
        <td align="right" style="padding:${index === 0 ? "18px" : "10px"} 18px 10px;color:#0f172a;font-size:13px;font-weight:700;${index > 0 ? "border-top:1px solid #e2e8f0;" : ""}">${escapeHtml(value)}</td>
      </tr>`).join("")}
    </table>` : "";

  const safeSummary = escapeHtml(content[payload.role]);
  const safeNote = payload.note ? `<p style="margin:18px 0 0;padding:14px 16px;background:#fff7ed;border-left:4px solid #f59e0b;border-radius:8px;color:#7c2d12;font-size:13px;line-height:1.6;">${escapeHtml(payload.note)}</p>` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject(title))}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.heading)} — ${escapeHtml(title)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:32px 12px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
      <tr><td style="background:#003366;padding:26px 32px;">
        <div style="font-size:25px;font-weight:900;letter-spacing:-.6px;color:#FFC000;">Open<span style="color:#ffffff;">Notes.in</span></div>
        <div style="margin-top:5px;color:#94a3b8;font-size:12px;">BITSian notes exchange</div>
      </td></tr>
      <tr><td style="height:5px;background:${content.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:34px 32px 30px;">
        <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:${content.accent}16;color:${content.accent};font-size:11px;font-weight:800;letter-spacing:.7px;">${content.label}</div>
        <h1 style="margin:18px 0 10px;font-size:25px;line-height:1.25;letter-spacing:-.4px;">${escapeHtml(content.heading)}</h1>
        <p style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.7;">Hi ${escapeHtml(firstName)},</p>
        <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">${safeSummary}</p>
        ${detailsHtml}
        ${safeNote}
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:26px;"><tr><td style="background:#FFC000;border-radius:11px;">
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 22px;color:#003366;text-decoration:none;font-size:14px;font-weight:800;">${escapeHtml(content.cta)} →</a>
        </td></tr></table>
        ${payload.meetupPin ? `<p style="margin:22px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">Keep your exchange PIN private. Share it with the seller only after you receive the notes.</p>` : ""}
      </td></tr>
      <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:11px;line-height:1.6;">
        This transactional email was sent because you are part of an OpenNotes.in order.<br>OpenNotes.in · BITS Pilani notes exchange
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const text = `OpenNotes.in — ${content.label}\n\nHi ${firstName},\n\n${content[payload.role]}${textRows ? `\n\n${textRows}` : ""}${payload.note ? `\n\n${payload.note}` : ""}\n\n${content.cta}: ${actionUrl}\n\nThis email was sent because you are part of an OpenNotes.in order.`;

  return {
    subject: content.subject(title).slice(0, 180),
    html,
    text,
  };
}

/** Persist order-email work with the same transaction as the business event. */
export async function queueOrderEmail(payload: OrderEmailPayload, tx?: Executor) {
  const executor = tx || db;
  await executor.execute({
    sql: `INSERT OR IGNORE INTO order_email_jobs
          (id, event_key, recipient_user_id, payload_json)
          VALUES (?, ?, ?, ?)`,
    args: [crypto.randomUUID(), payload.eventKey, payload.recipientUserId, JSON.stringify(payload)],
  });
}

let orderEmailWorkerRunning = false;

/** Deliver a bounded batch with retry; deterministic keys prevent duplicate sends. */
export async function processOrderEmailJobs() {
  if (orderEmailWorkerRunning) return;
  orderEmailWorkerRunning = true;
  try {
    await db.execute("UPDATE order_email_jobs SET status = 'pending' WHERE status = 'processing' AND updated_at < datetime('now', '-10 minutes')");
    const jobs = await db.execute(`
      SELECT id, event_key, recipient_user_id, payload_json, attempts
      FROM order_email_jobs
      WHERE status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP
      ORDER BY created_at ASC
      LIMIT 20
    `);

    for (const job of jobs.rows as any[]) {
      const claimed = await db.execute({
        sql: "UPDATE order_email_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
        args: [job.id],
      });
      if (!claimed.rowsAffected) continue;

      try {
        const payload = JSON.parse(String(job.payload_json)) as OrderEmailPayload;
        const [recipientRes, counterpartRes] = await Promise.all([
          db.execute({ sql: "SELECT name, email FROM users WHERE id = ?", args: [job.recipient_user_id] }),
          payload.counterpartUserId
            ? db.execute({ sql: "SELECT name FROM users WHERE id = ?", args: [payload.counterpartUserId] })
            : Promise.resolve({ rows: [] } as any),
        ]);
        const recipient = recipientRes.rows[0] as any;
        if (!recipient?.email) throw new Error("Order-email recipient has no email address");
        const email = orderActivityEmail(payload, String(recipient.name || "there"), String((counterpartRes.rows[0] as any)?.name || "") || undefined);
        await sendMail({
          to: String(recipient.email),
          ...email,
          purpose: "order_update",
          idempotencyKey: `order-event-${String(job.event_key)}`,
        });
        await db.execute({
          sql: "UPDATE order_email_jobs SET status = 'sent', updated_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?",
          args: [job.id],
        });
      } catch (error: any) {
        const attempts = Number(job.attempts || 0) + 1;
        const status = attempts >= 5 ? "failed" : "pending";
        const delayMinutes = Math.min(60, 2 ** attempts);
        await db.execute({
          sql: `UPDATE order_email_jobs
                SET status = ?, attempts = ?, last_error = ?,
                    next_attempt_at = datetime('now', ?), updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          args: [status, attempts, String(error?.message || error).slice(0, 500), `+${delayMinutes} minutes`, job.id],
        });
      }
    }
  } catch (error) {
    console.error("[Order Email] Delivery worker failed:", error);
  } finally {
    orderEmailWorkerRunning = false;
  }
}
