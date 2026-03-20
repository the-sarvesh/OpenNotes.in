import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ShoppingCart, Trash2, ArrowRight, Info, 
  ChevronRight, AlertCircle, Sparkles, Gift,
  ShoppingBag, ShieldCheck, MapPin, Clock, Tag
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getPlatformFeeConfig } from '../utils/formatters';
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
  const subtotal = cart.reduce((sum, item) => sum + (item.note.price * item.quantity), 0);
  const fee = Math.round(subtotal * (PLATFORM_FEE_PERCENTAGE / 100));
  const total = subtotal + fee;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface w-full h-full sm:h-auto sm:max-w-xl sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-border"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between shrink-0 bg-background/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black text-text-main tracking-tight">
                Your Cart
              </h2>
              {cart.length > 0 && (
                <span className="bg-primary text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-text-muted hover:bg-primary-hover hover:text-white transition-all active:scale-90">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-0 scrollbar-hide">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-20 h-20 bg-background rounded-3xl flex items-center justify-center mb-4 border border-border">
                  <ShoppingBag className="h-10 w-10 text-slate-200" />
                </div>
                <p className="font-black text-text-main text-lg mb-1">Empty cart</p>
                <p className="text-sm text-text-muted max-w-[200px]">Looks like you haven't added any notes yet.</p>
                <button 
                  onClick={onClose}
                  className="mt-6 text-xs font-black text-primary uppercase tracking-widest hover:underline"
                >
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.note.id} className="flex gap-4 p-4 bg-background border border-border rounded-2xl group transition-all hover:border-primary/20">
                    <img 
                      src={item.note.image} 
                      alt={item.note.title} 
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-black text-text-main truncate pr-2">{item.note.title}</h4>
                        <button 
                          onClick={() => removeFromCart(item.note.id)}
                          className="text-text-muted hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-2">{item.note.courseCode}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border shadow-sm">
                          <button
                            onClick={() => updateQuantity(item.note.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-primary disabled:opacity-30 transition-colors"
                          >−</button>
                          <span className="w-5 text-center text-xs font-black text-text-main">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.note.id, item.quantity + 1)}
                            disabled={item.quantity >= item.note.quantity}
                            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-primary disabled:opacity-30 transition-colors"
                          >+</button>
                        </div>
                        <span className="text-sm font-black text-primary">₹{item.note.price * item.quantity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-6 bg-background border-t border-border space-y-4 shrink-0 shadow-2xl">
              {/* Summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-text-muted px-1">
                  <span>Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                {(() => {
                  const config = getPlatformFeeConfig(PLATFORM_FEE_PERCENTAGE);
                  return (
                    <div className="space-y-2">
                      <div className={`flex justify-between text-xs font-bold px-1 ${config.color} ${config.isPromo ? 'italic' : ''}`}>
                        <span className="flex items-center gap-1.5">
                          {config.isPromo && <Sparkles className="h-3 w-3 animate-pulse" />}
                          {config.label}: {config.desc}
                          <button onClick={() => setShowDelivery(!showDelivery)} className="text-primary hover:text-primary-hover ml-1">
                            <Info className="h-3 w-3" />
                          </button>
                        </span>
                        <span>₹{fee}</span>
                      </div>
                      
                      {showDelivery && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                          className={`p-3 rounded-xl border ${config.bgColor} ${config.borderColor} text-[10px] leading-relaxed ${config.color}`}
                        >
                          {config.isPromo ? (
                            <p className="font-bold">✨ Special Offer Applied!</p>
                          ) : null}
                          The platform fee helps us maintain the service, provide secure real-time chat, and verified handovers. You only pay this amount online; the rest is cash at pickup.
                        </motion.div>
                      )}
                    </div>
                  );
                })()}
                <div className="h-px bg-border/50 my-2" />
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-black text-text-main">Estimated Total</span>
                  <span className="text-xl font-black text-text-main">₹{total}</span>
                </div>
              </div>

              {/* Pay Now Callout */}
              {PLATFORM_FEE_PERCENTAGE > 0 ? (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Pay now (Fee)</p>
                    <p className="text-base font-black text-text-main">₹{fee}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Due at Meetup</p>
                    <p className="text-base font-black text-emerald-700 dark:text-emerald-400">₹{subtotal}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Payment Style</p>
                    <p className="text-xs font-black text-text-main">🤝 Direct Meetup (Cash)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Due</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">₹{subtotal}</p>
                  </div>
                </div>
              )}
              <button
                onClick={onCheckout}
                className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                Proceed to Checkout
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
