import "./env.js";
import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import session from "express-session";
import passport from "passport";
import jwt from "jsonwebtoken";
import db from "./db/database.js";
import fs from "fs";
import "./db/init.js";
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
import listingsRoutes from "./routes/listings.js";
import ordersRoutes from "./routes/orders.js";
import usersRoutes from "./routes/users.js";
import adminRoutes from "./routes/admin.js";
import messagesRoutes from "./routes/messages.js";
import notificationsRoutes from "./routes/notifications.js";
import reviewsRoutes from "./routes/reviews.js";
import pushRoutes from "./routes/push.js";
import resourcesRoutes from "./routes/resources.js";

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

const JWT_SECRET =
  process.env.JWT_SECRET || "opennotes-dev-secret-change-in-prod";

// ── Security: Warn if session secret is default ───────────────────────────────
if (process.env.NODE_ENV === "production") {
  if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET === "opennotes-session-secret"
  ) {
    console.error(
      "[FATAL] SESSION_SECRET is not set or is using the default value in production. " +
      "Server startup aborted.",
    );
    process.exit(1);
  }
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

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

// Fallback if FRONTEND_URL is missing but we know the Vercel domain
if (!allowedOrigins.includes("https://open-notes-in-client.vercel.app")) {
  allowedOrigins.push("https://open-notes-in-client.vercel.app");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.set("io", io);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

// Session & Passport (Session is still used by Passport Google strategy)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "opennotes-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax'
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id],
    });
    done(null, result.rows[0] as any);
  } catch (err) {
    done(err);
  }
});

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "OpenNotes.in API is running" });
});

app.get("/", (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
  res.redirect(frontendUrl);
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error Handler]:', err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ── Start HTTP + WebSocket server ────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO ready for real-time messaging`);
});

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
