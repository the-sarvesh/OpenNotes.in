import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Star, Clock, MapPin, ShoppingCart, Layers, Eye, CreditCard } from 'lucide-react';
import { formatSemester, formatMaterialType } from '../utils/formatters';

export interface Note {
  id: string;
  title: string;
  courseCode: string;
  semester: string;
  condition: string;
  price: number;
  seller: string;
  location: string;
  image: string;
  images?: string[];
  description?: string;
  rating: number;
  quantity: number;
  materialType?: string;
  isMultipleSubjects?: boolean;
  subjects?: string[];
  sellerId?: string;
  deliveryMethod?: string;
  preferredMeetupSpot?: string;
  meetupLocation?: string;
  views?: number;
}

// ── Condition colour map ───────────────────────────────────────────
const conditionColor: Record<string, string> = {
  'Like New':          'text-emerald-600 dark:text-emerald-400',
  'Good':              'text-blue-600    dark:text-blue-400',
  'Fair':              'text-amber-600   dark:text-amber-400',
  'Heavily Annotated': 'text-orange-600  dark:text-orange-400',
};

// Mobile check
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

export const NoteCard = ({
  note,
  onAddToCart,
  onBuyNow,
  isInCart,
  onContactSeller,
  onViewDetails,
  cart = [],
}: {
  note: Note;
  onAddToCart: (n: Note) => void;
  onBuyNow?: (n: Note) => void;
  isInCart?: boolean;
  onContactSeller?: (sellerId: string, listingId: string, title: string) => void;
  onViewDetails?: (n: Note) => void;
  cart?: { note: any; quantity: number }[];
  key?: React.Key;
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const cartQty    = cart.find(i => i.note.id === note.id)?.quantity || 0;
  const maxReached = cartQty >= note.quantity;
  const outOfStock = note.quantity === 0;
  const mobile     = isMobile();

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm hover:shadow-lg hover:shadow-primary/8 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group flex flex-col h-full">
      {/* ── Image ── */}
      <div
        className="relative overflow-hidden bg-background cursor-pointer shrink-0"
        style={{ height: mobile ? '140px' : '176px' }}
        onClick={() => onViewDetails?.(note)}
      >
        <img
          src={note.image}
          alt={note.title}
          className={`w-full h-full object-cover transition-transform duration-500 ${mobile ? '' : 'group-hover:scale-105'}`}
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Favourite */}
        <button
          onClick={e => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
          className="absolute top-2 left-2 p-1.5 bg-black/30 backdrop-blur-md border border-white/20 rounded-full text-white hover:text-red-400 transition-colors z-10 active:scale-90"
        >
          <Heart className={`h-3.5 w-3.5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        {/* Rating */}
        <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full text-[9px] font-bold text-white flex items-center gap-1">
          <Star className="h-2.5 w-2.5 fill-[#FFC000] text-[#FFC000]" />
          {note.rating}
        </div>

        {/* Course code */}
        <div className="absolute bottom-2 left-2 bg-primary/90 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-black text-white tracking-wider">
          {note.courseCode}
        </div>

        {/* Views */}
        {note.views !== undefined && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/30 backdrop-blur-md border border-white/20 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white">
            <Eye className="h-2.5 w-2.5" /> {note.views}
          </div>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-[9px] font-black text-white uppercase tracking-widest bg-black/60 px-3 py-1.5 rounded-full border border-white/20">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-3 sm:p-4 flex flex-col flex-grow">

        {/* Title */}
        <h3
          className="font-bold text-xs sm:text-sm text-text-main line-clamp-2 leading-snug mb-2 cursor-pointer hover:text-primary transition-colors"
          onClick={() => onViewDetails?.(note)}
        >
          {note.title}
        </h3>

        {/* Tags */}
        {(note.materialType || (note.isMultipleSubjects && note.subjects?.length)) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {note.materialType && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-background border border-border text-text-muted">
                {formatMaterialType(note.materialType)}
              </span>
            )}
            {note.isMultipleSubjects && note.subjects && note.subjects.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-background border border-border text-text-muted">
                <Layers className="h-2.5 w-2.5" /> {note.subjects.length}
              </span>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 text-[9px] text-text-muted mb-3">
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="h-2.5 w-2.5 shrink-0" /> {formatSemester(note.semester)}
          </span>
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{note.location}</span>
          </span>
        </div>

        {/* Condition + price */}
        <div className="mt-auto pt-2.5 border-t border-border/50 flex items-center justify-between mb-2.5">
          <div>
            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">Condition</p>
            <p className={`text-[10px] font-bold ${conditionColor[note.condition] || 'text-text-muted'}`}>
              {note.condition}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">Price</p>
            <p className="text-base sm:text-lg font-black text-text-main tracking-tight">
              {note.price === 0 ? 'FREE' : `₹${Math.round(note.price)}`}
            </p>
          </div>
        </div>

        {/* Stock */}
        {!outOfStock && (
          <p className="text-[8px] font-black uppercase tracking-widest text-center mb-2 text-emerald-600 dark:text-emerald-400">
            {note.quantity} available
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={() => onAddToCart(note)}
            disabled={outOfStock || maxReached}
            className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              isInCart
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-primary text-black hover:bg-primary-hover shadow-sm shadow-primary/20'
            }`}
          >
            <ShoppingCart className="h-3 w-3 shrink-0" />
            {outOfStock ? 'OOS' : maxReached ? 'Max' : isInCart ? 'In Cart' : 'Add'}
          </button>

          <button
            onClick={() => {
              // Fix: close the product modal before navigating to checkout
              // onBuyNow is responsible for navigating — the parent should close the modal
              onBuyNow?.(note);
            }}
            disabled={outOfStock}
            className="flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#fb641b', color: '#fff', boxShadow: '0 2px 10px rgba(251,100,27,0.22)' }}
          >
            <CreditCard className="h-3 w-3 shrink-0" />
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};