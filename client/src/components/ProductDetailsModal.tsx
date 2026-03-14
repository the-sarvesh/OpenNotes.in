import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, MapPin, MessageCircle, ShoppingCart, Trash2, Package, Tag, Layers, Eye, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { apiRequest } from '../utils/api.js';
import { formatSemester } from '../utils/formatters';
import type { Note } from '../types';

interface ProductDetailsModalProps {
  note: Note;
  onClose: () => void;
  onAddToCart: (n: Note) => void;
  onBuyNow: (n: Note) => void;
  isInCart: boolean;
  cart: { note: any; quantity: number }[];
  onContactSeller: (sellerId: string, listingId: string, listingTitle: string) => void;
}

const conditionColor: Record<string, string> = {
  'Like New': 'text-emerald-700 bg-emerald-50 border-emerald-100',
  'Good': 'text-blue-700 bg-blue-50 border-blue-100',
  'Heavily Annotated': 'text-amber-700 bg-amber-50 border-amber-100',
};

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  note, onClose, onAddToCart, onBuyNow, isInCart, cart, onContactSeller,
}) => {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const hasTrackedView = React.useRef(false);

  const images = note.images && note.images.length > 0 ? note.images : [note.image];

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  useEffect(() => {
    // Increment view count on mount
    if (!hasTrackedView.current) {
      apiRequest(`/api/listings/${note.id}/view`, { method: 'POST' }).catch(() => {});
      hasTrackedView.current = true;
    }

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => { 
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [note.id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    setDeleting(true);
    try {
      const res = await apiRequest(`/api/admin/listings/${note.id}`, {
        method: 'DELETE',
      });
      if (res.ok) { alert('Deleted successfully'); onClose(); window.location.reload(); }
    } finally {
      setDeleting(false);
    }
  };

  const cartItem = cart.find(i => i.note.id === note.id);
  const currentQtyInCart = cartItem?.quantity || 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.98 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="bg-surface w-full max-w-3xl sm:rounded-[2.5rem] shadow-2xl flex flex-col sm:flex-row max-h-[92vh] sm:max-h-[85vh] overflow-hidden border border-border"
      >
        {/* Close Button Mobile */}
        <button onClick={onClose} className="sm:hidden absolute top-4 right-4 z-10 p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-90">
          <X className="h-5 w-5" />
        </button>

        {/* Left: Image Section */}
        <div className="relative w-full sm:w-[45%] h-72 sm:h-auto shrink-0 bg-slate-100 group/carousel">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              src={images[currentImageIndex]}
              alt={`${note.title} - ${currentImageIndex + 1}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>

          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-all sm:opacity-0 group-hover/carousel:opacity-100 active:scale-90 z-10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-all sm:opacity-0 group-hover/carousel:opacity-100 active:scale-90 z-10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full z-10">
                {images.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-all ${
                      i === currentImageIndex ? 'bg-white w-3' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent sm:hidden" />
          
          {/* Badges on image */}
          <div className="absolute bottom-4 left-5 flex flex-col gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-black text-[10px] font-black rounded-lg uppercase tracking-wider shadow-md">
              <Tag className="h-2.5 w-2.5" />{note.courseCode}
            </span>
          </div>
        </div>

        {/* Right: Content Section */}
        <div className="flex-1 flex flex-col min-w-0 bg-surface">
          <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 scrollbar-hide">
            <div className="hidden sm:flex justify-end mb-2">
              <button onClick={onClose} className="p-2 hover:bg-background rounded-xl transition-all active:scale-90 text-text-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="text-xl font-black text-text-main leading-tight">{note.title}</h2>
              <div className="flex gap-2 shrink-0">
                {note.views !== undefined && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-lg">
                    <Eye className="h-3 w-3 text-primary" />
                    <span className="text-xs font-bold text-primary">{note.views}</span>
                  </div>
                )}
                {note.rating > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{note.rating}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-fit px-3 py-1.5 bg-background border border-border rounded-full mb-6">
              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-black text-[9px] font-black">
                {note.seller.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-text-muted">{note.seller}</span>
            </div>

            {/* Logistics */}
            <div className="p-4 bg-background border border-border rounded-2xl mb-4">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 px-1">Exchange Details</p>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-main">
                    {note.deliveryMethod === 'in_person' ? 'In-person meetup' : note.deliveryMethod === 'courier' ? 'Courier / Shipping' : 'In-person or Courier'}
                  </p>
                  <p className="text-xs font-medium text-text-muted mt-0.5">{note.location}</p>
                  {note.preferredMeetupSpot && (
                    <p className="text-xs font-black text-primary mt-2">Spot: {note.preferredMeetupSpot}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Launch Promo Badge */}
            <div className="mb-6 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 shadow-sm">
              <div className="p-1 bg-emerald-500 rounded-lg text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.1em]">Limited Time: ₹0 Platform Fee! 🚀</p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="p-4 rounded-2xl bg-background border border-border">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Semester</p>
                <p className="text-sm font-bold text-text-main">{formatSemester(note.semester)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-background border border-border">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Condition</p>
                <p className="text-sm font-bold text-text-main">{note.condition}</p>
              </div>
              <div className="p-4 rounded-2xl bg-background border border-border">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Material</p>
                <p className="text-sm font-bold text-text-main">{note.materialType}</p>
              </div>
              <div className="p-4 rounded-2xl bg-background border border-border">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Availability</p>
                <p className="text-sm font-bold text-text-main">{note.quantity} left</p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-5 sm:p-8 bg-background border-t border-border space-y-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-black text-text-muted uppercase tracking-widest">Total Price</span>
              <span className="text-3xl font-black text-text-main">₹{note.price}</span>
            </div>

            <div className="flex gap-3">
              {user?.role === 'admin' && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
              
              <button
                onClick={() => onContactSeller(note.sellerId || '', note.id, note.title)}
                className="p-4 bg-surface border border-border rounded-2xl text-text-muted hover:text-primary hover:border-primary transition-all active:scale-90"
              >
                <MessageCircle className="h-5 w-5" />
              </button>

              <button
                onClick={() => onAddToCart(note)}
                disabled={note.quantity === 0 || currentQtyInCart >= note.quantity}
                className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 disabled:opacity-40 ${
                  isInCart 
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                    : 'bg-primary text-black shadow-primary/20'
                }`}
              >
                {isInCart ? 'In Cart ✓' : 'Add to Cart'}
              </button>

              {!isMobile && (
                <button
                  onClick={() => onBuyNow(note)}
                  disabled={note.quantity === 0}
                  className="flex-1 py-4 bg-primary text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-40"
                >
                  Buy Now
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
