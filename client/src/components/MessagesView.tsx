import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Clock,
  Wifi,
  WifiOff,
  Circle,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../contexts/AuthContext.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  otherUserId: string;
  otherUserName: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageIsMe: boolean;
  lastMessageAt: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ── Socket singleton (module-level so it persists across re-renders) ──────────

let socketInstance: Socket | null = null;

function getSocket(token: string): Socket {
  if (socketInstance && socketInstance.connected) return socketInstance;

  // Disconnect stale instance if it exists
  if (socketInstance) {
    socketInstance.disconnect();
  }

  const SOCKET_URL =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : "http://localhost:5000";

  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1500,
    timeout: 10_000,
  });

  return socketInstance;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MessagesView: React.FC<{
  initialConversationId?: string | null;
  onBack?: () => void;
}> = ({ initialConversationId, onBack }) => {
  const { user, token } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Socket state
  const [isConnected, setIsConnected] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvoRef = useRef<Conversation | null>(null);

  // Keep ref in sync so socket callbacks can read current activeConvo
  useEffect(() => {
    activeConvoRef.current = activeConvo;
  }, [activeConvo]);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ── Scroll to bottom ──────────────────────────────────────────────────────

  const scrollToBottom = useCallback((smooth = false) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, otherUserTyping, scrollToBottom]);

  // ── REST: fetch conversations list ────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/conversations", { headers });
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);

        if (initialConversationId) {
          const target = data.find(
            (c) => c.conversationId === initialConversationId,
          );
          if (target) setActiveConvo(target);
        }
      }
    } catch (err) {
      console.error("[Messages] fetchConversations error:", err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── REST: fetch full message history (called once when entering a convo) ──

  const fetchMessages = useCallback(
    async (convoId: string) => {
      try {
        const res = await fetch(`/api/messages/${convoId}`, { headers });
        if (res.ok) {
          const data: Message[] = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error("[Messages] fetchMessages error:", err);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [token],
  );

  // ── Socket.IO lifecycle ───────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    // ── Connection events ────────────────────────────────────────────────────
    const onConnect = () => {
      setIsConnected(true);
      console.log("[Socket] Connected:", socket.id);
      // Re-join active conversation room if we had one when reconnecting
      if (activeConvoRef.current) {
        socket.emit("join_conversation", {
          conversationId: activeConvoRef.current.conversationId,
        });
      }
    };

    const onDisconnect = (reason: string) => {
      setIsConnected(false);
      console.log("[Socket] Disconnected:", reason);
    };

    const onConnectError = (err: Error) => {
      setIsConnected(false);
      console.warn("[Socket] Connection error:", err.message);
    };

    // ── Incoming message ─────────────────────────────────────────────────────
    const onNewMessage = (msg: Message) => {
      const currentConvo = activeConvoRef.current;
      if (currentConvo && msg.conversation_id === currentConvo.conversationId) {
        setMessages((prev) => {
          // Deduplicate by ID
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Tell the server we've seen it
        socket.emit("mark_read", {
          conversationId: currentConvo.conversationId,
        });
        setOtherUserTyping(false); // clear typing indicator on new message
      }
      // Refresh conversation list so last-message preview + unread badge update
      fetchConversations();
    };

    // ── Unread count changed (we're in a different view) ─────────────────────
    const onUnreadCountChanged = () => {
      fetchConversations();
    };

    // ── Typing indicators ────────────────────────────────────────────────────
    const onUserTyping = ({
      userId,
    }: {
      userId: string;
      conversationId: string;
    }) => {
      if (userId !== user?.id) setOtherUserTyping(true);
    };

    const onUserStoppedTyping = ({ userId }: { userId: string }) => {
      if (userId !== user?.id) setOtherUserTyping(false);
    };

    // ── Read receipts ─────────────────────────────────────────────────────────
    const onMessagesRead = ({ conversationId }: { conversationId: string }) => {
      const currentConvo = activeConvoRef.current;
      if (currentConvo?.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id === user?.id ? { ...m, is_read: true } : m,
          ),
        );
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("new_message", onNewMessage);
    socket.on("unread_count_changed", onUnreadCountChanged);
    socket.on("user_typing", onUserTyping);
    socket.on("user_stopped_typing", onUserStoppedTyping);
    socket.on("messages_read", onMessagesRead);

    // Reflect current connection state immediately (in case already connected)
    setIsConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("new_message", onNewMessage);
      socket.off("unread_count_changed", onUnreadCountChanged);
      socket.off("user_typing", onUserTyping);
      socket.off("user_stopped_typing", onUserStoppedTyping);
      socket.off("messages_read", onMessagesRead);
    };
  }, [token, user?.id, fetchConversations]);

  // ── Join / leave conversation rooms ──────────────────────────────────────

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (activeConvo) {
      // Load history from REST
      fetchMessages(activeConvo.conversationId);
      // Join socket room
      socket.emit("join_conversation", {
        conversationId: activeConvo.conversationId,
      });
      // Mark existing messages as read
      socket.emit("mark_read", {
        conversationId: activeConvo.conversationId,
      });
    }

    return () => {
      if (activeConvo) {
        socket.emit("leave_conversation", {
          conversationId: activeConvo.conversationId,
        });
      }
      setOtherUserTyping(false);
    };
  }, [activeConvo, fetchMessages]);

  // ── Typing emit helpers ───────────────────────────────────────────────────

  const emitTypingStart = useCallback(() => {
    const socket = socketRef.current;
    const convo = activeConvoRef.current;
    if (!socket || !convo || !socket.connected) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing_start", { conversationId: convo.conversationId });
    }
    // Auto-stop typing after 2 s of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop();
    }, 2000);
  }, []);

  const emitTypingStop = useCallback(() => {
    const socket = socketRef.current;
    const convo = activeConvoRef.current;
    if (socket && convo && isTypingRef.current) {
      socket.emit("typing_stop", { conversationId: convo.conversationId });
    }
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  // Clear typing ref on unmount
  useEffect(() => {
    return () => {
      emitTypingStop();
    };
  }, [emitTypingStop]);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConvo || sending) return;
    setSending(true);
    setErrorMsg("");
    emitTypingStop();

    const socket = socketRef.current;
    const trimmedContent = newMessage.trim();

    // Prefer socket when connected for instant delivery
    if (socket && socket.connected) {
      // Optimistic: clear input immediately
      setNewMessage("");

      // One-time error listener for this send attempt
      const onError = ({ message }: { message: string }) => {
        setErrorMsg(message);
        setNewMessage(trimmedContent); // restore on error
        socket.off("message_error", onError);
        setSending(false);
      };
      socket.once("message_error", onError);

      socket.emit("send_message", {
        conversationId: activeConvo.conversationId,
        receiverId: activeConvo.otherUserId,
        listingId: activeConvo.listingId,
        content: trimmedContent,
      });

      // If no error arrives within 3 s, assume success
      setTimeout(() => {
        socket.off("message_error", onError);
        setSending(false);
      }, 3000);
    } else {
      // Fallback: REST API
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers,
          body: JSON.stringify({
            receiver_id: activeConvo.otherUserId,
            listing_id: activeConvo.listingId,
            content: trimmedContent,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setNewMessage("");
          fetchMessages(activeConvo.conversationId);
          fetchConversations();
        } else {
          setErrorMsg(data.error || "Failed to send message");
        }
      } catch {
        setErrorMsg("Network error while sending message. Please retry.");
      }
      setSending(false);
    }
  };

  // ── Clear error on convo change ───────────────────────────────────────────

  useEffect(() => {
    setErrorMsg("");
    setMessages([]);
  }, [activeConvo?.conversationId]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      emitTypingStart();
    } else {
      emitTypingStop();
    }
  };

  // ── Connection status pill ────────────────────────────────────────────────

  const ConnectionBadge = () => (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
        isConnected
          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
          : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
      }`}
      title={isConnected ? "Real-time connected" : "Reconnecting…"}
    >
      {isConnected ? (
        <Wifi className="h-2.5 w-2.5" />
      ) : (
        <WifiOff className="h-2.5 w-2.5" />
      )}
      {isConnected ? "Live" : "Reconnecting"}
    </span>
  );

  // ── Typing bubble ─────────────────────────────────────────────────────────

  const TypingBubble = () => (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-2xl bg-surface text-text-main rounded-bl-md flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <div className="mb-8 flex items-center gap-4">
        {onBack && !activeConvo && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-primary-hover rounded-xl transition-colors shrink-0"
            title="Go Back"
          >
            <ArrowLeft className="h-6 w-6 text-text-muted" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-text-main mb-1 flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-primary shrink-0" />
            Messages
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-text-muted text-sm">
              Chat with buyers and sellers
            </p>
            <ConnectionBadge />
          </div>
        </div>
      </div>

      <div
        className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden"
        style={{ minHeight: "500px" }}
      >
        {loading ? (
          /* Loading spinner */
          <div className="flex justify-center p-16">
            <span className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !activeConvo ? (
          /* ── Conversation List ───────────────────────────────────────────── */
          <div>
            {conversations.length === 0 ? (
              <div className="text-center py-16 text-text-muted">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No conversations yet</p>
                <p className="text-sm">
                  Start a conversation by clicking "Contact Seller" on a listing
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {conversations.map((convo) => (
                  <button
                    key={convo.conversationId}
                    onClick={() => setActiveConvo(convo)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-background transition-colors text-left"
                  >
                    <img
                      src={convo.listingImage}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover bg-surface shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-text-main">
                          {convo.otherUserName}
                        </p>
                        <span className="text-[10px] text-text-muted flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {timeAgo(convo.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-primary font-medium truncate">
                        {convo.listingTitle}
                      </p>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {convo.lastMessageIsMe ? "You: " : ""}
                        {convo.lastMessage}
                      </p>
                    </div>
                    {convo.unreadCount > 0 && (
                      <span className="bg-red-600 dark:bg-red-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0">
                        {convo.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Active Chat ─────────────────────────────────────────────────── */
          <div className="flex flex-col h-[500px]">
            {/* Chat header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-background">
              <button
                onClick={() => {
                  if (initialConversationId && conversations.length <= 1) {
                    onBack?.();
                  } else {
                    setActiveConvo(null);
                    fetchConversations();
                  }
                }}
                className="p-1.5 hover:bg-primary-hover rounded-lg transition-colors shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-text-muted" />
              </button>
              <img
                src={activeConvo.listingImage}
                alt=""
                className="w-10 h-10 rounded-lg object-cover bg-surface shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-main truncate">
                    {activeConvo.otherUserName}
                  </p>
                  {/* Online indicator dot (purely decorative — shows when socket is up) */}
                  {isConnected && (
                    <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-text-muted truncate">
                  {activeConvo.listingTitle}
                </p>
              </div>
              <ConnectionBadge />
            </div>

            {/* Messages area */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {messages.length === 0 && (
                <div className="flex justify-center py-8 text-text-muted text-xs font-medium opacity-60">
                  Start of conversation
                </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-surface text-text-main rounded-bl-md border border-border"
                      }`}
                    >
                      <p>{msg.content}</p>
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 ${
                          isMe
                            ? "text-primary-foreground/60"
                            : "text-text-muted"
                        }`}
                      >
                        <span className="text-[10px]">
                          {timeAgo(msg.created_at)}
                        </span>
                        {/* Read receipt checkmarks for sent messages */}
                        {isMe && (
                          <span className="text-[10px] select-none">
                            {msg.is_read ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {otherUserTyping && <TypingBubble />}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-border bg-background flex flex-col gap-2">
              {errorMsg && (
                <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-xs px-3 py-2 rounded-lg font-medium">
                  {errorMsg}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={emitTypingStop}
                  placeholder="Type a message…"
                  className="flex-1 px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-text-main"
                  disabled={sending}
                  autoComplete="off"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {!isConnected && (
                <p className="text-[10px] text-amber-500 dark:text-amber-400 font-medium text-center">
                  Reconnecting to real-time server… messages will be sent via
                  HTTP fallback.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
