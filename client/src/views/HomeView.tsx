import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../utils/api.js';
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring } from 'motion/react';
import {
  Search, ShoppingBag, BookOpen, MapPin, ArrowRight, TrendingUp, Shield, Zap,
  CheckCircle2, ShieldCheck, HelpCircle, Star, ArrowUpRight, FileText,
} from 'lucide-react';
import { NoteCard } from '../components/NoteCard';
import { useNavigate } from 'react-router-dom';
import { mapListing } from '../utils/listings';
import { useSettings } from '../contexts/SettingsContext';
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
  userName?: string;
}

// ── Mobile detection ───────────────────────────────────────────────
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

// ── FadeUp — opacity-only on mobile, y-transform on desktop ───────
const FadeUp: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children, delay = 0, className = '',
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const mobile = isMobile();
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: mobile ? 0 : 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: mobile ? 0.3 : 0.5, delay: mobile ? Math.min(delay, 0.1) : delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >{children}</motion.div>
  );
};

const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; x?: number; className?: string }> = ({
  children, delay = 0, x = 0, className = '',
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const mobile = isMobile();
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, x: mobile ? 0 : x }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: mobile ? 0.3 : 0.5, delay: mobile ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >{children}</motion.div>
  );
};

// ── Desktop-only 3D tilt ────────────────────────────────────────────
const TiltCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile()) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 800 }}
      className={className}
    >{children}</motion.div>
  );
};

// ── StepCard with 3D flip-in on scroll ─────────────────────────────
const StepCard: React.FC<{
  icon: React.ElementType; step: string; title: string; desc: string;
  accent: string; bg: string; border: string; delay: number;
}> = ({ icon: Icon, step, title, desc, accent, bg, border, delay }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const mobile = isMobile();
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: mobile ? 0 : 30, rotateX: mobile ? 0 : 12 }}
      animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ duration: mobile ? 0.28 : 0.55, delay: mobile ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformStyle: 'preserve-3d', perspective: 600 }}
    >
      <TiltCard className="group relative bg-surface rounded-3xl p-7 border border-border hover:border-primary/30 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/8 cursor-default h-full">
        <span className="absolute top-5 right-7 text-7xl font-black text-text-main/[0.04] group-hover:text-primary/8 transition-colors select-none leading-none">{step}</span>
        <div className={`inline-flex p-4 rounded-2xl ${bg} border ${border} mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1`}>
          <Icon className={`h-6 w-6 ${accent}`} />
        </div>
        <h3 className="text-lg font-black text-text-main mb-2.5">{title}</h3>
        <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
      </TiltCard>
    </motion.div>
  );
};

// ── Particle field animation ───────────────────────────────────────
const ParticleField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mobile = window.innerWidth < 768;
    const COUNT = mobile ? 50 : 120;
    const CONN = mobile ? 80 : 120;
    const PUSH = 100;

    let primary = '#003366';
    const updateColor = () => {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
      if (c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') primary = c;
    };
    updateColor();

    let W = 0, H = 0;
    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    type P = { x: number; y: number; vx: number; vy: number; r: number };
    const particles: P[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
    }));

    const draw = () => {
      // Periodic check for color if it's still fallback
      if (primary === '#003366') updateColor();

      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PUSH && dist > 0) {
          const force = (PUSH - dist) / PUSH;
          p.vx += (dx / dist) * force * 0.4;
          p.vy += (dy / dist) * force * 0.4;
        }
        p.vx *= 0.98; p.vy *= 0.98;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = primary;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONN) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.globalAlpha = (1 - d / CONN) * 0.5;
            ctx.strokeStyle = primary;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    const onMove = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};

const FloatingCardsStrip = () => (
  <section className="relative overflow-hidden bg-background border-y border-border/40" style={{ height: '260px' }}>
    <ParticleField />
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">OpenNotes Network</p>
      <p className="text-xl sm:text-2xl font-black text-text-main">Connecting students across campuses</p>
    </div>
  </section>
);


// ── Main ───────────────────────────────────────────────────────────
export const HomeView: React.FC<HomeViewProps> = ({
  onAddToCart, onBuyNow, onContactSeller, onViewDetails, checkAuth, cart = [], refreshKey, onShowGuide,
}) => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const feeInfo = settings?.platform_fee_percentage ?? 0;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const mobile = isMobile();
  const heroY = useTransform(scrollYProgress, [0, 1], mobile ? ['0%', '0%'] : ['0%', '14%']);
  const heroOpacity = useTransform(scrollYProgress, [0, mobile ? 1 : 0.6], [1, 1]);

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

      {/* ══════════ HERO ══════════ */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex items-center overflow-hidden bg-background">

        <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none will-change-transform">
          <div className="absolute inset-0 mesh-gradient opacity-60 dark:opacity-30" />
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]" style={{
            backgroundImage: `linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }} />
        </motion.div>

        {/* Glow orbs */}
        <div className="pointer-events-none absolute top-[-20%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#003366] dark:bg-[#FFC000] blur-[180px] opacity-[0.07] dark:opacity-[0.05]" />
        <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[#FFC000] dark:bg-[#003366] blur-[160px] opacity-[0.05] dark:opacity-[0.04]" />

        <motion.div style={{ opacity: heroOpacity }} className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:py-32">
          <div className="max-w-3xl">

            {/* Pills — stacked on mobile, row on sm+ */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 mb-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
                className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-2 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-sm font-bold text-text-muted">{greeting}, Dear Student 👋</span>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5"
              >
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  {feeInfo === 0 ? "Launch Promo: Free for BITSians 🚀" : "Secure Escrow Marketplace 🤝"}
                </span>
              </motion.div>
            </div>

            {/* Headline */}
            <div className="mb-5">
              {['Your study materials', 'deserve a'].map((line, li) => (
                <div key={li} className="overflow-hidden">
                  <motion.div
                    initial={{ y: '105%' }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.07 + li * 0.07, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                    className="block text-4xl sm:text-6xl md:text-7xl lg:text-[5rem] font-black text-text-main tracking-tight leading-[1.05]"
                  >{line}</motion.div>
                </div>
              ))}
              <div className="overflow-hidden">
                <motion.div
                  initial={{ y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.22, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                  className="block text-4xl sm:text-6xl md:text-7xl lg:text-[5rem] font-black tracking-tight leading-[1.05]"
                >
                  <span className="relative inline-block text-primary">
                    second life.
                    <motion.span
                      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                      transition={{ delay: 0.6, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      style={{ originX: 0 }}
                      className="absolute -bottom-1 left-0 right-0 h-[4px] bg-primary/30 rounded-full block"
                    />
                  </span>
                </motion.div>
              </div>
            </div>

            {/* Subheading */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}
              className="text-sm sm:text-base text-text-muted max-w-xl mb-7 leading-relaxed"
            >
              Buy and sell course materials, or access our free study material repository for BITS PPTs.
            </motion.p>

            {/* CTA buttons — 2 col grid on mobile, row on sm+ */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.48 }}
              className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 sm:gap-3 mb-8"
            >
              <button onClick={() => checkAuth(() => navigate('/browse'))}
                className="group col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover active:scale-[0.97] text-white px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-primary/20"
              >
                <Search className="h-4 w-4" />
                Find Notes
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
              <button onClick={() => checkAuth(() => navigate('/sell'))}
                className="inline-flex items-center justify-center gap-2 bg-surface hover:bg-background border border-border active:scale-[0.97] text-text-main px-5 py-3.5 rounded-2xl font-bold text-sm transition-all"
              >
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <span>Sell Notes</span>
              </button>
              <button onClick={() => checkAuth(() => navigate('/resources'))}
                className="inline-flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary px-5 py-3.5 rounded-2xl font-bold text-sm transition-all"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>Study Hub</span>
              </button>
              <button onClick={onShowGuide}
                className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm text-text-muted hover:text-primary hover:bg-primary/5 transition-all border border-border sm:border-transparent"
              >
                <HelpCircle className="h-4 w-4" />
                How it works
              </button>
            </motion.div>

            {/* Trust bar */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }}
              className="flex flex-wrap items-center gap-4 pt-6 border-t border-border/60"
            >
              {[
                { label: feeInfo === 0 ? '0% Platform Fee' : `${feeInfo}% Platform Fee`, icon: CheckCircle2 },
                { label: 'Escrow protected', icon: ShieldCheck },
                { label: 'All locations', icon: MapPin },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                  <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  {label}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Floating hero image — desktop only */}
          <motion.div
            initial={{ opacity: 0, x: 50, rotate: 6 }}
            animate={{ opacity: 1, x: 0, rotate: 3 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block absolute top-1/2 right-[4%] -translate-y-1/2 w-[400px] xl:w-[450px] aspect-square animate-float"
          >
            <TiltCard className="w-full h-full">
              <div className="w-full h-full rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,51,102,0.3)] border-4 border-white/80 dark:border-slate-800">
                <img src="/hero_premium.png" alt="OpenNotes study space" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#003366]/25 to-transparent" />
              </div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}
                className="absolute -left-8 top-[30%] bg-surface border border-border rounded-2xl px-4 py-3 shadow-xl flex items-center gap-2.5"
              >
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Avg Recovery</p>
                  <p className="text-sm font-black text-text-main">Recover costs</p>
                </div>
              </motion.div>
            </TiltCard>
            <div className="absolute -top-5 -right-5 w-20 h-20 bg-[#FFC000] rounded-full blur-2xl opacity-40 animate-pulse" />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
        >
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Scroll</span>
          <motion.div animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-0.5 h-5 bg-gradient-to-b from-primary/60 to-transparent rounded-full"
          />
        </motion.div>
      </section>

      {/* ══════════ 3D FLOATING CARDS STRIP ══════════ */}
      <FloatingCardsStrip />

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="py-18 sm:py-28 bg-surface/40 border-b border-border/50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-3">The Process</p>
            <h2 className="text-3xl sm:text-5xl font-black text-text-main">Three steps, zero waste</h2>
            <p className="text-text-muted mt-3 max-w-lg mx-auto text-sm sm:text-base">A peer-to-peer marketplace for open book exam materials.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-5 lg:gap-7 relative">
            <div className="hidden md:block absolute top-[4.5rem] left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px bg-gradient-to-r from-transparent via-border to-transparent pointer-events-none" />
            {[
              { icon: BookOpen, step: '01', title: 'List your materials', desc: 'Snap a photo, set a fair price, specify your meetup location and go live in minutes. PPTs, books, notes — anything goes.', accent: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800/40' },
              { icon: Search, step: '02', title: 'Buyers find you', desc: 'Juniors searching for specific course codes discover your listing and add it to their cart.', accent: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/40' },
              { icon: MapPin, step: '03', title: 'Meet & Exchange', desc: 'Coordinate a meetup at a common location. Cash changes hands at pickup.', accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/40' },
            ].map(({ icon, step, title, desc, accent, bg, border }, i) => (
              <StepCard key={step} icon={icon} step={step} title={title} desc={desc} accent={accent} bg={bg} border={border} delay={i * 0.12} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TRUST ══════════ */}
      <section className="py-14 sm:py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Shield, title: 'Escrow Protection', desc: 'Only pay the platform fee upfront. Cash changes hands at meetup — no risk.', delay: 0 },
              { icon: Zap, title: 'Instant Messaging', desc: 'Chat with sellers directly after purchase to coordinate pickup times.', delay: 0.08 },
              { icon: TrendingUp, title: 'Recover Your Costs', desc: 'Recoup what you spent on materials by selling to the next batch.', delay: 0.16 },
            ].map(({ icon: Icon, title, desc, delay }) => (
              <FadeIn key={title} delay={delay}>
                <TiltCard className="flex items-start gap-4 p-5 rounded-2xl bg-surface border border-border hover:border-primary/20 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5 h-full cursor-default">
                  <div className="p-3 bg-primary/8 dark:bg-primary/10 rounded-xl shrink-0"><Icon className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-sm font-black text-text-main mb-1.5">{title}</p>
                    <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
                  </div>
                </TiltCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ RECENT LISTINGS ══════════ */}
      <section className="py-18 sm:py-24 bg-surface/40 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="flex items-end justify-between mb-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-1.5">Fresh Listings</p>
                <h2 className="text-2xl sm:text-4xl font-black text-text-main">Notes from your peers</h2>
              </div>
              <button onClick={() => checkAuth(() => navigate('/browse'))}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-black text-primary hover:underline underline-offset-4"
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </FadeUp>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="h-8 w-8 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-text-muted animate-pulse">Fetching listings…</p>
            </div>
          ) : notes.length === 0 ? (
            <FadeUp>
              <div className="text-center py-14 text-text-muted font-medium">No listings yet — be the first to sell!</div>
            </FadeUp>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {notes.map((note, i) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.38, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                >
                  <NoteCard
                    note={note}
                    onAddToCart={onAddToCart}
                    onBuyNow={onBuyNow}
                    isInCart={cart.some(c => c.note.id === note.id)}
                    cart={cart}
                    onContactSeller={onContactSeller}
                    onViewDetails={onViewDetails}
                  />
                </motion.div>
              ))}
            </div>
          )}

          <FadeUp>
            <button onClick={() => checkAuth(() => navigate('/browse'))}
              className="w-full mt-5 sm:hidden py-4 bg-surface border border-border rounded-2xl text-sm font-bold text-text-muted flex items-center justify-center gap-2 hover:border-primary/20 transition-colors"
            >
              View all listings <ArrowRight className="h-4 w-4" />
            </button>
          </FadeUp>
        </div>
      </section>

      {/* ══════════ BOTTOM CTA ══════════ */}
      <section className="py-14 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <FadeUp>
            <div className="relative rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden bg-slate-900 dark:bg-slate-800 p-8 sm:p-16 text-center shadow-2xl shadow-slate-900/40">
              <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />
              <div className="absolute top-0 left-0 w-72 h-72 bg-[#003366] rounded-full blur-3xl opacity-60 -translate-x-1/3 -translate-y-1/3" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#FFC000]/20 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3">Final Batch of Semester?</p>
                <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">Contribute or Earn</h2>
                <p className="text-slate-400 mb-7 max-w-xl mx-auto text-sm leading-relaxed">
                  Sell your physical notes to earn back your costs, or access our free digital repository for PYQs, assignments, and BITS PPTs.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                  <button onClick={() => checkAuth(() => navigate('/sell'))}
                    className="inline-flex items-center justify-center gap-2.5 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 active:scale-[0.97] px-7 py-3.5 rounded-2xl font-black text-sm transition-all shadow-xl shadow-[#FFC000]/20"
                  >
                    <ShoppingBag className="h-4 w-4" /> List Physical Notes <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                  </button>
                  <button onClick={() => checkAuth(() => navigate('/resources'))}
                    className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white active:scale-[0.97] px-7 py-3.5 rounded-2xl font-black text-sm transition-all"
                  >
                    <BookOpen className="h-4 w-4" /> Free Study Material
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