import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { Toaster, toast } from "react-hot-toast";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";

// ── Layout ──────────────────────────────────────────────────────────
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

// ── Views ───────────────────────────────────────────────────────────
import { HomeView } from "./views/HomeView";
import { BrowseView } from "./views/BrowseView";
import { SellView } from "./views/SellView";
import { ResourcesView } from "./views/ResourcesView";

// ── Components ──────────────────────────────────────────────────────
import { ProductDetailsModal } from "./components/ProductDetailsModal";
import { AuthModal } from "./components/AuthModal";
import { ProfileCompletionModal } from "./components/ProfileCompletionModal";
import { ProfileView } from "./components/ProfileView";
import { OrdersView } from "./components/OrdersView";
import { AdminView } from "./components/AdminView";
import { MessagesView } from "./components/MessagesView";
import { CartView } from "./views/CartView.tsx";
import { CheckoutView } from "./views/CheckoutView.tsx";
import { OrderSuccessView } from "./views/OrderSuccessView";
import { UserGuideModal } from "./components/UserGuideModal";
import { TelegramNudge } from "./components/TelegramNudge";
import { FeedbackCard } from "./components/FeedbackCard";
import ScrollToTop from "./components/ScrollToTop";
import { apiRequest } from "./utils/api";
import { NotificationManager } from "./utils/NotificationManager";
import { getSocket } from "./utils/socket";
import type { Notification } from "./components/NotificationSystem";

// ── Contexts / Types ────────────────────────────────────────────────
import { useAuth } from "./contexts/AuthContext";
import { CartProvider, useCart } from "./contexts/CartContext";
import type { Note, View } from "./types/index.ts";

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [profileTab, setProfileTab] = useState<'listings' | 'earnings' | 'settings'>('listings');

  const navigateTo = (view: View, tab?: string) => {
    if (view === 'profile' && tab) {
      setProfileTab(tab as any);
      navigate('/profile');
    } else {
      navigate(`/${view === 'home' ? '' : view}`);
    }
  };

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // ── Theme ─────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    // Default to true (dark mode) on any system if no preference saved
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("darkMode", String(isDark));
  }, [isDark]);

  // ── Cart ──────────────────────────────────────────────────────────
  const { cart, setCart, addToCart, removeFromCart, updateQuantity, clearCart, validateCart } = useCart();
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // ── UI state ──────────────────────────────────────────────────────────
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [profileModalDismissCount, setProfileModalDismissCount] = useState<number>(() => {
    return parseInt(localStorage.getItem("profileModalDismissCount") || "0", 10);
  });
  const [hasDismissedProfileModalThisSession, setHasDismissedProfileModalThisSession] = useState(false);

  const [authMode, setAuthMode] = useState<
    "login" | "register" | "forgot" | "reset"
  >("login");
  const [resetToken, setResetToken] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [orderSuccessData, setOrderSuccessData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // ── Feedback card ─────────────────────────────────────────────────
  const [pendingFeedback, setPendingFeedback] = useState<{
    triggerType: 'buyer' | 'seller';
    referenceId: string;
    itemTitle: string;
  } | null>(null);

  // ── Audio refs ────────────────────────────────────────────────────
  const messageAudio = React.useRef<HTMLAudioElement | null>(null);
  const notificationAudio = React.useRef<HTMLAudioElement | null>(null);
  const prevMessagesRef = React.useRef(unreadMessages);
  const prevNotifsRef = React.useRef(unreadNotifs);

  const { user, login } = useAuth();

  useEffect(() => {
    const isProfileIncomplete = user && (!user.mobile_number || !user.upi_id);
    const hasNotExceededStrikes = profileModalDismissCount < 3;

    if (isProfileIncomplete && hasNotExceededStrikes && !hasDismissedProfileModalThisSession) {
      // Don't show if they are on the auth callback page (it's too fast)
      if (location.pathname !== "/auth/callback") {
        setShowProfileCompletion(true);
      }
    } else {
      setShowProfileCompletion(false);
    }
  }, [user, location.pathname, profileModalDismissCount, hasDismissedProfileModalThisSession]);


  // ── Validate cart freshness whenever user authenticates (FE-4) ───────────
  useEffect(() => {
    if (user && cart.length > 0) {
      validateCart();
    }
  }, [user]);

  // ── Handle password-reset deep link (/reset-password?token=...) ──────────
  useEffect(() => {
    if (window.location.pathname === "/reset-password") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        setResetToken(token);
        setAuthMode("reset");
        setShowAuth(true);
        navigate("/", { replace: true });
      }
    }
  }, [navigate]);

  // ── Handle email verification deep link (/verify-email?token=...) ────────
  useEffect(() => {
    if (window.location.pathname === "/verify-email") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        const verify = async () => {
          try {
            const res = await apiRequest(`/api/auth/verify-email?token=${token}`);
            const data = await res.json();
            if (res.ok) {
              toast.success(data.message || "Email verified! You can now log in.", { duration: 5000 });
              setAuthMode("login");
              setShowAuth(true);
            } else {
              toast.error(data.error || "Verification failed.", { duration: 5000 });
            }
          } catch (err) {
            toast.error("Network error during verification.");
          } finally {
            // Use navigate for cleaner URL handling
            navigate("/", { replace: true });
          }
        };
        verify();
      }
    }
  }, [navigate]);

  // ── Handle OAuth Callback ─────────────────────────────────────────
  useEffect(() => {
    if (window.location.pathname === "/auth/callback") {
      const params = new URLSearchParams(window.location.search);
      const userId = params.get("userId");
      const email = params.get("email");
      const name = params.get("name");
      const role = params.get("role");
      const token = params.get("token");

      if (userId && email && name) {
        login({
          id: userId,
          email,
          name,
          role: role || "user",
        }, token || undefined);
        toast.success(`Welcome back, ${name.split(" ")[0]}!`);
      } else {
        toast.error("Authentication failed. Please try again.");
      }

      // Clean up the URL and go home
      navigate("/", { replace: true });
    }
  }, [login, navigate]);

  // ── Handle OAuth / Account errors from query params ───────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");

    if (error === "blocked") {
      toast.error("Your account has been blocked by an administrator.", {
        duration: 6000,
        icon: "🚫",
      });
      window.history.replaceState({}, document.title, "/");
    } else if (error === "auth_failed") {
      const reason = params.get("reason");
      const msg = reason
        ? decodeURIComponent(reason)
        : "Google sign-in failed. Only BITS Pilani email addresses are allowed.";
      toast.error(msg, { duration: 7000, icon: "🚫" });
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  // ── Unread counts (Optimized: single endpoint + Visibility + Sockets) ──
  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      // Don't fetch if tab is hidden to save DB reads
      if (document.visibilityState !== "visible") return;

      try {
        const res = await apiRequest("/api/users/me/unread-counts");
        const data = await res.json();
        if (res.ok) {
          setUnreadMessages(data.messages || 0);
          setUnreadNotifs(data.notifications || 0);
        }
      } catch { /* silent */ }
    };

    // Initial fetch
    fetchCounts();

    // 1. Slow fallback poll (60s) — only if visible
    const intervalId = setInterval(fetchCounts, 60_000);

    // 2. Immediate refetch on visibility change (back to tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchCounts();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Socket-driven immediate updates
    const socket = getSocket();
    const handleSocketUpdate = () => fetchCounts();
    
    socket.on("unread_count_changed", handleSocketUpdate);
    socket.on("connect", () => {
      socket.emit("join", `user:${user.id}`);
    });
    
    // Ensure joined if already connected
    if (socket.connected) {
      socket.emit("join", `user:${user.id}`);
    }

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      socket.off("unread_count_changed", handleSocketUpdate);
    };
  }, [user, location.pathname]);

  // ── Service Worker & Push registration ───────────────────────────
  useEffect(() => {
    if (!user) return;
    
    const initPush = async () => {
      await NotificationManager.registerServiceWorker();
      const granted = await NotificationManager.requestPermission();
      if (granted) {
        await NotificationManager.subscribeUser();
      }
    };
    
    initPush();
  }, [user]);

  // ── Socket.IO Notifications ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    
    const onNewNotification = (notif: Notification) => {
      setUnreadNotifs(prev => prev + 1);
      toast(notif.title, {
        icon: '🔔',
        duration: 5000,
      });
      notificationAudio.current?.play().catch(() => {});
    };

    const onUnreadCountChanged = () => {
      // Something changed (e.g. read status elsewhere), refresh counts
      apiRequest("/api/messages/unread/count").then(r => r.json()).then(data => setUnreadMessages(data.count ?? 0));
      apiRequest("/api/notifications/unread/count").then(r => r.json()).then(data => setUnreadNotifs(data.count ?? 0));
    };

    const onConnectError = (err: any) => console.error("[Socket] connect_error:", err.message);

    const onNewMessage = (msg: any) => {
      // Avoid showing toast for our own messages (emitted via conv room)
      if (msg.sender_id === user.id) return;

      // Only show toast if we're not already on the messages page
      if (location.pathname !== '/messages') {
        const sender = msg.sender_name || "Someone";
        toast(`${sender}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`, {
          icon: '💬',
          duration: 4000,
        });
        messageAudio.current?.play().catch(() => {});
      }
      setUnreadMessages(prev => prev + 1);
    };

    socket.on('connect_error', onConnectError);
    socket.on('new_notification', onNewNotification);
    socket.on('unread_count_changed', onUnreadCountChanged);
    socket.on('new_message', onNewMessage);

    // ── Feedback trigger: listen for completed meetup ───────────────
    const onMeetupStatusChanged = (data: any) => {
      if (data.status !== 'completed') return;
      if (!user) return;

      const now = Date.now();
      const isSkippedUntil = Number(localStorage.getItem('feedback_skipped_until') || 0);
      const isSubmittedUntil = Number(localStorage.getItem('feedback_submitted_until') || 0);
      if (now < isSkippedUntil || now < isSubmittedUntil) return;
      if (pendingFeedback) return; // one at a time

      // Determine role
      let triggerType: 'buyer' | 'seller' | null = null;

      if (data.buyerId === user.id) {
        // Buyer: once per order
        const key = `feedback_shown_${data.orderId}`;
        if (localStorage.getItem(key)) return;
        triggerType = 'buyer';
      } else if (data.sellerId === user.id) {
        // Seller: 7-day cooldown
        const lastShown = Number(localStorage.getItem('feedback_seller_shown') || 0);
        if (now - lastShown < 7 * 24 * 60 * 60 * 1000) return;
        triggerType = 'seller';
      }

      if (!triggerType) return;

      setTimeout(() => {
        setPendingFeedback({
          triggerType,
          referenceId: data.orderId || data.itemId,
          itemTitle: data.itemTitle || 'your note',
        });
      }, 1500);
    };

    socket.on('meetup_status_changed', onMeetupStatusChanged);

    return () => {
      socket.off('connect_error', onConnectError);
      socket.off('new_notification', onNewNotification);
      socket.off('unread_count_changed', onUnreadCountChanged);
      socket.off('new_message', onNewMessage);
      socket.off('meetup_status_changed', onMeetupStatusChanged);
    };
  }, [user, pendingFeedback]);

  // ── Notification Sound handling ──────────────────────────────────
  useEffect(() => {
    if (!user) {
      prevMessagesRef.current = unreadMessages;
      prevNotifsRef.current = unreadNotifs;
      return;
    }
    
    if (unreadMessages > prevMessagesRef.current) {
      messageAudio.current?.play().catch(() => {});
    }
    if (unreadNotifs > prevNotifsRef.current) {
      notificationAudio.current?.play().catch(() => {});
    }
    
    prevMessagesRef.current = unreadMessages;
    prevNotifsRef.current = unreadNotifs;
  }, [unreadMessages, unreadNotifs, user]);

  // ── First-time user guide ─────────────────────────────────────────
  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenGuide");
    if (!hasSeen) {
      setTimeout(() => setShowUserGuide(true), 1500); // Give it a moment to breathe
    }
  }, []);

  const closeGuide = () => {
    setShowUserGuide(false);
    localStorage.setItem("hasSeenGuide", "true");
  };

  // No longer needed: Redirect logic handled by ProtectedRoute or similar if needed
  // For now, simple redirect in main Routes is better.
  const isProtected = (path: string) => {
    const public_ = ["/", "/auth/callback", "/reset-password", "/verify-email"];
    return !public_.includes(path);
  };

  useEffect(() => {
    if (!user && isProtected(location.pathname)) {
      navigate("/", { replace: true });
    }
  }, [user, location.pathname, navigate]);

  // ── Helpers ───────────────────────────────────────────────────────
  const requireAuth = (action: () => void) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    action();
  };

  const handleAddToCart = (note: Note) => {
    requireAuth(() => {
      if (note.sellerId && user?.id === note.sellerId) {
        toast("You can't buy your own listing!");
        return;
      }
      const success = addToCart(note);
      if (success) {
        toast.success("Added to cart!");
      } else {
        toast.error("Stock limit reached!");
      }
    });
  };

  const handleBuyNow = (note: Note) => {
    requireAuth(() => {
      if (note.sellerId && user?.id === note.sellerId) {
        toast("You can't buy your own listing!", { icon: "🚫" });
        return;
      }
      // Add to cart if not already there
      setCart((prev) => {
        const existing = prev.find((i) => i.note.id === note.id);
        if (existing) return prev;
        return [...prev, { note, quantity: 1 }];
      });
      navigateTo("checkout");
    });
  };

  const handleContactSeller = async (
    sellerId: string,
    listingId: string,
    title: string,
  ) => {
    requireAuth(async () => {
      if (!sellerId) return;
      try {
        const check = await apiRequest(
          `/api/messages/check/${sellerId}/${listingId}`
        );
        if (!check.ok) throw new Error("Failed to check messaging status");
        const { canMessage, hasConversation, conversationId } =
          await check.json();

        if (!canMessage) {
          toast.error("You can only message after purchasing this item");
          return;
        }
        if (hasConversation) {
          setSelectedConversationId(conversationId);
          navigateTo("messages");
          return;
        }

        const res = await apiRequest("/api/messages", {
          method: "POST",
          body: JSON.stringify({
            receiver_id: sellerId,
            listing_id: listingId,
            content: `Hi! I'm interested in "${title}". Can we discuss the meetup location?`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start chat");
        setSelectedConversationId(data.conversationId);
        toast.success("Conversation started!");
        navigateTo("messages");
      } catch (err: any) {
        toast.error(err.message || "Network error. Please try again.");
      }
    });
  };
  const handleTelegramConnect = async () => {
    requireAuth(async () => {
      const toastId = toast.loading("Generating connection link...");
      try {
        const res = await apiRequest("/api/telegram/generate-token");
        const data = await res.json();
        if (res.ok && data.link) {
          // Try to open Telegram app directly, fallback to web
          // Directly open in a new tab - confirmed as most reliable method by user
          window.open(data.link, "_blank", "noopener,noreferrer");
          toast.success("Opening Telegram in a new tab...", { id: toastId });
        } else {
          toast.error(data.error || "Failed to generate link", { id: toastId });
        }
      } catch (err) {
        toast.error("Network error. Please try again.", { id: toastId });
      }
    });
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background font-sans transition-colors duration-200">
      <ScrollToTop />
      <audio ref={messageAudio} src="/sounds/message.mp3" preload="auto" />
      <audio ref={notificationAudio} src="/sounds/notification.mp3" preload="auto" />
      <Navbar
        isDark={isDark}
        toggleDark={() => setIsDark(!isDark)}
        cartCount={cartCount}
        setShowAuth={setShowAuth}
        onShowGuide={() => setShowUserGuide(true)}
        unreadNotificationCount={unreadNotifs}
        unreadMessageCount={unreadMessages}
        onMessagesClick={() => {
          setSelectedConversationId(null);
          navigate("/messages");
        }}
        onTelegramClick={handleTelegramConnect}
      />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <Routes location={location}>
            <Route path="/" element={
              <HomeView
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
                onContactSeller={handleContactSeller}
                onViewDetails={setSelectedNote}
                checkAuth={requireAuth}
                cart={cart}
                refreshKey={refreshKey}
                onShowGuide={() => setShowUserGuide(true)}
                userName={user?.name}
              />
            } />
            <Route path="/browse" element={
              <BrowseView
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
                onContactSeller={handleContactSeller}
                onViewDetails={setSelectedNote}
                checkAuth={requireAuth}
                cart={cart}
                refreshKey={refreshKey}
              />
            } />
            <Route path="/sell" element={<SellView onGoToBrowse={() => navigate("/browse")} />} />
            <Route path="/resources" element={<ResourcesView />} />
            <Route path="/profile" element={
              <ProfileView 
                onContactSeller={handleContactSeller} 
                initialTab={profileTab}
              />
            } />
            <Route path="/orders" element={<OrdersView onContactSeller={handleContactSeller} />} />
            <Route path="/admin" element={<AdminView />} />
            <Route path="/cart" element={
              <CartView
                cart={cart}
                updateQuantity={(id, q) =>
                  setCart((c) =>
                    c.map((i) => (i.note.id === id ? { ...i, quantity: q } : i)),
                  )
                }
                removeItem={(id) =>
                  setCart((c) => c.filter((i) => i.note.id !== id))
                }
                onCheckout={() => navigate("/checkout")}
                onBack={() => navigate("/browse", { replace: true })}
              />
            } />
            <Route path="/checkout" element={
              <CheckoutView
                cart={cart}
                onSuccess={(data) => {
                  setCart([]);
                  setRefreshKey((k) => k + 1);
                  setOrderSuccessData(data);
                  navigate("/order-success");
                }}
                onBack={() => navigate("/cart", { replace: true })}
              />
            } />
            <Route path="/order-success" element={
              <OrderSuccessView
                orderData={orderSuccessData}
                onBack={() => navigate("/orders")}
                onGoToMessages={() => navigate("/messages")}
              />
            } />
            <Route path="/messages" element={
              <MessagesView
                initialConversationId={selectedConversationId}
                onBack={() => navigate(-1)}
                onGoToOrders={() => navigate("/orders")}
                onGoToSales={() => navigate("/profile", { state: { tab: "earnings" } })}
              />
            } />
            <Route path="/auth/callback" element={<div className="min-h-[50vh] flex items-center justify-center text-text-muted font-medium animate-pulse">Authenticating with Google...</div>} />
            <Route path="/verify-email" element={<div className="min-h-[50vh] flex items-center justify-center text-text-muted font-medium animate-pulse text-sm">Verifying your account...</div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      {location.pathname !== "/messages" && <Footer />}

      <AnimatePresence>
        <AuthModal
          key="auth"
          isOpen={showAuth}
          onClose={() => {
            setShowAuth(false);
            setAuthMode("login");
            setResetToken("");
            setAuthEmail("");
          }}
          defaultMode={authMode}
          resetToken={resetToken}
          initialEmail={authEmail}
        />

        <ProfileCompletionModal
          key="profile-completion"
          isOpen={showProfileCompletion}
          onClose={() => {
            setShowProfileCompletion(false);
            setHasDismissedProfileModalThisSession(true);
            // Only increment strike count if they dismissed without completing
            if (user && (!user.mobile_number || !user.upi_id)) {
              setProfileModalDismissCount((prev) => {
                const newCount = prev + 1;
                localStorage.setItem("profileModalDismissCount", newCount.toString());
                return newCount;
              });
            }
          }}
        />


        {selectedNote && (
          <ProductDetailsModal
            key="product"
            note={selectedNote}
            onClose={() => setSelectedNote(null)}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            isInCart={cart.some((i) => i.note.id === selectedNote.id)}
            cart={cart}
            onContactSeller={handleContactSeller}
          />
        )}

        <TelegramNudge key="telegram-nudge" />
        <UserGuideModal isOpen={showUserGuide} onClose={closeGuide} />

        {pendingFeedback && (
          <FeedbackCard
            key="feedback"
            triggerType={pendingFeedback.triggerType}
            referenceId={pendingFeedback.referenceId}
            itemTitle={pendingFeedback.itemTitle}
            onClose={() => setPendingFeedback(null)}
          />
        )}
      </AnimatePresence>

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: isDark ? "#1e293b" : "#fff",
            color: isDark ? "#f1f5f9" : "#0f172a",
            borderRadius: "14px",
            fontWeight: 600,
            fontSize: "13px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
          },
        }}
      />
      <SpeedInsights />
    </div>
  );
};

export default App;
