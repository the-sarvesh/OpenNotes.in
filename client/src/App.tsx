import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { Toaster, toast } from "react-hot-toast";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";

// ── Layout ──────────────────────────────────────────────────────────
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

// ── Views ───────────────────────────────────────────────────────────
import { HomeView } from "./views/HomeView";
import { BrowseView } from "./views/BrowseView";
import { SellView } from "./views/SellView";

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
    // Re-validate cart when entering cart or checkout pages
    if ((view === "cart" || view === "checkout") && user && cart.length > 0) {
      validateCart();
    }

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
  const [hasDismissedProfileModal, setHasDismissedProfileModal] = useState(false);
  const [authMode, setAuthMode] = useState<
    "login" | "register" | "forgot" | "reset"
  >("login");
  const [resetToken, setResetToken] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [orderSuccessData, setOrderSuccessData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // ── Audio refs ────────────────────────────────────────────────────
  const messageAudio = React.useRef<HTMLAudioElement | null>(null);
  const notificationAudio = React.useRef<HTMLAudioElement | null>(null);
  const prevMessagesRef = React.useRef(unreadMessages);
  const prevNotifsRef = React.useRef(unreadNotifs);

  const { user, login } = useAuth();

  useEffect(() => {
    if (user && (!user.mobile_number || !user.upi_id) && !hasDismissedProfileModal) {
      // Don't show if they are on the auth callback page (it's too fast)
      if (location.pathname !== "/auth/callback") {
        setShowProfileCompletion(true);
      }
    } else {
      setShowProfileCompletion(false);
    }
  }, [user, location.pathname, hasDismissedProfileModal]);

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
        window.history.replaceState({}, document.title, "/");
      }
    }
  }, []);

  // ── Handle OAuth Callback ─────────────────────────────────────────
  useEffect(() => {
    if (window.location.pathname === "/auth/callback") {
      const params = new URLSearchParams(window.location.search);
      const userId = params.get("userId");
      const email = params.get("email");
      const name = params.get("name");
      const role = params.get("role");

      if (userId && email && name) {
        login({
          id: userId,
          email,
          name,
          role: role || "user",
        });
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

  // ── Poll unread counts ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetch_ = async () => {
      try {
        const [m, n] = await Promise.all([
          apiRequest("/api/messages/unread/count").then((r) => r.json()),
          apiRequest("/api/notifications/unread/count").then((r) => r.json()),
        ]);
        setUnreadMessages(m.count ?? 0);
        setUnreadNotifs(n.count ?? 0);
      } catch {
        /* silent */
      }
    };
    fetch_();
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
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

    return () => {
      socket.off('connect_error', onConnectError);
      socket.off('new_notification', onNewNotification);
      socket.off('unread_count_changed', onUnreadCountChanged);
      socket.off('new_message', onNewMessage);
    };
  }, [user]);

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
    const public_ = ["/", "/auth/callback", "/reset-password"];
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

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background font-sans transition-colors duration-200">
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
              />
            } />
            <Route path="/auth/callback" element={<div className="min-h-[50vh] flex items-center justify-center text-text-muted font-medium animate-pulse">Authenticating with Google...</div>} />
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
          }}
          defaultMode={authMode}
          resetToken={resetToken}
        />

        <ProfileCompletionModal
          key="profile-completion"
          isOpen={showProfileCompletion}
          onClose={() => {
            setShowProfileCompletion(false);
            setHasDismissedProfileModal(true);
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

        <UserGuideModal isOpen={showUserGuide} onClose={closeGuide} />
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
    </div>
  );
};

export default App;
