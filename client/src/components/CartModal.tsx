import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, X, Shield, CreditCard, Check, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { apiRequest } from '../utils/api';
import type { Note } from '../types';

const PLATFORM_FEE_PCT = 10;

export interface CartItem {
  note: Note;
  quantity: number;
}

interface CartModalProps {
  cart: CartItem[];
  onClose: () => void;
  updateQuantity: (id: string, q: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  onOrderSuccess?: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  cart, onClose, updateQuantity, removeItem, clearCart, onOrderSuccess,
}) => {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  // Scroll Lock (only when mounted)
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);

  const subtotal = cart.reduce((s, i) => s + i.note.price * i.quantity, 0);
  const fee = Math.round(subtotal * (PLATFORM_FEE_PCT / 100));

  const handleCheckout = async () => {
    if (!user) { setError('Please sign in to checkout.'); return; }
    if (!agreed) { setError('Please agree to coordinate with sellers.'); return; }
    setProcessing(true);
    setError('');
    try {
      const res = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map(i => ({ listing_id: i.note.id, quantity: i.quantity })),
          delivery_details: deliveryDetails,
          collection_date: collectionDate,
          agreed_to_delivery: agreed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      setSuccess(true);
      toast.success('Order placed! Check My Orders for your Meetup PIN.', { duration: 4000 });
      clearCart();
      onOrderSuccess?.();
      setTimeout(onClose, 2500);
    } catch (err: any) {
      toast.error(err.message);
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 32, stiffness: 380 }}
        className="bg-surface rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden border-0 sm:border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle mobile */}
        <div className="w-10 h-1.5 bg-surface  rounded-full mx-auto mt-4 sm:hidden shrink-0" />

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-black text-text-main mb-2">Order Confirmed!</h3>
            <p className="text-text-muted text-sm">
              Check <strong>My Orders</strong> for your Meetup PIN to complete the exchange.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-black text-text-main">
                  Your Cart
                </h2>
                {cart.length > 0 && (
                  <span className="bg-primary text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-text-muted hover:text-text-muted hover:text-primary hover:bg-primary-hover hover:bg-primary-hover transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <ShoppingCart className="h-12 w-12 text-slate-200  mb-4" />
                  <p className="font-bold text-text-main mb-1">Your cart is empty</p>
                  <p className="text-sm text-text-muted">Browse notes and add them here!</p>
                </div>
              ) : (
                <div className="px-6 py-4 space-y-4">
                  {cart.map(item => (
                    <div key={item.note.id} className="flex gap-4">
                      <img
                        src={item.note.image}
                        alt={item.note.title}
                        className="w-16 h-16 rounded-xl object-cover bg-surface shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-main line-clamp-1">{item.note.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">{item.note.courseCode} • {item.note.seller}</p>
                        <div className="flex items-center justify-between mt-2.5">
                          {/* Qty controls */}
                          <div className="flex items-center gap-2 bg-surface rounded-lg p-1">
                            <button
                              onClick={() => updateQuantity(item.note.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="w-6 h-6 flex items-center justify-center text-text-muted hover:bg-surface hover:bg-primary-hover rounded-md disabled:opacity-40 transition-all text-sm font-bold"
                            >−</button>
                            <span className="w-5 text-center text-sm font-bold text-text-main">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.note.id, item.quantity + 1)}
                              disabled={item.quantity >= item.note.quantity}
                              className="w-6 h-6 flex items-center justify-center text-text-muted hover:bg-surface hover:bg-primary-hover rounded-md disabled:opacity-40 transition-all text-sm font-bold"
                            >+</button>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-text-main">₹{item.note.price * item.quantity}</p>
                            <button onClick={() => removeItem(item.note.id)} className="text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium">Remove</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout panel */}
            {cart.length > 0 && (
              <div className="shrink-0 border-t border-border bg-background">
                {/* Delivery preferences - collapsible */}
                <button
                  onClick={() => setShowDelivery(!showDelivery)}
                  className="w-full flex items-center justify-between px-6 py-3.5 text-sm font-semibold text-text-muted hover:bg-primary-hover hover:bg-primary-hover transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Delivery preferences (optional)
                  </span>
                  {showDelivery ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                <AnimatePresence>
                  {showDelivery && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 space-y-3">
                        <input
                          type="text"
                          placeholder="Courier address (if applicable)"
                          value={deliveryDetails}
                          onChange={e => setDeliveryDetails(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-[#003366]/20 transition-all"
                        />
                        <input
                          type="date"
                          value={collectionDate}
                          onChange={e => setCollectionDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-text-muted focus:outline-none focus:ring-2 focus:ring-[#003366]/20 transition-all"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="px-6 pb-6 space-y-4">
                  {/* Price summary */}
                  <div className="space-y-2 py-3 border-t border-border">
                    <div className="flex justify-between text-sm text-text-muted">
                      <span>Item total (pay cash at meetup)</span>
                      <span>₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm text-text-muted">
                      <span className="flex items-center gap-1">Platform unlock fee (10%) <Shield className="h-3 w-3 text-primary" /></span>
                      <span>₹{fee}</span>
                    </div>
                  </div>

                  {/* What you pay now */}
                  <div className="p-4 bg-surface bg-accent rounded-xl border border-border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-black text-text-main">Pay now</span>
                      <span className="text-xl font-black text-primary">₹{fee}</span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      You'll pay ₹{subtotal} cash to the seller at meetup using your PIN.
                    </p>
                  </div>

                  {/* Agreement */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={e => setAgreed(e.target.checked)}
                      className="mt-0.5 rounded border-border text-black"
                    />
                    <span className="text-xs text-text-muted leading-relaxed">
                      I'll coordinate with the seller(s) via chat to arrange delivery based on their specified method.
                    </span>
                  </label>

                  {error && (
                    <p className="text-xs text-primary font-medium bg-surface bg-accent px-3 py-2 rounded-xl">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleCheckout}
                    disabled={processing || !agreed}
                    className="w-full py-3.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    {processing ? 'Processing...' : `Pay Unlock Fee · ₹${fee}`}
                  </button>

                  <p className="text-center text-[10px] text-text-muted flex items-center justify-center gap-1">
                    <Shield className="h-3 w-3" /> Escrow protected · Secure payment
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
};
