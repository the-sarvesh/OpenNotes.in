import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, SlidersHorizontal, BookOpen, BookMarked, FileText, Layers } from 'lucide-react';
import { formatSemester } from '../utils/formatters';
import { NoteCard } from '../components/NoteCard';
import { mapListing } from '../utils/listings';
import type { Note, View } from '../types/index.ts';

interface BrowseViewProps {
  onAddToCart: (n: Note) => void;
  onBuyNow: (n: Note) => void;
  onContactSeller: (sellerId: string, listingId: string, title: string) => void;
  onViewDetails: (n: Note) => void;
  checkAuth: (action: () => void) => void;
  cart: { note: Note }[];
  refreshKey?: number;
}

const SEMESTERS = ['All', '1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];
const MATERIAL_TYPES = [
  { label: 'All', icon: Layers },
  { label: 'PPT', icon: FileText },
  { label: 'Handwritten Notes', icon: BookMarked },
  { label: 'Book', icon: BookOpen },
];

export const BrowseView: React.FC<BrowseViewProps> = ({ 
  onAddToCart, onBuyNow, onContactSeller, onViewDetails, checkAuth, cart, refreshKey 
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const lastNoteElementRef = useCallback((node: HTMLDivElement) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset when filters change
  useEffect(() => {
    setNotes([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
  }, [debouncedSearch, selectedSemester, selectedType, refreshKey]);

  const fetchNotes = useCallback((pageNum: number) => {
    const params = new URLSearchParams();
    if (selectedSemester !== 'All') params.set('semester', selectedSemester);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedType !== 'All') params.set('material_type', selectedType);
    params.set('page', pageNum.toString());
    params.set('limit', '20');

    const isFirstPage = pageNum === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    fetch(`/api/listings?${params}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map(mapListing);
          setNotes(prev => isFirstPage ? mapped : [...prev, ...mapped]);
          setHasMore(data.length === 20);
        } else {
          if (isFirstPage) setNotes([]);
          setHasMore(false);
        }
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [debouncedSearch, selectedSemester, selectedType, refreshKey]);

  useEffect(() => { 
    fetchNotes(page); 
  }, [page, debouncedSearch, selectedSemester, selectedType, refreshKey, fetchNotes]);

  const activeFiltersCount = [selectedSemester !== 'All', selectedType !== 'All'].filter(Boolean).length;
  const clearFilters = () => { setSelectedSemester('All'); setSelectedType('All'); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24"
    >
      {/* Header */}
      <div className="mb-7">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#003366] dark:text-blue-400 mb-1">Marketplace</p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-black text-text-main leading-none">Browse Notes</h1>
          {!loading && notes.length > 0 && (
            <span className="text-[11px] font-black text-text-muted bg-surface border border-border px-3 py-1.5 rounded-full shrink-0 mb-0.5">
              {notes.length} listing{notes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted mt-1.5">Find materials for your upcoming open-book exams.</p>
      </div>

      {/* Search + Filter bar */}
      <div className="flex gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Course code, title, subject…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/15 focus:border-[#003366] transition-all text-text-main placeholder:text-text-muted/60"
          />
          <AnimatePresence>
            {searchTerm && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-main transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all shrink-0 ${showFilters || activeFiltersCount > 0
              ? 'bg-[#003366] text-white border-[#003366] shadow-lg shadow-[#003366]/20'
              : 'bg-surface border-border text-text-muted hover:border-[#003366]/30 hover:text-text-main'
            }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="flex items-center justify-center w-4 h-4 bg-white/20 rounded-full text-[9px] font-black">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden mb-4"
          >
            <div className="p-4 sm:p-5 bg-surface border border-border rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-text-main uppercase tracking-widest">Material Type</p>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1 text-[10px] font-black text-[#003366] dark:text-blue-400 hover:underline uppercase tracking-widest">
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {MATERIAL_TYPES.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => setSelectedType(label)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${selectedType === label
                        ? 'bg-[#003366] text-white border-[#003366] shadow-md shadow-[#003366]/20'
                        : 'bg-background border-border text-text-muted hover:border-[#003366]/30 hover:text-text-main'
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Semester tabs — scrollable */}
      <div className="relative mb-7">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {SEMESTERS.map(sem => (
            <button
              key={sem}
              onClick={() => setSelectedSemester(sem)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${selectedSemester === sem
                  ? 'bg-[#003366] text-white border-[#003366] shadow-md shadow-[#003366]/15'
                  : 'bg-surface border-border text-text-muted hover:border-[#003366]/30 hover:text-text-main'
                }`}
            >
              {sem === 'All' ? 'All' : formatSemester(sem)}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="relative h-10 w-10">
            <span className="absolute inset-0 rounded-full border-4 border-primary/20"></span>
            <span className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></span>
          </div>
          <p className="text-xs font-bold text-text-muted animate-pulse">Finding listings…</p>
        </div>
      ) : notes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4 text-2xl shadow-inner">
            🔍
          </div>
          <p className="text-lg font-black text-text-main mb-1.5">No listings found</p>
          <p className="text-sm text-text-muted mb-5 max-w-xs">Try adjusting your search terms or removing some filters.</p>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs font-black text-[#003366] dark:text-blue-400 uppercase tracking-widest hover:underline"
            >
              Clear filters
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
        >
          {notes.map((note, idx) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.25 }}
              ref={idx === notes.length - 1 ? lastNoteElementRef : null}
            >
              <NoteCard
                note={note}
                onAddToCart={onAddToCart}
                onBuyNow={onBuyNow}
                isInCart={cart.some(i => i.note.id === note.id)}
                cart={cart}
                onContactSeller={onContactSeller}
                onViewDetails={onViewDetails}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Loading states for subsequent pages */}
      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="relative h-8 w-8">
            <span className="absolute inset-0 rounded-full border-2 border-primary/20"></span>
            <span className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
          </div>
        </div>
      )}

      {!hasMore && notes.length > 0 && (
        <p className="text-center text-text-muted text-[11px] font-bold mt-12 mb-6 uppercase tracking-widest opacity-60">
          ✨ You've reached the end of the marketplace
        </p>
      )}
    </motion.div>
  );
};
