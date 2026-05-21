import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Send } from 'lucide-react';
import { apiRequest } from '../utils/api';
import toast from 'react-hot-toast';

interface FeedbackCardProps {
  triggerType: 'buyer' | 'seller';
  referenceId: string;    // order_id
  itemTitle: string;
  onClose: () => void;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  triggerType,
  referenceId,
  itemTitle,
  onClose,
}) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const headline =
    triggerType === 'seller'
      ? `Your note just found a new home! 🎉`
      : `Exchange complete! How was it?`;

  const subtext =
    triggerType === 'seller'
      ? `How was selling "${itemTitle.length > 30 ? itemTitle.slice(0, 30) + '…' : itemTitle}" on OpenNotes?`
      : `How was your experience buying "${itemTitle.length > 30 ? itemTitle.slice(0, 30) + '…' : itemTitle}"?`;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await apiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          trigger_type: triggerType,
          reference_id: referenceId,
          rating: rating || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (res.ok) {
        // Set 30-day cooldown
        const until = Date.now() + 30 * 24 * 60 * 60 * 1000;
        localStorage.setItem('feedback_submitted_until', String(until));
        if (triggerType === 'buyer') {
          localStorage.setItem(`feedback_shown_${referenceId}`, '1');
        } else {
          localStorage.setItem('feedback_seller_shown', String(Date.now()));
        }
        toast.success('Thanks for your feedback! 🎉', { duration: 4000 });
        onClose();
      } else {
        toast.error('Could not save feedback. Try again.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    const until = Date.now() + 14 * 24 * 60 * 60 * 1000;
    localStorage.setItem('feedback_skipped_until', String(until));
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.95 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      className="fixed bottom-5 right-5 z-50 w-80 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
    >
      {/* Accent strip */}
      <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-black text-text-main text-sm leading-snug">{headline}</p>
            <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{subtext}</p>
          </div>
          <button
            onClick={handleSkip}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-primary-hover transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Stars */}
        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform active:scale-90"
            >
              <Star
                className="h-7 w-7 transition-colors"
                fill={(hovered || rating) >= s ? '#FFC000' : 'none'}
                stroke={(hovered || rating) >= s ? '#FFC000' : 'currentColor'}
                style={{ color: (hovered || rating) >= s ? '#FFC000' : 'var(--color-text-muted)' }}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-xs text-text-muted ml-1 font-semibold">
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing!'][rating]}
            </span>
          )}
        </div>

        {/* Message */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Any suggestions? (optional)"
          rows={2}
          maxLength={500}
          className="w-full text-xs bg-background border border-border rounded-xl px-3 py-2.5 text-text-main placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        />

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSkip}
            className="flex-1 py-2 text-xs font-bold text-text-muted hover:text-text-main bg-background border border-border rounded-xl transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2 text-xs font-black text-white bg-primary hover:bg-primary/90 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? (
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <Send className="h-3 w-3" /> Send
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
