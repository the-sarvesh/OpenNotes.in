import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../utils/api.js';
import { motion, useScroll, useTransform, useInView } from 'motion/react';
import {
  Search, ShoppingBag, BookOpen, MapPin, ArrowRight, TrendingUp, Shield, Zap,
  CheckCircle2, ShieldCheck, HelpCircle, Star, ArrowUpRight, FileText, Clock, Calendar
} from 'lucide-react';
import { NoteCard } from '../components/NoteCard';
import { useNavigate, Link } from 'react-router-dom';
import { mapListing } from '../utils/listings';
import type { Note, CartItem } from '../types/index.ts';

interface HomeViewProps {
  onAddToCart: (n: Note) => void;
  onBuyNow: (n: Note) => void;
  onContactSeller: (sellerId: string, listingId: string, title: string) => void;
  onViewDetails: (n: Note) => void;
  checkAuth: (action: () => void) => void;
  cart: CartItem[];
  refreshKey?: number;
  onShowGuide?: () => void;
  userName?: string; // optional greeting name
}


// Reusable scroll-triggered fade-up
const FadeUp: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Reusable scroll-triggered fade-in from side
const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; x?: number; className?: string }> = ({ children, delay = 0, x = 0, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({
  onAddToCart, onBuyNow, onContactSeller, onViewDetails, checkAuth, cart = [], refreshKey, onShowGuide, userName,
}) => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Parallax hero — no spring wrapper to avoid lag/jitter
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    apiRequest('/api/listings')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNotes(data.slice(0, 4).map(mapListing)); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-24 overflow-x-hidden">

      {/* ═══════════════════════════════ HERO ═══════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-[92vh] sm:min-h-screen flex items-center overflow-hidden bg-background">

        {/* Parallax mesh background */}
        <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none will-change-transform">
          <div className="absolute inset-0 mesh-gradient opacity-60 dark:opacity-30" />
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
            style={{
              backgroundImage: `linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)`,
              backgroundSize: '64px 64px',
            }}
          />
        </motion.div>

        {/* Glow orbs */}
        <div className="pointer-events-none absolute top-[-20%] right-[-5%] w-[700px] h-[700px] rounded-full bg-[#003366] dark:bg-[#FFC000] blur-[180px] opacity-[0.07] dark:opacity-[0.05]" />
        <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#FFC000] dark:bg-[#003366] blur-[160px] opacity-[0.05] dark:opacity-[0.04]" />

        <motion.div style={{ opacity: heroOpacity }} className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 will-change-transform">
          <div className="max-w-3xl">

            {/* Greeting pill */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex items-center gap-2.5 bg-surface border border-border rounded-full px-4 py-2 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-bold text-text-muted">
                  {greeting}, Dear Student 👋
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 shadow-sm"
              >
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">
                  Launch Promo: Free for BITSians 🚀
                </span>
              </motion.div>
            </div>

            {/* Main headline — staggered word reveal */}
            <div className="mb-6 overflow-hidden">
              {[
                "Your study materials",
                "deserve a",
              ].map((line, li) => (
                <motion.div
                  key={li}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.05 + li * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="block text-5xl sm:text-6xl md:text-7xl lg:text-[5rem] font-black text-text-main tracking-tight leading-[1.05]"
                >
                  {line}
                </motion.div>
              ))}
              <motion.div
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ delay: 0.22, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="block text-5xl sm:text-6xl md:text-7xl lg:text-[5rem] font-black tracking-tight leading-[1.05]"
              >
                <span className="relative inline-block text-primary">
                  second life.
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    style={{ originX: 0 }}
                    className="absolute -bottom-1 left-0 right-0 h-[5px] bg-primary/30 rounded-full block"
                  />
                </span>
              </motion.div>
            </div>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-lg sm:text-xl text-text-muted max-w-xl mb-10 leading-relaxed font-medium"
            >
              Buy and sell course materials, or access our free soft copy repository for previous year papers, assignments, and BITS PPTs.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.48, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap gap-4"
            >
              <button
                onClick={() => navigate('/browse')}
                className="group inline-flex items-center justify-center gap-2.5 bg-primary hover:bg-primary-hover active:scale-[0.97] text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-xl shadow-[#003366]/25 dark:shadow-[#FFC000]/15"
              >
                <Search className="h-5 w-5" />
                Find Notes
                <ArrowUpRight className="h-4 w-4 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
              <button
                onClick={() => checkAuth(() => navigate('/sell'))}
                className="inline-flex items-center justify-center gap-2.5 bg-surface hover:bg-background border border-border active:scale-[0.97] text-text-main px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-sm"
              >
                <ShoppingBag className="h-5 w-5" />
                Sell Your Notes
              </button>
              <button
                onClick={() => navigate('/resources')}
                className="inline-flex items-center justify-center gap-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-sm"
              >
                <FileText className="h-5 w-5" />
                Soft Copies
              </button>
              <button
                onClick={onShowGuide}
                className="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-bold text-sm text-primary hover:bg-primary/5 transition-all"
              >
                <HelpCircle className="h-4 w-4" />
                How it works
              </button>
            </motion.div>

            {/* Trust bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="flex flex-wrap items-center gap-5 mt-12 pt-10 border-t border-border/60"
            >
              {[
                { label: '0% Platform Fee', icon: CheckCircle2 },
                { label: 'Escrow protected', icon: ShieldCheck },
                { label: 'All locations', icon: MapPin },
              ].map(({ label, icon: Icon }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.05 }}
                  className="flex items-center gap-2 text-sm font-semibold text-text-muted"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  {label}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Floating hero image */}
          <motion.div
            initial={{ opacity: 0, x: 60, rotate: 6 }}
            animate={{ opacity: 1, x: 0, rotate: 3 }}
            transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block absolute top-1/2 right-[4%] -translate-y-1/2 w-[420px] xl:w-[480px] aspect-square animate-float"
          >
            <div className="w-full h-full rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,51,102,0.35)] dark:shadow-[0_40px_80px_-20px_rgba(255,192,0,0.15)] border-4 border-white/80 dark:border-slate-800 hover:rotate-0 transition-transform duration-700">
              <img src="/hero_premium.png" alt="OpenNotes.in Study Space" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003366]/30 to-transparent" />
            </div>
            {/* Floating stat chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="absolute -left-8 top-[30%] bg-surface border border-border rounded-2xl px-4 py-3 shadow-xl flex items-center gap-2.5"
            >
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Avg Recovery</p>
                <p className="text-sm font-black text-text-main">Recover costs</p>
              </div>
            </motion.div>

            <div className="absolute -top-5 -right-5 w-20 h-20 bg-[#FFC000] rounded-full blur-2xl opacity-40 animate-pulse" />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            className="w-0.5 h-6 bg-gradient-to-b from-primary/60 to-transparent rounded-full"
          />
        </motion.div>
      </section>

      {/* ═══════════════════════════════ HOW IT WORKS ═══════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-surface/40 border-y border-border/50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-16">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-3">The Process</p>
            <h2 className="text-4xl sm:text-5xl font-black text-text-main">Three steps, zero waste</h2>
            <p className="text-text-muted mt-4 max-w-lg mx-auto">A peer-to-peer marketplace for open book exam materials.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-[4.5rem] left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px bg-gradient-to-r from-transparent via-border to-transparent pointer-events-none" />

            {[
              { icon: BookOpen, step: '01', title: 'List your materials', desc: 'Snap a photo, set a fair price, specify your pickup location and go live in minutes. Books, notes, PPTs — anything goes.', accent: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800/40' },
              { icon: Search, step: '02', title: 'Buyers find you', desc: 'Juniors searching for specific course codes discover your listing and add it to their cart.', accent: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/40' },
              { icon: MapPin, step: '03', title: 'Meet & Exchange', desc: 'Coordinate a meetup at HCL, exam centres, or arrange shipping. Cash changes hands at pickup.', accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/40' },
            ].map(({ icon: Icon, step, title, desc, accent, bg, border }, i) => (
              <FadeUp key={step} delay={i * 0.12}>
                <div className="group relative bg-surface rounded-3xl p-8 border border-border hover:border-primary/20 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/8">
                  {/* Step number watermark */}
                  <span className="absolute top-5 right-7 text-7xl font-black text-text-main/[0.05] group-hover:text-primary/10 transition-colors select-none leading-none">{step}</span>

                  <div className={`inline-flex p-4 rounded-2xl ${bg} border ${border} mb-6 transition-transform duration-300 group-hover:scale-110`}>
                    <Icon className={`h-6 w-6 ${accent}`} />
                  </div>
                  <h3 className="text-xl font-black text-text-main mb-3">{title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ TRUST SIGNALS ═══════════════════════════════ */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Shield, title: 'Escrow Protection', desc: 'Only pay the platform fee upfront. Cash changes hands at meetup — no risk.', delay: 0 },
              { icon: Zap, title: 'Instant Messaging', desc: 'Chat with sellers directly after purchase to coordinate pickup times.', delay: 0.1 },
              { icon: TrendingUp, title: 'Recover Your Costs', desc: 'Recoup what you spent on materials by selling to the next batch. Something is always better than nothing.', delay: 0.2 },
            ].map(({ icon: Icon, title, desc, delay }) => (
              <FadeIn key={title} delay={delay}>
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-surface border border-border hover:border-primary/20 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary/5 h-full">
                  <div className="p-3 bg-primary/8 dark:bg-primary/10 rounded-xl shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-text-main mb-1.5">{title}</p>
                    <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ RECENT LISTINGS ═══════════════════════════════ */}
      <section className="py-24 bg-surface/40 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-2">Fresh Listings</p>
                <h2 className="text-3xl sm:text-4xl font-black text-text-main">Notes from your peers</h2>
              </div>
              <button
                onClick={() => navigate('/browse')}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-black text-primary hover:underline underline-offset-4"
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </FadeUp>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative h-10 w-10">
                <span className="absolute inset-0 rounded-full border-4 border-primary/20"></span>
                <span className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></span>
              </div>
              <p className="text-xs font-bold text-text-muted animate-pulse">Fetching listings…</p>
            </div>
          ) : notes.length === 0 ? (
            <FadeUp>
              <div className="text-center py-16 text-text-muted font-medium">No listings yet — be the first to sell!</div>
            </FadeUp>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {notes.map((note, i) => (
                <FadeUp key={note.id} delay={i * 0.08}>
                  <NoteCard
                    note={note}
                    onAddToCart={onAddToCart}
                    onBuyNow={onBuyNow}
                    isInCart={cart.some(c => c.note.id === note.id)}
                    cart={cart}
                    onContactSeller={onContactSeller}
                    onViewDetails={onViewDetails}
                  />
                </FadeUp>
              ))}
            </div>
          )}

          <FadeUp>
            <button
              onClick={() => navigate('/browse')}
              className="w-full mt-8 sm:hidden py-4 bg-surface border border-border rounded-2xl text-sm font-bold text-text-muted flex items-center justify-center gap-2 hover:border-primary/20 transition-colors"
            >
              View all listings <ArrowRight className="h-4 w-4" />
            </button>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════════════════════════ BOTTOM CTA ═══════════════════════════════ */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <FadeUp>
            <div className="relative rounded-[2.5rem] overflow-hidden bg-slate-900 dark:bg-slate-800 p-10 sm:p-16 text-center shadow-2xl shadow-slate-900/40">
              {/* Subtle dot grid */}
              <div
                className="absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
                  backgroundSize: '28px 28px',
                }}
              />
              {/* Accent glow — top left */}
              <div className="absolute top-0 left-0 w-72 h-72 bg-[#003366] rounded-full blur-3xl opacity-60 -translate-x-1/3 -translate-y-1/3" />
              {/* Accent glow — bottom right */}
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#FFC000]/20 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-4">Final Batch of Semester?</p>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Contribute or Earn</h2>
                <p className="text-slate-400 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
                  Sell your physical notes to earn back your costs, or access our free digital repository for PYQs, assignments, and BITS PPTs to help your peers.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => checkAuth(() => navigate('/sell'))}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 active:scale-[0.97] px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-xl shadow-[#FFC000]/25"
                  >
                    <ShoppingBag className="h-5 w-5" />
                    List Physical Notes
                    <ArrowUpRight className="h-4 w-4 opacity-70" />
                  </button>
                  <button
                    onClick={() => navigate('/resources')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white active:scale-[0.97] px-8 py-4 rounded-2xl font-black text-sm transition-all backdrop-blur-sm"
                  >
                    <BookOpen className="h-5 w-5" />
                    Access Soft Copies (Free)
                  </button>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

    </motion.div>
  );
};
