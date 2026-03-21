import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronRight, ChevronLeft, ShoppingCart,
  PlusCircle, ShieldCheck, MapPin, CheckCircle2,
  Coins, MessageCircle, Lock, BookOpen, Compass,
  Search, Bell, ArrowUpRight, Layers, Share2
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideTab = 'welcome' | 'buying' | 'selling' | 'resources' | 'safety';

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-400',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
  purple: 'bg-purple-400',
  emerald_bg: 'bg-emerald-500/10 border-emerald-500/20',
  blue_bg: 'bg-blue-500/10    border-blue-500/20',
  amber_bg: 'bg-amber-500/10   border-amber-500/20',
  purple_bg: 'bg-purple-500/10  border-purple-500/20',
  emerald_text: 'text-emerald-400',
  blue_text: 'text-blue-400',
  amber_text: 'text-amber-400',
  purple_text: 'text-purple-400',
};

const TAB_ORDER: GuideTab[] = ['welcome', 'buying', 'selling', 'resources', 'safety'];

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('welcome');
  const { settings } = useSettings();
  const feePercent = settings?.platform_fee_percentage ?? 10;

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  const tabs: { id: GuideTab; label: string; icon: React.ReactNode }[] = [
    { id: 'welcome', label: 'Welcome', icon: <Compass className="h-3.5 w-3.5" /> },
    { id: 'buying', label: 'Buying', icon: <ShoppingCart className="h-3.5 w-3.5" /> },
    { id: 'selling', label: 'Selling', icon: <PlusCircle className="h-3.5 w-3.5" /> },
    { id: 'resources', label: 'Free Resources', icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: 'safety', label: 'Safety', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  ];

  const currentIdx = TAB_ORDER.indexOf(activeTab);
  const goNext = () => { if (currentIdx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[currentIdx + 1]); };
  const goPrev = () => { if (currentIdx > 0) setActiveTab(TAB_ORDER[currentIdx - 1]); };

  if (!isOpen) return null;

  // Shared step row
  const StepRow = ({
    icon: Icon, color, title, desc, step,
  }: { icon: React.ElementType; color: string; title: string; desc: string; step?: number }) => (
    <div className="flex gap-3.5 p-4 rounded-2xl bg-white/5 border border-white/8 hover:border-white/15 transition-colors group">
      <div className={`w-9 h-9 rounded-xl border ${COLOR_MAP[`${color}_bg`]} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon className={`h-4 w-4 ${COLOR_MAP[`${color}_text`]}`} />
      </div>
      <div className="min-w-0">
        {step !== undefined && (
          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Step {step}</span>
        )}
        <p className="font-black text-white text-sm mb-1 leading-snug">{title}</p>
        <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative bg-slate-900 w-full sm:max-w-2xl rounded-t-[2rem] sm:rounded-[2rem] flex flex-col border border-white/10 shadow-2xl shadow-black/60 overflow-hidden"
          style={{ maxHeight: '92dvh' }}
        >
          {/* Top glow line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FFC000]/50 to-transparent pointer-events-none z-10" />

          {/* Mobile drag handle */}
          <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mt-3.5 sm:hidden shrink-0" />

          {/* Header */}
          <div className="px-5 sm:px-7 pt-3 sm:pt-5 pb-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FFC000] rounded-xl shadow-lg shadow-[#FFC000]/20 shrink-0">
                <BookOpen className="h-4 w-4 text-black" />
              </div>
              <div>
                <p className="font-black text-white text-sm leading-none">How it Works</p>
                <p className="text-[10px] text-slate-500 mt-0.5">OpenNotes.in guide</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white active:scale-95"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex px-4 sm:px-6 gap-1.5 overflow-x-auto scrollbar-hide pb-3 shrink-0">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border ${activeTab === tab.id
                    ? 'bg-[#FFC000] text-black border-[#FFC000] shadow-md shadow-[#FFC000]/20'
                    : 'bg-white/5 text-slate-400 border-white/8 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {i < currentIdx && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                    <CheckCircle2 className="h-1.5 w-1.5 text-white" />
                  </span>
                )}
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {/* Mobile: show short labels */}
                <span className="sm:hidden">
                  {tab.id === 'resources' ? 'Resources' : tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-px bg-white/8 mx-5 sm:mx-7 shrink-0">
            <motion.div
              className="h-full bg-[#FFC000] rounded-full"
              animate={{ width: `${((currentIdx + 1) / TAB_ORDER.length) * 100}%` }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7 py-5">
            <AnimatePresence mode="wait">

              {/* ── WELCOME ── */}
              {activeTab === 'welcome' && (
                <motion.div key="welcome"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }} className="space-y-5"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-2">Welcome</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      Pass it forward.<br />Get paid for it.
                    </h3>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-sm">
                    OpenNotes.in is a peer-to-peer marketplace for students. Instead of discarding your
                    printed notes and annotated PPTs after exams, sell them to juniors and recover your
                    printing costs.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: 'Sustainable', desc: 'Reduce paper waste from print cycles.', color: 'emerald' },
                      { label: 'Affordable', desc: 'Buy notes at a fraction of print cost.', color: 'blue' },
                      { label: 'Trustworthy', desc: 'PIN-verified meetups protect both sides.', color: 'amber' },
                      { label: 'Simple', desc: 'List in under 2 minutes. No fluff.', color: 'purple' },
                    ].map(({ label, desc, color }) => (
                      <div key={label} className="p-4 rounded-2xl bg-white/5 border border-white/8 hover:border-white/15 transition-colors">
                        <div className={`w-2 h-2 rounded-full ${COLOR_MAP[color]} mb-2.5`} />
                        <p className="font-black text-white text-sm mb-1">{label}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── BUYING ── */}
              {activeTab === 'buying' && (
                <motion.div key="buying"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }} className="space-y-4"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-1.5">For Buyers</p>
                    <h3 className="text-xl sm:text-2xl font-black text-white">Buying Notes</h3>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { icon: Search, color: 'blue', title: 'Browse & Add to Cart', desc: 'Search by course code or title. Add what you need — you can buy from multiple sellers in one checkout.' },
                      { icon: Coins, color: 'amber', title: feePercent === 0 ? 'Reserve the Listing' : 'Pay the Platform Fee', desc: feePercent === 0 ? 'At checkout you simply reserve the notes online for free. This "unlocks" seller contact details and secures your listing slot.' : `At checkout you pay a small ${feePercent}% fee online. This "unlocks" seller contact details and secures your listing slot.` },
                      { icon: MessageCircle, color: 'emerald', title: 'Coordinate a Meetup', desc: 'Use the built-in chat to arrange a time and place — usually your exam centre or a campus common area.' },
                      { icon: CheckCircle2, color: 'purple', title: 'Inspect & Pay Cash', desc: "Check the notes in person first. If satisfied, share your 4-digit PIN (from My Orders) with the seller and pay the notes price in cash." },
                    ].map(({ icon, color, title, desc }, i) => (
                      <StepRow key={i} icon={icon} color={color} title={title} desc={desc} step={i + 1} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── SELLING ── */}
              {activeTab === 'selling' && (
                <motion.div key="selling"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }} className="space-y-4"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-1.5">For Sellers</p>
                    <h3 className="text-xl sm:text-2xl font-black text-white">Selling Notes</h3>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { icon: PlusCircle, color: 'blue', title: 'Post a Listing', desc: 'Upload clear photos. Be honest about condition — annotated, highlighted, or clean. Set a fair price (~50% of print cost).' },
                      { icon: MapPin, color: 'emerald', title: 'Set Meetup Notes', desc: 'Crucial: specify where you can meet — e.g. "Main Gate, Saturday 5 PM" so buyers can confirm before purchasing.' },
                      { icon: Bell, color: 'amber', title: 'Wait for a Buyer', desc: `You'll get a notification when someone buys your listing. You keep 100% of the notes price — the platform only takes the buyer's ${feePercent}% fee.` },
                      { icon: Lock, color: 'purple', title: 'Verify PIN & Collect', desc: "During handover, ask the buyer for their 4-digit order PIN. Once verified in your dashboard the order is complete — collect your cash." },
                    ].map(({ icon, color, title, desc }, i) => (
                      <StepRow key={i} icon={icon} color={color} title={title} desc={desc} step={i + 1} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── RESOURCES ── */}
              {activeTab === 'resources' && (
                <motion.div key="resources"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }} className="space-y-4"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-1.5">Digital Content</p>
                    <h3 className="text-xl sm:text-2xl font-black text-white">Free Resources</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Not everything needs to be physically bought. We host a completely free, crowd-sourced digital vault for the community.
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { icon: BookOpen, color: 'emerald', title: 'Previous Year Papers', desc: 'Browse through mid-sem and compre PYQs uploaded by seniors.' },
                      { icon: Layers, color: 'blue', title: 'Class PPTs & Slides', desc: 'Download official course presentations, handouts, and assignment solutions.' },
                      { icon: Share2, color: 'purple', title: 'Contribute & Help', desc: 'Have a useful PDF? Upload your own digital notes to help the next batch!' },
                    ].map(({ icon, color, title, desc }) => (
                      <StepRow key={title} icon={icon} color={color} title={title} desc={desc} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── SAFETY ── */}
              {activeTab === 'safety' && (
                <motion.div key="safety"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }} className="space-y-4"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-1.5">Trust & Safety</p>
                    <h3 className="text-xl sm:text-2xl font-black text-white">The OpenNotes Shield</h3>
                  </div>

                  {/* Escrow card */}
                  <div className="relative rounded-2xl overflow-hidden border border-[#FFC000]/20 bg-[#FFC000]/5 p-5">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-[#FFC000]/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    <div className="flex items-center gap-3 mb-3.5">
                      <div className="p-2 bg-[#FFC000]/15 rounded-xl border border-[#FFC000]/20 shrink-0">
                        <ShieldCheck className="h-4 w-4 text-[#FFC000]" />
                      </div>
                      <p className="font-black text-[#FFC000] text-xs uppercase tracking-widest">Escrow-Style Model</p>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                      A hybrid payment model so strangers can transact with full confidence:
                    </p>
                    <div className="space-y-2.5">
                      {[
                        `The ${feePercent}% platform fee ensures the buyer is serious about the purchase.`,
                        'Cash at exchange means you only pay the full price once you physically hold the notes.',
                        'PIN verification secures the transaction for the seller — no PIN, no handover.',
                      ].map((point, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#FFC000]/15 border border-[#FFC000]/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[9px] font-black text-[#FFC000]">{i + 1}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tips */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2.5">Tips for a smooth exchange</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { title: 'Meet Publicly', desc: 'Always meet at known campus locations or exam centres.' },
                        { title: 'Inspect First', desc: "Don't share your PIN until you've checked the materials." },
                        { title: 'Use the Chat', desc: 'Keep all coordination inside the app for a clear record.' },
                        { title: 'Leave a Review', desc: 'Ratings help future buyers trust good sellers.' },
                      ].map(({ title, desc }) => (
                        <div key={title} className="p-3.5 rounded-2xl bg-white/5 border border-white/8 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all">
                          <p className="text-xs font-black text-white mb-1">{title}</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-7 py-4 border-t border-white/8 bg-white/[0.02] flex items-center justify-between shrink-0">
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-0 disabled:pointer-events-none transition-all px-3 py-2.5 rounded-xl hover:bg-white/10 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {TAB_ORDER.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`rounded-full transition-all duration-300 ${i === currentIdx ? 'w-5 h-2 bg-[#FFC000]' :
                      i < currentIdx ? 'w-2 h-2 bg-emerald-500' :
                        'w-2 h-2 bg-white/20'
                    }`}
                />
              ))}
            </div>

            {activeTab === 'safety' ? (
              <button onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FFC000] hover:bg-[#e6ac00] text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#FFC000]/20 active:scale-[0.97] transition-all"
              >
                Let's Go! <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={goNext}
                className="flex items-center gap-2 bg-[#FFC000] hover:bg-[#e6ac00] text-black px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#FFC000]/20 active:scale-[0.97] transition-all"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};