import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Trash2, Info, Sparkles, ShoppingBag,
  CreditCard, Banknote,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getPlatformFeeConfig, formatRupee, formatCashAtMeetup } from '../utils/formatters';
import type { Note } from '../types';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose, onCheckout }) => {
  const { cart, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [showDelivery, setShowDelivery] = useState(false);

  const PLATFORM_FEE_PERCENTAGE = settings.platform_fee_percentage;
  const total = cart.reduce((sum, item) => sum + item.note.price * item.quantity, 0);
  const originalTotal = cart.reduce((sum, item) => sum + (item.note.originalPrice || item.note.price) * item.quantity, 0);
  const totalSavings = originalTotal - total;
  const fee = Math.round(total * (PLATFORM_FEE_PERCENTAGE / 100));
  const cashAtMeetup = total - fee;

  if (!isOpen) return null;

  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: 'spring', damping: 32, stiffness: 420, mass: 0.7 }}
          className="bg-surface w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-border"
          style={{ maxHeight: '92dvh' }}
        >
          {/* Drag handle — mobile only */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <h2 className="text-base font-black text-text-main tracking-tight">Your Cart</h2>
              {itemCount > 0 && (
                <span className="bg-primary text-black text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {itemCount}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-text-muted hover:bg-background transition-all active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mb-4 border border-border">
                  <ShoppingBag className="h-8 w-8 text-text-muted opacity-40" />
                </div>
                <p className="font-black text-text-main mb-1">Empty cart</p>
                <p className="text-xs text-text-muted mb-6">You haven't added any notes yet.</p>
                <button
                  onClick={onClose}
                  className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                >
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {cart.map((item) => (
                  <motion.div
                    key={item.note.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex gap-3 p-3.5 bg-background border border-border rounded-2xl"
                  >
                    <img
                      src={item.note.image}
                      alt={item.note.title}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="text-sm font-bold text-text-main truncate pr-2 leading-tight">{item.note.title}</h4>
                        <button
                          onClick={() => removeFromCart(item.note.id)}
                          className="text-text-muted hover:text-red-500 transition-colors shrink-0 p-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider mb-2.5">{item.note.courseCode}</p>

                      <div className="flex items-center justify-between">
                        {/* Quantity control */}
                        <div className="flex items-center gap-0 bg-surface rounded-xl border border-border overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.note.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-primary disabled:opacity-30 transition-colors text-sm font-bold"
                          >−</button>
                          <span className="w-6 text-center text-xs font-black text-text-main">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.note.id, item.quantity + 1)}
                            disabled={item.quantity >= item.note.quantity}
                            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-primary disabled:opacity-30 transition-colors text-sm font-bold"
                          >+</button>
                        </div>
                        <div className="flex flex-col items-end leading-none">
                          {item.note.originalPrice && item.note.originalPrice > item.note.price && (
                            <span className="text-[9px] font-bold text-text-muted line-through mb-[1px]">
                              {formatRupee(item.note.originalPrice * item.quantity)}
                            </span>
                          )}
                          <span className="text-sm font-black text-primary">{formatRupee(item.note.price * item.quantity)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {cart.length > 0 && (
            <div className="px-4 pt-3 pb-5 sm:pb-4 border-t border-border space-y-3 shrink-0 bg-surface">

              {/* Payment split strip */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="p-3 flex flex-col gap-0.5 bg-primary/5">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest">Pay Online</span>
                    </div>
                    <p className="text-xl font-black text-text-main">₹{fee}</p>
                    <p className="text-[9px] text-text-muted">Platform fee</p>
                  </div>
                  <div className="p-3 flex flex-col gap-0.5 bg-surface">
                    <div className="flex items-center gap-1.5">
                      <Banknote className="h-3 w-3 text-text-muted shrink-0" />
                      <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Cash at Meetup</span>
                    </div>
                    <p className="text-xl font-black text-text-main">₹{cashAtMeetup}</p>
                    <p className="text-[9px] text-text-muted">To seller</p>
                  </div>
                </div>

                {/* Fee info row */}
                {(() => {
                  const config = getPlatformFeeConfig(PLATFORM_FEE_PERCENTAGE);
                  return (
                    <div className="border-t border-border">
                      <button
                        onClick={() => setShowDelivery(!showDelivery)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-background/50 hover:bg-background transition-colors"
                      >
                        <span className={`flex items-center gap-1.5 text-[9px] font-bold ${config.color}`}>
                          {config.isPromo && <Sparkles className="h-3 w-3 animate-pulse" />}
                          {config.label}: {config.desc}
                        </span>
                        <Info className={`h-3 w-3 shrink-0 ${config.color}`} />
                      </button>

                      <AnimatePresence>
                        {showDelivery && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className={`px-3 py-2.5 text-[10px] leading-relaxed ${config.color} border-t border-border/50`}>
                              {config.isPromo && <p className="font-black mb-1">✨ Special Offer Applied!</p>}
                              <p>The platform fee maintains secure real-time chat and verified handovers. You only pay this online — the rest is cash at pickup.</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })()}
              </div>

              {/* Total row */}
              <div className="flex items-baseline justify-between px-1">
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Order Total</span>
                <div className="flex flex-col items-end leading-none">
                  {totalSavings > 0 && (
                    <span className="text-[10px] font-bold text-emerald-500 mb-1">
                      You save {formatRupee(totalSavings)}
                    </span>
                  )}
                  <span className="text-2xl font-black text-text-main">{formatRupee(total)}</span>
                </div>
              </div>

              {/* Checkout button */}
              <button
                onClick={onCheckout}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: '#fb641b', color: '#fff', boxShadow: '0 4px 18px rgba(251,100,27,0.3)' }}
              >
                <CreditCard className="h-4 w-4" />
                Proceed to Checkout
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};