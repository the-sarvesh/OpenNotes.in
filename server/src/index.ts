import "./env.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import session from "express-session";
import passport from "passport";
import jwt from "jsonwebtoken";
import db from "./db/database.js";
import "./db/init.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from "./routes/auth.js";
import listingsRoutes from "./routes/listings.js";
import ordersRoutes from "./routes/orders.js";
import usersRoutes from "./routes/users.js";
import adminRoutes from "./routes/admin.js";
import messagesRoutes from "./routes/messages.js";
import notificationsRoutes from "./routes/notifications.js";
import reviewsRoutes from "./routes/reviews.js";

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
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET === "opennotes-session-secret")
) {
  console.error(
    "[FATAL] SESSION_SECRET is not set or is using the default value in production. " +
      "Server startup aborted.",
  );
  process.exit(1);
}

// ── Socket.IO setup ──────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Use websocket first, fall back to polling
  transports: ["websocket", "polling"],
});

// ── Socket.IO JWT auth middleware ────────────────────────────────────────────
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");

  if (!token) {
    return next(new Error("Authentication token required"));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
    };
    (socket as any).userId = payload.id;
    (socket as any).userEmail = payload.email;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

// ── Socket.IO connection handler ─────────────────────────────────────────────
io.on("connection", (socket) => {
  const userId = (socket as any).userId as string;
  console.log(`[Socket] User connected: ${userId} (${socket.id})`);

  // ── Join personal room for notifications ──────────────────────────────────
  socket.join(`user:${userId}`);

  // ── Join a conversation room ──────────────────────────────────────────────
  // Client emits: { conversationId: string }
  socket.on(
    "join_conversation",
    async ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) return;

      try {
        // Verify user is actually part of this conversation
        const check = await db.execute({
          sql: "SELECT id FROM messages WHERE conversation_id = ? AND (sender_id = ? OR receiver_id = ?) LIMIT 1",
          args: [conversationId, userId, userId],
        });

        if (check.rows.length === 0) {
          socket.emit("error", {
            message: "Not authorized for this conversation",
          });
          return;
        }

        socket.join(`conv:${conversationId}`);
        console.log(
          `[Socket] User ${userId} joined conversation ${conversationId}`,
        );
      } catch (err) {
        console.error("[Socket] join_conversation error:", err);
      }
    },
  );

  // ── Leave a conversation room ─────────────────────────────────────────────
  socket.on(
    "leave_conversation",
    ({ conversationId }: { conversationId: string }) => {
      socket.leave(`conv:${conversationId}`);
      console.log(
        `[Socket] User ${userId} left conversation ${conversationId}`,
      );
    },
  );

  // ── Send a message via socket ─────────────────────────────────────────────
  // Client emits: { conversationId, receiverId, listingId, content }
  // Server saves to DB and broadcasts to room members
  socket.on(
    "send_message",
    async ({
      conversationId,
      receiverId,
      listingId,
      content,
    }: {
      conversationId: string;
      receiverId: string;
      listingId: string;
      content: string;
    }) => {
      if (!conversationId || !receiverId || !content?.trim()) {
        socket.emit("message_error", { message: "Invalid message payload" });
        return;
      }

      if (receiverId === userId) {
        socket.emit("message_error", { message: "Cannot message yourself" });
        return;
      }

      try {
        // Verify order exists (same check as REST endpoint)
        const orderCheck = await db.execute({
          sql: `SELECT o.id FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.listing_id = ?
                  AND ((o.buyer_id = ? AND oi.seller_id = ?) OR (o.buyer_id = ? AND oi.seller_id = ?))
                LIMIT 1`,
          args: [listingId, userId, receiverId, receiverId, userId],
        });

        if (orderCheck.rows.length === 0) {
          socket.emit("message_error", {
            message: "You can only message users after purchasing their item",
          });
          return;
        }

        // Verify user is in the conversation room they claim
        const sorted = [userId, receiverId].sort();
        const expectedConvId = `${sorted[0]}_${sorted[1]}_${listingId}`;
        if (conversationId !== expectedConvId) {
          socket.emit("message_error", { message: "Invalid conversation ID" });
          return;
        }

        // Persist to DB
        const { v4: uuidv4 } = await import("uuid");
        const messageId = uuidv4();

        await db.execute({
          sql: `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, content)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            messageId,
            conversationId,
            userId,
            receiverId,
            listingId,
            content.trim(),
          ],
        });

        // Fetch sender name
        const senderRes = await db.execute({
          sql: "SELECT name FROM users WHERE id = ?",
          args: [userId],
        });
        const senderName = (senderRes.rows[0]?.name as string) || "Unknown";

        const messagePayload = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: userId,
          receiver_id: receiverId,
          listing_id: listingId,
          sender_name: senderName,
          content: content.trim(),
          is_read: false,
          created_at: new Date().toISOString(),
        };

        // Broadcast to everyone in the conversation room (including sender)
        io.to(`conv:${conversationId}`).emit("new_message", messagePayload);

        // Also push a socket notification to the receiver's personal room
        // so their unread badge updates in real-time even if they're on a diff view
        io.to(`user:${receiverId}`).emit("unread_count_changed");
      } catch (err) {
        console.error("[Socket] send_message error:", err);
        socket.emit("message_error", { message: "Failed to send message" });
      }
    },
  );

  // ── Mark messages as read ─────────────────────────────────────────────────
  socket.on(
    "mark_read",
    async ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) return;
      try {
        await db.execute({
          sql: "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ?",
          args: [conversationId, userId],
        });
        // Notify sender that messages were read (optional read receipts)
        socket.to(`conv:${conversationId}`).emit("messages_read", {
          conversationId,
          readBy: userId,
        });
      } catch (err) {
        console.error("[Socket] mark_read error:", err);
      }
    },
  );

  // ── Typing indicators ─────────────────────────────────────────────────────
  socket.on(
    "typing_start",
    ({ conversationId }: { conversationId: string }) => {
      socket
        .to(`conv:${conversationId}`)
        .emit("user_typing", { userId, conversationId });
    },
  );

  socket.on("typing_stop", ({ conversationId }: { conversationId: string }) => {
    socket
      .to(`conv:${conversationId}`)
      .emit("user_stopped_typing", { userId, conversationId });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[Socket] User disconnected: ${userId} (${reason})`);
  });
});

// ── Export io for use in route handlers (e.g. push real-time notifications) ──
export { io };

// ── Express Middleware ───────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

// Session & Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || "opennotes-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
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
    done(null, result.rows[0]);
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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "OpenNotes.in API is running" });
});

app.get("/", (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  res.redirect(frontendUrl);
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
