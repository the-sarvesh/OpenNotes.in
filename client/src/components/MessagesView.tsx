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
import { useAuth, User } from "../contexts/AuthContext.js";
import { apiRequest } from "../utils/api.js";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  conversationId: string;
  listingIds: string[];
  listingTitles: string[];
  listingImages: string[];
  otherUserId: string;
  otherUserName: string;
  otherUserProfileImage?: string;
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

  // User Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Arrived state (real-time handoff)
  const [arrivedUsers, setArrivedUsers] = useState<Record<string, boolean>>({});

  // Meetup Proposal State
  const [showMeetupModal, setShowMeetupModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [activeOrderItemId, setActiveOrderItemId] = useState("");
  const [pin, setPin] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
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

    const onOtherUserArrived = ({ userId: id }: { userId: string }) => {
      setArrivedUsers(prev => ({ ...prev, [id]: true }));
      toast.success("The other user has arrived at the meetup spot!", { icon: "📍", duration: 6000 });
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
    socket.on("other_user_arrived", onOtherUserArrived);

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
      socket.off("other_user_arrived", onOtherUserArrived);
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
        listingId: activeConvo.listingIds[0],
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
            listing_id: activeConvo.listingIds[0],
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
    if (!meetupTime || !activeConvo) return;
    
    // If no custom location typed, try to get from the initial order message
    let finalLocation = meetupLocation;
    if (!finalLocation) {
      const purchaseMsg = messages.find(m => m.type === 'purchase_notice');
      if (purchaseMsg) {
        const meta = JSON.parse(purchaseMsg.metadata || '{}');
        finalLocation = meta.buyerLocation;
      }
    }

    if (!finalLocation) {
      alert("Please specify a meetup location.");
      return;
    }

    // Simple validation: Time should be in future
    if (new Date(meetupTime).getTime() <= Date.now()) {
      alert("Please select a future time for the meetup.");
      return;
    }

    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("propose_meetup", {
        conversationId: activeConvo.conversationId,
        receiverId: activeConvo.otherUserId,
        listingId: activeConvo.listingIds[0],
        proposedTime: meetupTime,
        location: finalLocation
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

  const fetchUserProfile = async (userId: string) => {
    setLoadingProfile(true);
    setShowProfileModal(true);
    try {
      const res = await apiRequest(`/api/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUserProfile(data);
      } else {
        toast.error("Failed to load user profile");
        setShowProfileModal(false);
      }
    } catch (err) {
      toast.error("Network error");
      setShowProfileModal(false);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCancelMeetup = (proposalId: string, messageId: string) => {
    const socket = socketRef.current;
    if (socket && socket.connected && activeConvo) {
      socket.emit("cancel_meetup", {
        conversationId: activeConvo.conversationId,
        proposalId,
        messageId
      });
    }
  };

  const handleVerifyPin = async () => {
    if (!pin || !activeOrderItemId) return;
    setVerifyingPin(true);
    try {
      const res = await apiRequest(`/api/orders/items/${activeOrderItemId}/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("PIN verified successfully!");
        setShowPinModal(false);
        setPin("");
        // Give it a tiny moment to ensure modal state is cleared before refreshing messages
        setTimeout(() => fetchMessages(activeConvo!.conversationId), 100);
      } else {
        toast.error(data.error || "Failed to verify PIN");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleArrived = () => {
    const socket = socketRef.current;
    if (socket && socket.connected && activeConvo && user) {
      socket.emit("arrived_at_meetup", { conversationId: activeConvo.conversationId });
      setArrivedUsers(prev => ({ ...prev, [user.id]: true }));
      toast.success("Signal sent! The other user will be notified.", { icon: "📍" });
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
          status === 'cancelled' ? 'border-gray-500/30 bg-gray-50/50 dark:bg-gray-800/20 grayscale' :
          'border-primary/20 bg-surface'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              status === 'accepted' ? 'bg-emerald-500 text-white' :
              status === 'declined' ? 'bg-red-500 text-white' :
              status === 'cancelled' ? 'bg-gray-500 text-white' :
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

          {isMe && status === 'pending' && (
            <button
              onClick={() => handleCancelMeetup(proposalId, msg.id)}
              className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-text-main rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
            >
              Cancel Proposal
            </button>
          )}
          
          {status === 'accepted' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
              <Circle className="h-2 w-2 fill-current" /> Meetup Confirmed
            </div>
          )}

          {status === 'cancelled' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-gray-500/10 rounded-xl text-gray-500 text-xs font-black uppercase tracking-wider">
              <Circle className="h-2 w-2 fill-current" /> Proposal Withdrawn
            </div>
          )}
        </div>
        <span className="text-[10px] text-text-muted px-2">{timeAgo(msg.created_at)}</span>
      </div>
    );
  };

  const PurchaseNoticeBubble = ({ msg, isMe }: { msg: Message, isMe: boolean }) => {
    const metadata = JSON.parse(msg.metadata || '{}');
    const { listingTitle, listingImage, orderItemId, meetupPin, buyerLocation, buyerAvailability, buyerNote } = metadata;

    return (
      <div className={`flex flex-col gap-2 max-w-[85%] ${isMe ? "items-end" : "items-start"}`}>
        <div className="p-5 rounded-3xl border-2 border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative shrink-0 w-12 h-12">
              <img src={listingImage} alt="" className="w-full h-full object-cover rounded-xl shadow-sm" />
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-1 shadow-md">
                <ShieldCheck className="h-3 w-3" />
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Order Placed</p>
              <h4 className="text-sm font-bold text-text-main line-clamp-1">{listingTitle}</h4>
            </div>
          </div>

          <div className="space-y-2 mb-6 text-xs text-text-muted font-medium">
            <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Based in {buyerLocation || "BITS"}</p>
            <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {buyerAvailability}</p>
            {buyerNote && <p className="mt-2 italic border-l-2 border-emerald-200 pl-2">"{buyerNote}"</p>}
          </div>

          {!isMe && metadata.status !== 'completed' && (
            <button
              onClick={() => {
                setActiveOrderItemId(orderItemId);
                setShowPinModal(true);
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 font-black"
            >
              Verify Exchange PIN
            </button>
          )}

          {!isMe && metadata.status === 'completed' && (
            <div className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest border border-emerald-500/20">
              <ShieldCheck className="h-4 w-4" /> Verified & Completed
            </div>
          )}

          {isMe && metadata.status !== 'completed' && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-full py-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-center border border-emerald-500/30">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Your Exchange PIN</p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-[0.3em]">{meetupPin}</p>
              </div>
              <p className="text-[9px] text-text-muted font-bold text-center px-2">
                Share this PIN with the seller when you meet to confirm the handover.
              </p>
            </div>
          )}

          {isMe && metadata.status === 'completed' && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-2 py-3 px-6 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest border border-emerald-500/20 w-full">
                <ShieldCheck className="h-4 w-4" /> Exchange Completed
              </div>
              <p className="text-[9px] text-text-muted font-bold text-center">
                This item has been successfully handed over.
              </p>
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
                    <div className="relative shrink-0">
                      {convo.otherUserProfileImage ? (
                        <img src={convo.otherUserProfileImage} alt="" className="w-12 h-12 rounded-xl object-cover bg-surface" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black">
                          {convo.otherUserName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1">
                        <img src={convo.listingImages[0]} alt="" className="w-6 h-6 rounded-md border-2 border-surface object-cover shadow-sm" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-text-main">{convo.otherUserName}</p>
                        <span className="text-[10px] text-text-muted flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {timeAgo(convo.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-primary font-medium truncate">
                        {convo.listingTitles[0]}
                        {convo.listingTitles.length > 1 && ` (+${convo.listingTitles.length - 1} more)`}
                      </p>
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
              
              <button 
                onClick={() => fetchUserProfile(activeConvo.otherUserId)}
                className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
              >
                <div className="relative shrink-0">
                  {activeConvo.otherUserProfileImage ? (
                    <img src={activeConvo.otherUserProfileImage} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">
                      {activeConvo.otherUserName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-main truncate">{activeConvo.otherUserName}</p>
                    {isConnected && <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 shrink-0" />}
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[10px] text-primary truncate max-w-[200px] font-bold uppercase tracking-wider">
                      {activeConvo.listingTitles[0]}
                    </p>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-2">
                {messages.some(m => {
                  const meta = JSON.parse(m.metadata || '{}');
                  return m.type === 'meetup_proposal' && meta.status === 'accepted';
                }) && (
                  <button
                    onClick={handleArrived}
                    disabled={user ? arrivedUsers[user.id] : false}
                    className={`p-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-sm active:scale-95 ${
                      user && arrivedUsers[user.id] 
                        ? 'bg-emerald-500 text-white opacity-100' 
                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}
                    title="Signal that you have reached the meetup spot"
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="hidden sm:inline">{user && arrivedUsers[user.id] ? "Arrived" : "I'm Here"}</span>
                  </button>
                )}

                {user && arrivedUsers[activeConvo.otherUserId] && (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 animate-pulse">
                    <MapPin className="h-3.5 w-3.5 fill-current" />
                    <span className="text-[10px] font-black uppercase tracking-tight">User Arrived</span>
                  </div>
                )}

                <button
                  onClick={() => setShowMeetupModal(true)}
                  className="group relative p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-sm active:scale-95"
                  title="Schedule a meetup location and time for exchange"
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Schedule Meetup</span>
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
                if (msg.type === 'purchase_notice') {
                  return <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}><PurchaseNoticeBubble msg={msg} isMe={isMe} /></div>;
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-text-muted">Location</label>
                  {messages.find(m => m.type === 'purchase_notice') && (
                    <button 
                      onClick={() => {
                        const m = messages.find(msg => msg.type === 'purchase_notice');
                        if (m) setMeetupLocation(JSON.parse(m.metadata || '{}').buyerLocation);
                      }}
                      className="text-[9px] font-black text-primary uppercase tracking-tighter hover:underline"
                    >
                      Use Agreed Spot
                    </button>
                  )}
                </div>
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
                {messages.find(m => m.type === 'purchase_notice') && (
                  <p className="text-[10px] text-text-muted mt-2 px-1">
                    Agreed in order: <span className="font-bold text-text-main">{JSON.parse(messages.find(m => m.type === 'purchase_notice')?.metadata || '{}').buyerLocation}</span>
                  </p>
                )}
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

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-surface w-full max-w-md rounded-3xl p-6 shadow-2xl border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-black text-text-main">Verify Exchange</h2>
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Enter Buyer's PIN</p>
              </div>
            </div>
            
            <div className="mb-8">
              <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-2">4-Digit PIN</label>
              <input 
                type="text" 
                maxLength={4}
                value={pin} 
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
                placeholder="0000" 
                className="w-full text-center tracking-[1em] text-2xl font-black py-4 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-main" 
              />
              <p className="text-[10px] text-text-muted mt-3 text-center font-medium">Ask the buyer to show the PIN from their "My Orders" section.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowPinModal(false); setPin(""); }} className="flex-1 py-4 text-sm font-black text-text-muted uppercase tracking-widest hover:bg-background rounded-2xl transition-colors">Cancel</button>
              <button 
                onClick={handleVerifyPin} 
                disabled={pin.length !== 4 || verifyingPin} 
                className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-[0.98]"
              >
                {verifyingPin ? "Verifying..." : "Confirm Delivery"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-surface w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-border">
            {loadingProfile ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            ) : selectedUserProfile ? (
              <>
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-black mb-4 overflow-hidden border-2 border-primary/20">
                    {selectedUserProfile.profile_image_url ? (
                      <img src={selectedUserProfile.profile_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedUserProfile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    )}
                  </div>
                  <h2 className="text-xl font-black text-text-main">{selectedUserProfile.name}</h2>
                  <p className="text-xs text-text-muted font-bold uppercase tracking-wider">{selectedUserProfile.role} · Joined {new Date(selectedUserProfile.created_at || "").toLocaleDateString()}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="p-4 bg-background border border-border rounded-2xl">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Email</p>
                    <p className="text-sm font-bold text-text-main">{selectedUserProfile.email}</p>
                  </div>

                  {selectedUserProfile.mobile_number ? (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Mobile Number</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{selectedUserProfile.mobile_number}</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Mobile Number</p>
                      <p className="text-xs font-bold text-text-muted italic flex items-center gap-1.5">
                        <ShieldCheck className="h-3 w-3" /> Shared after purchase
                      </p>
                    </div>
                  )}

                  {selectedUserProfile.location ? (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Hostel / Location</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{selectedUserProfile.location}</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Hostel / Location</p>
                      <p className="text-xs font-bold text-text-muted italic flex items-center gap-1.5">
                        <ShieldCheck className="h-3 w-3" /> Shared after purchase
                      </p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setShowProfileModal(false)} 
                  className="w-full py-4 bg-surface hover:bg-background text-text-main rounded-2xl text-xs font-black uppercase tracking-widest border border-border transition-colors"
                >
                  Close
                </button>
              </>
            ) : null}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
