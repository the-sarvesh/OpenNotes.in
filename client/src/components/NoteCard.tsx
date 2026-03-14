import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Star, Clock, MapPin, ShoppingCart, Layers, Eye } from 'lucide-react';
import { formatSemester } from '../utils/formatters';

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

export const NoteCard = ({ 
  note, 
  onAddToCart, 
  onBuyNow,
  isInCart,
  onContactSeller, 
  onViewDetails,
  cart = []
}: { 
  note: Note; 
  onAddToCart: (n: Note) => void; 
  onBuyNow?: (n: Note) => void;
  isInCart?: boolean;
  onContactSeller?: (sellerId: string, listingId: string, title: string) => void; 
  onViewDetails?: (n: Note) => void; 
  cart?: { note: any, quantity: number }[];
  key?: React.Key 
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-surface rounded-2xl border border-border shadow-sm hover:shadow-xl dark:hover:shadow-[#003366]/20 transition-all overflow-hidden group flex flex-col h-full"
    >
      <div 
        className="relative h-48 overflow-hidden bg-surface cursor-pointer"
        onClick={() => onViewDetails?.(note)}
      >
        <img 
          src={note.image} 
          alt={note.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <button 
          onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
          className="absolute top-3 left-3 p-1.5 bg-surface/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-700/50 rounded-full text-text-muted hover:text-red-500 transition-all z-10 shadow-sm"
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-primary' : ''}`} />
        </button>
        <div className="absolute top-3 right-3 bg-surface/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-700/50 px-2.5 py-1 rounded-full text-xs font-bold text-text-main flex items-center gap-1 shadow-sm">
          <Star className="h-3 w-3 fill-[#FFC000] text-[#FFC000]" />
          {note.rating}
        </div>
        <div className="absolute bottom-3 left-3 bg-[#003366]/80 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-full text-xs font-medium text-white shadow-sm">
          {note.courseCode}
        </div>
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div 
          className="flex justify-between items-start mb-2 cursor-pointer"
          onClick={() => onViewDetails?.(note)}
        >
          <h3 className="font-semibold text-text-main line-clamp-2 leading-tight hover:text-black dark:hover:text-primary transition-colors">
            {note.title}
          </h3>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {note.materialType && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-surface border border-border text-text-main shadow-sm">
              {note.materialType}
            </span>
          )}

          {note.isMultipleSubjects && note.subjects && note.subjects.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-background border border-border text-text-muted cursor-default" title="View details for all subjects">
              <Layers className="h-3 w-3 mr-1" /> {note.subjects.length} Subjects Included
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3 text-xs text-text-muted mb-4">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatSemester(note.semester)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {note.location}
          </span>
          {note.views !== undefined && (
            <span className="flex items-center gap-1 ml-auto font-bold text-[#003366] dark:text-blue-400">
              <Eye className="h-3 w-3" /> {note.views}
            </span>
          )}
        </div>
        
        <div className="mt-auto pt-4 border-t border-slate-50  flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">Condition</p>
            <p className="text-sm font-medium text-text-muted">{note.condition}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted mb-0.5">Price</p>
            <p className="text-lg font-bold text-primary">₹{note.price}</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="text-center">
            <span className={`text-[10px] font-black uppercase tracking-widest ${note.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {note.quantity > 0 ? `${note.quantity} available` : 'Out of stock'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onAddToCart(note)}
              disabled={note.quantity === 0 || (cart.find(i => i.note.id === note.id)?.quantity || 0) >= note.quantity}
              className={`flex-1 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm ${
                isInCart
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                  : 'bg-[#FFC000] text-black hover:bg-amber-400'
              } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
            >

              <ShoppingCart className="h-3.5 w-3.5" />
              {note.quantity === 0 ? 'Out of Stock' : (cart.find(i => i.note.id === note.id)?.quantity || 0) >= note.quantity ? 'Max in Cart' : isInCart ? 'In Cart' : 'Add to Cart'}
            </button>
            
            <button 
              onClick={() => onBuyNow?.(note)}
              disabled={note.quantity === 0}
              className="flex-1 py-3 bg-[#003366] dark:bg-[#FFC000] text-white dark:text-black rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
