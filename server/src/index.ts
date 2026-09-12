import "./env.js";
import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import { createServer } from "http";
import passport from "passport";
import crypto from "crypto";
import db from "./db/database.js";
import fs from "fs";
import { initDb } from "./db/init.js";
import { initSocket, io } from "./socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Ensure uploads directory exists ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`[Init] Created missing uploads directory: ${uploadsDir}`);
}

import authRoutes from "./routes/auth.js";
import telegramRoutes from "./routes/telegram.js";
import { initTelegramBot } from "./utils/telegram.js";
import settingsRouter from "./routes/settings.js";
import listingsRoutes from "./routes/listings.js";
import ordersRoutes from "./routes/orders.js";
import usersRoutes from "./routes/users.js";
import adminRoutes from "./routes/admin.js";
import messagesRoutes from "./routes/messages.js";
import notificationsRoutes from "./routes/notifications.js";
import reviewsRoutes from "./routes/reviews.js";
import pushRoutes from "./routes/push.js";
import resourcesRoutes from "./routes/resources.js";
import feedbackRoutes from "./routes/feedback.js";
import issuesRoutes from "./routes/issues.js";
import resendWebhookRoutes from "./routes/resend-webhook.js";
import { processNotificationDeliveryJobs } from "./utils/notifications.js";


// NOTE: Coupon routes are handled under /api/admin/coupons (admin.ts)
// NOTE: Coupon validation at checkout is handled under /api/orders/validate-coupon (orders.ts)
// ── PAYMENT GATEWAY HOOK ─────────────────────────────────────────────────────
// TODO: When integrating Razorpay (or any other gateway):
//   1. npm install razorpay
//   2. Create server/src/routes/payments.ts
//   3. Add: import paymentsRoutes from './routes/payments.js';
//   4. Add: app.use('/api/payments', paymentsRoutes);
//   5. Move platform fee collection logic from orders.ts into that route.
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Render/Vercel forward the real client IP and protocol through one trusted proxy.
// This is required for accurate rate limiting and secure-cookie detection.
app.set("trust proxy", 1);

const JWT_SECRET =
  process.env.JWT_SECRET || "opennotes-dev-secret-change-in-prod";

// ── Security: refuse to start with a default signing key ─────────────────────
if (process.env.NODE_ENV === "production") {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET === "opennotes-dev-secret-change-in-prod"
  ) {
    console.error(
      "[FATAL] JWT_SECRET is not set or is using the default value in production. " +
      "Server startup aborted.",
    );
    process.exit(1);
  }
}

// ── Socket.IO setup ──────────────────────────────────────────────────────────
initSocket(httpServer);

// ── Export io for use in route handlers (e.g. push real-time notifications) ──
export { io } from "./socket.js";

// ── Express Middleware ───────────────────────────────────────────────────────
app.use(cookieParser());

// Safe baseline headers without a restrictive CSP that could break existing
// Cloudinary images, Google OAuth, sockets, or Vercel assets.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Request IDs make a user report traceable without logging private query values.
app.use((req, res, next) => {
  const requestId = String(req.get("x-request-id") || crypto.randomUUID()).slice(0, 128);
  const startedAt = Date.now();
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    console.log(JSON.stringify({
      type: "http_request",
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
});

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL?.replace(/\/$/, ""),
  "https://opennotes.in",
  "https://www.opennotes.in"
].filter(Boolean) as string[];

for (const previewOrigin of (process.env.ALLOWED_PREVIEW_ORIGINS || "").split(",")) {
  const normalized = previewOrigin.trim().replace(/\/$/, "");
  if (normalized.startsWith("https://") && !allowedOrigins.includes(normalized)) {
    allowedOrigins.push(normalized);
  }
}

// Fallback if FRONTEND_URL is missing but we know the Vercel domain
if (!allowedOrigins.includes("https://open-notes-in-client.vercel.app")) {
  allowedOrigins.push("https://open-notes-in-client.vercel.app");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.set("io", io);
app.use("/api/webhooks/resend", express.raw({ type: "application/json", limit: "256kb" }), resendWebhookRoutes);
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

// OAuth callbacks issue JWTs and explicitly use session:false, so a process-local
// session store is unnecessary and unsafe when the service scales horizontally.
app.use(passport.initialize());

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/resources", resourcesRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/settings", settingsRouter);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/issues", issuesRoutes);


app.get("/api/health", async (_req, res) => {
  try {
    await db.execute("SELECT 1 AS ok");
    res.json({
      status: "ok",
      database: "connected",
      emailConfigured: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_PASS),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Health] Database check failed:", error);
    res.status(503).json({
      status: "degraded",
      database: "unavailable",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/", (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
  res.redirect(frontendUrl);
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error Handler]:', err);
  const uploadMessages: Record<string, string> = {
    LIMIT_FILE_SIZE: "The selected file is too large.",
    LIMIT_FILE_COUNT: "Too many files were selected.",
    LIMIT_UNEXPECTED_FILE: "This file type or upload field is not supported.",
  };
  const uploadMessage = typeof err?.code === "string" ? uploadMessages[err.code] : undefined;
  const status = uploadMessage ? 400 : (Number(err.status || err.statusCode) || 500);
  const isSafeClientError = status >= 400 && status < 500;
  res.status(status).json({
    error: uploadMessage || (isSafeClientError && err.message ? err.message : "Internal server error"),
    requestId: res.getHeader("X-Request-Id"),
  });
});

// ── Telegram Webhook Registration ───────────────────────────────────────────
const registerTelegramWebhook = async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.BACKEND_URL;
  if (!token || !appUrl) {
    console.warn('[Telegram] Skipping webhook registration: TELEGRAM_BOT_TOKEN or BACKEND_URL missing');
    return;
  }

  if (!appUrl.startsWith('https://')) {
    console.info('[Telegram] Local development detected (non-HTTPS). Skipping webhook registration. Bot will use polling if enabled.');
    return;
  }

  try {
    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = (await res.json()) as any;
    console.log(
      "[Telegram] Webhook:",
      data.ok ? `registered at ${webhookUrl}` : data.description,
    );
  } catch (err) {
    console.error("[Telegram] Webhook error:", err);
  }
};

// ── Start HTTP + WebSocket server only after the schema is ready ─────────────
const startServer = async () => {
  await initDb();
  httpServer.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO ready for real-time messaging`);
    initTelegramBot();
    const appUrl = process.env.BACKEND_URL;
    if (appUrl && appUrl.startsWith('https://')) {
      registerTelegramWebhook();
    } else if (process.env.USE_POLLING === 'true') {
      // In local development, ONLY use polling if explicitly enabled.
      // Otherwise, a local server could steal traffic from the production bot.
      const bot = (await import('./utils/telegram.js')).getBot();
      if (bot) {
        bot.launch().then(() => console.log('[Telegram] Bot started in polling mode (USE_POLLING=true)')).catch(e => console.error('[Telegram] Polling error:', e));
      }
    } else {
      console.log('[Telegram] Skipping bot polling (Set USE_POLLING=true if testing locally)');
    }
    void processNotificationDeliveryJobs();
  });
};

void startServer().catch((error) => {
  console.error("[FATAL] Server startup failed:", error);
  process.exit(1);
});

setInterval(() => {
  void processNotificationDeliveryJobs();
}, 30 * 1000);

// ── Auto-archive out-of-stock listings every 1 hour ─────────────────────────
setInterval(
  async () => {
    try {
      const result = await db.execute(
        "UPDATE listings SET status = 'archived' WHERE status = 'active' AND quantity = 0",
      );
      if (result.rowsAffected > 0) {
        console.log(
          `[Cron] Auto-archived ${result.rowsAffected} out-of-stock listings`,
        );
      }
    } catch (err) {
      console.error("[Cron] Auto-archive error:", err);
    }
  },
  60 * 60 * 1000,
);

// ── Automated Meetup Reminders every 5 minutes ──────────────────────────────
setInterval(
  async () => {
    try {
      const now = new Date();
      const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000);
      const thirtyFiveMinsLater = new Date(now.getTime() + 35 * 60 * 1000);

      // Find accepted meetups happening in the next 30-35 minutes that haven't had a reminder
      const upcoming = await db.execute({
        sql: `SELECT * FROM meetup_proposals 
              WHERE status = 'accepted' 
                AND reminder_sent = 0 
                AND proposed_time BETWEEN ? AND ?`,
        args: [thirtyMinsLater.toISOString(), thirtyFiveMinsLater.toISOString()]
      });

      if (upcoming.rows.length > 0) {
        const { createNotification } = await import('./utils/notifications.js');

        for (const proposal of upcoming.rows as any[]) {
          const message = `Reminder: Meetup at ${proposal.location} in 30 minutes!`;

          await createNotification(proposal.sender_id, 'meetup_reminder', 'Meetup Soon! ⏰', message, '/messages');
          await createNotification(proposal.receiver_id, 'meetup_reminder', 'Meetup Soon! ⏰', message, '/messages');

          // Mark as sent
          await db.execute({
            sql: "UPDATE meetup_proposals SET reminder_sent = 1 WHERE id = ?",
            args: [proposal.id]
          });

          console.log(`[Cron] Sent meetup reminders for proposal ${proposal.id}`);
        }
      }
    } catch (err) {
      console.error("[Cron] Meetup reminder error:", err);
    }
  },
  5 * 60 * 1000,
);
