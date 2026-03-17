import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import db from "./db/database.js";

const JWT_SECRET = process.env.JWT_SECRET || "opennotes-dev-secret-change-in-prod";

export let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3001",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Socket.IO JWT auth middleware
  io.use((socket, next) => {
    let token = socket.handshake.auth?.token;

    if (!token && socket.handshake.headers?.cookie) {
      const cookieHeader = socket.handshake.headers.cookie;
      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach(c => {
        const parts = c.trim().split('=');
        if (parts.length === 2) {
          cookies[parts[0]] = parts[1];
        }
      });
      token = cookies['auth_token'];
    }

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
    } catch (err: any) {
      console.error("[Socket Auth] Token verification failed:", err.message);
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId as string;

    socket.join(`user:${userId}`);

    socket.on("join_conversation", async ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) return;
      try {
        const [u1, u2] = conversationId.split('_');

        if (!u1 || !u2) {
          socket.emit("error", { message: "Invalid conversation ID" });
          return;
        }

        if (userId !== u1 && userId !== u2) {
          socket.emit("error", { message: "Not authorized for this conversation" });
          return;
        }

        const otherUserId = userId === u1 ? u2 : u1;

        const orderCheck = await db.execute({
          sql: `SELECT o.id FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE (o.buyer_id = ? AND oi.seller_id = ?) 
                   OR (o.buyer_id = ? AND oi.seller_id = ?)
                LIMIT 1`,
          args: [userId, otherUserId, otherUserId, userId],
        });

        if (orderCheck.rows.length === 0) {
          socket.emit("error", { message: "No purchase found between you and this user." });
          return;
        }
        socket.join(`conv:${conversationId}`);
      } catch (err) {
        console.error("[Socket] join_conversation error:", err);
      }
    });

    socket.on("leave_conversation", ({ conversationId }: { conversationId: string }) => {
      socket.leave(`conv:${conversationId}`);
    });

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
          // Verify order exists (any order between these two)
          const orderCheck = await db.execute({
            sql: `SELECT oi.id FROM order_items oi
                  JOIN orders o ON o.id = oi.order_id
                  WHERE ((o.buyer_id = ? AND oi.seller_id = ?) 
                     OR (o.buyer_id = ? AND oi.seller_id = ?))
                     AND oi.status NOT IN ('completed', 'cancelled')
                  LIMIT 1`,
            args: [userId, receiverId, receiverId, userId],
          });

          if (orderCheck.rows.length === 0) {
            socket.emit("message_error", {
              message: "This conversation is closed. You can only message while a transaction is active.",
            });
            return;
          }

          // Verify user is in the conversation room they claim
          const sorted = [userId, receiverId].sort();
          const expectedConvId = `${sorted[0]}_${sorted[1]}`;
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

          // Broadcast to everyone in the conversation room PLUS the receiver's personal room
          // (Socket.IO ensures a single socket in both rooms only gets it once)
          io.to(`conv:${conversationId}`).to(`user:${receiverId}`).emit("new_message", messagePayload);

          // Also push a badge update notification to the receiver's personal room
          io.to(`user:${receiverId}`).emit("unread_count_changed");

          // Trigger Web Push for background notification
          import('./utils/notifications.js').then(({ sendPushNotification }) => {
            sendPushNotification(receiverId, {
              title: `New message from ${senderName}`,
              body: content.trim().length > 100 ? content.trim().substring(0, 97) + '...' : content.trim(),
              url: '/messages',
              icon: '/logo192.png',
              tag: 'message'
            });
          });
        } catch (err) {
          console.error("[Socket] send_message error:", err);
          socket.emit("message_error", { message: "Failed to send message" });
        }
      },
    );

    socket.on("mark_read", async ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) return;
      try {
        await db.execute({
          sql: "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ?",
          args: [conversationId, userId],
        });
        socket.to(`conv:${conversationId}`).emit("messages_read", { conversationId, readBy: userId });
      } catch (err) {
        console.error("[Socket] mark_read error:", err);
      }
    });

    socket.on("typing_start", ({ conversationId }: { conversationId: string }) => {
      socket.to(`conv:${conversationId}`).emit("user_typing", { userId, conversationId });
    });

    socket.on("typing_stop", ({ conversationId }: { conversationId: string }) => {
      socket.to(`conv:${conversationId}`).emit("user_stopped_typing", { userId, conversationId });
    });

    // ── Meetup Proposals ─────────────────────────────────────────────────────

    socket.on("propose_meetup", async ({ conversationId, receiverId, listingId, proposedTime, location }) => {
      try {
        // Verify active order exists for this specific listing
        const orderCheck = await db.execute({
          sql: `SELECT oi.id FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE ((o.buyer_id = ? AND oi.seller_id = ?) 
                   OR (o.buyer_id = ? AND oi.seller_id = ?))
                   AND oi.listing_id = ?
                   AND oi.status NOT IN ('completed', 'cancelled')
                LIMIT 1`,
          args: [userId, receiverId, receiverId, userId, listingId],
        });

        if (orderCheck.rows.length === 0) {
          socket.emit("message_error", { message: "Cannot propose meetup for non-active orders." });
          return;
        }

        const { v4: uuidv4 } = await import("uuid");
        const proposalId = uuidv4();
        const messageId = uuidv4();

        // 1. Create proposal
        await db.execute({
          sql: `INSERT INTO meetup_proposals (id, conversation_id, sender_id, receiver_id, listing_id, proposed_time, location, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
          args: [proposalId, conversationId, userId, receiverId, listingId, proposedTime, location]
        });

        // 2. Create structured message
        const content = `Meetup Proposal: ${location} at ${new Date(proposedTime).toLocaleString()}`;
        const metadata = JSON.stringify({ proposalId, proposedTime, location, status: 'pending' });

        await db.execute({
          sql: `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, content, type, metadata)
                VALUES (?, ?, ?, ?, ?, ?, 'meetup_proposal', ?)`,
          args: [messageId, conversationId, userId, receiverId, listingId, content, metadata]
        });

        const senderRes = await db.execute({ sql: "SELECT name FROM users WHERE id = ?", args: [userId] });
        const senderName = (senderRes.rows[0]?.name as string) || "Someone";

        const messagePayload = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: userId,
          receiver_id: receiverId,
          listing_id: listingId,
          sender_name: senderName,
          content,
          type: 'meetup_proposal',
          metadata,
          is_read: false,
          created_at: new Date().toISOString(),
        };

        io.to(`conv:${conversationId}`).emit("new_message", messagePayload);

        io.to(`user:${receiverId}`).emit("unread_count_changed");

        // Web Push
        import('./utils/notifications.js').then(({ sendPushNotification }) => {
          sendPushNotification(receiverId, {
            title: `Meetup proposed by ${senderName}`,
            body: `Location: ${location}`,
            url: '/messages',
            icon: '/logo192.png',
            tag: 'meetup'
          });
        });

      } catch (err) {
        console.error("[Socket] propose_meetup error:", err);
      }
    });

    socket.on("accept_meetup", async ({ conversationId, proposalId, messageId }) => {
      try {
        // Update proposal
        await db.execute({
          sql: "UPDATE meetup_proposals SET status = 'accepted' WHERE id = ?",
          args: [proposalId]
        });

        // Update message metadata to reflect acceptance
        const msgRes = await db.execute({ sql: "SELECT metadata FROM messages WHERE id = ?", args: [messageId] });
        if (msgRes.rows[0]) {
          const metadata = JSON.parse(msgRes.rows[0].metadata as string);
          metadata.status = 'accepted';
          await db.execute({
            sql: "UPDATE messages SET metadata = ? WHERE id = ?",
            args: [JSON.stringify(metadata), messageId]
          });
        }

        io.to(`conv:${conversationId}`).emit("meetup_status_changed", { proposalId, status: 'accepted', messageId });

        // Notify proposer
        const proposalRes = await db.execute({ sql: "SELECT sender_id FROM meetup_proposals WHERE id = ?", args: [proposalId] });
        if (proposalRes.rows[0]) {
          const proposerId = proposalRes.rows[0].sender_id as string;
          import('./utils/notifications.js').then(({ createNotification }) => {
            createNotification(proposerId, 'meetup', 'Meetup Accepted! 🤝', 'The other party has accepted your meetup proposal.', '/messages');
          });
        }
      } catch (err) {
        console.error("[Socket] accept_meetup error:", err);
      }
    });

    socket.on("decline_meetup", async ({ conversationId, proposalId, messageId }) => {
      try {
        await db.execute({
          sql: "UPDATE meetup_proposals SET status = 'declined' WHERE id = ?",
          args: [proposalId]
        });

        // Update message metadata
        const msgRes = await db.execute({ sql: "SELECT metadata FROM messages WHERE id = ?", args: [messageId] });
        if (msgRes.rows[0]) {
          const metadata = JSON.parse(msgRes.rows[0].metadata as string);
          metadata.status = 'declined';
          await db.execute({
            sql: "UPDATE messages SET metadata = ? WHERE id = ?",
            args: [JSON.stringify(metadata), messageId]
          });
        }

        io.to(`conv:${conversationId}`).emit("meetup_status_changed", { proposalId, status: 'declined', messageId });
      } catch (err) {
        console.error("[Socket] decline_meetup error:", err);
      }
    });

    socket.on("cancel_meetup", async ({ conversationId, proposalId, messageId }) => {
      try {
        await db.execute({
          sql: "UPDATE meetup_proposals SET status = 'cancelled' WHERE id = ? AND sender_id = ?",
          args: [proposalId, userId]
        });

        // Update message metadata
        const msgRes = await db.execute({ sql: "SELECT metadata FROM messages WHERE id = ?", args: [messageId] });
        if (msgRes.rows[0]) {
          const metadata = JSON.parse(msgRes.rows[0].metadata as string);
          metadata.status = 'cancelled';
          await db.execute({
            sql: "UPDATE messages SET metadata = ? WHERE id = ?",
            args: [JSON.stringify(metadata), messageId]
          });
        }

        io.to(`conv:${conversationId}`).emit("meetup_status_changed", { proposalId, status: 'cancelled', messageId });
      } catch (err) {
        console.error("[Socket] cancel_meetup error:", err);
      }
    });

    socket.on("arrived_at_meetup", async ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) return;
      try {
        const [u1, u2] = conversationId.split('_');
        if (userId !== u1 && userId !== u2) return;

        // Verify active order exists in the conversation
        const orderCheck = await db.execute({
          sql: `SELECT oi.id FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE ((o.buyer_id = ? AND oi.seller_id = ?) 
                   OR (o.buyer_id = ? AND oi.seller_id = ?))
                   AND oi.status NOT IN ('completed', 'cancelled')
                LIMIT 1`,
          args: [u1, u2, u1, u2],
        });

        if (orderCheck.rows.length > 0) {
          io.to(`conv:${conversationId}`).emit("other_user_arrived", { userId });
        }
      } catch (err) {
        console.error("[Socket] arrived_at_meetup error:", err);
      }
    });

    socket.on("disconnect", (reason) => {
      // disconnected
    });
  });

  return io;
};
