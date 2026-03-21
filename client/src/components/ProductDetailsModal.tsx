import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Star, MapPin, MessageCircle, ShoppingCart, Trash2, Package,
  Tag, Layers, Eye, ShieldCheck, ChevronLeft, ChevronRight,
  Share2, Maximize2, Check, CreditCard,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
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

// ── condition pill colours ────────────────────────────────────────
const conditionStyle: Record<string, string> = {
  'Like New': 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
  'Good': 'text-blue-700    dark:text-blue-300    bg-blue-50    dark:bg-blue-950/40    border-blue-200    dark:border-blue-800',
  'Fair': 'text-amber-700   dark:text-amber-300   bg-amber-50   dark:bg-amber-950/40   border-amber-200   dark:border-amber-800',
  'Heavily Annotated': 'text-orange-700  dark:text-orange-300  bg-orange-50  dark:bg-orange-950/40  border-orange-200  dark:border-orange-800',
};

// ── tiny reusable pill ────────────────────────────────────────────
const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${className}`}>
    {children}
  </span>
);

// ── info grid tile ────────────────────────────────────────────────
const Tile: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = '' }) => (
  <div className={`p-3.5 rounded-2xl bg-background border border-border ${className}`}>
    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">{label}</p>
    <p className="text-sm font-bold text-text-main leading-tight">{value}</p>
  </div>
);

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  note, onClose, onAddToCart, onBuyNow, isInCart, cart, onContactSeller,
}) => {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [copied, setCopied] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const hasTrackedView = React.useRef(false);

  const images = note.images && note.images.length > 0 ? note.images : [note.image];

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(p => (p + 1) % images.length);
  };
  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(p => (p - 1 + images.length) % images.length);
  };

  useEffect(() => {
    if (!hasTrackedView.current) {
      apiRequest(`/api/listings/${note.id}/view`, { method: 'POST' }).catch(() => { });
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
    if (!confirm('Delete this listing?')) return;
    setDeleting(true);
    try {
      const res = await apiRequest(`/api/admin/listings/${note.id}`, { method: 'DELETE' });
      if (res.ok) { alert('Deleted'); onClose(); window.location.reload(); }
    } finally {
      setDeleting(false);
    }
  };

  const cartItem = cart.find(i => i.note.id === note.id);
  const currentQtyInCart = cartItem?.quantity || 0;

  const deliveryLabel =
    note.deliveryMethod === 'in_person' ? 'In-person meetup' :
      note.deliveryMethod === 'Hand-to-Hand' ? 'In-person meetup' :
        note.deliveryMethod === 'courier' ? 'Courier / Shipping' :
          note.deliveryMethod === 'Delivery' ? 'Courier / Shipping' :
            'In-person or Courier';

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.97 }}
        transition={{ type: 'spring', damping: 32, stiffness: 480, mass: 0.7 }}
        className="bg-surface w-full max-w-3xl sm:rounded-[2rem] shadow-2xl flex flex-col sm:flex-row max-h-[92vh] sm:max-h-[86vh] overflow-hidden border border-border"
      >
        {/* ── Mobile close pill ──────────────────────────────────── */}
        <div className="sm:hidden absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30 z-10" />
        <button
          onClick={onClose}
          className="sm:hidden absolute top-4 right-4 z-10 p-2 bg-black/25 backdrop-blur-md rounded-full text-white active:scale-90 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ══════════════════════════════════════════════════════════
            LEFT — Image carousel
        ══════════════════════════════════════════════════════════ */}
        <div
          className="relative w-full sm:w-[44%] h-64 sm:h-auto shrink-0 bg-slate-100 dark:bg-slate-800 group/carousel cursor-zoom-in overflow-hidden"
          onClick={() => setShowLightbox(true)}
        >
          {/* Image */}
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              src={images[currentImageIndex]}
              alt={`${note.title} — ${currentImageIndex + 1}`}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>

          {/* Top-left action buttons */}
          <div className="absolute top-3 left-3 flex gap-1.5 z-20">
            <button
              onClick={e => { e.stopPropagation(); handleShare(); }}
              className="p-2 bg-black/25 hover:bg-black/45 backdrop-blur-md rounded-xl text-white transition-all active:scale-90"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Share2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={e => { e.stopPropagation(); setShowLightbox(true); }}
              className="p-2 bg-black/25 hover:bg-black/45 backdrop-blur-md rounded-xl text-white transition-all active:scale-90"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Carousel controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/25 hover:bg-black/45 backdrop-blur-md rounded-full text-white transition-all sm:opacity-0 group-hover/carousel:opacity-100 active:scale-90 z-10"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/25 hover:bg-black/45 backdrop-blur-md rounded-full text-white transition-all sm:opacity-0 group-hover/carousel:opacity-100 active:scale-90 z-10"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/25 backdrop-blur-md rounded-full z-10">
                {images.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentImageIndex ? 'bg-white w-4' : 'bg-white/40 w-1.5'}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Bottom gradient (mobile) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent sm:hidden pointer-events-none" />

          {/* Course code badge */}
          <div className="absolute bottom-4 left-4 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-black text-[10px] font-black rounded-xl uppercase tracking-wider shadow-lg">
              <Tag className="h-3 w-3" />{note.courseCode}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            RIGHT — Details & actions
        ══════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 bg-surface overflow-hidden">

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-7 pt-5 sm:pt-6 pb-4 scrollbar-hide space-y-4">

            {/* Desktop close */}
            <div className="hidden sm:flex justify-end -mt-1 -mr-1">
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-background rounded-xl transition-all active:scale-90 text-text-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Title + meta badges */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="text-xl font-black text-text-main leading-tight tracking-tight">{note.title}</h2>
                <div className="flex gap-1.5 shrink-0 mt-0.5">
                  {note.views !== undefined && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-lg">
                      <Eye className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-bold text-primary">{note.views}</span>
                    </span>
                  )}
                  {note.rating > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{note.rating}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Seller pill (Hidden until purchase) */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-full" title="Seller identity is revealed after purchase">
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-black text-[9px] font-black shrink-0">
                  <ShieldCheck className="h-3 w-3" />
                </div>
                <span className="text-xs font-bold text-text-muted">Seller identity hidden</span>
              </div>
            </div>

            {/* ── Exchange details ─────────────────────────────────── */}
            <div className="p-4 bg-background border border-border rounded-2xl">
              <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-3">Exchange Details</p>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-xl shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-text-main">{deliveryLabel}</p>
                  <p className="text-xs text-text-muted">{note.location}</p>
                  {note.preferredMeetupSpot && (
                    <p className="text-xs font-black text-primary mt-1">
                      📍 {note.preferredMeetupSpot}
                    </p>
                  )}
                  {note.meetupLocation && (
                    <p className="text-xs font-bold text-text-main mt-1">
                      Exact Location: {note.meetupLocation}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Description ──────────────────────────────────────── */}
            {note.description && (
              <div className="p-4 bg-background border border-border rounded-2xl">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2">About this material</p>
                <p className="text-xs text-text-muted leading-relaxed italic">"{note.description}"</p>
              </div>
            )}

            {/* ── Subjects ─────────────────────────────────────────── */}
            {note.isMultipleSubjects && note.subjects && note.subjects.length > 0 && (
              <div className="p-4 bg-background border border-border rounded-2xl">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2">Subjects Included</p>
                <div className="flex flex-wrap gap-1.5">
                  {note.subjects.map((sub, i) => (
                    <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary/5 border border-primary/20 text-primary">
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Urgency + promo ──────────────────────────────────── */}
            <div className="space-y-2">
              {note.quantity === 1 && (
                <div className="px-4 py-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 rounded-xl flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">Only 1 left!</p>
                </div>
              )}
              <div className="px-4 py-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                <div className="p-1 bg-emerald-500 rounded-lg text-white shrink-0">
                  <ShieldCheck className="h-3 w-3" />
                </div>
                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.1em]">
                  Limited Time: ₹0 Platform Fee! 🚀
                </p>
              </div>
            </div>

            {/* ── Info grid ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2.5">
              <Tile label="Semester" value={formatSemester(note.semester)} />
              <div className={`p-3.5 rounded-2xl border ${conditionStyle[note.condition] || 'bg-background border-border'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-70">Condition</p>
                <p className="text-sm font-bold leading-tight">{note.condition}</p>
              </div>
              <Tile label="Material" value={note.materialType} />
              <Tile label="Availability" value={`${note.quantity} left`} />
            </div>
          </div>

          {/* ── Footer actions ───────────────────────────────────────── */}
          <div className="px-5 sm:px-7 py-4 bg-background border-t border-border space-y-3 shrink-0">
            {/* Price line */}
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total Price</span>
              <span className="text-3xl font-black text-text-main tracking-tight">₹{note.price}</span>
            </div>

            {/* Action buttons — single row on both mobile and desktop */}
            <div className="flex gap-2">
              {user?.role === 'admin' && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-3 sm:p-3.5 bg-red-500/10 text-red-500 rounded-xl sm:rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={() => onContactSeller(note.sellerId || '', note.id, note.title)}
                className="p-3 sm:p-3.5 bg-surface border border-border rounded-xl sm:rounded-2xl text-text-muted hover:text-primary hover:border-primary transition-all active:scale-90 shrink-0"
                title="Message seller"
              >
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Add to Cart */}
              <button
                onClick={() => onAddToCart(note)}
                disabled={note.quantity === 0 || currentQtyInCart >= note.quantity}
                className={`flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.15em] transition-all shadow-lg active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5 ${isInCart
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-primary text-black shadow-primary/20 hover:bg-primary-hover'
                  }`}
              >
                {isInCart
                  ? <><Check className="h-3.5 w-3.5" /><span>In Cart</span></>
                  : <><ShoppingCart className="h-3.5 w-3.5" /><span>Add to Cart</span></>
                }
              </button>

              {/* Buy Now — always in the same row */}
              <button
                onClick={() => { onClose(); onBuyNow(note); }}
                disabled={note.quantity === 0}
                className="flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.15em] transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: '#fb641b', color: '#fff', boxShadow: '0 3px 14px rgba(251,100,27,0.3)' }}
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Buy Now</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Lightbox ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/96 flex flex-col items-center justify-center p-4 sm:p-10"
            onClick={() => setShowLightbox(false)}
          >
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-5 right-5 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[160]"
            >
              <X className="h-5 w-5" />
            </button>

            <motion.div
              className="relative w-full max-w-5xl h-full flex items-center justify-center"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {images.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-0 top-1/2 -translate-y-1/2 p-3.5 bg-white/8 hover:bg-white/15 rounded-full text-white transition-all active:scale-90 z-10">
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <button onClick={nextImage} className="absolute right-0 top-1/2 -translate-y-1/2 p-3.5 bg-white/8 hover:bg-white/15 rounded-full text-white transition-all active:scale-90 z-10">
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </>
              )}

              <img
                src={images[currentImageIndex]}
                alt="Full preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={e => e.stopPropagation()}
                referrerPolicy="no-referrer"
              />

              <p className="absolute bottom-0 left-0 right-0 text-center py-5 text-white/50 text-xs font-medium tracking-widest uppercase">
                {currentImageIndex + 1} / {images.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};