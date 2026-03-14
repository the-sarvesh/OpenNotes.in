import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  ChevronRight,
  Check,
  Tag,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Note } from "../types";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import { apiRequest } from "../utils/api";

interface CheckoutViewProps {
  cart?: any[];
  onSuccess?: (orderData: any) => void;
  onBack?: () => void;
}

// ── Reusable section card ──────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`bg-surface rounded-2xl border border-border shadow-sm ${className}`}
  >
    {children}
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="p-2.5 bg-surface rounded-xl text-text-muted">{icon}</div>
    <h2 className="text-base font-black text-text-main">{title}</h2>
  </div>
);

const ShieldCheck = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  cart,
  onSuccess,
  onBack,
}) => {
  const navigate = useNavigate();
  const { cart: contextCart, clearCart } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // If component is mounted with CheckoutViewProps instead of routing, fallback to contextCart
  const activeCart = cart || contextCart;

  const [address, setAddress] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [userNote, setUserNote] = useState("");
  const [agreedToDelivery, setAgreedToDelivery] = useState(false);

  // ── Coupon state ──────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    message: string;
    originalFee: number;
    finalFee: number;
    feeWaived: boolean;
    discountType: string;
    discountValue: number;
  } | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const total = activeCart.reduce(
    (acc, item) => acc + item.note.price * item.quantity,
    0,
  );
  const rawPlatformFee = Math.round(total * 0.1);
  const platformFee = couponResult?.valid
    ? couponResult.finalFee
    : rawPlatformFee;
  const subtotal = total - rawPlatformFee; // cash portion never changes

  const needsDelivery = activeCart.some(
    (i) =>
      i.note.deliveryMethod === "courier" ||
      i.note.deliveryMethod === "both" ||
      i.note.deliveryMethod === "Delivery",
  );
  const needsMeetup = activeCart.some(
    (i) =>
      i.note.deliveryMethod === "in_person" ||
      i.note.deliveryMethod === "both" ||
      i.note.deliveryMethod === "Hand-to-Hand",
  );

  const meetupItems = activeCart.filter(
    (i) =>
      i.note.deliveryMethod === "in_person" ||
      i.note.deliveryMethod === "both" ||
      i.note.deliveryMethod === "Hand-to-Hand",
  );

  // ── Coupon validation ─────────────────────────────────────────────
  const validateCoupon = useCallback(async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponResult(null);
    try {
      const res = await apiRequest("/api/orders/validate-coupon", {
        method: "POST",
        body: JSON.stringify({
          coupon_code: couponInput.trim(),
          order_total: total,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCouponResult(data);
        setAppliedCoupon(couponInput.trim().toUpperCase());
        toast.success(data.message);
      } else {
        setCouponResult({
          valid: false,
          message: data.error,
          originalFee: rawPlatformFee,
          finalFee: rawPlatformFee,
          feeWaived: false,
          discountType: "",
          discountValue: 0,
        });
        setAppliedCoupon(null);
        toast.error(data.error);
      }
    } catch {
      toast.error("Failed to validate coupon. Try again.");
    } finally {
      setCouponLoading(false);
    }
  }, [couponInput, total, rawPlatformFee]);

  const removeCoupon = () => {
    setCouponInput("");
    setCouponResult(null);
    setAppliedCoupon(null);
  };

  const handlePlaceOrder = async () => {
    if (!user) return;
    if (needsDelivery && !address) {
      toast.error("Please enter delivery address");
      return;
    }
    if (needsMeetup && !collectionDate) {
      toast.error("Please select a collection date");
      return;
    }
    if (!agreedToDelivery) {
      toast.error("You must agree to the delivery methods");
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: activeCart.map((item) => ({
            listing_id: item.note.id,
            quantity: item.quantity,
          })),
          buyer_location: address || null,
          buyer_availability: collectionDate || null,
          buyer_note: userNote || null,
          agreed_to_delivery: agreedToDelivery,
          coupon_code: appliedCoupon || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (onSuccess) {
          onSuccess(data);
        } else {
          clearCart();
          toast.success("Order placed successfully!");
        }
      } else toast.error(data.error || "Failed to place order");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-36 lg:pb-24 overflow-x-hidden">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="p-2 rounded-xl hover:bg-primary-hover hover:bg-primary-hover text-text-muted transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-text-main tracking-tight">
            Checkout
          </h1>
          <p className="text-sm text-text-muted">
            Verify details and place your order
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Step indicator */}
          <Card className="p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              {[
                {
                  id: 1,
                  label: "Logistics",
                  icon: <MapPin className="h-4 w-4" />,
                },
                {
                  id: 2,
                  label: "Payment",
                  icon: <CreditCard className="h-4 w-4" />,
                },
              ].map((s, i) => {
                const done = step > s.id;
                const active = step === s.id;
                return (
                  <React.Fragment key={s.id}>
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex-shrink-0 flex items-center justify-center font-black text-sm transition-all ${done
                            ? "bg-accent text-accent-foreground"
                            : active
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface text-text-muted"
                          }`}
                      >
                        {done ? <Check className="h-4 w-4" /> : s.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-muted leading-none mb-0.5">
                          Step {s.id}
                        </p>
                        <p
                          className={`text-xs font-bold transition-colors truncate ${active ? "text-text-main" : "text-text-muted"}`}
                        >
                          {s.label}
                        </p>
                      </div>
                    </div>
                    {i === 0 && (
                      <div
                        className={`flex-1 mx-1 sm:mx-2 h-0.5 rounded-full transition-colors ${done ? "bg-accent" : "bg-border"}`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </Card>

          <AnimatePresence mode="wait">
            {/* ── Step 1: Logistics ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Meetup Details Form */}
                <Card className="p-4 sm:p-6">
                  <SectionHeader
                    icon={<MapPin className="h-4 w-4" />}
                    title="Meetup Details"
                  />

                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                        Your City / Campus Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Pilani Campus, Krishna Bhawan"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                        When are you available?
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {["Weekdays", "Weekends", "Evenings", "Flexible"].map(
                          (time) => (
                            <label
                              key={time}
                              className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                            >
                              <input
                                type="radio"
                                name="availability"
                                value={time}
                                checked={collectionDate === time}
                                onChange={(e) =>
                                  setCollectionDate(e.target.value)
                                }
                                className="w-4 h-4 text-primary focus:ring-primary bg-background border-border"
                              />
                              <span className="text-sm font-semibold text-text-main">
                                {time}
                              </span>
                            </label>
                          ),
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                        Note to seller (optional)
                      </label>
                      <textarea
                        placeholder="Any specific time or place you prefer?"
                        value={userNote}
                        onChange={(e) => setUserNote(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none"
                      />
                    </div>
                  </div>
                </Card>

              </motion.div>
            )}

            {/* ── Step 2: Payment ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                  <SectionHeader
                    icon={<CreditCard className="h-4 w-4" />}
                    title="Payment Method"
                  />

                  {/* Coupon Code Input */}
                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                      <Tag className="h-3 w-3 inline mr-1" />
                      Coupon Code (Optional)
                    </label>

                    {appliedCoupon && couponResult?.valid ? (
                      /* Applied coupon badge */
                      <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 tracking-widest">
                              {appliedCoupon}
                            </p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
                              {couponResult.message}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={removeCoupon}
                          className="p-1.5 text-emerald-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                          title="Remove coupon"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      /* Coupon entry row */
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => {
                            setCouponInput(e.target.value.toUpperCase());
                            setCouponResult(null);
                          }}
                          onKeyDown={(e) =>
                            e.key === "Enter" && validateCoupon()
                          }
                          placeholder="Enter coupon code…"
                          className="flex-1 px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono tracking-widest uppercase"
                          disabled={couponLoading}
                        />
                        <button
                          onClick={validateCoupon}
                          disabled={!couponInput.trim() || couponLoading}
                          className="px-4 py-2.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                        >
                          {couponLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Tag className="h-3.5 w-3.5" />
                          )}
                          Apply
                        </button>
                      </div>
                    )}

                    {/* Invalid coupon feedback */}
                    {couponResult && !couponResult.valid && (
                      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                        <XCircle className="h-3 w-3 shrink-0" />{" "}
                        {couponResult.message}
                      </p>
                    )}
                  </div>

                  {/* OpenNotes Shield callout */}
                  <div className="p-5 bg-accent border border-accent rounded-xl">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center shadow-sm shrink-0">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-text-main uppercase tracking-wider">
                          OpenNotes Shield Protected
                        </p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Only the platform unlock fee is paid online.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {/* Online payment row — adapts when fee is waived */}
                      {couponResult?.valid && couponResult.feeWaived ? (
                        <div className="relative flex items-center justify-between p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border-2 border-emerald-400 dark:border-emerald-700 overflow-hidden">
                          <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-500 text-white text-[7px] sm:text-[8px] font-black uppercase tracking-widest rounded-bl-lg">
                            FREE
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 truncate">
                              Platform Fee Waived!
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            <span className="text-xs sm:text-sm line-through text-text-muted">
                              ₹{rawPlatformFee}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                              ₹0
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="relative flex items-center justify-between p-3 sm:p-4 bg-surface rounded-xl border-2 border-primary overflow-hidden">
                          <div className="absolute top-0 right-0 px-2 py-0.5 bg-primary text-black text-[7px] sm:text-[8px] font-black uppercase tracking-widest rounded-bl-lg">
                            Pay now
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full border-[2.5px] sm:border-[3px] border-primary shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-text-main truncate">
                              UPI / Cards / NetBanking
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {couponResult?.valid &&
                              couponResult.finalFee < rawPlatformFee && (
                                <span className="text-[10px] sm:text-xs line-through text-text-muted">
                                  ₹{rawPlatformFee}
                                </span>
                              )}
                            <span className="text-xs sm:text-sm font-black text-primary">
                              ₹{platformFee}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Cash at meetup row */}
                      <div className="flex items-center justify-between p-4 bg-surface/60 rounded-xl border border-border opacity-70">
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded-full border-2 border-border" />
                          <span className="text-sm font-semibold text-text-muted">
                            Cash at meetup (to seller)
                          </span>
                        </div>
                        <span className="text-sm font-black text-text-muted">
                          ₹{subtotal}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Agreement checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer group p-3 sm:p-4 bg-surface/50 rounded-xl border border-border hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={agreedToDelivery}
                        onChange={(e) => setAgreedToDelivery(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border border-border bg-surface checked:bg-primary dark:checked:bg-primary checked:border-transparent transition-all"
                      />
                      <svg
                        className="absolute h-3 w-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-text-muted leading-relaxed group-hover:text-text-main dark:group-hover:text-white transition-colors">
                      I agree to the collection spot(s) and logistics from the
                      previous step, and acknowledge that the notes cost is paid
                      in cash at the time of exchange.
                    </span>
                  </label>

                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right sidebar: Order summary ── */}
        <div className="lg:sticky lg:top-6">
          <Card className="p-6">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-5">
              Order Summary
            </p>

            {/* Cart items */}
            <div className="space-y-5 max-h-80 overflow-y-auto pr-1 mb-5">
              {activeCart.map((item) => (
                <div key={item.note.id} className="flex gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={item.note.image}
                      className="h-16 w-16 rounded-xl object-cover border border-border"
                    />
                    {item.quantity > 1 && (
                      <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary text-black rounded-full flex items-center justify-center text-[9px] font-black border-2 border-white ">
                        {item.quantity}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-primary uppercase tracking-wider mb-0.5">
                      {item.note.courseCode}
                    </p>
                    <p className="text-xs font-bold text-text-main leading-snug line-clamp-2 mb-1.5">
                      {item.note.title}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      <span className="px-1.5 py-0.5 bg-surface rounded text-[8px] font-bold text-text-muted uppercase">
                        {item.note.semester}
                      </span>
                      <span className="px-1.5 py-0.5 bg-surface rounded text-[8px] font-bold text-text-muted uppercase">
                        {item.note.condition}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-text-muted flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> {item.note.location}
                      </span>
                      <span className="text-sm font-black text-text-main">
                        ₹{item.note.price * item.quantity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex justify-between text-xs font-semibold text-text-muted">
                <span>Notes cost (in cash)</span>
                <span className="font-bold text-text-main">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-text-muted">
                <span>Platform fee (online)</span>
                <div className="flex items-center gap-1.5">
                  {couponResult?.valid &&
                    couponResult.finalFee < rawPlatformFee && (
                      <span className="text-[10px] line-through text-text-muted">
                        ₹{rawPlatformFee}
                      </span>
                    )}
                  <span
                    className={`font-bold ${couponResult?.valid && couponResult.feeWaived ? "text-emerald-600 dark:text-emerald-400" : "text-text-main"}`}
                  >
                    {couponResult?.valid && couponResult.feeWaived
                      ? "FREE"
                      : `₹${platformFee}`}
                  </span>
                </div>
              </div>
              {appliedCoupon && couponResult?.valid && (
                <div className="flex justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Tag className="h-2.5 w-2.5" /> {appliedCoupon}
                  </span>
                  <span>-₹{rawPlatformFee - platformFee}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-3 border-t border-border">
                <span className="text-xs font-black text-text-main uppercase tracking-wider">
                  Total
                </span>
                <span className="text-xl font-black text-text-main">
                  ₹{total}
                </span>
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-relaxed">
                {couponResult?.valid && couponResult.feeWaived
                  ? `Fee waived via coupon · ₹${subtotal} cash at exchange`
                  : `₹${platformFee} paid online now · ₹${subtotal} cash at exchange`}
              </p>
            </div>

            {/* Desktop CTA buttons — hidden on mobile */}
            <div className="hidden lg:flex flex-col gap-3 mt-6 pt-5 border-t border-border">
              {step === 1 ? (
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                >
                  Continue to Payment <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setStep(1)}
                    className="w-full py-3 bg-surface hover:bg-primary-hover text-text-muted rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] border border-border"
                  >
                    ← Back to Logistics
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={loading || !agreedToDelivery}
                    className="w-full py-3.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#003366]/25 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Processing...
                      </>
                    ) : couponResult?.valid && couponResult.feeWaived ? (
                      "Place Order (Free!)"
                    ) : (
                      `Pay ₹${platformFee} & Place Order`
                    )}
                  </button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Mobile sticky bottom CTA bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border px-4 py-4 shadow-2xl shadow-black/10">
        {/* Mini price summary */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
              {step === 1 ? 'Order Total' : 'Pay Now'}
            </span>
            <span className="text-lg font-black text-text-main">
              ₹{step === 1 ? total : platformFee}
            </span>
          </div>
          {step === 2 && (
            <span className="text-[10px] text-text-muted font-semibold">
              + ₹{subtotal} cash at meetup
            </span>
          )}
        </div>

        {step === 1 ? (
          <button
            onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="w-full py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[#003366]/25"
          >
            Continue to Payment <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-5 py-4 bg-surface border border-border text-text-muted rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              ← Back
            </button>
            <button
              onClick={handlePlaceOrder}
              disabled={loading || !agreedToDelivery}
              className="flex-1 py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#003366]/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Processing...
                </>
              ) : couponResult?.valid && couponResult.feeWaived ? (
                <>Place Order · Free! 🎉</>
              ) : (
                <>Pay ₹{platformFee} &amp; Order</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};