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
  Banknote,
  Info,
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

const LOCATIONS = ['Noida / Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Other (Manual)'];
const STANDARD_SPOTS = ['HCL Office', 'BITS Exam Center'];

// ── Reusable section card ──────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div className={`bg-surface rounded-2xl border border-border shadow-sm ${className}`}>
    {children}
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="p-2.5 bg-primary/10 rounded-xl text-primary">{icon}</div>
    <h2 className="text-sm font-black text-text-main uppercase tracking-widest">{title}</h2>
  </div>
);

const ShieldCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// ── Payment Split explanation banner ──────────────────────────────
const PaymentSplitBanner: React.FC<{ platformFee: number; cashAmount: number }> = ({ platformFee, cashAmount }) => (
  <div className="rounded-2xl border border-border overflow-hidden">
    <div className="grid grid-cols-2 divide-x divide-border">
      <div className="p-4 flex flex-col gap-1 bg-primary/5">
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-3 w-3 text-primary shrink-0" />
          <span className="text-[9px] font-black text-primary uppercase tracking-widest">Pay Online Now</span>
        </div>
        <p className="text-2xl font-black text-text-main">₹{platformFee}</p>
        <p className="text-[10px] text-text-muted leading-tight">Platform fee · secures order</p>
      </div>
      <div className="p-4 flex flex-col gap-1 bg-surface">
        <div className="flex items-center gap-1.5">
          <Banknote className="h-3 w-3 text-text-muted shrink-0" />
          <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Cash at Meetup</span>
        </div>
        <p className="text-2xl font-black text-text-main">₹{cashAmount}</p>
        <p className="text-[10px] text-text-muted leading-tight">To seller · after inspecting notes</p>
      </div>
    </div>
    <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200/60 dark:border-amber-800/40 flex items-start gap-2">
      <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-tight">
        Share your <strong>4-digit PIN</strong> with the seller only after you've verified the notes at the meetup.
      </p>
    </div>
  </div>
);

export const CheckoutView: React.FC<CheckoutViewProps> = ({ cart, onSuccess, onBack }) => {
  const navigate = useNavigate();
  const { cart: contextCart, clearCart, validateCart } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Re-validate cart freshness when the checkout page is first opened (FE-4)
  React.useEffect(() => {
    if (user && contextCart.length > 0) {
      validateCart();
    }
  }, []);

  const activeCart = cart || contextCart;

  const [buyerLocation, setBuyerLocation] = useState("Noida / Delhi NCR");
  const [customBuyerLocation, setCustomBuyerLocation] = useState("");
  const [buyerPreferredSpot, setBuyerPreferredSpot] = useState("HCL Office");
  const [buyerMeetupDetails, setBuyerMeetupDetails] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [collectionPeriod, setCollectionPeriod] = useState("Morning");
  const [userNote, setUserNote] = useState("");
  const [agreedToDelivery, setAgreedToDelivery] = useState(false);

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

  const total = activeCart.reduce((acc, item) => acc + item.note.price * item.quantity, 0);
  const rawPlatformFee = 0; // Temporarily 0 for launch promo
  const platformFee = 0;
  const subtotal = total;

  const needsDelivery = activeCart.some(
    (i) => i.note.deliveryMethod === "courier" || i.note.deliveryMethod === "both" || i.note.deliveryMethod === "Delivery",
  );
  const needsMeetup = activeCart.some(
    (i) => i.note.deliveryMethod === "in_person" || i.note.deliveryMethod === "both" || i.note.deliveryMethod === "Hand-to-Hand",
  );

  const validateCoupon = useCallback(async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponResult(null);
    try {
      const res = await apiRequest("/api/orders/validate-coupon", {
        method: "POST",
        body: JSON.stringify({ coupon_code: couponInput.trim(), order_total: total }),
      });
      const data = await res.json();
      if (res.ok) {
        setCouponResult(data);
        setAppliedCoupon(couponInput.trim().toUpperCase());
        toast.success(data.message);
      } else {
        setCouponResult({ valid: false, message: data.error, originalFee: rawPlatformFee, finalFee: rawPlatformFee, feeWaived: false, discountType: "", discountValue: 0 });
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
    if (needsDelivery && buyerLocation === 'Other (Manual)' && !customBuyerLocation) { toast.error("Please specify your city/region"); return; }
    if (needsMeetup && !collectionDate) { toast.error("Please select a collection date"); return; }
    if (!agreedToDelivery) { toast.error("You must agree to the delivery methods"); return; }

    setLoading(true);
    try {
      const formattedAvailability = `${collectionDate} (${collectionPeriod})`;
      const res = await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: activeCart.map((item) => ({ listing_id: item.note.id, quantity: item.quantity })),
          buyer_location: buyerLocation === 'Other (Manual)' ? customBuyerLocation : buyerLocation,
          buyer_preferred_spot: buyerPreferredSpot,
          buyer_availability: formattedAvailability,
          buyer_note: userNote || null,
          buyer_meetup_details: buyerMeetupDetails || null,
          agreed_to_delivery: agreedToDelivery,
          coupon_code: appliedCoupon || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (onSuccess) { onSuccess(data); } else { clearCart(); toast.success("Order placed successfully!"); }
      } else {
        toast.error(data.error || "Failed to place order");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goToStep2 = () => { setStep(2); };
  const goToStep1 = () => { setStep(1); };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-36 lg:pb-24 overflow-x-hidden">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="p-2 rounded-xl hover:bg-background text-text-muted transition-colors shrink-0 active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text-main tracking-tight leading-none">Checkout</h1>
          <p className="text-[10px] text-text-muted mt-1 font-bold uppercase tracking-widest">Step {step} of 2</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 lg:gap-8 items-start">

        {/* ── Left column ── */}
        <div className="space-y-4">

          {/* Step indicator */}
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              {[
                { id: 1, label: "Meetup Details", icon: <MapPin className="h-4 w-4" /> },
                { id: 2, label: "Payment", icon: <CreditCard className="h-4 w-4" /> },
              ].map((s, i) => {
                const done = step > s.id;
                const active = step === s.id;
                return (
                  <React.Fragment key={s.id}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-black text-sm transition-all ${done ? "bg-emerald-500 text-white" : active ? "bg-primary text-black" : "bg-background text-text-muted border border-border"}`}>
                        {done ? <Check className="h-4 w-4" /> : s.icon}
                      </div>
                      <p className={`text-xs font-bold transition-colors truncate ${active ? "text-text-main" : "text-text-muted"}`}>
                        {s.label}
                      </p>
                    </div>
                    {i === 0 && (
                      <div className={`flex-1 mx-1 h-0.5 rounded-full transition-colors ${done ? "bg-emerald-500" : "bg-border"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </Card>

          <AnimatePresence mode="wait">

            {/* ════════ STEP 1 ════════ */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Launch Promo Banner */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/20">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Launch Promo Active! 🎉</h3>
                    <p className="text-xs text-emerald-800/70 font-medium">Platform fees are waived for all BITSians for a limited time.</p>
                  </div>
                </div>

                {/* Payment split — shown upfront so user isn't surprised */}
                <PaymentSplitBanner platformFee={0} cashAmount={total} />

                <Card className="p-4 sm:p-6">
                  <SectionHeader icon={<MapPin className="h-4 w-4" />} title="Where & When to Meet" />

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                          Your Region / City
                        </label>
                        <select
                          value={buyerLocation}
                          onChange={(e) => setBuyerLocation(e.target.value)}
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        >
                          {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                          Preferred Hand-over Spot
                        </label>
                        <select
                          value={buyerPreferredSpot}
                          onChange={(e) => setBuyerPreferredSpot(e.target.value)}
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        >
                          {STANDARD_SPOTS.map(spot => (
                            <option key={spot} value={spot}>{spot}</option>
                          ))}
                          <option value="Other">Other (Specify below)</option>
                        </select>
                      </div>
                    </div>

                    {buyerLocation === 'Other (Manual)' && (
                      <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                          Specify Your City / Region <span className="text-red-500 text-[9px] font-bold">(Required)</span>
                        </label>
                        <input
                          type="text"
                          value={customBuyerLocation}
                          onChange={(e) => setCustomBuyerLocation(e.target.value)}
                          placeholder="e.g. Mumbai, Kolkata, Pilani..."
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                        Specific Instructions / Meetup Details
                      </label>
                      <input
                        type="text"
                        value={buyerMeetupDetails}
                        onChange={(e) => setBuyerMeetupDetails(e.target.value)}
                        placeholder="e.g. hcl 126, cafe 3..."
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                        Preferred Date for Meetup
                      </label>
                      <input
                        type="date"
                        value={collectionDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setCollectionDate(e.target.value)}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary transition-all mb-4 [color-scheme:dark]"
                      />
                      
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                        Preferred Time of Day
                      </label>
                      <div className="grid grid-cols-3 gap-2.5">
                        {["Morning", "Afternoon", "Evening"].map((time) => (
                          <label
                            key={time}
                            className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${collectionPeriod === time ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-border/80"}`}
                          >
                            <input
                              type="radio"
                              name="availability"
                              value={time}
                              checked={collectionPeriod === time}
                              onChange={(e) => setCollectionPeriod(e.target.value)}
                              className="hidden"
                            />
                            <span className="text-xs font-bold text-text-main">{time}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                        Note to seller <span className="normal-case text-[9px] text-text-muted font-medium">(optional)</span>
                      </label>
                      <textarea
                        placeholder="Anything else you'd like to mention?"
                        value={userNote}
                        onChange={(e) => setUserNote(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ════════ STEP 2 ════════ */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Payment split — shown again before user pays */}
                <PaymentSplitBanner
                  platformFee={couponResult?.valid && couponResult.feeWaived ? 0 : platformFee}
                  cashAmount={subtotal}
                />

                <Card className="p-4 sm:p-6 space-y-5">
                  <SectionHeader icon={<CreditCard className="h-4 w-4" />} title="Confirm & Pay" />

                  {/* Coupon Code */}
                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                      <Tag className="h-3 w-3 inline mr-1" />
                      Coupon Code (Optional)
                    </label>

                    {appliedCoupon && couponResult?.valid ? (
                      <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 tracking-widest">{appliedCoupon}</p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-500">{couponResult.message}</p>
                          </div>
                        </div>
                        <button
                          onClick={removeCoupon}
                          className="p-1.5 text-emerald-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponResult(null); }}
                          onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
                          placeholder="Enter coupon code…"
                          className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-main placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono tracking-widest uppercase"
                          disabled={couponLoading}
                        />
                        <button
                          onClick={validateCoupon}
                          disabled={!couponInput.trim() || couponLoading}
                          className="px-4 py-3 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 active:scale-95"
                        >
                          {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                          Apply
                        </button>
                      </div>
                    )}

                    {couponResult && !couponResult.valid && (
                      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                        <XCircle className="h-3 w-3 shrink-0" /> {couponResult.message}
                      </p>
                    )}
                  </div>

                  {/* OpenNotes Shield */}
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-surface rounded-xl flex items-center justify-center shadow-sm border border-border shrink-0">
                        <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1">OpenNotes Shield Active</p>
                        <p className="text-[11px] text-emerald-800/70 dark:text-emerald-400/70 leading-relaxed">
                          Pay the platform fee now to lock in your order and get the seller's contact. Only share your <strong>PIN</strong> after you inspect the notes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agreement checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer p-3.5 bg-background rounded-xl border border-border hover:border-primary/40 transition-colors">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={agreedToDelivery}
                        onChange={(e) => setAgreedToDelivery(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border border-border bg-surface checked:bg-emerald-500 checked:border-transparent transition-all"
                      />
                      <svg className="absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-text-muted leading-relaxed">
                      I agree: I'll pay <strong className="text-text-main">₹0 online (Waived)</strong> as the platform fee, and <strong className="text-text-main">₹{total} cash</strong> to the seller at the meetup after inspecting the notes.
                    </span>
                  </label>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right sidebar: Order summary ── */}
        <div className="lg:sticky lg:top-6">
          <Card className="p-5 sm:p-6">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-5">Order Summary</p>

            {/* Cart items */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1 mb-5 scrollbar-hide">
              {activeCart.map((item) => (
                <div key={item.note.id} className="p-3 bg-background rounded-2xl border border-border/50">
                  <div className="flex gap-3 mb-3">
                    <div className="relative shrink-0">
                      <img src={item.note.image} className="h-16 w-16 rounded-xl object-cover border border-border" />
                      {item.quantity > 1 && (
                        <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary text-black rounded-full flex items-center justify-center text-[9px] font-black border-2 border-surface shadow-sm">
                          {item.quantity}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black text-primary uppercase tracking-wider mb-0.5">{item.note.courseCode}</p>
                      <p className="text-xs font-bold text-text-main leading-snug line-clamp-2 mb-1">{item.note.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-text-main">₹{item.note.price * item.quantity}</span>
                        <div className="flex gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-surface border border-border rounded-md text-text-muted uppercase">{item.note.semester}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-surface border border-border rounded-md text-text-muted uppercase">{item.note.condition}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Seller Preferred Location & Details */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Exchange Location</p>
                        <p className="text-[11px] font-bold text-text-main leading-tight">
                          {item.note.location || "BITS Pilani Campus"}
                        </p>
                        {item.note.preferredMeetupSpot && (
                          <p className="text-[10px] text-primary font-black mt-1 leading-tight flex items-center gap-1">
                            📍 {item.note.preferredMeetupSpot}
                          </p>
                        )}
                        {item.note.meetupLocation && (
                          <p className="text-[10px] text-text-muted mt-1 leading-tight italic">
                            ({item.note.meetupLocation})
                          </p>
                        )}
                      </div>
                    </div>
                    {item.note.materialType && (
                      <div className="flex items-center gap-2">
                        <Info className="h-3 w-3 text-text-muted shrink-0" />
                        <span className="text-[10px] font-medium text-text-muted italic capitalize">
                          {item.note.materialType} material
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex justify-between text-xs font-semibold text-text-muted">
                <span>Cash to seller (at meetup)</span>
                <span className="font-bold text-text-main">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-text-muted">
                <span>Platform fee (online)</span>
                <div className="flex items-center gap-1.5">
                  {couponResult?.valid && couponResult.finalFee < rawPlatformFee && (
                    <span className="text-[10px] line-through text-text-muted">₹{rawPlatformFee}</span>
                  )}
                  <span className={`font-bold ${couponResult?.valid && couponResult.feeWaived ? "text-emerald-600" : "text-text-main"}`}>
                    {couponResult?.valid && couponResult.feeWaived ? "FREE" : `₹${platformFee}`}
                  </span>
                </div>
              </div>
              {appliedCoupon && couponResult?.valid && (
                <div className="flex justify-between text-[10px] font-bold text-emerald-600">
                  <span className="flex items-center gap-1"><Tag className="h-2.5 w-2.5" /> {appliedCoupon}</span>
                  <span>−₹{rawPlatformFee - platformFee}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-3 border-t border-border">
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Pay Online Now</span>
                <span className="text-2xl font-black text-text-main">₹{platformFee}</span>
              </div>
              <p className="text-[10px] text-text-muted font-medium leading-relaxed">
                {couponResult?.valid && couponResult.feeWaived
                  ? `Fee waived · ₹${subtotal} cash at meetup`
                  : `₹${platformFee} online · ₹${subtotal} cash at meetup`}
              </p>
            </div>

            {/* Desktop CTAs */}
            <div className="hidden lg:flex flex-col gap-3 mt-6 pt-5 border-t border-border">
              {step === 1 ? (
                <button
                  onClick={goToStep2}
                  className="w-full py-3.5 bg-primary hover:bg-primary-hover text-black rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Continue to Payment <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <>
                  <button
                    onClick={goToStep1}
                    className="w-full py-3 bg-surface hover:bg-background text-text-muted rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] border border-border"
                  >
                    ← Back to Meetup
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={loading || !agreedToDelivery}
                    className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: "#fb641b", color: "#fff", boxShadow: "0 4px 20px rgba(251,100,27,0.3)" }}
                  >
                    {loading ? (
                      <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Processing…</>
                    ) : couponResult?.valid && couponResult.feeWaived ? (
                      "Place Order · Free! 🎉"
                    ) : (
                      <><CreditCard className="h-4 w-4" /> Pay ₹{platformFee} Now</>
                    )}
                  </button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Mobile sticky bottom bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border px-4 pt-3 pb-5 shadow-2xl">
        {/* Mini price strip */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
              {step === 1 ? "Order Total" : "Pay Online Now"}
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
            onClick={goToStep2}
            className="w-full py-4 bg-primary hover:bg-primary-hover text-black rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
          >
            Continue to Payment <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex gap-2.5">
            <button
              onClick={goToStep1}
              className="px-5 py-4 bg-surface border border-border text-text-muted rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] shrink-0"
            >
              ← Back
            </button>
            <button
              onClick={handlePlaceOrder}
              disabled={loading || !agreedToDelivery}
              className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "#fb641b", color: "#fff", boxShadow: "0 4px 20px rgba(251,100,27,0.3)" }}
            >
              {loading ? (
                <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Processing…</>
              ) : couponResult?.valid && couponResult.feeWaived ? (
                <>Place Order · Free! 🎉</>
              ) : (
                <><CreditCard className="h-4 w-4" /> Pay ₹{platformFee}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};