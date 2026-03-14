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
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { getSocket } from "../utils/socket.js";
import { Socket } from "socket.io-client";
import { useAuth } from "../contexts/AuthContext.js";
import { apiRequest } from "../utils/api.js";

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

// ── Helpers ────────────────────────────────────────────────────────────

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  content: string;
  type?: 'text' | 'meetup_proposal';
  metadata?: string;
  is_read: boolean;
  created_at: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MessagesView: React.FC<{
  initialConversationId?: string | null;
  onBack?: () => void;
}> = ({ initialConversationId, onBack }) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Meetup Proposal State
  const [showMeetupModal, setShowMeetupModal] = useState(false);
  const [meetupTime, setMeetupTime] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");

  // Socket state
  const [isConnected, setIsConnected] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvoRef = useRef<Conversation | null>(null);
  const hasHandledInitialId = useRef(false);

  useEffect(() => {
    activeConvoRef.current = activeConvo;
  }, [activeConvo]);

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

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiRequest("/api/messages/conversations");
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);

        if (initialConversationId && !hasHandledInitialId.current) {
          const target = data.find(
            (c) => c.conversationId === initialConversationId,
          );
          if (target) {
            setActiveConvo(target);
            hasHandledInitialId.current = true;
          }
        }
      }
    } catch (err) {
      console.error("[Messages] fetchConversations error:", err);
    }
    setLoading(false);
  }, [initialConversationId]);

  useEffect(() => {
    hasHandledInitialId.current = false;
  }, [initialConversationId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(
    async (convoId: string) => {
      try {
        const res = await apiRequest(`/api/messages/${convoId}`);
        if (res.ok) {
          const data: Message[] = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error("[Messages] fetchMessages error:", err);
      }
    },
    [],
  );

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      if (activeConvoRef.current) {
        socket.emit("join_conversation", {
          conversationId: activeConvoRef.current.conversationId,
        });
      }
    };

    const onDisconnect = () => setIsConnected(false);
    const onConnectError = () => setIsConnected(false);

    const onNewMessage = (msg: Message) => {
      const currentConvo = activeConvoRef.current;
      if (currentConvo && msg.conversation_id === currentConvo.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        socket.emit("mark_read", {
          conversationId: currentConvo.conversationId,
        });
        setOtherUserTyping(false);
      }
      fetchConversations();
    };

    const onUnreadCountChanged = () => fetchConversations();

    const onUserTyping = ({ userId: id }: { userId: string }) => {
      if (id !== user?.id) setOtherUserTyping(true);
    };

    const onUserStoppedTyping = ({ userId: id }: { userId: string }) => {
      if (id !== user?.id) setOtherUserTyping(false);
    };

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

    const onMeetupStatusChanged = ({ proposalId, status, messageId }: { proposalId: string, status: string, messageId: string }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const metadata = JSON.parse(m.metadata || '{}');
          return { ...m, metadata: JSON.stringify({ ...metadata, status }) };
        }
        return m;
      }));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("new_message", onNewMessage);
    socket.on("unread_count_changed", onUnreadCountChanged);
    socket.on("user_typing", onUserTyping);
    socket.on("user_stopped_typing", onUserStoppedTyping);
    socket.on("messages_read", onMessagesRead);
    socket.on("meetup_status_changed", onMeetupStatusChanged);

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
      socket.off("meetup_status_changed", onMeetupStatusChanged);
    };
  }, [user?.id, fetchConversations]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (activeConvo) {
      fetchMessages(activeConvo.conversationId);
      socket.emit("join_conversation", {
        conversationId: activeConvo.conversationId,
      });
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

  const emitTypingStart = useCallback(() => {
    const socket = socketRef.current;
    const convo = activeConvoRef.current;
    if (!socket || !convo || !socket.connected) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing_start", { conversationId: convo.conversationId });
    }
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

  useEffect(() => {
    return () => emitTypingStop();
  }, [emitTypingStop]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConvo || sending) return;
    setSending(true);
    setErrorMsg("");
    emitTypingStop();

    const socket = socketRef.current;
    const trimmedContent = newMessage.trim();

    if (socket && socket.connected) {
      setNewMessage("");
      const onError = ({ message }: { message: string }) => {
        setErrorMsg(message);
        setNewMessage(trimmedContent);
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

      setTimeout(() => {
        socket.off("message_error", onError);
        setSending(false);
      }, 3000);
    } else {
      try {
        const res = await apiRequest("/api/messages", {
          method: "POST",
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

  useEffect(() => {
    setErrorMsg("");
    setMessages([]);
  }, [activeConvo?.conversationId]);

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

  const handleProposeMeetup = () => {
    if (!meetupTime || !meetupLocation || !activeConvo) return;
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("propose_meetup", {
        conversationId: activeConvo.conversationId,
        receiverId: activeConvo.otherUserId,
        listingId: activeConvo.listingId,
        proposedTime: meetupTime,
        location: meetupLocation
      });
      setShowMeetupModal(false);
      setMeetupTime("");
      setMeetupLocation("");
    }
  };

  const handleAcceptMeetup = (proposalId: string, messageId: string) => {
    const socket = socketRef.current;
    if (socket && socket.connected && activeConvo) {
      socket.emit("accept_meetup", {
        conversationId: activeConvo.conversationId,
        proposalId,
        messageId
      });
    }
  };

  const handleDeclineMeetup = (proposalId: string, messageId: string) => {
    const socket = socketRef.current;
    if (socket && socket.connected && activeConvo) {
      socket.emit("decline_meetup", {
        conversationId: activeConvo.conversationId,
        proposalId,
        messageId
      });
    }
  };

  const ConnectionBadge = () => (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
        isConnected
          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
          : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
      }`}
    >
      {isConnected ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
      {isConnected ? "Live" : "Reconnecting"}
    </span>
  );

  const TypingBubble = () => (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-2xl bg-surface text-text-main rounded-bl-md flex items-center gap-1.5 border border-border">
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );

  const MeetupBubble = ({ msg, isMe }: { msg: Message, isMe: boolean }) => {
    const metadata = JSON.parse(msg.metadata || '{}');
    const { location, proposedTime, proposalId } = metadata;
    // status fallback to pending if missing from older proposals or initial emit
    const status = metadata.status || 'pending';
    const date = new Date(proposedTime);

    return (
      <div className={`flex flex-col gap-2 max-w-[85%] ${isMe ? "items-end" : "items-start"}`}>
        <div className={`p-5 rounded-3xl border-2 shadow-sm ${
          status === 'accepted' ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' :
          status === 'declined' ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20' :
          'border-primary/20 bg-surface'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              status === 'accepted' ? 'bg-emerald-500 text-white' :
              status === 'declined' ? 'bg-red-500 text-white' :
              'bg-primary text-white'
            }`}>
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-text-muted">Meetup Proposal</p>
              <h4 className="text-sm font-bold text-text-main">{status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending response'}</h4>
            </div>
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-2 text-sm text-text-main font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              {location}
            </div>
            <div className="flex items-center gap-2 text-sm text-text-main font-medium">
              <Clock className="h-4 w-4 text-primary" />
              {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {!isMe && status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleAcceptMeetup(proposalId, msg.id)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors font-black"
              >
                Accept
              </button>
              <button
                onClick={() => handleDeclineMeetup(proposalId, msg.id)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors font-black"
              >
                Decline
              </button>
            </div>
          )}
          
          {status === 'accepted' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
              <Circle className="h-2 w-2 fill-current" /> Meetup Confirmed
            </div>
          )}
        </div>
        <span className="text-[10px] text-text-muted px-2">{timeAgo(msg.created_at)}</span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-width-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <div className="mb-8 flex items-center gap-4">
        {onBack && !activeConvo && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-primary-hover rounded-xl transition-colors shrink-0"
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
            <p className="text-text-muted text-sm">Chat with buyers and sellers</p>
            <ConnectionBadge />
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden" style={{ minHeight: "600px" }}>
        {loading ? (
          <div className="flex justify-center p-16">
            <span className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !activeConvo ? (
          <div>
            {conversations.length === 0 ? (
              <div className="text-center py-16 text-text-muted">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No conversations yet</p>
                <p className="text-sm">Start a conversation by clicking "Contact Seller" on a listing</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {conversations.map((convo) => (
                  <button
                    key={convo.conversationId}
                    onClick={() => setActiveConvo(convo)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-background transition-colors text-left"
                  >
                    <img src={convo.listingImage} alt="" className="w-12 h-12 rounded-xl object-cover bg-surface shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-text-main">{convo.otherUserName}</p>
                        <span className="text-[10px] text-text-muted flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {timeAgo(convo.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-primary font-medium truncate">{convo.listingTitle}</p>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {convo.lastMessageIsMe ? "You: " : ""}{convo.lastMessage}
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
          <div className="flex flex-col h-[600px]">
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
              <img src={activeConvo.listingImage} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-main truncate">{activeConvo.otherUserName}</p>
                  {isConnected && <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 shrink-0" />}
                </div>
                <p className="text-[10px] text-primary truncate max-w-[200px] font-bold uppercase tracking-wider">{activeConvo.listingTitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMeetupModal(true)}
                  className="group relative p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-sm active:scale-95"
                  title="Schedule a meetup location and time for exchange"
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Schedule Meetup</span>
                  
                  {/* Tooltip Badge for awareness */}
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                </button>
                <ConnectionBadge />
              </div>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex justify-center py-8 text-text-muted text-xs font-medium opacity-60">Start of conversation</div>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                if (msg.type === 'meetup_proposal') {
                  return <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}><MeetupBubble msg={msg} isMe={isMe} /></div>;
                }
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-primary text-primary-foreground rounded-br-md shadow-sm" : "bg-background text-text-main rounded-bl-md border border-border shadow-sm"}`}>
                        <p>{msg.content}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-1 ${isMe ? "text-primary-foreground/60" : "text-text-muted"}`}>
                        <span className="text-[9px] font-bold">{timeAgo(msg.created_at)}</span>
                        {isMe && <span className="text-[9px] font-bold">{msg.is_read ? "Seen" : "Sent"}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {otherUserTyping && <TypingBubble />}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border bg-background flex flex-col gap-2">
              {errorMsg && <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-xs px-3 py-2 rounded-lg font-medium">{errorMsg}</div>}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={emitTypingStop}
                  placeholder="Type a message…"
                  className="flex-1 px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-text-main shadow-sm"
                  disabled={sending}
                  autoComplete="off"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-5 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showMeetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-surface w-full max-w-md rounded-3xl p-6 shadow-2xl border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white"><Clock className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-black text-text-main">Schedule Meetup</h2>
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Coordinate Exchange</p>
              </div>
            </div>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-2">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                  <input 
                    type="text" 
                    value={meetupLocation} 
                    onChange={(e) => setMeetupLocation(e.target.value)} 
                    placeholder="e.g. SR Grounds, ANC, Library" 
                    className="w-full pl-12 pr-4 py-4 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm font-medium text-text-main" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-2">Time & Date</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                  <input 
                    type="datetime-local" 
                    value={meetupTime} 
                    onChange={(e) => setMeetupTime(e.target.value)} 
                    className="w-full pl-12 pr-4 py-4 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm font-medium text-text-main cursor-pointer [color-scheme:dark]" 
                  />
                </div>
              </div>
            </div>

            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 mb-8">
              <h4 className="text-[10px] font-black text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" /> How it works
              </h4>
              <p className="text-[11px] text-text-muted leading-relaxed font-medium">
                Choose a public location (like Library or ANC) and a time. Once the other party accepts, you'll both receive a notification reminder 30 mins before the meetup!
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowMeetupModal(false)} className="flex-1 py-4 text-sm font-black text-text-muted uppercase tracking-widest hover:bg-background rounded-2xl transition-colors">Cancel</button>
              <button onClick={handleProposeMeetup} disabled={!meetupTime || !meetupLocation} className="flex-[2] py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-[0.98]">Send Proposal</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
