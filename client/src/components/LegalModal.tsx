import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/30">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            {type === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar text-slate-300 space-y-6 text-sm leading-relaxed">
          {type === 'terms' ? (
            <>
              <section className="space-y-3">
                <h3 className="text-[#FFC000] font-bold uppercase tracking-wider text-xs">1. Platform Purpose</h3>
                <p>OpenNotes.in is a peer-to-peer marketplace designed for students to exchange study materials. We do not guarantee the accuracy or quality of the content uploaded by users.</p>
              </section>
              <section className="space-y-3">
                <h3 className="text-[#FFC000] font-bold uppercase tracking-wider text-xs">2. Ethical Usage</h3>
                <p>Users are expected to use these materials for personal study only. Do not use this platform to facilitate plagiarism or academic dishonesty.</p>
              </section>
              <section className="space-y-3">
                <h3 className="text-[#FFC000] font-bold uppercase tracking-wider text-xs">3. Trading & Fees</h3>
                <p>Currently, the platform charges 0% commission. All transactions are peer-to-peer. We are not responsible for disputes between buyers and sellers.</p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-3">
                <h3 className="text-[#FFC000] font-bold uppercase tracking-wider text-xs">1. Information We Collect</h3>
                <p>We only collect your BITS email, name, and profile information (if provided) to facilitate account creation and transactions.</p>
              </section>
              <section className="space-y-3">
                <h3 className="text-[#FFC000] font-bold uppercase tracking-wider text-xs">2. How We Use Data</h3>
                <p>Your data is used to verify your BITS identity, track your listings, and facilitate messaging between users. Your email is never shared with third parties.</p>
              </section>
              <section className="space-y-3">
                <h3 className="text-[#FFC000] font-bold uppercase tracking-wider text-xs">3. Account Deletion</h3>
                <p>You can request account deletion at any time by contacting support. Your listings will be removed, but transaction history may be kept for audit purposes.</p>
              </section>
            </>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-800/30 text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Last Updated: March 2026
          </p>
        </div>
      </motion.div>
    </div>
  );
};
