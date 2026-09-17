import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import { ProductDetailsModal } from '../components/ProductDetailsModal';
import { apiRequest } from '../utils/api';
import { mapListing } from '../utils/listings';
import type { Note } from '../types';

interface ListingViewProps {
  cart: { note: Note; quantity: number }[];
  onAddToCart: (note: Note) => void;
  onBuyNow: (note: Note) => void;
  onContactSeller: (sellerId: string, listingId: string, title: string) => void;
}

export const ListingView: React.FC<ListingViewProps> = ({
  cart,
  onAddToCart,
  onBuyNow,
  onContactSeller,
}) => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadListing = async () => {
      if (!listingId) return;
      setError('');
      try {
        const response = await apiRequest(`/api/listings/${encodeURIComponent(listingId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Listing not found');
        if (!cancelled) setNote(mapListing(data));
      } catch (loadError: any) {
        if (!cancelled) setError(loadError.message || 'This listing is no longer available.');
      }
    };

    void loadListing();
    return () => { cancelled = true; };
  }, [listingId]);

  useEffect(() => {
    if (!note) return;
    const previousTitle = document.title;
    document.title = `${note.title} | OpenNotes.in`;
    return () => { document.title = previousTitle; };
  }, [note]);

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <PackageOpen className="h-12 w-12 text-text-muted" />
        <div>
          <h1 className="text-xl font-black text-text-main">Listing unavailable</h1>
          <p className="text-sm text-text-muted mt-1">{error}</p>
        </div>
        <Link to="/browse" className="px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-black">
          Browse available notes
        </Link>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Loading listing">
        <span className="h-8 w-8 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/browse')}
          className="text-xs font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
        >
          ← Back to marketplace
        </button>
        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Shareable listing
        </span>
      </div>
      <ProductDetailsModal
        standalone
        note={note}
        onClose={() => navigate('/browse')}
        onAddToCart={onAddToCart}
        onBuyNow={onBuyNow}
        isInCart={cart.some((item) => item.note.id === note.id)}
        cart={cart}
        onContactSeller={onContactSeller}
      />
    </section>
  );
};
