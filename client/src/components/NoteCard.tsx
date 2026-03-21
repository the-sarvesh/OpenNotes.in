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
  'Like New': 'text-emerald-600 dark:text-emerald-400',
  'Good': 'text-blue-600    dark:text-blue-400',
  'Fair': 'text-amber-600   dark:text-amber-400',
  'Heavily Annotated': 'text-orange-600  dark:text-orange-400',
};

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
  const cartQty = cart.find(i => i.note.id === note.id)?.quantity || 0;
  const maxReached = cartQty >= note.quantity;
  const outOfStock = note.quantity === 0;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="bg-surface rounded-2xl border border-border shadow-sm hover:shadow-xl hover:shadow-primary/8 dark:hover:shadow-primary/10 hover:border-primary/20 transition-all duration-300 overflow-hidden group flex flex-col h-full"
    >
      {/* ── Image ── */}
      <div
        className="relative h-44 overflow-hidden bg-background cursor-pointer shrink-0"
        onClick={() => onViewDetails?.(note)}
      >
        <img
          src={note.image}
          alt={note.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Favourite button */}
        <button
          onClick={e => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
          className="absolute top-2.5 left-2.5 p-1.5 bg-black/30 backdrop-blur-md border border-white/20 rounded-full text-white hover:text-red-400 transition-all z-10 active:scale-90"
        >
          <Heart className={`h-3.5 w-3.5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        {/* Rating badge */}
        <div className="absolute top-2.5 right-2.5 bg-black/30 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
          <Star className="h-2.5 w-2.5 fill-[#FFC000] text-[#FFC000]" />
          {note.rating}
        </div>

        {/* Course code */}
        <div className="absolute bottom-2.5 left-2.5 bg-primary/90 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-black text-white tracking-wider">
          {note.courseCode}
        </div>

        {/* Views */}
        {note.views !== undefined && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/30 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full text-[9px] font-bold text-white">
            <Eye className="h-2.5 w-2.5" /> {note.views}
          </div>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-[10px] font-black text-white uppercase tracking-widest bg-black/60 px-3 py-1.5 rounded-full border border-white/20">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-4 flex flex-col flex-grow">

        {/* Title */}
        <h3
          className="font-bold text-sm text-text-main line-clamp-2 leading-snug mb-2.5 cursor-pointer hover:text-primary transition-colors"
          onClick={() => onViewDetails?.(note)}
        >
          {note.title}
        </h3>

        {/* Tags */}
        {(note.materialType || (note.isMultipleSubjects && note.subjects?.length)) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {note.materialType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-background border border-border text-text-muted">
                {formatMaterialType(note.materialType)}
              </span>
            )}
            {note.isMultipleSubjects && note.subjects && note.subjects.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-background border border-border text-text-muted" title="View details for all subjects">
                <Layers className="h-2.5 w-2.5" /> {note.subjects.length} Subjects
              </span>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] text-text-muted mb-3">
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3 shrink-0" /> {formatSemester(note.semester)}
          </span>
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{note.location}</span>
          </span>
        </div>

        {/* Condition + price */}
        <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Condition</p>
            <p className={`text-xs font-bold ${conditionColor[note.condition] || 'text-text-muted'}`}>
              {note.condition}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Price</p>
            <p className="text-xl font-black text-text-main tracking-tight">
              {note.price === 0 ? 'FREE' : `₹${Math.round(note.price)}`}
            </p>
          </div>
        </div>

        {/* Stock indicator */}
        {!outOfStock && (
          <p className="text-[9px] font-black uppercase tracking-widest text-center mb-2.5 text-emerald-600 dark:text-emerald-400">
            {note.quantity} available
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onAddToCart(note)}
            disabled={outOfStock || maxReached}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isInCart
                ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15'
                : 'bg-primary text-black hover:bg-primary-hover shadow-sm shadow-primary/20'
              }`}
          >
            <ShoppingCart className="h-3 w-3 shrink-0" />
            {outOfStock ? 'Out of Stock' : maxReached ? 'Max' : isInCart ? 'In Cart' : 'Add'}
          </button>

          <button
            onClick={() => onBuyNow?.(note)}
            disabled={outOfStock}
            className="flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#fb641b', color: '#fff', boxShadow: '0 2px 12px rgba(251,100,27,0.25)' }}
          >
            <CreditCard className="h-3 w-3 shrink-0" />
            Buy Now
          </button>
        </div>
      </div>
    </motion.div>
  );
};