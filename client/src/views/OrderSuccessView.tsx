import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Copy, ShieldCheck, MapPin, MessageSquare, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderSuccessViewProps {
  key?: string;
  orderData: any;
  onBack: () => void;
  onGoToMessages: () => void;
}

export const OrderSuccessView: React.FC<OrderSuccessViewProps> = ({ orderData, onBack, onGoToMessages }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!orderData) return null;

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast.success('PIN copied to clipboard');
  };

  const totalCost = orderData.items.reduce((acc: number, item: any) => acc + (item.price_at_purchase * item.quantity), 0);
  const cashDue = totalCost - orderData.platformFee;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/20"
      >
        <CheckCircle2 className="h-10 w-10 text-white" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-2 mb-10"
      >
        <h1 className="text-3xl font-black text-text-main tracking-tight">Order Confirmed!</h1>
        <p className="text-text-muted">Your payment of <span className="font-bold text-text-main">₹{orderData.platformFee}</span> (Platform Fee) is successful.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full space-y-6"
      >
        {/* Next Steps Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          
          <h2 className="text-lg font-black text-text-main mb-6 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Security & Exchange
          </h2>

          <div className="space-y-8">
            {/* PIN HERO SECTION */}
            <div className="bg-background/80 border-2 border-primary/20 rounded-3xl p-6 text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
              
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">
                <ShieldCheck className="h-3 w-3" /> Secure Exchange PIN
              </div>

              <div className="space-y-4">
                {orderData.items.map((item: any, idx: number) => (
                  <div key={idx} className="relative z-10">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 truncate px-4">
                      {item.title}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex gap-2">
                        {(item.meetup_pin || '0000').split('').map((char: string, i: number) => (
                          <span key={i} className="w-10 h-12 sm:w-12 sm:h-14 bg-surface rounded-xl border border-border flex items-center justify-center text-xl sm:text-2xl font-black text-primary shadow-sm">
                            {char}
                          </span>
                        ))}
                      </div>
                      <button 
                        onClick={() => handleCopyPin(item.meetup_pin)}
                        className="p-3 bg-surface hover:bg-primary-hover border border-border rounded-xl text-text-muted transition-all active:scale-95"
                        title="Copy PIN"
                      >
                        <Copy className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-[11px] font-medium text-text-muted leading-relaxed">
                <span className="text-primary font-black">CRITICAL:</span> Only show this PIN to the seller <span className="underline decoration-primary/30 underline-offset-4">after</span> you have inspected and received the physical notes.
              </p>
            </div>

            {/* Step 1: Cash */}
            <div className="flex gap-4 p-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center shrink-0 border border-primary/20">
                <span className="text-sm">₹</span>
              </div>
              <div>
                <h3 className="font-bold text-text-main mb-1">Cash Payment Due</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Hand over <strong className="text-text-main font-black">₹{cashDue}</strong> to the seller at the meetup. The remaining balance was settled via the online platform fee.
                </p>
              </div>
            </div>

            {/* Step 3: Chat */}
            <div className="flex gap-4 p-2">
              <div className="w-10 h-10 rounded-2xl bg-accent text-accent-foreground font-black flex items-center justify-center shrink-0 border border-accent/20">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="w-full">
                <h3 className="font-bold text-text-main mb-1">Coordinate via Chat</h3>
                <p className="text-sm text-text-muted mb-5 leading-relaxed">
                  We've sent your availability to the seller. Open the chat to confirm the exact location and time for the exchange.
                </p>
                
                <button
                  onClick={onGoToMessages}
                  className="w-full py-4 bg-[#003366] hover:bg-[#002244] text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#003366]/20 active:scale-[0.98]"
                >
                  <MessageSquare className="h-4 w-4" /> Go to Chat
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onBack}
          className="w-full py-4 text-text-muted hover:text-text-main font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        >
          View in My Orders <ArrowRight className="h-4 w-4" />
        </button>

      </motion.div>
    </div>
  );
}
