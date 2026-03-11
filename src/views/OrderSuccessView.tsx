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
            Next Steps for Meetup
          </h2>

          <div className="space-y-6">
            {/* Step 1: Cash */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center shrink-0">1</div>
              <div>
                <h3 className="font-bold text-text-main mb-1">Bring exact cash</h3>
                <p className="text-sm text-text-muted">You still need to pay the seller <strong className="text-text-main font-black">₹{cashDue}</strong> in cash (or UPI) during the meetup. (Total was ₹{totalCost})</p>
              </div>
            </div>

            {/* Step 2: Secret PIN */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center shrink-0">2</div>
              <div className="w-full">
                <h3 className="font-bold text-text-main mb-1">Share PIN to collect notes</h3>
                <p className="text-sm text-text-muted mb-3">Provide this PIN <strong className="text-black dark:text-white">after</strong> you've inspected the notes.</p>
                
                <div className="flex flex-col gap-2">
                  {orderData.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                      <div className="truncate pr-4">
                        <p className="text-xs font-semibold text-text-muted truncate">{item.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-lg font-black tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-lg">
                          {item.meetup_pin || '----'}
                        </span>
                        <button 
                          onClick={() => handleCopyPin(item.meetup_pin)}
                          className="p-2 hover:bg-surface rounded-lg text-text-muted transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Chat */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center shrink-0">3</div>
              <div className="w-full">
                <h3 className="font-bold text-text-main mb-1">Coordinate time and place</h3>
                <p className="text-sm text-text-muted mb-4">We've automatically messaged the seller with your availability. Go to Chat to confirm the exact meetup time.</p>
                
                <button
                  onClick={onGoToMessages}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-black text-sm uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageSquare className="h-4 w-4" /> Open Chat Now
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
