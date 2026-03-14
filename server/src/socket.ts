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
        // Check if an order exists between these two users for this listing
        // This allows joining a room even if no messages have been sent yet.
        const [u1, u2, lId] = conversationId.split('_');

        if (!u1 || !u2 || !lId) {
          socket.emit("error", { message: "Invalid conversation ID" });
          return;
        }

        if (userId !== u1 && userId !== u2) {
          socket.emit("error", { message: "Not authorized for this conversation" });
          return;
        }

        const orderCheck = await db.execute({
          sql: `SELECT o.id FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.listing_id = ?
                  AND (o.buyer_id = ? OR oi.seller_id = ?)
                LIMIT 1`,
          args: [lId, userId, userId],
        });

        if (orderCheck.rows.length === 0) {
          socket.emit("error", { message: "No purchase found for this item." });
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

    socket.on("disconnect", (reason) => {
      // disconnected
    });
  });

  return io;
};
