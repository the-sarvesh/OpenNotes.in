import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { toast } from "react-hot-toast";
import type { Note } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  note: Note;
  quantity: number;
}

interface ValidationResult {
  id: string;
  available: boolean;
  reason?: string;
  quantity?: number;
  price?: number;
  title?: string;
}

interface CartContextType {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (note: Note) => void;
  removeFromCart: (noteId: string) => void;
  updateQuantity: (noteId: string, quantity: number) => void;
  clearCart: () => void;
  /** Manually trigger a server-side freshness check. Requires a valid JWT. */
  validateCart: (token: string) => Promise<void>;
  isValidating: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export const CartProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("bits_notes_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isValidating, setIsValidating] = useState(false);

  // Track whether we've already validated on the current token so we don't
  // hammer the server on every re-render.
  const validatedTokenRef = useRef<string | null>(null);

  // ── Persist to localStorage on every change ───────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("bits_notes_cart", JSON.stringify(cart));
    } catch {
      /* storage full or blocked — silently skip */
    }
  }, [cart]);

  // ── Server-side stale cart validation (FE-4) ──────────────────────────────
  /**
   * Calls POST /api/listings/validate-cart with the IDs of items currently
   * in the cart, then:
   *  - removes listings that no longer exist or are inactive
   *  - clamps quantities to the listing's current stock
   *  - shows a user-friendly toast summarising what was removed / adjusted
   *
   * Skips silently if the cart is empty or the user is not authenticated.
   */
  const validateCart = useCallback(
    async (token: string): Promise<void> => {
      // Nothing to validate
      if (cart.length === 0) return;
      // Already validated with this token in this session
      if (validatedTokenRef.current === token) return;

      setIsValidating(true);
      try {
        const ids = cart.map((item) => item.note.id);
        const res = await fetch("/api/listings/validate-cart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids }),
        });

        if (!res.ok) {
          // Non-auth errors (500, etc.) — fail silently, don't break the cart
          console.warn("[CartContext] validate-cart returned", res.status);
          return;
        }

        const results: ValidationResult[] = await res.json();
        const resultMap = new Map(results.map((r) => [r.id, r]));

        let removedTitles: string[] = [];
        let adjustedTitles: string[] = [];

        setCart((prev) => {
          const next: CartItem[] = [];

          for (const item of prev) {
            const info = resultMap.get(item.note.id);

            // Listing disappeared or became inactive → remove
            if (!info || !info.available) {
              removedTitles.push(item.note.title);
              continue;
            }

            // Stock dropped below requested quantity → clamp
            const maxQty = info.quantity ?? item.quantity;
            if (item.quantity > maxQty) {
              adjustedTitles.push(item.note.title);
              next.push({ ...item, quantity: maxQty });
            } else {
              // Price may have changed — update in cart so checkout total is
              // always fresh (note: this only updates the copy stored in cart)
              if (info.price !== undefined && info.price !== item.note.price) {
                next.push({
                  ...item,
                  note: { ...item.note, price: info.price },
                });
              } else {
                next.push(item);
              }
            }
          }

          return next;
        });

        // ── User-facing feedback ──────────────────────────────────────────────
        if (removedTitles.length > 0) {
          const label =
            removedTitles.length === 1
              ? `"${removedTitles[0]}"`
              : `${removedTitles.length} items`;
          toast(
            `🛒 ${label} ${removedTitles.length === 1 ? "was" : "were"} removed from your cart — no longer available.`,
            {
              duration: 5000,
              style: { maxWidth: "360px" },
            },
          );
        }

        if (adjustedTitles.length > 0) {
          const label =
            adjustedTitles.length === 1
              ? `"${adjustedTitles[0]}"`
              : `${adjustedTitles.length} items`;
          toast(
            `📦 Quantity for ${label} was reduced to match available stock.`,
            {
              duration: 5000,
              style: { maxWidth: "360px" },
            },
          );
        }

        // Mark this token as validated so we don't re-run during the session
        validatedTokenRef.current = token;
      } catch (err) {
        // Network errors are non-fatal — the user can still proceed
        console.warn("[CartContext] validate-cart network error:", err);
      } finally {
        setIsValidating(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart.length], // re-create only when cart length changes (new items added)
  );

  // ── Cart mutation helpers ─────────────────────────────────────────────────

  const addToCart = (note: Note) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.note.id === note.id);
      if (existing) {
        if (existing.quantity >= note.quantity) return prev;
        return prev.map((i) =>
          i.note.id === note.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { note, quantity: 1 }];
    });
  };

  const removeFromCart = (noteId: string) => {
    setCart((prev) => prev.filter((i) => i.note.id !== noteId));
  };

  const updateQuantity = (noteId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(noteId);
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.note.id === noteId ? { ...i, quantity } : i)),
    );
  };

  const clearCart = () => setCart([]);

  // ── Reset validation cache when cart is fully cleared ────────────────────
  useEffect(() => {
    if (cart.length === 0) {
      validatedTokenRef.current = null;
    }
  }, [cart.length]);

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        validateCart,
        isValidating,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
