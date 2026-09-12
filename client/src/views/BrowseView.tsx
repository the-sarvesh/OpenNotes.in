import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, SlidersHorizontal, BookOpen, BookMarked, FileText, Layers, ChevronDown, MapPin } from 'lucide-react';
import { formatSemester } from '../utils/formatters';
import { NoteCard } from '../components/NoteCard';
import { mapListing } from '../utils/listings';
import { apiRequest } from '../utils/api.js';
import { LOCATIONS, SUBJECTS_BY_SEM } from '../utils/constants';
import type { Note, View } from '../types/index.ts';
import { useSettings } from '../contexts/SettingsContext';

interface BrowseViewProps {
  onAddToCart: (n: Note) => void;
  onBuyNow: (n: Note) => void;
  onContactSeller: (sellerId: string, listingId: string, title: string) => void;
  onViewDetails: (n: Note) => void;
  checkAuth: (action: () => void) => void;
  cart: { note: Note }[];
  refreshKey?: number;
}

const SEMESTERS = ['All', 'Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6', 'Sem7', 'Sem8'];
const MATERIAL_TYPES = [
  { label: 'All', icon: Layers },
  { label: 'PPT', icon: FileText },
  { label: 'Handwritten Notes', icon: BookMarked },
  { label: 'Printed Notes', icon: BookOpen },
  { label: 'Digital Notes', icon: FileText },
  { label: 'Book', icon: BookOpen },
  { label: 'Other', icon: Layers },
];

export const BrowseView: React.FC<BrowseViewProps> = ({
  onAddToCart, onBuyNow, onContactSeller, onViewDetails, checkAuth, cart, refreshKey,
}) => {
  const { settings } = useSettings();
  const subjectCatalog = settings?.subjects_by_sem || SUBJECTS_BY_SEM;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(() => localStorage.getItem('opennotes_preferred_semester') || 'All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const requestSequence = useRef(0);

  const availableSubjects = useMemo(() => {
    if (selectedSemester !== 'All') return subjectCatalog[selectedSemester] || [];
    return [...new Set((Object.values(subjectCatalog) as string[][]).flat())].sort((a, b) => a.localeCompare(b));
  }, [selectedSemester, subjectCatalog]);

  const lastNoteElementRef = useCallback((node: HTMLDivElement) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(prev => prev + 1);
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setNotes([]); setPage(1); setHasMore(true); setLoading(true); setLoadError('');
  }, [debouncedSearch, selectedSemester, selectedType, selectedLocation, selectedSubject, sortBy, refreshKey]);

  useEffect(() => {
    if (selectedSemester === 'All') localStorage.removeItem('opennotes_preferred_semester');
    else localStorage.setItem('opennotes_preferred_semester', selectedSemester);
    if (selectedSubject !== 'All' && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject('All');
    }
  }, [selectedSemester, selectedSubject, availableSubjects]);

  useEffect(() => {
    // Fetch unique locations currently used in listings for "Normalized" filtering
    apiRequest('/api/listings/locations')
      .then(r => r.json())
      .then(setAvailableLocations)
      .catch(console.error);
  }, []);

  const fetchNotes = useCallback(async (pageNum: number) => {
    const params = new URLSearchParams();
    if (selectedSemester !== 'All') params.set('semester', selectedSemester);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedType !== 'All') {
      const typeMap: Record<string, string> = {
        'PPT': 'ppt',
        'Book': 'book',
        'Handwritten Notes': 'handwritten',
        'Printed Notes': 'printed',
        'Digital Notes': 'digital',
        'Other': 'other',
      };
      params.set('material_type', typeMap[selectedType] || selectedType.toLowerCase());
    }
    if (selectedLocation !== 'All') params.set('location', selectedLocation);
    if (selectedSubject !== 'All') params.set('subject', selectedSubject);
    params.set('sort', sortBy);
    params.set('page', pageNum.toString());
    params.set('limit', '20');

    const isFirst = pageNum === 1;
    if (isFirst) setLoading(true); else setLoadingMore(true);

    const requestId = ++requestSequence.current;
    try {
      const response = await apiRequest(`/api/listings?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load listings.');
      if (requestId !== requestSequence.current) return;
      if (Array.isArray(data)) {
        const mapped = data.map(mapListing);
        const total = data.length > 0 ? Number(data[0].total_count) || data.length : 0;
        if (isFirst || data.length > 0) setTotalResults(total);
        setNotes(prev => isFirst ? mapped : [...prev, ...mapped]);
        setHasMore(data.length > 0 && pageNum * 20 < total);
        setLoadError('');
      } else {
        if (isFirst) setNotes([]);
        setTotalResults(0);
        setHasMore(false);
      }
    } catch (error: any) {
      if (requestId !== requestSequence.current) return;
      setLoadError(error.message || 'Could not load listings. Check your connection and try again.');
      if (isFirst) setNotes([]);
      setHasMore(false);
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, selectedSemester, selectedType, selectedLocation, selectedSubject, sortBy, refreshKey]);

  useEffect(() => { void fetchNotes(page); }, [page, fetchNotes]);

  const activeFiltersCount = [selectedSemester !== 'All', selectedType !== 'All', selectedLocation !== 'All', selectedSubject !== 'All'].filter(Boolean).length;
  const clearFilters = () => { setSelectedSemester('All'); setSelectedType('All'); setSelectedLocation('All'); setSelectedSubject('All'); setSortBy('newest'); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24"
    >
      {/* ── Header ── */}
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Marketplace</p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-2xl sm:text-4xl font-black text-text-main leading-none">Browse Notes</h1>
          {!loading && notes.length > 0 && (
            <span className="text-[10px] font-black text-text-muted bg-surface border border-border px-3 py-1.5 rounded-full shrink-0">
              {totalResults} listing{totalResults !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted mt-1.5">Find materials for your upcoming open-book exams.</p>
      </div>

      {/* ── Search + filter bar ── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Course code, title, subject…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Search listings"
            className="w-full pl-10 pr-9 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-main placeholder:text-text-muted/60"
          />
          <AnimatePresence>
            {searchTerm && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
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
              ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
              : 'bg-surface border-border text-text-muted hover:border-primary/30 hover:text-text-main'
            }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 ? (
            <span className="flex items-center justify-center w-4 h-4 bg-black/20 rounded-full text-[9px] font-black">
              {activeFiltersCount}
            </span>
          ) : (
            <ChevronDown className={`h-3.5 w-3.5 transition-transform hidden sm:block ${showFilters ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>

      {/* ── Filter panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden mb-3"
          >
            <div className="p-4 bg-surface border border-border rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Material Type</p>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1 text-[10px] font-black text-primary hover:underline uppercase tracking-widest">
                    <X className="h-3 w-3" /> Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {MATERIAL_TYPES.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => setSelectedType(label)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${selectedType === label
                        ? 'bg-primary text-black border-primary shadow-sm shadow-primary/20'
                        : 'bg-background border-border text-text-muted hover:border-primary/30 hover:text-text-main'
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Location filter */}
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedLocation('All')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                      selectedLocation === 'All'
                        ? 'bg-primary text-black border-primary shadow-sm shadow-primary/20'
                        : 'bg-background border-border text-text-muted hover:border-primary/30 hover:text-text-main'
                    }`}
                  >
                    All Locations
                  </button>
                  {/* Merge standard locations with dynamic ones while avoiding duplicates */}
                  {[...new Set([...LOCATIONS.filter(l => l !== 'Other (Manual)'), ...availableLocations])]
                    .sort((a, b) => a.localeCompare(b))
                    .map(loc => (
                      <button
                        key={loc}
                        onClick={() => setSelectedLocation(loc)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                          selectedLocation === loc
                            ? 'bg-primary text-black border-primary shadow-sm shadow-primary/20'
                            : 'bg-background border-border text-text-muted hover:border-primary/30 hover:text-text-main'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border grid sm:grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Subject</span>
                  <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-background border border-border text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="All">All subjects</option>
                    {availableSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Sort by</span>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-background border border-border text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="newest">Newest first</option>
                    <option value="price_low">Price: low to high</option>
                    <option value="price_high">Price: high to low</option>
                    <option value="rating">Seller rating</option>
                    <option value="popular">Most viewed</option>
                  </select>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Semester tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-7 scrollbar-hide -mx-1 px-1">
        {SEMESTERS.map(sem => (
          <button
            key={sem}
            onClick={() => setSelectedSemester(sem)}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${selectedSemester === sem
                ? 'bg-primary text-black border-primary shadow-sm shadow-primary/15'
                : 'bg-surface border-border text-text-muted hover:border-primary/30 hover:text-text-main'
              }`}
          >
            {sem === 'All' ? 'All Sems' : formatSemester(sem)}
          </button>
        ))}
      </div>

      {/* Active filter pills */}
      <AnimatePresence>
        {activeFiltersCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 mb-5"
          >
            {selectedSemester !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-wider">
                {formatSemester(selectedSemester)}
                <button onClick={() => setSelectedSemester('All')} className="hover:opacity-70 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedType !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-wider">
                {selectedType}
                <button onClick={() => setSelectedType('All')} className="hover:opacity-70 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedLocation !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-wider">
                <MapPin className="h-3 w-3" />{selectedLocation}
                <button onClick={() => setSelectedLocation('All')} className="hover:opacity-70 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedSubject !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-wider">
                {selectedSubject}
                <button onClick={() => setSelectedSubject('All')} aria-label="Remove subject filter" className="hover:opacity-70 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <span className="h-8 w-8 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
          <p className="text-xs font-bold text-text-muted animate-pulse">Finding listings…</p>
        </div>

      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center" role="alert">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">⚠️</div>
          <p className="text-base font-black text-text-main mb-1.5">Listings could not be loaded</p>
          <p className="text-sm text-text-muted mb-5 max-w-sm leading-relaxed">{loadError}</p>
          <button onClick={() => void fetchNotes(1)} className="px-5 py-2.5 rounded-xl bg-primary text-black text-xs font-black">Try again</button>
        </div>
      ) : notes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4 text-2xl">
            🔍
          </div>
          <p className="text-base font-black text-text-main mb-1.5">No listings found</p>
          <p className="text-sm text-text-muted mb-5 max-w-xs leading-relaxed">Try adjusting your search or removing some filters.</p>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
            >
              Clear all filters
            </button>
          )}
        </motion.div>

      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
        >
          {notes.map((note, idx) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.035, 0.25), duration: 0.22 }}
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

      {/* Load more spinner */}
      {loadingMore && (
        <div className="flex justify-center py-8">
          <span className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {/* End of results */}
      {!hasMore && notes.length > 0 && (
        <div className="flex items-center gap-4 my-10">
          <div className="flex-1 h-px bg-border/50" />
          <p className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-60 shrink-0">
            End of marketplace ✨
          </p>
          <div className="flex-1 h-px bg-border/50" />
        </div>
      )}
    </motion.div>
  );
};
