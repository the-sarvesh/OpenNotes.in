import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, CheckCircle2, Info, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiRequest } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export const TelegramNudge: React.FC = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkStatusAndNudge = async () => {
      try {
        const res = await apiRequest('/api/telegram/status');
        const data = await res.json();
        
        if (data.isLinked) {
          setIsLinked(true);
          return;
        }

        // Check nudge count
        const nudgeCount = parseInt(localStorage.getItem(`tg_nudge_${user.id}`) || '0');
        const lastNudge = parseInt(localStorage.getItem(`tg_nudge_last_${user.id}`) || '0');
        const now = Date.now();

        // Don't show if already linked or reached 3 denies
        if (nudgeCount >= 3) return;

        // Wait at least 1 day between nudges, or show immediately for new users (count 0)
        if (nudgeCount === 0 || (now - lastNudge > 24 * 60 * 60 * 1000)) {
          // Delay briefly for better UX after page load
          setTimeout(() => setIsVisible(true), 3000);
        }
      } catch (err) {
        console.error('Failed to check Telegram status for nudge:', err);
      }
    };

    checkStatusAndNudge();
  }, [user]);

  const handleClose = () => {
    if (user) {
      const nudgeCount = parseInt(localStorage.getItem(`tg_nudge_${user.id}`) || '0');
      localStorage.setItem(`tg_nudge_${user.id}`, (nudgeCount + 1).toString());
      localStorage.setItem(`tg_nudge_last_${user.id}`, Date.now().toString());
    }
    setIsVisible(false);
  };

  const handleConnect = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest('/api/telegram/generate-token');
      const data = await res.json();
      if (res.ok && data.link) {
        window.open(data.link, '_blank');
        toast.success('Opening Telegram...');
        setIsVisible(false); // Close on success
      } else {
        toast.error(data.error || 'Failed to generate linking token');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (!isVisible || isLinked) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-surface border border-border rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
        >
          {/* Decorative background element */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[80px] rounded-full" />
          
          <button 
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 hover:bg-background rounded-full transition-colors text-text-muted hover:text-text-main"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="p-5 bg-blue-500/10 rounded-[2rem] text-blue-600">
                <MessageCircle className="h-10 w-10" />
              </div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2 p-1.5 bg-primary rounded-full text-black shadow-lg"
              >
                <Sparkles className="h-4 w-4" />
              </motion.div>
            </div>

            <h3 className="text-xl font-black text-text-main uppercase tracking-tight mb-2">
              Stay Notified Anywhere!
            </h3>
            <p className="text-sm font-medium text-text-muted leading-relaxed mb-8 px-4">
              Connect our Telegram Bot to receive instant alerts for <b>orders</b>, <b>new messages</b>, and <b>meetup reminders</b> directly on your phone.
            </p>

            <div className="w-full space-y-3">
              <button
                onClick={handleConnect}
                disabled={generating}
                className="w-full px-8 py-4 bg-primary hover:bg-primary-hover text-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
                Connect Telegram Bot
              </button>
              
              <button
                onClick={handleClose}
                className="w-full px-8 py-4 bg-background hover:bg-slate-100 text-text-muted hover:text-text-main rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all"
              >
                Maybe Later
              </button>
            </div>

            <p className="mt-8 text-[9px] text-text-muted font-medium flex items-center gap-1.5 opacity-60">
              <Info className="h-3 w-3" />
              One-click setup. We only use your Chat ID for alerts.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
