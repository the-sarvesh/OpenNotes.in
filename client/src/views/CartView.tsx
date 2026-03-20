import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart, ArrowLeft, Trash2, Plus, Minus,
  ChevronRight, ShieldCheck, Info, Sparkles, MapPin, Package,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  formatSemester, getPlatformFeeConfig,
  formatRupee, formatCashAtMeetup,
} from '../utils/formatters';
import { View, Listing, Order, OrderItem, CartItem } from '../types';
import { useSettings } from '../contexts/SettingsContext';

interface CartViewProps {
  cart: CartItem[];
  updateQuantity: (id: string, q: number) => void;
  removeItem: (id: string) => void;
}

export const CartView: React.FC<CartViewProps> = ({ cart, updateQuantity, removeItem }) => {
  const navigate = useNavigate();
  const { settings, loading } = useSettings();

  if (loading || !settings) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center">
        <span className="h-7 w-7 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const PLATFORM_FEE_PERCENTAGE = settings.platform_fee_percentage;
  const total = cart.reduce((acc, item) => acc + item.note.price * item.quantity, 0);
  const platformFee = Math.round(total * (PLATFORM_FEE_PERCENTAGE / 100));
  const cashAtMeetup = total - platformFee;

  // ── Empty state ──────────────────────────────────────────────────
  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-surface rounded-[2.5rem] p-12 border border-border shadow-xl text-center max-w-sm w-full"
        >
          <div className="w-20 h-20 bg-background rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border">
            <ShoppingCart className="h-9 w-9 text-slate-300" />
          </div>
          <h2 className="text-2xl font-black text-text-main mb-2 tracking-tight">Cart is empty</h2>
          <p className="text-text-muted mb-8 text-sm leading-relaxed max-w-xs mx-auto">
            You haven't added any notes yet. Browse the marketplace to find what you need.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-2xl active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            Start Shopping
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Filled cart ──────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-40 lg:pb-12">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate('/browse')}
          className="p-2 hover:bg-background rounded-xl transition-colors active:scale-90 text-text-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-text-main tracking-tight leading-none">
            Shopping Cart
          </h1>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">
            {cart.length} item{cart.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-start">

        {/* ── Item list ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          <AnimatePresence initial={false}>
            {cart.map((item, idx) => (
              <motion.div
                layout
                key={item.note.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                <div className="flex gap-4 p-4 sm:p-5">

                  {/* Thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-background border border-border shrink-0">
                    <img
                      src={item.note.image}
                      alt={item.note.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col gap-2">

                    {/* Top row: title + delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">
                          {item.note.courseCode}
                        </p>
                        <h3 className="font-bold text-text-main text-sm sm:text-base leading-tight line-clamp-2">
                          {item.note.title}
                        </h3>
                      </div>
                      <button
                        onClick={() => removeItem(item.note.id)}
                        className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all shrink-0 active:scale-90"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Meta pills */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-background border border-border rounded-lg text-[9px] font-bold text-text-muted uppercase tracking-wider">
                        {formatSemester(item.note.semester)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-background border border-border rounded-lg text-[9px] font-bold text-text-muted uppercase tracking-wider">
                        <MapPin className="h-2.5 w-2.5" />
                        {item.note.location}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-background border border-border rounded-lg text-[9px] font-bold text-text-muted uppercase tracking-wider">
                        <Package className="h-2.5 w-2.5" />
                        {item.note.deliveryMethod}
                      </span>
                    </div>

                    {/* Bottom row: qty + price */}
                    <div className="flex items-center justify-between mt-auto pt-1">
                      {/* Qty stepper */}
                      <div className="flex items-center gap-0.5 bg-background border border-border rounded-xl p-1">
                        <button
                          onClick={() => updateQuantity(item.note.id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-text-muted transition-colors disabled:opacity-30 active:scale-90"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-black text-text-main">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.note.id, Math.min(item.note.quantity, item.quantity + 1))}
                          disabled={item.quantity >= item.note.quantity}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-text-muted transition-colors disabled:opacity-30 active:scale-90"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Price</p>
                        <p className="text-xl font-black text-text-main">
                          {item.note.price === 0 ? 'FREE' : formatRupee(item.note.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── Price summary sidebar ──────────────────────────────── */}
        <div className="lg:sticky lg:top-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="bg-surface rounded-[2rem] border border-border shadow-lg overflow-hidden"
          >
            {/* Summary header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Price Details</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Listing total */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-text-muted">Listing Total</span>
                <span className="text-base font-black text-text-main">{formatRupee(total)}</span>
              </div>

              {/* Platform fee — dynamic config */}
              {(() => {
                const config = getPlatformFeeConfig(PLATFORM_FEE_PERCENTAGE);
                return (
                  <div className="space-y-3">
                    <div className={`flex justify-between items-center ${config.color}`}>
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        {config.isPromo && <Sparkles className="h-3.5 w-3.5 animate-pulse" />}
                        {config.label}
                        <span className="text-[9px] opacity-70 font-bold uppercase tracking-wider">{config.desc}</span>
                      </span>
                      <span className="text-base font-black">{formatRupee(platformFee)}</span>
                    </div>

                    {config.isPromo && (
                      <div className={`p-3.5 rounded-xl border ${config.bgColor} ${config.borderColor} flex items-start gap-2.5`}>
                        <div className={`p-1.5 rounded-lg ${config.color} bg-white/10 shrink-0 mt-0.5`}>
                          <Info className="h-3.5 w-3.5" />
                        </div>
                        <p className={`text-[11px] font-bold leading-relaxed ${config.color}`}>
                          {config.label} applied! You're saving on platform fees.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Pay now / cash split */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border overflow-hidden">
                <div className="p-3.5 bg-primary/5 flex flex-col gap-0.5">
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">Pay Online</span>
                  <span className="text-xl font-black text-text-main">{formatRupee(platformFee)}</span>
                  <span className="text-[9px] text-text-muted">Platform fee</span>
                </div>
                <div className="p-3.5 bg-surface flex flex-col gap-0.5 border-l border-border">
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Cash at Meetup</span>
                  <span className="text-xl font-black text-text-main">{formatCashAtMeetup(total, platformFee)}</span>
                  <span className="text-[9px] text-text-muted">To seller</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="px-6 pb-6">
              <button
                onClick={() => navigate('/checkout')}
                className="w-full py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#003366]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Checkout Now <ChevronRight className="h-4 w-4" />
              </button>

              <div className="mt-4 flex items-center gap-2.5 px-3 py-2.5 bg-background rounded-xl border border-border">
                <ShieldCheck className="h-6 w-6 text-text-muted shrink-0" />
                <p className="text-[9px] font-bold text-text-muted leading-relaxed uppercase tracking-wider">
                  Safe & Secure Payments. 100% Authentic Notes.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Mobile sticky bottom bar ───────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border px-4 pt-3 pb-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Pay Online Now</p>
            <p className="text-xl font-black text-text-main">{formatRupee(platformFee)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Cash at Meetup</p>
            <p className="text-xl font-black text-text-main">{formatCashAtMeetup(total, platformFee)}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/checkout')}
          className="w-full py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#003366]/25"
        >
          Checkout Now <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};