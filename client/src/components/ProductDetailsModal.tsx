import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Star, MapPin, MessageCircle, ShoppingCart, Trash2, Package, Tag, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Note } from '../types';

interface ProductDetailsModalProps {
  note: Note;
  onClose: () => void;
  onAddToCart: (n: Note) => void;
  onBuyNow: (n: Note) => void;
  isInCart: boolean;
  onContactSeller: (sellerId: string, listingId: string, title: string) => void;
}

const conditionColor: Record<string, string> = {
  'Like New': 'text-primary bg-surface bg-accent border-border',
  'Good': 'text-primary bg-surface bg-accent border-border',
  'Heavily Annotated': 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50',
};

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  note, onClose, onAddToCart, onBuyNow, isInCart, onContactSeller,
}) => {
  const { user, token } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => { 
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  const handleAdminDelete = async () => {
    if (!confirm('Delete this listing permanently?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/listings/${note.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { alert('Deleted successfully'); onClose(); window.location.reload(); }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 12 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        className="relative bg-surface/90 dark:bg-slate-900/90 backdrop-blur-xl w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden z-10 border border-white/20 dark:border-slate-700/50"
      >
        {/* Mobile drag handle */}
        <div className="w-10 h-1.5 bg-surface  rounded-full mx-auto mt-4 sm:hidden shrink-0" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20 p-2 bg-black/25 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-all border border-white/20"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        <div className="relative h-56 sm:h-64 shrink-0 bg-surface overflow-hidden">
          <img src={note.image} alt={note.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Badges on image */}
          <div className="absolute bottom-4 left-5 flex flex-col gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-black text-[10px] font-black rounded-lg uppercase tracking-wider shadow-md">
              <Tag className="h-2.5 w-2.5" />{note.courseCode}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 pt-5 pb-32">
          {/* Title + seller */}
          <div className="mb-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="text-xl font-black text-text-main leading-tight">{note.title}</h2>
              {note.rating > 0 && (
                <div className="shrink-0 flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{note.rating}</span>
                </div>
              )}
            </div>

            {/* Seller chip */}
            <div className="flex items-center gap-2 w-fit px-3 py-1.5 bg-surface border border-border rounded-full">
              <div className="h-5 w-5 rounded-full bg-[#003366] flex items-center justify-center text-white text-[9px] font-black">
                {note.seller.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-text-muted">{note.seller}</span>
            </div>
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${conditionColor[note.condition] || conditionColor['Good']}`}>
              {note.condition}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface rounded-lg text-[11px] font-bold text-text-muted border border-border shadow-sm">
              <Package className="h-3 w-3" /> {note.materialType}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background rounded-lg text-[11px] font-bold text-text-muted border border-border">
              {note.semester}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${note.quantity > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'}`}>
              {note.quantity > 0 ? `${note.quantity} in stock` : 'Sold out'}
            </span>
          </div>

          {/* Logistics */}
          <div className="p-4 bg-surface/50 rounded-2xl border border-border mb-4">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3">Exchange Details</p>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-text-main">
                  {note.deliveryMethod === 'in_person' ? 'In-person meetup' : note.deliveryMethod === 'courier' ? 'Courier / Shipping' : 'In-person or Courier'} · {note.location}
                </p>
                {note.meetupLocation && (
                  <p className="text-xs text-text-muted mt-1 italic">"{note.meetupLocation}"</p>
                )}
              </div>
            </div>
          </div>

          {/* Multiple subjects */}
          {note.isMultipleSubjects && note.subjects && note.subjects.length > 0 && (
            <div className="p-4 bg-surface/50 rounded-2xl border border-border">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Subjects included
              </p>
              <div className="flex flex-wrap gap-1.5">
                {note.subjects.map(s => (
                  <span key={s} className="px-2.5 py-1 bg-background rounded-lg text-[10px] font-semibold text-text-muted border border-border">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-surface/96 /96 backdrop-blur-xl border-t border-border px-4 sm:px-6 py-4 flex items-center gap-3 z-20">
          <div className="hidden sm:block min-w-[80px]">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Price</p>
            <p className="text-xl font-black text-text-main">₹{note.price}</p>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <button
              onClick={() => { onContactSeller(note.sellerId || '', note.id, note.title); }}
              className="p-3 bg-surface hover:bg-primary dark:hover:bg-primary group text-text-muted hover:text-white dark:hover:text-black rounded-xl transition-all border border-border"
              title="Message Seller"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => onAddToCart(note)}
              disabled={note.quantity === 0}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-40 ${
                isInCart 
                ? 'bg-accent text-white shadow-[#003366]/20 dark:shadow-[#FFC000]/10' 
                : 'bg-surface text-text-main border border-border'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              {isInCart ? 'In Cart' : 'Add to Cart'}
            </button>
            <button
              onClick={() => { onBuyNow(note); onClose(); }}
              disabled={note.quantity === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-[#fb641b] text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#fb641b]/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Buy Now
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
