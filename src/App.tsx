import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { Toaster, toast } from "react-hot-toast";

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
import { ProfileView } from "./components/ProfileView";
import { OrdersView } from "./components/OrdersView";
import { AdminView } from "./components/AdminView";
import { MessagesView } from "./components/MessagesView";
import { CartView } from "./views/CartView.tsx";
import { CheckoutView } from "./views/CheckoutView.tsx";
import { OrderSuccessView } from "./views/OrderSuccessView";
import { UserGuideModal } from "./components/UserGuideModal";

// ── Contexts / Types ────────────────────────────────────────────────
import { useAuth } from "./contexts/AuthContext";
import { CartProvider, useCart } from "./contexts/CartContext";
import type { Note, View } from "./types/index.ts";

const App: React.FC = () => {
  // ── Navigation ────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<View>("home");
  const [previousView, setPreviousView] = useState<View | null>(null);

  const navigateTo = (view: View) => {
    setPreviousView(currentView);
    setCurrentView(view);
    // Re-validate cart when entering cart or checkout pages (FE-4)
    if ((view === "cart" || view === "checkout") && token && cart.length > 0) {
      validateCart(token);
    }
  };

  const goBack = () => {
    setCurrentView(previousView ?? "home");
    setPreviousView(null);
  };

  // ── Theme ─────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved !== null
      ? saved === "true"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("darkMode", String(isDark));
  }, [isDark]);

  // ── Cart ──────────────────────────────────────────────────────────
  const { cart, setCart, addToCart, validateCart } = useCart();
  const [showCart, setShowCart] = useState(false);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // ── UI state ──────────────────────────────────────────────────────────
  const [showAuth, setShowAuth] = useState(false);
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

  const { user, token, login } = useAuth();

  // ── Validate cart freshness whenever user authenticates (FE-4) ───────────
  useEffect(() => {
    if (token && cart.length > 0) {
      validateCart(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      const tokenParam = params.get("token");
      const userId = params.get("userId");
      const email = params.get("email");
      const name = params.get("name");
      const role = params.get("role");

      if (tokenParam && userId && email && name) {
        login(tokenParam, {
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
      window.history.replaceState({}, document.title, "/");
      setCurrentView("home");
    }
  }, [login]);

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
    if (!user || !token) return;
    const fetch_ = async () => {
      try {
        const [m, n] = await Promise.all([
          fetch("/api/messages/unread/count", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()),
          fetch("/api/notifications/unread/count", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()),
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
  }, [user, token, currentView]);

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

  // ── Redirect logged-out users from protected views ────────────────
  useEffect(() => {
    const protected_: View[] = [
      "profile",
      "sell",
      "admin",
      "messages",
      "orders",
    ];
    if (!user && protected_.includes(currentView)) navigateTo("home");
  }, [user, currentView]);

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
      addToCart(note);
      toast.success("Added to cart!");
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
      if (!sellerId || !token) return;
      try {
        const check = await fetch(
          `/api/messages/check/${sellerId}/${listingId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
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

        const res = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
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
      <Navbar
        currentView={currentView}
        setView={navigateTo}
        isDark={isDark}
        toggleDark={() => setIsDark((d) => !d)}
        cartCount={cartCount}
        setShowCart={() => navigateTo("cart")}
        setShowAuth={setShowAuth}
        unreadMessageCount={unreadMessages}
        unreadNotificationCount={unreadNotifs}
        onShowGuide={() => setShowUserGuide(true)}
      />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentView === "home" && (
            <HomeView
              key="home"
              setView={navigateTo}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
              onContactSeller={handleContactSeller}
              onViewDetails={setSelectedNote}
              checkAuth={requireAuth}
              cart={cart}
              refreshKey={refreshKey}
              onShowGuide={() => setShowUserGuide(true)}
            />
          )}
          {currentView === "browse" && (
            <BrowseView
              key="browse"
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
              onContactSeller={handleContactSeller}
              onViewDetails={setSelectedNote}
              cart={cart}
              refreshKey={refreshKey}
            />
          )}
          {currentView === "sell" && (
            <SellView key="sell" onGoToBrowse={() => navigateTo("browse")} />
          )}
          {currentView === "profile" && (
            <ProfileView key="profile" onContactSeller={handleContactSeller} />
          )}
          {currentView === "orders" && (
            <OrdersView key="orders" onContactSeller={handleContactSeller} />
          )}
          {currentView === "admin" && <AdminView key="admin" />}
          {currentView === "cart" && (
            <CartView
              key="cart"
              cart={cart}
              updateQuantity={(id, q) =>
                setCart((c) =>
                  c.map((i) => (i.note.id === id ? { ...i, quantity: q } : i)),
                )
              }
              removeItem={(id) =>
                setCart((c) => c.filter((i) => i.note.id !== id))
              }
              onCheckout={() => navigateTo("checkout")}
              onBack={() => navigateTo("browse")}
            />
          )}
          {currentView === "checkout" && (
            <CheckoutView
              key="checkout"
              cart={cart}
              onSuccess={(data) => {
                setCart([]);
                setRefreshKey((k) => k + 1);
                setOrderSuccessData(data);
                navigateTo("order-success");
              }}
              onBack={() => navigateTo("cart")}
            />
          )}
          {currentView === "order-success" && (
            <OrderSuccessView
              key="order-success"
              orderData={orderSuccessData}
              onBack={() => navigateTo("orders")}
              onGoToMessages={() => navigateTo("messages")}
            />
          )}
          {currentView === "messages" && (
            <MessagesView
              key="messages"
              initialConversationId={selectedConversationId}
              onBack={goBack}
            />
          )}
        </AnimatePresence>
      </main>

      {currentView !== "messages" && <Footer />}

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

        {selectedNote && (
          <ProductDetailsModal
            key="product"
            note={selectedNote}
            onClose={() => setSelectedNote(null)}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            isInCart={cart.some((i) => i.note.id === selectedNote.id)}
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
