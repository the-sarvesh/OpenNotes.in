import React from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, ArrowLeft, Trash2, Plus, Minus, ChevronRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatSemester } from '../utils/formatters';
import { View, Listing, Order, OrderItem, CartItem } from '../types';


interface CartViewProps {
  cart: CartItem[];
  updateQuantity: (id: string, q: number) => void;
  removeItem: (id: string) => void;
}

export const CartView: React.FC<CartViewProps> = ({
  cart,
  updateQuantity,
  removeItem,
}) => {
  const navigate = useNavigate();
  const total = cart.reduce((acc, item) => acc + item.note.price * item.quantity, 0);
  const platformFee = Math.round(total * 0.1); 
  const cashAtMeetup = total - platformFee;

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surface rounded-[2.5rem] p-12 border border-border shadow-xl inline-block"
        >
          <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="h-10 w-10 text-slate-300" />
          </div>
          <h2 className="text-2xl font-black text-text-main mb-2">Your cart is empty</h2>
          <p className="text-text-muted mb-8 max-w-xs mx-auto text-sm">
            Looks like you haven't added any notes yet. Browse the marketplace to find what you need.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-2xl active:scale-95 transition-all shadow-lg"
          >
            Start Shopping
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-primary-hover hover:bg-primary-hover rounded-xl transition-colors">
          <ArrowLeft className="h-6 w-6 text-text-muted" />
        </button>
        <h1 className="text-3xl font-black text-text-main tracking-tight">Shopping Cart</h1>
        <span className="bg-surface px-3 py-1 rounded-full text-xs font-bold text-text-muted">
          {cart.length} item{cart.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Item List */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <motion.div
              layout
              key={item.note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-surface rounded-[2rem] p-5 sm:p-6 border border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex gap-4 sm:gap-6 items-start relative z-10">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[1.5rem] overflow-hidden bg-surface border border-border shrink-0">
                  <img src={item.note.image} alt={item.note.title} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className="font-bold text-text-main text-base sm:text-lg line-clamp-1 group-hover:text-black dark:group-hover:text-primary transition-colors">
                      {item.note.title}
                    </h3>
                    <button 
                      onClick={() => removeItem(item.note.id)}
                      className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <p className="text-xs font-black text-text-muted uppercase tracking-widest mb-3">
                    {item.note.courseCode} · {formatSemester(item.note.semester)}
                  </p>
                  
                  <div className="flex items-center gap-3 text-[10px] font-medium text-text-muted mb-4">
                    <span className="px-2 py-0.5 bg-surface rounded">{item.note.deliveryMethod}</span>
                    <span>•</span>
                    <span>{item.note.location}</span>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
                      <button 
                        onClick={() => updateQuantity(item.note.id, Math.max(1, item.quantity - 1))}
                        className="p-1.5 hover:bg-surface hover:bg-primary-hover rounded-lg text-text-muted transition-colors disabled:opacity-30"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-black text-text-main">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.note.id, Math.min(item.note.quantity, item.quantity + 1))}
                        className="p-1.5 hover:bg-surface hover:bg-primary-hover rounded-lg text-text-muted transition-colors disabled:opacity-30"
                        disabled={item.quantity >= item.note.quantity}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Price</p>
                      <p className="text-xl font-black text-text-main">₹{item.note.price * item.quantity}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Price Details */}
        <div className="lg:sticky lg:top-24">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-surface rounded-[2.5rem] p-8 border border-border shadow-xl shadow-slate-200/50 dark:shadow-none"
          >
            <h2 className="text-sm font-black text-text-muted uppercase tracking-[0.2em] mb-6">Price Details</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-text-muted text-sm font-semibold">
                <span>Notes Price (Cash)</span>
                <span className="text-text-main">₹{cashAtMeetup}</span>
              </div>
              <div className="flex justify-between text-text-muted text-sm font-semibold">
                <span>Platform Fee (Online)</span>
                <span className="text-primary">+₹{platformFee}</span>
              </div>
            </div>
            
            <div className="pt-6 border-t border-border mb-8">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Total Amount</p>
                  <p className="text-3xl font-black text-text-main">₹{total}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest bg-surface bg-accent px-2 py-1 rounded-lg">
                    You save ₹0
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#003366]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Checkout Now <ChevronRight className="h-4 w-4" />
            </button>
            
            <div className="mt-8 flex items-center gap-3 px-4 py-3 bg-background rounded-2xl border border-border">
              <ShieldCheck className="h-8 w-8 text-text-muted shrink-0" />
              <p className="text-[10px] font-medium text-text-muted leading-relaxed uppercase tracking-wider">
                Safe and Secure Payments. 100% Authentic Notes.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
