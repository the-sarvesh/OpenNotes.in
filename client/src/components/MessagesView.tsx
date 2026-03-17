import React, { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
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
  CheckCheck,
  Check,
  ChevronRight,
} from "lucide-react";
import { getSocket } from "../utils/socket.js";
import { Socket } from "socket.io-client";
import { useAuth, User } from "../contexts/AuthContext.js";
import { apiRequest } from "../utils/api.js";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────

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
  lastMessageMe: boolean;
  lastMessageAt: string;
  hasActiveOrder: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  content: string;
  type?: "text" | "meetup_proposal" | "purchase_notice";
  metadata?: string;
  is_read: boolean;
  created_at: string;
}

// ── Avatar ─────────────────────────────────────────────────────────
const Avatar: React.FC<{
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  badge?: React.ReactNode;
}> = ({ src, name, size = "md", badge }) => {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const sizeMap = { sm: "w-9 h-9 text-xs", md: "w-11 h-11 text-sm", lg: "w-16 h-16 text-lg" };
  return (
    <div className={`relative shrink-0 ${sizeMap[size]}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-xl object-cover border border-border" />
      ) : (
        <div className="w-full h-full rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black border border-primary/10">
          {initials}
        </div>
      )}
      {badge && <div className="absolute -bottom-1 -right-1">{badge}</div>}
    </div>
  );
};

// ── ConnectionBadge ────────────────────────────────────────────────
const ConnectionBadge: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${isConnected
      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
      : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
    }`}>
    {isConnected ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
    {isConnected ? "Live" : "Reconnecting"}
  </span>
);

// ── TypingBubble ───────────────────────────────────────────────────
const TypingBubble = () => (
  <div className="flex justify-start">
    <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface border border-border flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
    </div>
  </div>
);

// ── MessageSkeleton ────────────────────────────────────────────────
const MessageSkeleton = () => {
  // Fixed pattern so it looks like a real conversation
  const bubbles = [
    { isMe: false, w: "65%" },
    { isMe: true, w: "50%" },
    { isMe: false, w: "80%" },
    { isMe: true, w: "40%" },
    { isMe: true, w: "70%" },
    { isMe: false, w: "55%" },
    { isMe: true, w: "45%" },
    { isMe: false, w: "75%" },
  ];
  return (
    <div className="flex flex-col gap-3 px-1 py-2">
      {bubbles.map((b, i) => (
        <div key={i} className={`flex ${b.isMe ? "justify-end" : "justify-start"}`}>
          <div
            className="h-9 rounded-2xl bg-border/50 animate-pulse"
            style={{
              width: b.w,
              borderRadius: b.isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              animationDelay: `${i * 80}ms`,
            }}
          />
        </div>
      ))}
    </div>
  );
};

// ── MeetupBubble ───────────────────────────────────────────────────
const MeetupBubble: React.FC<{
  msg: Message;
  isMe: boolean;
  timeAgo: (d: string) => string;
  onAccept: (id: string, mid: string) => void;
  onDecline: (id: string, mid: string) => void;
  onCancel: (id: string, mid: string) => void;
}> = ({ msg, isMe, timeAgo, onAccept, onDecline, onCancel }) => {
  let metadata: any = {};
  try {
    metadata = typeof msg.metadata === "string" ? JSON.parse(msg.metadata || "{}") : (msg.metadata || {});
  } catch (e) { }
  const { location, proposedTime, proposalId } = metadata;
  const status = metadata.status || "pending";
  const date = proposedTime ? new Date(proposedTime) : new Date();

  return (
    <div className={`flex flex-col gap-1.5 max-w-[85%] ${isMe ? "items-end" : "items-start"}`}>
      <div className={`w-full rounded-2xl border overflow-hidden shadow-sm ${status === "accepted" ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" :
          status === "declined" ? "border-red-400/30 bg-red-50/50 dark:bg-red-950/20" :
            status === "cancelled" ? "border-border bg-surface/50 grayscale" :
              "border-primary/20 bg-surface"
        }`}>
        <div className="p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${status === "accepted" ? "bg-emerald-500 text-white" :
                status === "declined" ? "bg-red-500 text-white" :
                  status === "cancelled" ? "bg-border text-text-muted" :
                    "bg-primary text-black"
              }`}>
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Meetup Proposal</p>
              <p className="text-sm font-bold text-text-main capitalize">{status}</p>
            </div>
          </div>

          <div className="space-y-2 text-xs font-medium mb-4 p-3 bg-background rounded-xl border border-border/50">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-text-main">{location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-text-main">
                {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          {!isMe && status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => onAccept(proposalId, msg.id)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors active:scale-95">Accept</button>
              <button onClick={() => onDecline(proposalId, msg.id)} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors active:scale-95">Decline</button>
            </div>
          )}
          {isMe && status === "pending" && (
            <button onClick={() => onCancel(proposalId, msg.id)} className="w-full py-2 bg-border hover:bg-border/80 text-text-muted rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Cancel</button>
          )}
          {status === "accepted" && (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <Circle className="h-1.5 w-1.5 fill-current" /> Confirmed
            </div>
          )}
          {status === "cancelled" && (
            <div className="flex items-center justify-center gap-2 py-2 bg-border/40 rounded-xl text-text-muted text-[10px] font-black uppercase tracking-widest">
              <Circle className="h-1.5 w-1.5 fill-current" /> Withdrawn
            </div>
          )}
        </div>
      </div>
      <span className="text-[9px] text-text-muted px-1">{timeAgo(msg.created_at)}</span>
    </div>
  );
};

// ── PurchaseNoticeBubble ───────────────────────────────────────────
const PurchaseNoticeBubble: React.FC<{
  msg: Message;
  isMe: boolean;
  timeAgo: (d: string) => string;
  onVerify: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onGoToOrders?: () => void;
  onGoToSales?: () => void;
}> = ({ msg, isMe, timeAgo, onVerify, onAcknowledge, onGoToOrders, onGoToSales }) => {
  let metadata: any = {};
  try {
    metadata = typeof msg.metadata === "string" ? JSON.parse(msg.metadata || "{}") : (msg.metadata || {});
  } catch (e) { }
  const {
    listingTitle, listingImage, orderItemId, meetupPin,
    buyerLocation, buyerPreferredSpot, buyerAvailability,
    buyerNote, buyerMeetupDetails, totalToCollect, quantity,
  } = metadata;
  const status = metadata.status || "pending_meetup";

  return (
    <div className={`flex flex-col gap-1.5 max-w-[85%] ${isMe ? "items-end" : "items-start"}`}>
      <div
        onClick={() => isMe ? onGoToOrders?.() : onGoToSales?.()}
        className={`rounded-2xl border-2 overflow-hidden shadow-sm cursor-pointer hover:scale-[1.01] transition-transform ${status === "completed"
            ? "border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10"
            : status === "acknowledged"
              ? "border-primary/20 bg-primary/5"
              : "border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10"
          }`}
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative shrink-0">
              <img src={listingImage} alt="" className="w-11 h-11 rounded-xl object-cover border border-border shadow-sm" />
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-md">
                <ShieldCheck className="h-2.5 w-2.5" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  {status === "acknowledged" ? "Order Acknowledged" : "Order Placed"}
                </p>
                <ChevronRight className="h-3 w-3 text-emerald-500 opacity-50" />
              </div>
              <p className="text-sm font-bold text-text-main line-clamp-1">{listingTitle}</p>
              {quantity && <p className="text-[9px] text-text-muted font-bold">Qty: {quantity}</p>}
            </div>
          </div>

          <div className="space-y-2 mb-4 text-xs">
            <div className="p-2.5 bg-background/50 rounded-xl border border-border/50 space-y-1.5">
              <p className="flex items-center gap-1.5 text-text-muted"><MapPin className="h-3 w-3 shrink-0" /> {buyerLocation || "BITS"}</p>
              {buyerPreferredSpot && (
                <p className="flex items-center gap-1.5 text-text-main font-bold">
                  <Circle className="h-1.5 w-1.5 fill-primary text-primary shrink-0" /> {buyerPreferredSpot}
                </p>
              )}
              <p className="flex items-center gap-1.5 text-text-muted"><Clock className="h-3 w-3 shrink-0" /> {buyerAvailability}</p>
              {buyerMeetupDetails && <p className="text-[10px] text-text-main bg-primary/5 px-2 py-1 rounded-md">"{buyerMeetupDetails}"</p>}
              {buyerNote && <p className="border-l-2 border-emerald-300 dark:border-emerald-700 pl-2 italic text-text-muted">"{buyerNote}"</p>}
            </div>
            {totalToCollect !== undefined && (
              <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Cash to collect</span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">₹{totalToCollect}</span>
              </div>
            )}
          </div>

          <p className="text-[9px] font-black text-primary uppercase text-center tracking-widest mb-3 hover:underline decoration-primary/30 underline-offset-4">
            View Full Details →
          </p>

          {!isMe && (
            <div className="space-y-2" onClick={e => e.stopPropagation()}>
              {status === "pending_meetup" && (
                <button onClick={() => onAcknowledge(orderItemId)} className="w-full py-2.5 bg-primary hover:bg-primary-hover text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95">
                  Acknowledge Order
                </button>
              )}
              {status === "acknowledged" && (
                <button onClick={() => onVerify(orderItemId)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95">
                  Verify Exchange PIN
                </button>
              )}
              {status === "completed" && (
                <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified & Completed
                </div>
              )}
            </div>
          )}

          {isMe && (
            <div className="space-y-3" onClick={e => e.stopPropagation()}>
              {status === "pending_meetup" && (
                <div className="py-2.5 bg-primary/10 rounded-xl text-center border border-primary/20">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Waiting for Seller Acknowledgment</p>
                </div>
              )}
              {(status === "acknowledged" || status === "pending_meetup") && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full py-3 bg-emerald-500/10 rounded-xl text-center border border-emerald-500/20">
                    <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Your Exchange PIN</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-[0.35em]">{meetupPin}</p>
                  </div>
                  <p className="text-[9px] text-text-muted text-center">Share this PIN with the seller at meetup.</p>
                </div>
              )}
              {status === "completed" && (
                <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                  <ShieldCheck className="h-3.5 w-3.5" /> Exchange Completed
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <span className="text-[9px] text-text-muted px-1">{timeAgo(msg.created_at)}</span>
    </div>
  );
};

// ── ConversationList ───────────────────────────────────────────────
interface ConversationListProps {
  conversations: Conversation[];
  activeConvo: Conversation | null;
  loading: boolean;
  onSelect: (c: Conversation) => void;
  onBack?: () => void;
  isConnected: boolean;
  timeAgo: (d: string) => string;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations, activeConvo, loading, onSelect, onBack, isConnected, timeAgo,
}) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-border shrink-0 bg-surface">
      <div className="flex items-center gap-2.5">
        {onBack && (
          <button onClick={onBack} className="p-1.5 hover:bg-background rounded-xl transition-colors active:scale-90">
            <ArrowLeft className="h-5 w-5 text-text-muted" />
          </button>
        )}
        <div>
          <h1 className="text-sm font-black text-text-main tracking-tight">Messages</h1>
          <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <ConnectionBadge isConnected={isConnected} />
    </div>

    <div className="flex-1 overflow-y-auto overscroll-contain">
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="h-6 w-6 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <MessageCircle className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-bold text-text-main mb-1">No conversations yet</p>
          <p className="text-xs text-text-muted leading-relaxed">Tap "Contact Seller" on a listing to start chatting</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {conversations.map((convo) => (
            <button
              key={convo.conversationId}
              onClick={() => onSelect(convo)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors text-left ${activeConvo?.conversationId === convo.conversationId
                  ? "bg-primary/5 border-l-[3px] border-l-primary"
                  : "border-l-[3px] border-l-transparent"
                }`}
            >
              <Avatar
                src={convo.otherUserProfileImage}
                name={convo.otherUserName}
                size="sm"
                badge={
                  <img src={convo.listingImages[0]} alt="" className="w-5 h-5 rounded-md border-2 border-surface object-cover" />
                }
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-bold text-text-main truncate">{convo.otherUserName}</p>
                  <span className="text-[9px] text-text-muted shrink-0 ml-2">{timeAgo(convo.lastMessageAt)}</span>
                </div>
                <p className="text-[10px] text-primary font-bold truncate mb-0.5">
                  {convo.listingTitles[0]}{convo.listingTitles.length > 1 && ` +${convo.listingTitles.length - 1}`}
                </p>
                <p className="text-[10px] text-text-muted truncate">
                  {convo.lastMessageIsMe && <span className="font-semibold">You: </span>}
                  {convo.lastMessage}
                </p>
              </div>
              {convo.unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 px-1">
                  {convo.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ── ChatPanel ──────────────────────────────────────────────────────
interface ChatPanelProps {
  activeConvo: Conversation;
  messages: Message[];
  user: User | null;
  isConnected: boolean;
  arrivedUsers: Record<string, boolean>;
  otherUserTyping: boolean;
  newMessage: string;
  sending: boolean;
  errorMsg: string;
  loadingMessages: boolean;
  onBack: () => void;
  onProfileClick: (uid: string) => void;
  onMeetupModalOpen: () => void;
  onArrived: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onInputBlur: () => void;
  onInputFocus?: () => void;
  onSend: () => void;
  timeAgo: (d: string) => string;
  onAcceptMeetup: (id: string, mid: string) => void;
  onDeclineMeetup: (id: string, mid: string) => void;
  onCancelMeetup: (id: string, mid: string) => void;
  onVerifyPin: (id: string) => void;
  onAcknowledgeOrder: (id: string) => void;
  onGoToOrders?: () => void;
  onGoToSales?: () => void;
  hasActiveOrder: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  activeConvo, messages, user, isConnected, arrivedUsers,
  otherUserTyping, newMessage, sending, errorMsg, loadingMessages,
  onBack, onProfileClick, onMeetupModalOpen, onArrived,
  onInputChange, onKeyDown, onInputBlur, onInputFocus, onSend, timeAgo,
  onAcceptMeetup, onDeclineMeetup, onCancelMeetup,
  onVerifyPin, onAcknowledgeOrder, onGoToOrders, onGoToSales,
  hasActiveOrder,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  // Track IDs we've already animated so only NEW incoming messages animate
  const seenIdsRef = useRef<Set<string>>(new Set());

  // ── Helpers ──────────────────────────────────────────────────────
  const snapToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 80;
  }, []);

  // ── Reset flags when switching conversations ──────────────────────
  useEffect(() => {
    isInitialLoadRef.current = true;
    isAtBottomRef.current = true;
    seenIdsRef.current = new Set();
  }, [activeConvo.conversationId]);

  // ── KEY FIX: snap to bottom once loadingMessages flips to false ──
  // flushSync in fetchMessages guarantees messages are in the DOM before
  // this effect fires, so scrollHeight is already the real full height.
  useEffect(() => {
    if (loadingMessages) return;           // still loading — wait
    if (!isInitialLoadRef.current) return; // only for the first load of a convo

    isInitialLoadRef.current = false;

    // Seed seenIds so existing messages don't animate
    messages.forEach((m) => seenIdsRef.current.add(m.id));

    // Single rAF is enough — DOM is already painted thanks to flushSync
    requestAnimationFrame(() => {
      snapToBottom();
    });

    // Belt-and-suspenders: retry after 100ms for slow renders / tall bubbles
    const t = setTimeout(() => snapToBottom(), 100);
    return () => clearTimeout(t);
  }, [loadingMessages]); // ← intentionally only loadingMessages

  // ── New messages arriving (after initial load) ────────────────────
  useEffect(() => {
    if (isInitialLoadRef.current) return; // let the above handle it
    if (messages.length === 0) return;

    // Seed seen ids for any new messages
    messages.forEach((m) => seenIdsRef.current.add(m.id));

    if (isAtBottomRef.current) {
      requestAnimationFrame(() => snapToBottom());
    }
  }, [messages]);

  // ── Typing indicator ──────────────────────────────────────────────
  useEffect(() => {
    if (otherUserTyping && isAtBottomRef.current) {
      requestAnimationFrame(() => snapToBottom());
    }
  }, [otherUserTyping]);

  const hasPendingPin = messages.some((m) => {
    try {
      const meta = typeof m.metadata === "string" ? JSON.parse(m.metadata || "{}") : (m.metadata || {});
      return m.type === "meetup_proposal" && meta.status === "accepted";
    } catch { return false; }
  });

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-3 sm:px-4 py-3 border-b border-border bg-surface shrink-0">
        <button
          onClick={onBack}
          className="lg:hidden p-1.5 hover:bg-background rounded-xl transition-colors shrink-0 active:scale-90"
        >
          <ArrowLeft className="h-5 w-5 text-text-muted" />
        </button>

        <button
          onClick={() => onProfileClick(activeConvo.otherUserId)}
          className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
        >
          <Avatar src={activeConvo.otherUserProfileImage} name={activeConvo.otherUserName} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-text-main truncate">{activeConvo.otherUserName}</p>
              {isConnected && <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 shrink-0" />}
            </div>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest truncate max-w-[160px]">
              {activeConvo.listingTitles[0]}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {user && arrivedUsers[activeConvo.otherUserId] && (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 animate-pulse">
              <MapPin className="h-3 w-3 fill-current" />
              <span className="text-[9px] font-black uppercase tracking-tight hidden sm:inline">Arrived</span>
            </div>
          )}

          {hasActiveOrder && hasPendingPin && (
            <button
              onClick={onArrived}
              disabled={user ? arrivedUsers[user.id] : false}
              className={`p-2 rounded-xl transition-all active:scale-95 ${user && arrivedUsers[user.id]
                  ? "bg-emerald-500 text-white"
                  : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}
              title="Signal that you've arrived"
            >
              <MapPin className="h-4 w-4" />
            </button>
          )}

          {hasActiveOrder && (
            <button
              onClick={onMeetupModalOpen}
              className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all active:scale-95"
              title="Schedule meetup"
            >
              <Clock className="h-4 w-4" />
            </button>
          )}

          <ConnectionBadge isConnected={isConnected} />
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-4 space-y-3"
      >
        {/* Skeleton while loading */}
        {loadingMessages && <MessageSkeleton />}

        {/* Empty state */}
        {!loadingMessages && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest px-4 py-2 bg-surface rounded-full border border-border">
              Start of conversation
            </span>
          </div>
        )}

        {/* Messages */}
        {!loadingMessages && messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          // Only animate messages that weren't in the initial load
          const isNew = !seenIdsRef.current.has(msg.id);

          if (msg.type === "meetup_proposal") return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              style={isNew ? { animation: "msgSlideIn 0.2s ease-out" } : undefined}
            >
              <MeetupBubble
                msg={msg} isMe={isMe} timeAgo={timeAgo}
                onAccept={onAcceptMeetup} onDecline={onDeclineMeetup} onCancel={onCancelMeetup}
              />
            </div>
          );

          if (msg.type === "purchase_notice") return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              style={isNew ? { animation: "msgSlideIn 0.2s ease-out" } : undefined}
            >
              <PurchaseNoticeBubble
                msg={msg} isMe={isMe} timeAgo={timeAgo}
                onVerify={onVerifyPin} onAcknowledge={onAcknowledgeOrder}
                onGoToOrders={onGoToOrders} onGoToSales={onGoToSales}
              />
            </div>
          );

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              style={isNew ? { animation: "msgSlideIn 0.2s ease-out" } : undefined}
            >
              <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isMe
                    ? "bg-primary text-black rounded-br-sm shadow-sm"
                    : "bg-surface text-text-main rounded-bl-sm border border-border shadow-sm"
                  }`}>
                  {msg.content}
                </div>
                <div className={`flex items-center gap-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
                  <span className="text-[9px] text-text-muted font-medium">{timeAgo(msg.created_at)}</span>
                  {isMe && (msg.is_read
                    ? <CheckCheck className="h-3 w-3 text-[#FFC000]" />
                    : <Check className="h-3 w-3 text-text-muted" />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {otherUserTyping && <TypingBubble />}
      </div>

      {/* ── Input bar ── */}
      <div className="px-3 sm:px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-surface shrink-0">
        {!hasActiveOrder && (
          <div className="mb-3 p-3 bg-background rounded-2xl border border-border text-center">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              This conversation is closed because the transaction is complete.
            </p>
          </div>
        )}
        {errorMsg && (
          <div className="mb-2 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-xs px-3 py-2 rounded-xl font-medium">
            {errorMsg}
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newMessage}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            onBlur={onInputBlur}
            onFocus={() => {
              onInputFocus?.();
              // Small delay to ensure keyboard is fully up or viewport settled
              setTimeout(() => snapToBottom(), 300);
            }}
            placeholder={hasActiveOrder ? "Type a message…" : "Chat disabled"}
            className={`flex-1 px-4 py-3 bg-background border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-text-main transition-all ${!hasActiveOrder ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={sending || !hasActiveOrder}
            autoComplete="off"
          />
          <button
            onClick={onSend}
            disabled={!newMessage.trim() || sending || !hasActiveOrder}
            className="w-11 h-11 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 rounded-2xl font-bold flex items-center justify-center shadow-lg shadow-[#FFC000]/20 transition-all disabled:opacity-40 active:scale-95 shrink-0"
          >
            {sending
              ? <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MessagesView ───────────────────────────────────────────────────
export const MessagesView: React.FC<{
  initialConversationId?: string | null;
  onBack?: () => void;
  onGoToOrders?: () => void;
  onGoToSales?: () => void;
}> = ({ initialConversationId, onBack, onGoToOrders, onGoToSales }) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [arrivedUsers, setArrivedUsers] = useState<Record<string, boolean>>({});
  const [showMeetupModal, setShowMeetupModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [activeOrderItemId, setActiveOrderItemId] = useState("");
  const [pin, setPin] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [meetupTime, setMeetupTime] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const activeConvoRef = useRef<Conversation | null>(null);
  const hasHandledInitialId = useRef(false);

  useEffect(() => { activeConvoRef.current = activeConvo; }, [activeConvo]);

  // ── Fetch conversations ───────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiRequest("/api/messages/conversations");
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);
        if (initialConversationId && !hasHandledInitialId.current) {
          const target = data.find((c) => c.conversationId === initialConversationId);
          if (target) { setActiveConvo(target); hasHandledInitialId.current = true; }
        }
      }
    } catch (err) { console.error("[Messages] fetchConversations error:", err); }
    setLoading(false);
  }, [initialConversationId]);

  useEffect(() => {
    hasHandledInitialId.current = false;
    if (!initialConversationId) setActiveConvo(null);
  }, [initialConversationId]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Fetch messages — clears state first so skeleton always shows ──
  const fetchMessages = useCallback(async (convoId: string) => {
    setMessages([]);
    setLoadingMessages(true);
    try {
      const res = await apiRequest(`/api/messages/${convoId}`);
      if (res.ok) {
        const data: Message[] = await res.json();
        // flushSync forces React to paint messages into the DOM BEFORE
        // setLoadingMessages(false) runs — this gives scrollHeight a real
        // value when the scroll effect fires on the next line.
        flushSync(() => {
          setMessages(data);
        });
      }
    } catch (err) {
      console.error("[Messages] fetchMessages error:", err);
    } finally {
      // Now messages are already in the DOM — this flip triggers the scroll.
      setLoadingMessages(false);
    }
  }, []);

  // ── Socket setup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      if (activeConvoRef.current)
        socket.emit("join_conversation", { conversationId: activeConvoRef.current.conversationId });
    };
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = () => setIsConnected(false);

    const onNewMessage = (msg: Message) => {
      const curr = activeConvoRef.current;
      if (curr && msg.conversation_id === curr.conversationId) {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        socket.emit("mark_read", { conversationId: curr.conversationId });
        setOtherUserTyping(false);
        // Reset loading state if we were the sender
        setSending(false);
      }
      fetchConversations();
    };

    const onUnreadCountChanged = () => fetchConversations();

    const onUserTyping = ({ userId: id }: { userId: string }) => { if (id !== user?.id) setOtherUserTyping(true); };
    const onUserStoppedTyping = ({ userId: id }: { userId: string }) => { if (id !== user?.id) setOtherUserTyping(false); };

    const onMessagesRead = ({ conversationId }: { conversationId: string }) => {
      if (activeConvoRef.current?.conversationId === conversationId)
        setMessages((prev) => prev.map((m) => m.sender_id === user?.id ? { ...m, is_read: true } : m));
    };

    const onMeetupStatusChanged = ({ status, messageId }: { proposalId: string; status: string; messageId: string }) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m;
        let meta = {};
        try { meta = typeof m.metadata === "string" ? JSON.parse(m.metadata || "{}") : (m.metadata || {}); } catch { }
        return { ...m, metadata: JSON.stringify({ ...meta, status }) };
      }));
    };

    const onOtherUserArrived = ({ userId: id }: { userId: string }) => {
      setArrivedUsers((prev) => ({ ...prev, [id]: true }));
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

  // ── Join/leave conversation room ──────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (activeConvo) {
      fetchMessages(activeConvo.conversationId);
      socket.emit("join_conversation", { conversationId: activeConvo.conversationId });
      socket.emit("mark_read", { conversationId: activeConvo.conversationId });
    }
    return () => {
      if (activeConvo) socket.emit("leave_conversation", { conversationId: activeConvo.conversationId });
      setOtherUserTyping(false);
    };
  }, [activeConvo, fetchMessages]);

  // ── Clear error / messages on convo switch ────────────────────────
  useEffect(() => {
    setErrorMsg("");
  }, [activeConvo?.conversationId]);

  // ── Typing helpers ────────────────────────────────────────────────
  const emitTypingStart = useCallback(() => {
    const socket = socketRef.current; const convo = activeConvoRef.current;
    if (!socket || !convo || !socket.connected) return;
    if (!isTypingRef.current) { isTypingRef.current = true; socket.emit("typing_start", { conversationId: convo.conversationId }); }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTypingStop(), 2000);
  }, []);

  const emitTypingStop = useCallback(() => {
    const socket = socketRef.current; const convo = activeConvoRef.current;
    if (socket && convo && isTypingRef.current) socket.emit("typing_stop", { conversationId: convo.conversationId });
    isTypingRef.current = false;
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
  }, []);

  useEffect(() => () => emitTypingStop(), [emitTypingStop]);

  // ── Send message ──────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConvo || sending) return;
    setSending(true); setErrorMsg(""); emitTypingStop();
    const socket = socketRef.current;
    const trimmed = newMessage.trim();
    if (socket && socket.connected) {
      setNewMessage("");
      const onError = ({ message }: { message: string }) => {
        setErrorMsg(message); setNewMessage(trimmed);
        socket.off("message_error", onError); setSending(false);
      };
      socket.once("message_error", onError);
      socket.emit("send_message", {
        conversationId: activeConvo.conversationId,
        receiverId: activeConvo.otherUserId,
        listingId: activeConvo.listingIds[0],
        content: trimmed,
      });
      // Shorten fallback timeout to 1s
      setTimeout(() => { socket.off("message_error", onError); setSending(false); }, 1000);
    } else {
      try {
        const res = await apiRequest("/api/messages", { method: "POST", body: JSON.stringify({ receiver_id: activeConvo.otherUserId, listing_id: activeConvo.listingIds[0], content: trimmed }) });
        const data = await res.json();
        if (res.ok) { setNewMessage(""); fetchMessages(activeConvo.conversationId); fetchConversations(); }
        else setErrorMsg(data.error || "Failed to send message");
      } catch { setErrorMsg("Network error while sending message. Please retry."); }
      setSending(false);
    }
  };

  // ── Time helper ───────────────────────────────────────────────────
  const timeAgo = useCallback((dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setNewMessage(e.target.value); e.target.value.trim() ? emitTypingStart() : emitTypingStop(); };

  // ── Meetup handlers ───────────────────────────────────────────────
  const handleProposeMeetup = () => {
    if (!meetupTime || !activeConvo) return;
    let loc = meetupLocation;
    if (!loc) { const m = messages.find((m) => m.type === "purchase_notice"); if (m) loc = JSON.parse(m.metadata || "{}").buyerLocation; }
    if (!loc) { alert("Please specify a meetup location."); return; }
    if (new Date(meetupTime).getTime() <= Date.now()) { alert("Please select a future time."); return; }
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("propose_meetup", { conversationId: activeConvo.conversationId, receiverId: activeConvo.otherUserId, listingId: activeConvo.listingIds[0], proposedTime: meetupTime, location: loc });
      setShowMeetupModal(false); setMeetupTime(""); setMeetupLocation("");
    }
  };

  const handleAcceptMeetup = (proposalId: string, messageId: string) => { const s = socketRef.current; if (s?.connected && activeConvo) s.emit("accept_meetup", { conversationId: activeConvo.conversationId, proposalId, messageId }); };
  const handleDeclineMeetup = (proposalId: string, messageId: string) => { const s = socketRef.current; if (s?.connected && activeConvo) s.emit("decline_meetup", { conversationId: activeConvo.conversationId, proposalId, messageId }); };
  const handleCancelMeetup = (proposalId: string, messageId: string) => { const s = socketRef.current; if (s?.connected && activeConvo) s.emit("cancel_meetup", { conversationId: activeConvo.conversationId, proposalId, messageId }); };

  // ── Profile modal ─────────────────────────────────────────────────
  const fetchUserProfile = async (userId: string) => {
    setLoadingProfile(true); setShowProfileModal(true);
    try {
      const res = await apiRequest(`/api/users/${userId}`);
      if (res.ok) setSelectedUserProfile(await res.json());
      else { toast.error("Failed to load user profile"); setShowProfileModal(false); }
    } catch { toast.error("Network error"); setShowProfileModal(false); }
    finally { setLoadingProfile(false); }
  };

  // ── PIN verification ──────────────────────────────────────────────
  const handleVerifyPin = async () => {
    if (!pin || !activeOrderItemId) return;
    setVerifyingPin(true);
    try {
      const res = await apiRequest(`/api/orders/items/${activeOrderItemId}/verify-pin`, { method: "POST", body: JSON.stringify({ pin }) });
      const data = await res.json();
      if (res.ok) {
        toast.success("PIN verified successfully!");
        setShowPinModal(false); setPin("");
        setTimeout(() => fetchMessages(activeConvo!.conversationId), 100);
      } else toast.error(data.error || "Failed to verify PIN");
    } catch { toast.error("Network error. Please try again."); }
    finally { setVerifyingPin(false); }
  };

  // ── Order acknowledgement ─────────────────────────────────────────
  const handleAcknowledgeOrder = async (itemId: string) => {
    try {
      const res = await apiRequest(`/api/orders/items/${itemId}/acknowledge`, { method: "POST" });
      const data = await res.json();
      if (res.ok) { toast.success("Order acknowledged!"); setTimeout(() => fetchMessages(activeConvo!.conversationId), 100); }
      else toast.error(data.error || "Failed to acknowledge order");
    } catch { toast.error("Network error. Please try again."); }
  };

  // ── Arrived signal ────────────────────────────────────────────────
  const handleArrived = () => {
    const socket = socketRef.current;
    if (socket?.connected && activeConvo && user) {
      socket.emit("arrived_at_meetup", { conversationId: activeConvo.conversationId });
      setArrivedUsers((prev) => ({ ...prev, [user.id]: true }));
      toast.success("Signal sent!", { icon: "📍" });
    }
  };

  const handleChatBack = () => {
    if (initialConversationId && conversations.length <= 1) onBack?.();
    else { setActiveConvo(null); fetchConversations(); }
  };

  // ── Mobile keyboard fix ───────────────────────────────────────────
  const mobileRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mobileRootRef.current;
    if (!el || !window.visualViewport) return;

    const onViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        // We Use the visual viewport height directly but also account for any top offset 
        // if the browser doesn't automatically shift the body.
        // We use fixed positioning to prevent the background from scrolling away.
        el.style.height = `${vv.height}px`;
        
        // On some iOS versions or browsers, we need to explicitly offset the element
        // if the visual viewport is offset from the layout viewport.
        if (vv.offsetTop > 0) {
          el.style.transform = `translateY(${vv.offsetTop}px)`;
        } else {
          el.style.transform = "none";
        }
      } else {
        el.style.height = "";
        el.style.transform = "none";
      }
    };

    onViewportChange();
    window.visualViewport.addEventListener("resize", onViewportChange);
    window.visualViewport.addEventListener("scroll", onViewportChange);

    return () => {
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
    };
  }, []);

  // Shared props for ChatPanel
  const chatPanelProps = {
    messages, user, isConnected, arrivedUsers, otherUserTyping,
    newMessage, sending, errorMsg, loadingMessages,
    onBack: handleChatBack,
    onProfileClick: fetchUserProfile,
    onMeetupModalOpen: () => setShowMeetupModal(true),
    onArrived: handleArrived,
    onInputChange: handleInputChange,
    onKeyDown: handleKeyDown,
    onInputBlur: emitTypingStop,
    onInputFocus: emitTypingStart,
    onSend: sendMessage,
    timeAgo,
    onAcceptMeetup: handleAcceptMeetup,
    onDeclineMeetup: handleDeclineMeetup,
    onCancelMeetup: handleCancelMeetup,
    onVerifyPin: (id: string) => { setActiveOrderItemId(id); setShowPinModal(true); },
    onAcknowledgeOrder: handleAcknowledgeOrder,
    onGoToOrders,
    onGoToSales,
    hasActiveOrder: activeConvo?.hasActiveOrder ?? false,
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe for new message entrance — inject once */}
      <style>{`
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1);    }
        }
      `}</style>

      {/* ── Desktop: two-panel ── */}
      <div
        className="hidden lg:flex bg-surface border border-border rounded-3xl overflow-hidden shadow-sm max-w-5xl mx-auto"
        style={{ height: "calc(100dvh - 120px)", minHeight: "560px" }}
      >
        <div className="w-72 xl:w-80 border-r border-border flex-shrink-0 flex flex-col">
          <ConversationList
            conversations={conversations} activeConvo={activeConvo}
            loading={loading} onSelect={setActiveConvo}
            isConnected={isConnected} timeAgo={timeAgo}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {activeConvo ? (
            <ChatPanel key={activeConvo.conversationId} activeConvo={activeConvo} {...chatPanelProps} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-bold text-text-main mb-1">Select a conversation</p>
              <p className="text-xs text-text-muted">Choose from the list on the left</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: full screen ── */}
      {/* position:fixed + top:0 is overridden by the visualViewport hook on iOS */}
      <div
        ref={mobileRootRef}
        className="lg:hidden fixed inset-0 z-50 flex flex-col bg-surface border-t border-border overflow-hidden"
        style={{ overscrollBehavior: "none", top: 0, height: "100%" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!activeConvo ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <ConversationList
                conversations={conversations} activeConvo={activeConvo}
                loading={loading} onSelect={setActiveConvo}
                onBack={onBack} isConnected={isConnected} timeAgo={timeAgo}
              />
            </motion.div>
          ) : (
            <motion.div
              key={activeConvo.conversationId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <ChatPanel activeConvo={activeConvo} {...chatPanelProps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Meetup modal ── */}
      {showMeetupModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }}
            className="bg-surface w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-border"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center text-black shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-text-main">Schedule Meetup</h2>
                <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Coordinate exchange</p>
              </div>
            </div>
            <div className="space-y-4 mb-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Location</label>
                  {messages.find((m) => m.type === "purchase_notice") && (
                    <button
                      onClick={() => { const m = messages.find((msg) => msg.type === "purchase_notice"); if (m) setMeetupLocation(JSON.parse(m.metadata || "{}").buyerLocation); }}
                      className="text-[9px] font-black text-primary uppercase tracking-tight hover:underline"
                    >
                      Use Agreed Spot
                    </button>
                  )}
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                  <input
                    type="text" value={meetupLocation} onChange={(e) => setMeetupLocation(e.target.value)}
                    placeholder="e.g. SR Grounds, Library, ANC"
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-text-main"
                  />
                </div>
                {messages.find((m) => m.type === "purchase_notice") && (
                  <p className="text-[10px] text-text-muted mt-1.5 px-1">
                    From order: <span className="font-bold text-text-main">{JSON.parse(messages.find((m) => m.type === "purchase_notice")?.metadata || "{}").buyerLocation}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Time & Date</label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                  <input
                    type="datetime-local" value={meetupTime} onChange={(e) => setMeetupTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-text-main cursor-pointer [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 mb-5 flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-[10px] text-text-muted leading-relaxed">Once accepted, both parties get a reminder 30 mins before the meetup.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMeetupModal(false)}
                className="flex-1 py-3.5 text-xs font-black text-text-muted uppercase tracking-widest hover:bg-background rounded-2xl transition-colors border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleProposeMeetup}
                disabled={!meetupTime || !meetupLocation}
                className="flex-[2] py-3.5 bg-[#FFC000] hover:bg-[#e6ac00] text-black rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-[#FFC000]/20 disabled:opacity-50 active:scale-[0.98]"
              >
                Send Proposal
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── PIN modal ── */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }}
            className="bg-surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-border"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-text-main">Verify Exchange</h2>
                <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Enter buyer's PIN</p>
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">4-Digit PIN</label>
              <input
                type="text" maxLength={4} value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="0000"
                className="w-full text-center tracking-[0.5em] text-3xl font-black py-4 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-main"
              />
              <p className="text-[10px] text-text-muted mt-2 text-center">Ask the buyer to show the PIN from their "My Orders" section.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPinModal(false); setPin(""); }}
                className="flex-1 py-3.5 text-xs font-black text-text-muted uppercase tracking-widest hover:bg-background rounded-2xl transition-colors border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyPin}
                disabled={pin.length !== 4 || verifyingPin}
                className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-[0.98]"
              >
                {verifyingPin ? "Verifying…" : "Confirm Delivery"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Profile modal ── */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:px-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }}
            className="bg-surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-border"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            {loadingProfile ? (
              <div className="flex justify-center py-12">
                <span className="h-7 w-7 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
              </div>
            ) : selectedUserProfile ? (
              <>
                <div className="flex flex-col items-center text-center mb-5">
                  <Avatar src={selectedUserProfile.profile_image_url} name={selectedUserProfile.name} size="lg" />
                  <h2 className="text-lg font-black text-text-main mt-3">{selectedUserProfile.name}</h2>
                  <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider mt-0.5">
                    {selectedUserProfile.role} · Joined {new Date(selectedUserProfile.created_at || "").toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-2.5 mb-5">
                  <div className="p-3 bg-background border border-border rounded-xl">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Email</p>
                    <p className="text-sm font-bold text-text-main">{selectedUserProfile.email}</p>
                  </div>
                  {selectedUserProfile.mobile_number ? (
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Mobile</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{selectedUserProfile.mobile_number}</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">Mobile</p>
                        <p className="text-xs text-text-muted">Shared after purchase</p>
                      </div>
                    </div>
                  )}
                  {selectedUserProfile.location ? (
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Location</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{selectedUserProfile.location}</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">Location</p>
                        <p className="text-xs text-text-muted">Shared after purchase</p>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="w-full py-3.5 bg-background hover:bg-surface text-text-main rounded-2xl text-xs font-black uppercase tracking-widest border border-border transition-colors"
                >
                  Close
                </button>
              </>
            ) : null}
          </motion.div>
        </div>
      )}
    </>
  );
};