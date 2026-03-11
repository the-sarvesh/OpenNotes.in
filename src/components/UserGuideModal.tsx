import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronRight, ChevronLeft, ShoppingCart,
  PlusCircle, ShieldCheck, MapPin, CheckCircle2,
  Coins, MessageCircle, Lock, BookOpen, Compass,
  Search, Bell, ArrowUpRight
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideTab = 'welcome' | 'buying' | 'selling' | 'safety';

const TAB_ORDER: GuideTab[] = ['welcome', 'buying', 'selling', 'safety'];

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('welcome');

  const tabs: { id: GuideTab; label: string; icon: React.ReactNode }[] = [
    { id: 'welcome', label: 'Welcome', icon: <Compass className="h-4 w-4" /> },
    { id: 'buying', label: 'Buying', icon: <ShoppingCart className="h-4 w-4" /> },
    { id: 'selling', label: 'Selling', icon: <PlusCircle className="h-4 w-4" /> },
    { id: 'safety', label: 'Safety', icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  const currentIdx = TAB_ORDER.indexOf(activeTab);
  const goNext = () => { if (currentIdx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[currentIdx + 1]); };
  const goPrev = () => { if (currentIdx > 0) setActiveTab(TAB_ORDER[currentIdx - 1]); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-slate-900 w-full sm:max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col max-h-[92vh] border border-white/10 shadow-2xl shadow-black/60"
        >
          {/* Top glow line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FFC000]/40 to-transparent pointer-events-none" />

          {/* Mobile drag handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-4 sm:hidden shrink-0" />

          {/* Header */}
          <div className="px-6 sm:px-8 pt-4 sm:pt-6 pb-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FFC000] rounded-xl shadow-lg shadow-[#FFC000]/20">
                <BookOpen className="h-4 w-4 text-slate-900" />
              </div>
              <div>
                <p className="font-black text-white text-base leading-none">How it Works</p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">OpenNotes.in guide</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex px-4 sm:px-6 gap-1.5 overflow-x-auto scrollbar-hide pb-3 shrink-0">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${activeTab === tab.id
                    ? 'bg-[#FFC000] text-slate-900 border-[#FFC000] shadow-lg shadow-[#FFC000]/20'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {/* Completed dot */}
                {i < currentIdx && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                    <CheckCircle2 className="h-2 w-2 text-white" />
                  </span>
                )}
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-px bg-white/10 mx-6 sm:mx-8 shrink-0">
            <motion.div
              className="h-full bg-[#FFC000] rounded-full"
              animate={{ width: `${((currentIdx + 1) / TAB_ORDER.length) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6">
            <AnimatePresence mode="wait">

              {/* ── WELCOME ───────────────────────────────── */}
              {activeTab === 'welcome' && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-6"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-2">Welcome</p>
                    <h3 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                      Pass it forward.<br />Get paid for it.
                    </h3>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-sm">
                    OpenNotes.in is a peer-to-peer marketplace for students. Instead of discarding your
                    printed notes and annotated PPTs after exams, sell them to juniors and recover your
                    printing costs.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Sustainable', desc: 'Reduce paper waste from print cycles.', color: 'emerald' },
                      { label: 'Affordable', desc: 'Buy notes at a fraction of print cost.', color: 'blue' },
                      { label: 'Trustworthy', desc: 'PIN-verified meetups protect both sides.', color: 'amber' },
                      { label: 'Simple', desc: 'List in under 2 minutes. No fluff.', color: 'purple' },
                    ].map(({ label, desc, color }) => (
                      <div key={label} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                        <div className={`w-2 h-2 rounded-full bg-${color}-400 mb-2.5`} />
                        <p className="font-black text-white text-sm mb-1">{label}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── BUYING ────────────────────────────────── */}
              {activeTab === 'buying' && (
                <motion.div
                  key="buying"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-5"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-2">For Buyers</p>
                    <h3 className="text-2xl font-black text-white">Buying Notes</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { icon: Search, color: 'blue', title: 'Browse & Add to Cart', desc: 'Search by course code or title. Add what you need — you can buy from multiple sellers in one checkout.' },
                      { icon: Coins, color: 'amber', title: 'Pay the Platform Fee', desc: 'At checkout you pay a small 10% fee online. This "unlocks" seller contact details and secures your listing slot.' },
                      { icon: MessageCircle, color: 'emerald', title: 'Coordinate a Meetup', desc: 'Use the built-in chat to arrange a time and place — usually your exam centre or a campus common area.' },
                      { icon: CheckCircle2, color: 'purple', title: 'Inspect & Pay Cash', desc: 'Check the notes in person first. If satisfied, share your 4-digit PIN (from My Orders) with the seller and pay the notes price in cash.' },
                    ].map(({ icon: Icon, color, title, desc }, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group">
                        <div className={`w-9 h-9 rounded-xl bg-${color}-500/15 border border-${color}-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <Icon className={`h-4 w-4 text-${color}-400`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Step {i + 1}</span>
                          </div>
                          <p className="font-black text-white text-sm mb-1">{title}</p>
                          <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── SELLING ───────────────────────────────── */}
              {activeTab === 'selling' && (
                <motion.div
                  key="selling"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-5"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-2">For Sellers</p>
                    <h3 className="text-2xl font-black text-white">Selling Notes</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { icon: PlusCircle, color: 'blue', title: 'Post a Listing', desc: 'Upload clear photos. Be honest about condition — annotated, highlighted, or clean. Set a fair price (~50% of print cost).' },
                      { icon: MapPin, color: 'emerald', title: 'Set Meetup Notes', desc: 'Crucial: specify where you can meet — e.g. "Main Gate, Saturday 5 PM" so buyers can confirm before purchasing.' },
                      { icon: Bell, color: 'amber', title: 'Wait for a Buyer', desc: "You'll get a notification when someone buys your listing. You keep 100% of the notes price — the platform only takes the buyer's 10% fee." },
                      { icon: Lock, color: 'purple', title: 'Verify PIN & Collect', desc: "During handover, ask the buyer for their 4-digit order PIN. Once verified in your dashboard the order is complete — collect your cash." },
                    ].map(({ icon: Icon, color, title, desc }, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group">
                        <div className={`w-9 h-9 rounded-xl bg-${color}-500/15 border border-${color}-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <Icon className={`h-4 w-4 text-${color}-400`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Step {i + 1}</span>
                          </div>
                          <p className="font-black text-white text-sm mb-1">{title}</p>
                          <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── SAFETY ────────────────────────────────── */}
              {activeTab === 'safety' && (
                <motion.div
                  key="safety"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-5"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC000] mb-2">Trust & Safety</p>
                    <h3 className="text-2xl font-black text-white">The OpenNotes Shield</h3>
                  </div>

                  {/* Escrow model card */}
                  <div className="relative rounded-2xl overflow-hidden border border-[#FFC000]/20 bg-[#FFC000]/5 p-5">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFC000]/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-[#FFC000]/20 rounded-xl border border-[#FFC000]/20">
                        <ShieldCheck className="h-5 w-5 text-[#FFC000]" />
                      </div>
                      <p className="font-black text-[#FFC000] text-sm uppercase tracking-widest">Escrow-Style Model</p>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      A hybrid payment model so strangers can transact with full confidence:
                    </p>
                    <div className="space-y-3">
                      {[
                        'The 10% platform fee ensures the buyer is serious about the purchase.',
                        'Cash at exchange means you only pay the full price once you physically hold the notes.',
                        'PIN verification secures the transaction for the seller — no PIN, no handover.',
                      ].map((point, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#FFC000]/20 border border-[#FFC000]/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[9px] font-black text-[#FFC000]">{i + 1}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tips */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Tips for a smooth exchange</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { title: 'Meet Publicly', desc: 'Always meet at known campus locations or exam centres.' },
                        { title: 'Inspect First', desc: "Don't share your PIN until you've checked the materials." },
                        { title: 'Use the Chat', desc: 'Keep all coordination inside the app for a clear record.' },
                        { title: 'Leave a Review', desc: 'Ratings help future buyers trust good sellers.' },
                      ].map(({ title, desc }) => (
                        <div key={title} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all">
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
          <div className="px-6 sm:px-8 py-5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-0 transition-all px-3 py-2 rounded-xl hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {TAB_ORDER.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`rounded-full transition-all duration-300 ${i === currentIdx
                      ? 'w-5 h-2 bg-[#FFC000]'
                      : i < currentIdx
                        ? 'w-2 h-2 bg-emerald-500'
                        : 'w-2 h-2 bg-white/20'
                    }`}
                />
              ))}
            </div>

            {activeTab === 'safety' ? (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-6 py-3 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#FFC000]/20 active:scale-[0.97] transition-all"
              >
                Let's Go! <ArrowUpRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={goNext}
                className="flex items-center gap-2 bg-[#FFC000] hover:bg-[#e6ac00] text-slate-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#FFC000]/20 active:scale-[0.97] transition-all"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};